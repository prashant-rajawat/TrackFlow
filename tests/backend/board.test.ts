import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/src/app';
import { connectDB } from '../../server/src/config/db';
import { UserModelAdapter } from '../../server/src/models/User';
import { WorkspaceModelAdapter } from '../../server/src/models/Workspace';
import { WorkspaceMemberModelAdapter } from '../../server/src/models/WorkspaceMember';
import { ProjectModelAdapter } from '../../server/src/models/Project';
import { ProjectMemberModelAdapter } from '../../server/src/models/ProjectMember';
import { IssueModelAdapter } from '../../server/src/models/Issue';

/**
 * NOTE: Executed against TrackFlow's explicit in-memory development/test adapter
 * because no live mongod instance is provisioned inside this container.
 */
describe('TrackFlow Phase 5: Kanban Board Status API, Security & End-to-End Backend Workflow', () => {
  const app = createApp();
  const originalEnv = { ...process.env };

  let adminUser: { token: string; user: any };
  let devUser: { token: string; user: any };
  let viewerUser: { token: string; user: any };
  let wsNonProjectMember: { token: string; user: any };
  let outsiderUser: { token: string; user: any };
  let workspaceId: string;
  let otherWorkspaceId: string;
  let projectId: string;
  let otherProjectId: string;
  let issueId: string;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    await connectDB();

    UserModelAdapter.clearMemory();
    WorkspaceModelAdapter.clearMemory();
    WorkspaceMemberModelAdapter.clearMemory();
    ProjectModelAdapter.clearMemory();
    ProjectMemberModelAdapter.clearMemory();
    IssueModelAdapter.clearMemory();

    const register = async (fullName: string, email: string) => {
      const res = await request(app).post('/api/auth/register').send({
        fullName,
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
      return res.body.data;
    };

    adminUser = await register('Alice Admin', 'alice@acme.dev');
    devUser = await register('Bob Developer', 'bob@acme.dev');
    viewerUser = await register('Vera Viewer', 'vera@acme.dev');
    wsNonProjectMember = await register('Nina NonMember', 'nina@acme.dev');
    outsiderUser = await register('Oscar Outsider', 'oscar@other.dev');

    const ws1 = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({ name: 'Acme Engineering', slug: 'acme-board' });
    workspaceId = ws1.body.data.workspace.id;

    const ws2 = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${outsiderUser.token}`)
      .send({ name: 'Other Org', slug: 'other-board' });
    otherWorkspaceId = ws2.body.data.workspace.id;

    await WorkspaceMemberModelAdapter.createMember({
      workspaceId,
      userId: devUser.user.id,
      role: 'MEMBER',
    });
    await WorkspaceMemberModelAdapter.createMember({
      workspaceId,
      userId: viewerUser.user.id,
      role: 'MEMBER',
    });
    await WorkspaceMemberModelAdapter.createMember({
      workspaceId,
      userId: wsNonProjectMember.user.id,
      role: 'MEMBER',
    });

    const proj1 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        name: 'Kanban Core',
        key: 'KAN',
        workspaceId,
        visibility: 'WORKSPACE',
      });
    projectId = proj1.body.data.project.id;

    const proj2 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${outsiderUser.token}`)
      .send({
        name: 'External App',
        key: 'EXT',
        workspaceId: otherWorkspaceId,
        visibility: 'PRIVATE',
      });
    otherProjectId = proj2.body.data.project.id;

    await ProjectMemberModelAdapter.createMember({
      projectId,
      workspaceId,
      userId: devUser.user.id,
      role: 'DEVELOPER',
    });
    await ProjectMemberModelAdapter.createMember({
      projectId,
      workspaceId,
      userId: viewerUser.user.id,
      role: 'VIEWER',
    });

    const createdIssue = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${devUser.token}`)
      .send({
        title: 'Implement Kanban drag column state persistence',
        description: 'Move issue from TODO through IN_PROGRESS to DONE.',
        type: 'FEATURE',
        priority: 'HIGH',
      });
    issueId = createdIssue.body.data.issue.id;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows authorized DEVELOPER and PROJECT_ADMIN to transition status across IN_PROGRESS, DONE, and TODO and returns persisted issue', async () => {
    // 1. Developer moves TODO -> IN_PROGRESS
    const resInProgress = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set('Authorization', `Bearer ${devUser.token}`)
      .send({ status: 'IN_PROGRESS' });

    expect(resInProgress.status).toBe(200);
    expect(resInProgress.body.data.issue.status).toBe('IN_PROGRESS');
    expect(resInProgress.body.data.issue.issueKey).toBe('KAN-1');

    // 2. Project Admin moves IN_PROGRESS -> DONE
    const resDone = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({ status: 'DONE' });

    expect(resDone.status).toBe(200);
    expect(resDone.body.data.issue.status).toBe('DONE');

    // 3. Developer moves DONE -> TODO
    const resTodo = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set('Authorization', `Bearer ${devUser.token}`)
      .send({ status: 'TODO' });

    expect(resTodo.status).toBe(200);
    expect(resTodo.body.data.issue.status).toBe('TODO');

    // Verify persisted state on reload
    const reload = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${devUser.token}`);
    expect(reload.status).toBe(200);
    expect(reload.body.data.issues[0].status).toBe('TODO');
  });

  it('rejects status updates from VIEWER with 403 and preserves original status', async () => {
    const res = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set('Authorization', `Bearer ${viewerUser.token}`)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    const check = await request(app)
      .get(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${adminUser.token}`);
    expect(check.body.data.issue.status).toBe('TODO');
  });

  it('rejects status updates from workspace non-project-member and cross-workspace outsider with 403', async () => {
    const resNonProject = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set('Authorization', `Bearer ${wsNonProjectMember.token}`)
      .send({ status: 'DONE' });
    expect(resNonProject.status).toBe(403);

    const resOutsider = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set('Authorization', `Bearer ${outsiderUser.token}`)
      .send({ status: 'DONE' });
    expect(resOutsider.status).toBe(403);
  });

  it('rejects unauthenticated requests (401), invalid status values (400), malformed IDs (400), and missing issues (404)', async () => {
    const unauth = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .send({ status: 'IN_PROGRESS' });
    expect(unauth.status).toBe(401);

    const invalidStatus = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({ status: 'ARCHIVED_CUSTOM' });
    expect(invalidStatus.status).toBe(400);

    const malformedId = await request(app)
      .patch('/api/issues/invalid_format_99/status')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(malformedId.status).toBe(400);

    const missingId = await request(app)
      .patch('/api/issues/iss_0000000000000_missing/status')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(missingId.status).toBe(404);
  });

  it('returns 503 when database is unavailable and enforces workspace/project isolation on project board queries', async () => {
    // Unauthorized project access returns 403
    const crossWorkspaceBoard = await request(app)
      .get(`/api/projects/${otherProjectId}/issues`)
      .set('Authorization', `Bearer ${adminUser.token}`);
    expect(crossWorkspaceBoard.status).toBe(403);

    // Non-project-member in same workspace receives 403
    const nonMemberBoard = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${wsNonProjectMember.token}`);
    expect(nonMemberBoard.status).toBe(403);

    // Database outage fails closed with 503
    delete process.env.VITEST;
    process.env.NODE_ENV = 'development';
    delete process.env.MONGODB_URI;
    delete process.env.ALLOW_MEMORY_DB;
    await connectDB();
    try {
      const dbDown = await request(app)
        .patch(`/api/issues/${issueId}/status`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ status: 'DONE' });
      expect(dbDown.status).toBe(503);
      expect(dbDown.body.code).toBe('DATABASE_UNAVAILABLE');
    } finally {
      process.env = { ...originalEnv };
      await connectDB();
    }
  });

  it('supports complete backend workflow integration: create -> board list -> IN_PROGRESS -> reload -> DONE -> reload', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        title: 'Integration flow ticket',
        description: 'Verify full backend persistence workflow across board reloads.',
        type: 'TASK',
        priority: 'CRITICAL',
        assigneeId: devUser.user.id,
      });
    expect(createRes.status).toBe(201);
    const ticketId = createRes.body.data.issue.id;
    expect(createRes.body.data.issue.status).toBe('TODO');

    // Step 1: Move to IN_PROGRESS
    const moveRes = await request(app)
      .patch(`/api/issues/${ticketId}/status`)
      .set('Authorization', `Bearer ${devUser.token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.data.issue.status).toBe('IN_PROGRESS');

    // Step 2: Reload workspace/project board and verify persisted status
    const reload1 = await request(app)
      .get(`/api/issues?workspaceId=${workspaceId}&projectId=${projectId}`)
      .set('Authorization', `Bearer ${devUser.token}`);
    expect(reload1.status).toBe(200);
    const found1 = reload1.body.data.issues.find((i: any) => i.id === ticketId);
    expect(found1?.status).toBe('IN_PROGRESS');

    // Step 3: Move to DONE and reload
    const moveDone = await request(app)
      .patch(`/api/issues/${ticketId}/status`)
      .set('Authorization', `Bearer ${devUser.token}`)
      .send({ status: 'DONE' });
    expect(moveDone.status).toBe(200);
    expect(moveDone.body.data.issue.status).toBe('DONE');

    const reload2 = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${devUser.token}`);
    const found2 = reload2.body.data.issues.find((i: any) => i.id === ticketId);
    expect(found2?.status).toBe('DONE');
  });
});
