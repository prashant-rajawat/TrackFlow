import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/src/app';
import { connectDB } from '../../server/src/config/db';
import { UserModelAdapter } from '../../server/src/models/User';
import { WorkspaceModelAdapter } from '../../server/src/models/Workspace';
import { WorkspaceMemberModelAdapter } from '../../server/src/models/WorkspaceMember';
import { ProjectModelAdapter } from '../../server/src/models/Project';
import { ProjectMemberModelAdapter } from '../../server/src/models/ProjectMember';
import { IssueModelAdapter, MongooseIssueModel } from '../../server/src/models/Issue';

describe('TrackFlow Phase 7: Issue Search, Filtering, Sorting, Pagination & Security', () => {
  const app = createApp();
  const originalEnv = { ...process.env };

  let alice: { token: string; user: any };
  let bob: { token: string; user: any };
  let nina: { token: string; user: any };
  let oscar: { token: string; user: any };

  let ws1Id: string;
  let ws2Id: string;
  let projMobId: string;
  let projApiId: string;
  let projSecretId: string;
  let projOtherWsId: string;

  const utcDayOffset = (daysOffset: number, hour = 12): Date => {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysOffset, hour, 0, 0, 0)
    );
  };

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

    alice = await register('Alice Admin', 'alice@acme.dev');
    bob = await register('Bob Developer', 'bob@acme.dev');
    nina = await register('Nina Limited', 'nina@acme.dev');
    oscar = await register('Oscar Outsider', 'oscar@other.dev');

    // Workspace 1
    const ws1 = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Acme Engineering', slug: 'acme-eng' });
    ws1Id = ws1.body.data.workspace.id;

    await WorkspaceMemberModelAdapter.createMember({
      workspaceId: ws1Id,
      userId: bob.user.id,
      role: 'MEMBER',
    });
    await WorkspaceMemberModelAdapter.createMember({
      workspaceId: ws1Id,
      userId: nina.user.id,
      role: 'MEMBER',
    });

    // Workspace 2
    const ws2 = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${oscar.token}`)
      .send({ name: 'Other Corp', slug: 'other-corp' });
    ws2Id = ws2.body.data.workspace.id;

    // Projects in ws1: MOB (alice, bob, nina), API (alice, bob), SECRET (alice only)
    const mobRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Mobile Core', key: 'MOB', workspaceId: ws1Id, visibility: 'WORKSPACE' });
    projMobId = mobRes.body.data.project.id;

    const apiRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Public API', key: 'API', workspaceId: ws1Id, visibility: 'WORKSPACE' });
    projApiId = apiRes.body.data.project.id;

    const secretRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Vault Core', key: 'SEC', workspaceId: ws1Id, visibility: 'PRIVATE' });
    projSecretId = secretRes.body.data.project.id;

    await ProjectMemberModelAdapter.createMember({
      projectId: projMobId,
      workspaceId: ws1Id,
      userId: bob.user.id,
      role: 'DEVELOPER',
    });
    await ProjectMemberModelAdapter.createMember({
      projectId: projMobId,
      workspaceId: ws1Id,
      userId: nina.user.id,
      role: 'VIEWER',
    });
    await ProjectMemberModelAdapter.createMember({
      projectId: projApiId,
      workspaceId: ws1Id,
      userId: bob.user.id,
      role: 'DEVELOPER',
    });

    // Project in ws2
    const otherProjRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${oscar.token}`)
      .send({ name: 'External App', key: 'EXT', workspaceId: ws2Id, visibility: 'WORKSPACE' });
    projOtherWsId = otherProjRes.body.data.project.id;

    // Seed diverse deterministic issues
    await IssueModelAdapter.create({
      title: 'Fix [OAuth] regex (callback) crash',
      description: 'Auth session cookie drops when state contains special chars.*',
      issueKey: 'MOB-1',
      projectId: projMobId,
      workspaceId: ws1Id,
      reporterId: alice.user.id,
      assigneeId: bob.user.id,
      type: 'BUG',
      priority: 'CRITICAL',
      status: 'TODO',
      dueDate: utcDayOffset(-3), // overdue
      createdAt: utcDayOffset(-20, 10),
      updatedAt: utcDayOffset(-1, 10),
    });

    await IssueModelAdapter.create({
      title: 'alpha telemetry pipeline',
      description: 'Stream metrics cleanly without memory leaks.',
      issueKey: 'MOB-2',
      projectId: projMobId,
      workspaceId: ws1Id,
      reporterId: bob.user.id,
      assigneeId: null, // unassigned
      type: 'FEATURE',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: utcDayOffset(0, 18), // due today
      createdAt: utcDayOffset(-5, 9),
      updatedAt: utcDayOffset(0, 8),
    });

    await IssueModelAdapter.create({
      title: 'Zeta button alignment',
      description: 'Polish responsive table spacing on mobile.',
      issueKey: 'MOB-3',
      projectId: projMobId,
      workspaceId: ws1Id,
      reporterId: nina.user.id,
      assigneeId: alice.user.id,
      type: 'TASK',
      priority: 'LOW',
      status: 'DONE',
      dueDate: utcDayOffset(5), // next 7 days
      createdAt: utcDayOffset(-2, 14),
      updatedAt: utcDayOffset(-2, 15),
    });

    await IssueModelAdapter.create({
      title: 'Beta rate-limit header',
      description: 'Expose X-RateLimit-Remaining header on gateway.',
      issueKey: 'API-1',
      projectId: projApiId,
      workspaceId: ws1Id,
      reporterId: alice.user.id,
      assigneeId: bob.user.id,
      type: 'FEATURE',
      priority: 'MEDIUM',
      status: 'TODO',
      dueDate: utcDayOffset(20), // next 30 days
      createdAt: utcDayOffset(0, 6), // today
      updatedAt: utcDayOffset(0, 11), // newest updated
    });

    await IssueModelAdapter.create({
      title: 'Archive legacy webhook endpoint',
      description: 'Remove deprecated v1 webhook route.',
      issueKey: 'API-2',
      projectId: projApiId,
      workspaceId: ws1Id,
      reporterId: bob.user.id,
      assigneeId: null,
      type: 'TASK',
      priority: 'LOW',
      status: 'IN_PROGRESS',
      dueDate: null, // no due date
      createdAt: utcDayOffset(-45, 10),
      updatedAt: utcDayOffset(-10, 10),
    });

    // Restricted project issue (only Alice is member)
    await IssueModelAdapter.create({
      title: 'Secret vault key rotation',
      description: 'Rotate HSM master token.',
      issueKey: 'SEC-1',
      projectId: projSecretId,
      workspaceId: ws1Id,
      reporterId: alice.user.id,
      assigneeId: alice.user.id,
      type: 'TASK',
      priority: 'CRITICAL',
      status: 'TODO',
      dueDate: utcDayOffset(-1),
      createdAt: utcDayOffset(-1, 10),
      updatedAt: utcDayOffset(0, 12),
    });

    // Cross-tenant issue in ws2
    await IssueModelAdapter.create({
      title: 'Other Org Secret [OAuth] Bug',
      description: 'Belongs strictly to Oscar workspace.',
      issueKey: 'EXT-1',
      projectId: projOtherWsId,
      workspaceId: ws2Id,
      reporterId: oscar.user.id,
      assigneeId: oscar.user.id,
      type: 'BUG',
      priority: 'CRITICAL',
      status: 'TODO',
      dueDate: utcDayOffset(-2),
      createdAt: utcDayOffset(0, 10),
      updatedAt: utcDayOffset(0, 12),
    });
  });

  it('1-3. searches case-insensitively across title, description, issueKey, assignee/reporter, and escapes special regex characters', async () => {
    // 1. Search by title with regex special characters + surrounding whitespace
    const titleRes = await request(app)
      .get(`/api/projects/${projMobId}/issues`)
      .query({ search: '  [oauth] regex (callback)  ' })
      .set('Authorization', `Bearer ${alice.token}`);
    expect(titleRes.status).toBe(200);
    expect(titleRes.body.data.issues.map((i: any) => i.issueKey)).toEqual(['MOB-1']);

    // Regex metacharacters alone do not match unrelated issues or crash
    const regexRes = await request(app)
      .get(`/api/projects/${projMobId}/issues`)
      .query({ search: '.*+?^$' })
      .set('Authorization', `Bearer ${alice.token}`);
    expect(regexRes.status).toBe(200);
    expect(regexRes.body.data.issues).toEqual([]);

    // 2. Search by description & issueKey
    const descRes = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, search: 'x-ratelimit-remaining' })
      .set('Authorization', `Bearer ${alice.token}`);
    expect(descRes.status).toBe(200);
    expect(descRes.body.data.issues.map((i: any) => i.issueKey)).toEqual(['API-1']);

    const keyRes = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, search: 'mob-2' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(keyRes.status).toBe(200);
    expect(keyRes.body.data.issues.map((i: any) => i.issueKey)).toEqual(['MOB-2']);

    // 3. Search by reporter name/email & assignee name/email
    const reporterRes = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, search: 'nina@acme.dev' })
      .set('Authorization', `Bearer ${alice.token}`);
    expect(reporterRes.status).toBe(200);
    expect(reporterRes.body.data.issues.map((i: any) => i.issueKey)).toEqual(['MOB-3']);

    const assigneeOrReporterRes = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, search: 'bob developer' })
      .set('Authorization', `Bearer ${alice.token}`);
    expect(assigneeOrReporterRes.status).toBe(200);
    expect(assigneeOrReporterRes.body.data.issues.map((i: any) => i.issueKey).sort()).toEqual(
      ['API-1', 'API-2', 'MOB-1', 'MOB-2']
    );
  });

  it('4-10. filters by single and multi-value status, priority, type, assignee (including UNASSIGNED), reporter, and project', async () => {
    // 4-5. Single & multi-value status
    const multiStatus = await request(app)
      .get(`/api/projects/${projMobId}/issues`)
      .query({ status: 'TODO,DONE' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(multiStatus.status).toBe(200);
    expect(multiStatus.body.data.issues.map((i: any) => i.issueKey).sort()).toEqual(['MOB-1', 'MOB-3']);

    // 6. Multi-value priority
    const multiPriority = await request(app)
      .get(`/api/projects/${projMobId}/issues`)
      .query({ priority: ['CRITICAL', 'LOW'] })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(multiPriority.status).toBe(200);
    expect(multiPriority.body.data.issues.map((i: any) => i.issueKey).sort()).toEqual(['MOB-1', 'MOB-3']);

    // 7. Type filter
    const typeRes = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, type: 'FEATURE' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(typeRes.status).toBe(200);
    expect(typeRes.body.data.issues.map((i: any) => i.issueKey).sort()).toEqual(['API-1', 'MOB-2']);

    // 8. Assignee including UNASSIGNED
    const unassignedRes = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, assigneeId: 'UNASSIGNED' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(unassignedRes.status).toBe(200);
    expect(unassignedRes.body.data.issues.map((i: any) => i.issueKey).sort()).toEqual(['API-2', 'MOB-2']);

    const unassignedOrAlice = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, assigneeId: `UNASSIGNED,${alice.user.id}` })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(unassignedOrAlice.status).toBe(200);
    expect(unassignedOrAlice.body.data.issues.map((i: any) => i.issueKey).sort()).toEqual(['API-2', 'MOB-2', 'MOB-3']);

    // 9. Reporter filter
    const reporterRes = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, reporterId: bob.user.id })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(reporterRes.status).toBe(200);
    expect(reporterRes.body.data.issues.map((i: any) => i.issueKey).sort()).toEqual(['API-2', 'MOB-2']);

    // 10. Project filter on workspace endpoint + combined AND filters
    const combinedRes = await request(app)
      .get(`/api/issues`)
      .query({
        workspaceId: ws1Id,
        projectId: `${projMobId},${projApiId}`,
        type: 'FEATURE',
        status: 'TODO',
      })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(combinedRes.status).toBe(200);
    expect(combinedRes.body.data.issues.map((i: any) => i.issueKey)).toEqual(['API-1']);
    expect(combinedRes.body.data.appliedFilters).toEqual({
      status: ['TODO'],
      type: ['FEATURE'],
      projectId: [projMobId, projApiId],
    });
  });

  it('11-12. filters by dueDatePreset, custom dueDateFrom/dueDateTo, and createdFrom/createdTo ranges', async () => {
    const overdue = await request(app)
      .get(`/api/projects/${projMobId}/issues`)
      .query({ dueDatePreset: 'overdue' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(overdue.body.data.issues.map((i: any) => i.issueKey)).toEqual(['MOB-1']);

    const dueToday = await request(app)
      .get(`/api/projects/${projMobId}/issues`)
      .query({ dueDatePreset: 'due_today' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(dueToday.body.data.issues.map((i: any) => i.issueKey)).toEqual(['MOB-2']);

    const next7 = await request(app)
      .get(`/api/projects/${projMobId}/issues`)
      .query({ dueDatePreset: 'next_7_days' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(next7.body.data.issues.map((i: any) => i.issueKey).sort()).toEqual(['MOB-2', 'MOB-3']);

    const next30 = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, dueDatePreset: 'next_30_days' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(next30.body.data.issues.map((i: any) => i.issueKey).sort()).toEqual(['API-1', 'MOB-2', 'MOB-3']);

    const noDue = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, dueDatePreset: 'no_due_date' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(noDue.body.data.issues.map((i: any) => i.issueKey)).toEqual(['API-2']);

    const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
    const customDue = await request(app)
      .get(`/api/issues`)
      .query({
        workspaceId: ws1Id,
        dueDateFrom: toDateStr(utcDayOffset(4)),
        dueDateTo: toDateStr(utcDayOffset(25)),
      })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(customDue.body.data.issues.map((i: any) => i.issueKey).sort()).toEqual(['API-1', 'MOB-3']);

    const createdRange = await request(app)
      .get(`/api/issues`)
      .query({
        workspaceId: ws1Id,
        createdFrom: toDateStr(utcDayOffset(-6)),
        createdTo: toDateStr(utcDayOffset(0)),
      })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(createdRange.body.data.issues.map((i: any) => i.issueKey).sort()).toEqual(['API-1', 'MOB-2', 'MOB-3']);
  });

  it('13-17. sorts deterministically by default updatedAt desc, semantic priority, semantic status, dueDate (nulls last), and title', async () => {
    // 13. Default sort: updatedAt desc
    const defaultRes = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(defaultRes.body.data.appliedSorting).toEqual({ sortBy: 'updatedAt', sortOrder: 'desc' });
    expect(defaultRes.body.data.issues.map((i: any) => i.issueKey)).toEqual([
      'API-1',
      'MOB-2',
      'MOB-1',
      'MOB-3',
      'API-2',
    ]);

    // 14. Priority semantic order: CRITICAL > HIGH > MEDIUM > LOW
    const prioDesc = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, sortBy: 'priority', sortOrder: 'desc' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(prioDesc.body.data.issues.map((i: any) => i.priority)).toEqual([
      'CRITICAL',
      'HIGH',
      'MEDIUM',
      'LOW',
      'LOW',
    ]);

    const prioAsc = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, sortBy: 'priority', sortOrder: 'asc' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(prioAsc.body.data.issues.map((i: any) => i.priority)).toEqual([
      'LOW',
      'LOW',
      'MEDIUM',
      'HIGH',
      'CRITICAL',
    ]);

    // 15. Status semantic workflow order: TODO -> IN_PROGRESS -> DONE
    const statusAsc = await request(app)
      .get(`/api/projects/${projMobId}/issues`)
      .query({ sortBy: 'status', sortOrder: 'asc' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(statusAsc.body.data.issues.map((i: any) => i.status)).toEqual([
      'TODO',
      'IN_PROGRESS',
      'DONE',
    ]);

    // 16. Due date asc/desc with null dueDate always sorted last
    const dueAsc = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, sortBy: 'dueDate', sortOrder: 'asc' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(dueAsc.body.data.issues.map((i: any) => i.issueKey)).toEqual([
      'MOB-1',
      'MOB-2',
      'MOB-3',
      'API-1',
      'API-2',
    ]);

    const dueDesc = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, sortBy: 'dueDate', sortOrder: 'desc' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(dueDesc.body.data.issues.map((i: any) => i.issueKey)).toEqual([
      'API-1',
      'MOB-3',
      'MOB-2',
      'MOB-1',
      'API-2',
    ]);

    // 17. Case-insensitive title sort
    const titleAsc = await request(app)
      .get(`/api/projects/${projMobId}/issues`)
      .query({ sortBy: 'title', sortOrder: 'asc' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(titleAsc.body.data.issues.map((i: any) => i.issueKey)).toEqual([
      'MOB-2', // alpha...
      'MOB-1', // Fix...
      'MOB-3', // Zeta...
    ]);
  });

  it('18-22. enforces pagination metadata, out-of-range page behavior, strict 400 validation, and max limit 100', async () => {
    // 18-19. Page 1, Page 2, Partial last page (5 issues accessible to Bob in ws1, limit=2)
    const page1 = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, page: '1', limit: '2' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(page1.status).toBe(200);
    expect(page1.body.data.issues.map((i: any) => i.issueKey)).toEqual(['API-1', 'MOB-2']);
    expect(page1.body.data.pagination).toEqual({
      currentPage: 1,
      pageSize: 2,
      totalItems: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });

    const page2 = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, page: '2', limit: '2' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(page2.body.data.issues.map((i: any) => i.issueKey)).toEqual(['MOB-1', 'MOB-3']);
    expect(page2.body.data.pagination).toEqual({
      currentPage: 2,
      pageSize: 2,
      totalItems: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });

    const page3 = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, page: '3', limit: '2' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(page3.body.data.issues.map((i: any) => i.issueKey)).toEqual(['API-2']);
    expect(page3.body.data.pagination).toEqual({
      currentPage: 3,
      pageSize: 2,
      totalItems: 5,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    });

    // 20. Out-of-range page
    const page4 = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, page: '4', limit: '2' })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(page4.status).toBe(200);
    expect(page4.body.data.issues).toEqual([]);
    expect(page4.body.data.pagination).toEqual({
      currentPage: 4,
      pageSize: 2,
      totalItems: 5,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    });

    // 21-22. Invalid query parameters & max limit > 100
    const badQueries = [
      { page: '-1' },
      { page: 'abc' },
      { limit: '0' },
      { limit: '101' },
      { status: 'UNKNOWN_STATUS' },
      { priority: 'URGENT' },
      { sortBy: 'nonexistent' },
      { dueDateFrom: 'not-a-date' },
      { dueDateFrom: '2026-10-10', dueDateTo: '2026-10-01' },
      { createdFrom: '2026-10-10', createdTo: '2026-10-01' },
      { assigneeId: 'bad-id-without-prefix' },
    ];

    for (const q of badQueries) {
      const badRes = await request(app)
        .get(`/api/issues`)
        .query({ workspaceId: ws1Id, ...q })
        .set('Authorization', `Bearer ${alice.token}`);
      expect(badRes.status).toBe(400);
      expect(badRes.body.success).toBe(false);
    }
  });

  it('23-26. enforces multi-tenant isolation, project access scoping, schema indexes, and fail-closed 503 when DB offline', async () => {
    // 23. Nina is workspace member & MOB member ONLY — search/filter must never return API or SECRET or ws2 issues
    const ninaGlobal = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, search: 'secret' })
      .set('Authorization', `Bearer ${nina.token}`);
    expect(ninaGlobal.status).toBe(200);
    expect(ninaGlobal.body.data.issues).toEqual([]);

    // Filtering explicitly by unauthorized project returns 403
    const ninaForbiddenProj = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, projectId: projSecretId })
      .set('Authorization', `Bearer ${nina.token}`);
    expect(ninaForbiddenProj.status).toBe(403);

    // Filtering workspace issues by cross-tenant projectId returns 403
    const crossTenantProj = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, projectId: projOtherWsId })
      .set('Authorization', `Bearer ${alice.token}`);
    expect(crossTenantProj.status).toBe(403);

    // 24. Outsider cannot access ws1 issues or projMobId issues even with search/filter params
    const outsiderWs = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id, search: 'MOB-1' })
      .set('Authorization', `Bearer ${oscar.token}`);
    expect(outsiderWs.status).toBe(403);

    const outsiderProj = await request(app)
      .get(`/api/projects/${projMobId}/issues`)
      .query({ status: 'TODO' })
      .set('Authorization', `Bearer ${oscar.token}`);
    expect(outsiderProj.status).toBe(403);

    // 25. Fail-closed 503 when database is unavailable in production mode (and model adapter throws)
    process.env.NODE_ENV = 'production';
    const offlineRes = await request(app)
      .get(`/api/issues`)
      .query({ workspaceId: ws1Id })
      .set('Authorization', `Bearer ${alice.token}`);
    expect(offlineRes.status).toBe(503);
    await expect(
      IssueModelAdapter.queryIssues({
        workspaceId: ws1Id,
        allowedProjectIds: [projMobId],
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      })
    ).rejects.toThrow(/Database service unavailable/i);
    process.env.NODE_ENV = originalEnv.NODE_ENV;

    // 26. Verify compound indexes exist on MongooseIssueModel schema
    const indexes = MongooseIssueModel.schema.indexes();
    const indexKeys = indexes.map(([fields]) => Object.keys(fields).join(','));
    expect(indexKeys).toContain('projectId,status,updatedAt');
    expect(indexKeys).toContain('projectId,priority,updatedAt');
    expect(indexKeys).toContain('workspaceId,status,updatedAt');
    expect(indexKeys).toContain('projectId,assigneeId,updatedAt');
  });
});
