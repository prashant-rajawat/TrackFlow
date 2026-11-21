import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/src/app';
import { connectDB } from '../../server/src/config/db';
import { UserModelAdapter } from '../../server/src/models/User';
import { WorkspaceModelAdapter } from '../../server/src/models/Workspace';
import { WorkspaceMemberModelAdapter } from '../../server/src/models/WorkspaceMember';
import { ProjectModelAdapter } from '../../server/src/models/Project';
import { ProjectMemberModelAdapter } from '../../server/src/models/ProjectMember';
import { IssueModelAdapter, MongooseIssueModel } from '../../server/src/models/Issue';

describe('TrackFlow Phase 4: Issue / Ticket Management, RBAC & Multi-Tenant Security', () => {
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

    // Workspace 1 (owned by Alice)
    const ws1 = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({ name: 'Acme Engineering', slug: 'acme-eng' });
    workspaceId = ws1.body.data.workspace.id;

    // Workspace 2 (owned by Oscar)
    const ws2 = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${outsiderUser.token}`)
      .send({ name: 'Other Org', slug: 'other-org' });
    otherWorkspaceId = ws2.body.data.workspace.id;

    // Add workspace members to Acme Engineering
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

    // Create main project MOB inside Acme Engineering
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        name: 'Mobile Core',
        key: 'MOB',
        description: 'iOS & Android API gateway',
        workspaceId,
        visibility: 'WORKSPACE',
      });
    projectId = projRes.body.data.project.id;

    // Add Bob (DEVELOPER) and Vera (VIEWER) to project MOB; Nina intentionally NOT added
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

    // Create secondary project API in Acme where Nina IS a member (to test global /issues scoping)
    const proj2Res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        name: 'Public API',
        key: 'API',
        workspaceId,
        visibility: 'WORKSPACE',
      });
    otherProjectId = proj2Res.body.data.project.id;
    await ProjectMemberModelAdapter.createMember({
      projectId: otherProjectId,
      workspaceId,
      userId: wsNonProjectMember.user.id,
      role: 'DEVELOPER',
    });
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await connectDB();
  });

  describe('1. Issue Creation, Validation & Mass-Assignment Protection', () => {
    it('creates an issue successfully with sequential project key and server-derived reporter/project/workspace', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${devUser.token}`)
        .send({
          title: 'Token refresh fails under slow network',
          description: 'Refresh endpoint drops session cookie during concurrent tab reload.',
          type: 'BUG',
          priority: 'HIGH',
          assigneeId: devUser.user.id,
          dueDate: '2027-01-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const issue = res.body.data.issue;
      expect(issue.issueKey).toBe('MOB-1');
      expect(issue.projectId).toBe(projectId);
      expect(issue.workspaceId).toBe(workspaceId);
      expect(issue.reporterId).toBe(devUser.user.id);
      expect(issue.assigneeId).toBe(devUser.user.id);
      expect(issue.status).toBe('TODO');
      expect(issue.priority).toBe('HIGH');
      expect(issue.type).toBe('BUG');
      expect(issue.reporter.fullName).toBe('Bob Developer');
      expect(issue.assignee.fullName).toBe('Bob Developer');
    });

    it('protects reporterId, workspaceId, projectId, and issueKey against client mass-assignment forgery', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${devUser.token}`)
        .send({
          title: 'Forged field test issue',
          description: 'Checking mass assignment protection.',
          reporterId: outsiderUser.user.id,
          workspaceId: otherWorkspaceId,
          projectId: otherProjectId,
          issueKey: 'FAKE-999',
        });

      expect(res.status).toBe(201);
      const created = res.body.data.issue;
      expect(created.reporterId).toBe(devUser.user.id);
      expect(created.workspaceId).toBe(workspaceId);
      expect(created.projectId).toBe(projectId);
      expect(created.issueKey).toBe('MOB-1');

      // Also verify PATCH ignores immutable protected fields
      const patchRes = await request(app)
        .patch(`/api/issues/${created.id}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          title: 'Updated title',
          reporterId: outsiderUser.user.id,
          workspaceId: otherWorkspaceId,
          projectId: otherProjectId,
          issueKey: 'HACK-1',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.issue.title).toBe('Updated title');
      expect(patchRes.body.data.issue.reporterId).toBe(devUser.user.id);
      expect(patchRes.body.data.issue.workspaceId).toBe(workspaceId);
      expect(patchRes.body.data.issue.projectId).toBe(projectId);
      expect(patchRes.body.data.issue.issueKey).toBe('MOB-1');
    });

    it('rejects missing or invalid title, description, priority, status, and type', async () => {
      const missingTitle = await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ description: 'Missing title' });
      expect(missingTitle.status).toBe(400);

      const shortTitle = await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ title: 'ab', description: 'Too short' });
      expect(shortTitle.status).toBe(400);

      const badPriority = await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ title: 'Valid Title', description: 'Valid desc', priority: 'URGENT' });
      expect(badPriority.status).toBe(400);

      const badType = await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ title: 'Valid Title', description: 'Valid desc', type: 'EPIC' });
      expect(badType.status).toBe(400);

      const badStatus = await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ title: 'Valid Title', description: 'Valid desc', status: 'BLOCKED' });
      expect(badStatus.status).toBe(400);
    });

    it('generates distinct sequential issue keys even under concurrent creation', async () => {
      const payloads = [1, 2, 3, 4].map((n) =>
        request(app)
          .post(`/api/projects/${projectId}/issues`)
          .set('Authorization', `Bearer ${adminUser.token}`)
          .send({
            title: `Concurrent Issue ${n}`,
            description: `Description for concurrent issue ${n}`,
          })
      );

      const responses = await Promise.all(payloads);
      responses.forEach((r) => expect(r.status).toBe(201));

      const keys = responses.map((r) => r.body.data.issue.issueKey).sort();
      expect(keys).toEqual(['MOB-1', 'MOB-2', 'MOB-3', 'MOB-4']);
    });
  });

  describe('2. Multi-Tenant Isolation & Project RBAC', () => {
    let issueId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          title: 'Baseline Project Issue',
          description: 'Used for RBAC and cross-tenant tests.',
        });
      issueId = res.body.data.issue.id;
    });

    it('rejects unauthenticated access with 401', async () => {
      const listRes = await request(app).get(`/api/projects/${projectId}/issues`);
      expect(listRes.status).toBe(401);

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .send({ title: 'No auth', description: 'Should fail' });
      expect(createRes.status).toBe(401);

      const getRes = await request(app).get(`/api/issues/${issueId}`);
      expect(getRes.status).toBe(401);
    });

    it('blocks cross-workspace outsiders from viewing, creating, updating, or deleting issues', async () => {
      const listRes = await request(app)
        .get(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${outsiderUser.token}`);
      expect(listRes.status).toBe(403);

      const getRes = await request(app)
        .get(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${outsiderUser.token}`);
      expect(getRes.status).toBe(403);

      const patchRes = await request(app)
        .patch(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${outsiderUser.token}`)
        .send({ title: 'Hacked' });
      expect(patchRes.status).toBe(403);

      const delRes = await request(app)
        .delete(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${outsiderUser.token}`);
      expect(delRes.status).toBe(403);
    });

    it('denies workspace members who do not belong to the project from accessing or creating project issues', async () => {
      // Nina is a member of Acme Engineering workspace & project API, NOT project MOB
      const listRes = await request(app)
        .get(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${wsNonProjectMember.token}`);
      expect(listRes.status).toBe(403);

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${wsNonProjectMember.token}`)
        .send({ title: 'Unauthorized project issue', description: 'Should be rejected' });
      expect(createRes.status).toBe(403);

      const getRes = await request(app)
        .get(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${wsNonProjectMember.token}`);
      expect(getRes.status).toBe(403);
    });

    it('enforces read-only access for VIEWER on project issues', async () => {
      const listRes = await request(app)
        .get(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${viewerUser.token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.permissions.canCreate).toBe(false);
      expect(listRes.body.data.permissions.canDelete).toBe(false);

      const getRes = await request(app)
        .get(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${viewerUser.token}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.permissions.canUpdate).toBe(false);

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${viewerUser.token}`)
        .send({ title: 'Viewer attempt', description: 'Denied' });
      expect(createRes.status).toBe(403);

      const patchRes = await request(app)
        .patch(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${viewerUser.token}`)
        .send({ title: 'Viewer edit' });
      expect(patchRes.status).toBe(403);

      const statusRes = await request(app)
        .patch(`/api/issues/${issueId}/status`)
        .set('Authorization', `Bearer ${viewerUser.token}`)
        .send({ status: 'DONE' });
      expect(statusRes.status).toBe(403);

      const delRes = await request(app)
        .delete(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${viewerUser.token}`);
      expect(delRes.status).toBe(403);
    });

    it('allows DEVELOPER to update, assign, change status/priority, but denies issue deletion', async () => {
      const updateRes = await request(app)
        .patch(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${devUser.token}`)
        .send({ title: 'Updated by Developer', priority: 'CRITICAL' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.issue.title).toBe('Updated by Developer');
      expect(updateRes.body.data.issue.priority).toBe('CRITICAL');

      const statusRes = await request(app)
        .patch(`/api/issues/${issueId}/status`)
        .set('Authorization', `Bearer ${devUser.token}`)
        .send({ status: 'IN_PROGRESS' });
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.issue.status).toBe('IN_PROGRESS');

      const prioRes = await request(app)
        .patch(`/api/issues/${issueId}/priority`)
        .set('Authorization', `Bearer ${devUser.token}`)
        .send({ priority: 'LOW' });
      expect(prioRes.status).toBe(200);
      expect(prioRes.body.data.issue.priority).toBe('LOW');

      const delRes = await request(app)
        .delete(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${devUser.token}`);
      expect(delRes.status).toBe(403);
      expect(delRes.body.message).toContain('project administrators');
    });

    it('allows PROJECT_ADMIN to delete an issue permanently', async () => {
      const delRes = await request(app)
        .delete(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${adminUser.token}`);
      expect(delRes.status).toBe(200);

      const afterGet = await request(app)
        .get(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${adminUser.token}`);
      expect(afterGet.status).toBe(404);
    });

    it('scopes global GET /api/issues to accessible projects in workspace only', async () => {
      // Create an issue in project API (where Nina IS a member)
      const apiIssueRes = await request(app)
        .post(`/api/projects/${otherProjectId}/issues`)
        .set('Authorization', `Bearer ${wsNonProjectMember.token}`)
        .send({ title: 'API Rate Limit Bug', description: 'Rate limit misconfigured.' });
      expect(apiIssueRes.status).toBe(201);

      // Nina calls GET /api/issues?workspaceId=... -> only sees API issues, never MOB issues
      const ninaList = await request(app)
        .get(`/api/issues?workspaceId=${workspaceId}`)
        .set('Authorization', `Bearer ${wsNonProjectMember.token}`);
      expect(ninaList.status).toBe(200);
      expect(ninaList.body.data.issues.length).toBe(1);
      expect(ninaList.body.data.issues[0].projectId).toBe(otherProjectId);
    });
  });

  describe('3. Assignee Validation, Cascade Cleanup & Error Handling', () => {
    let issueId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ title: 'Assignee Validation Target', description: 'Check member rules.' });
      issueId = res.body.data.issue.id;
    });

    it('allows assigning an active project member and unassigning back to null', async () => {
      const assignRes = await request(app)
        .patch(`/api/issues/${issueId}/assignee`)
        .set('Authorization', `Bearer ${devUser.token}`)
        .send({ assigneeId: devUser.user.id });
      expect(assignRes.status).toBe(200);
      expect(assignRes.body.data.issue.assigneeId).toBe(devUser.user.id);
      expect(assignRes.body.data.issue.assignee.fullName).toBe('Bob Developer');

      const unassignRes = await request(app)
        .patch(`/api/issues/${issueId}/assignee`)
        .set('Authorization', `Bearer ${devUser.token}`)
        .send({ assigneeId: null });
      expect(unassignRes.status).toBe(200);
      expect(unassignRes.body.data.issue.assigneeId).toBeNull();
      expect(unassignRes.body.data.issue.assignee).toBeNull();
    });

    it('rejects assigning a workspace member who is NOT a member of the project or an outsider', async () => {
      const nonProjectAssign = await request(app)
        .patch(`/api/issues/${issueId}/assignee`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ assigneeId: wsNonProjectMember.user.id });
      expect(nonProjectAssign.status).toBe(400);
      expect(nonProjectAssign.body.message).toContain('member of this project');

      const outsiderAssign = await request(app)
        .patch(`/api/issues/${issueId}/assignee`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ assigneeId: outsiderUser.user.id });
      expect(outsiderAssign.status).toBe(400);
      expect(outsiderAssign.body.message).toContain('member of the workspace');
    });

    it('returns 400 on malformed ID format and 404 on valid non-existent IDs', async () => {
      const badProjectRes = await request(app)
        .get('/api/projects/invalid-id/issues')
        .set('Authorization', `Bearer ${adminUser.token}`);
      expect(badProjectRes.status).toBe(400);

      const badIssueRes = await request(app)
        .get('/api/issues/invalid-issue-id')
        .set('Authorization', `Bearer ${adminUser.token}`);
      expect(badIssueRes.status).toBe(400);

      const missingIssueRes = await request(app)
        .get('/api/issues/64b0f0f0f0f0f0f0f0f0f0f0')
        .set('Authorization', `Bearer ${adminUser.token}`);
      expect(missingIssueRes.status).toBe(404);
    });

    it('cascade deletes project issues when a project is deleted', async () => {
      expect(await IssueModelAdapter.countByProject(projectId)).toBe(1);

      const delProj = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminUser.token}`);
      expect(delProj.status).toBe(200);
      expect(await IssueModelAdapter.countByProject(projectId)).toBe(0);
    });

    it('fails closed (503) when database is unavailable and defines Mongoose Issue indexes', async () => {
      // Verify Mongoose schema definition & indexes
      const indexes = MongooseIssueModel.schema.indexes();
      const indexFields = indexes.map(([spec]) => Object.keys(spec).join(','));
      expect(indexFields).toContain('issueKey');
      expect(indexFields).toContain('projectId,createdAt');
      expect(indexFields).toContain('workspaceId,createdAt');

      // Simulate disconnected dev DB (no ALLOW_MEMORY_DB, no MONGODB_URI)
      delete process.env.VITEST;
      process.env.NODE_ENV = 'development';
      delete process.env.MONGODB_URI;
      delete process.env.ALLOW_MEMORY_DB;
      await connectDB();

      const unavailableRes = await request(app)
        .get(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${adminUser.token}`);
      expect(unavailableRes.status).toBe(503);
      expect(unavailableRes.body.code).toBe('DATABASE_UNAVAILABLE');

      await expect(IssueModelAdapter.findByProject(projectId)).rejects.toThrow(
        'Database service unavailable'
      );
    });
  });
});
