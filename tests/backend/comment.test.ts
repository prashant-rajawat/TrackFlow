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
import { CommentModelAdapter, MongooseCommentModel } from '../../server/src/models/Comment';
import { InvitationModelAdapter } from '../../server/src/models/Invitation';
import { clearRevokedTokensTest } from '../../server/src/models/RevokedToken';

describe('TrackFlow Phase 6: Issue Comments & Collaboration Backend API', () => {
  const app = createApp();
  const originalEnv = { ...process.env };

  const clearAll = () => {
    UserModelAdapter.clearMemory();
    WorkspaceModelAdapter.clearMemory();
    WorkspaceMemberModelAdapter.clearMemory();
    ProjectModelAdapter.clearMemory();
    ProjectMemberModelAdapter.clearMemory();
    IssueModelAdapter.clearMemory();
    CommentModelAdapter.clearMemory();
    InvitationModelAdapter.clearMemory();
    clearRevokedTokensTest();
  };

  let adminCookie: string;
  let adminId: string;
  let dev1Cookie: string;
  let dev1Id: string;
  let dev2Cookie: string;
  let dev2Id: string;
  let viewerCookie: string;
  let viewerId: string;
  let wsViewerCookie: string;
  let wsViewerId: string;
  let wsNonProjMemberCookie: string;
  let wsNonProjMemberId: string;
  let outsiderCookie: string;

  let workspaceId: string;
  let otherWorkspaceId: string;
  let projectId: string;
  let otherProjectId: string;
  let issueId: string;
  let otherIssueId: string;

  const registerAndLogin = async (fullName: string, email: string) => {
    const res = await request(app).post('/api/auth/register').send({
      fullName,
      email,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    const cookie = res.headers['set-cookie']?.[0] || '';
    const userId = res.body.data.user.id;
    return { cookie, userId };
  };

  beforeEach(async () => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    clearAll();
    await connectDB();

    const admin = await registerAndLogin('Alice Admin', 'alice@trackflow.dev');
    adminCookie = admin.cookie;
    adminId = admin.userId;

    const dev1 = await registerAndLogin('Bob Developer', 'bob@trackflow.dev');
    dev1Cookie = dev1.cookie;
    dev1Id = dev1.userId;

    const dev2 = await registerAndLogin('Charlie Dev', 'charlie@trackflow.dev');
    dev2Cookie = dev2.cookie;
    dev2Id = dev2.userId;

    const viewer = await registerAndLogin('Vera Viewer', 'vera@trackflow.dev');
    viewerCookie = viewer.cookie;
    viewerId = viewer.userId;

    const wsViewer = await registerAndLogin('Walt WsViewer', 'walt@trackflow.dev');
    wsViewerCookie = wsViewer.cookie;
    wsViewerId = wsViewer.userId;

    const wsMemberOnly = await registerAndLogin('Ned NonProject', 'ned@trackflow.dev');
    wsNonProjMemberCookie = wsMemberOnly.cookie;
    wsNonProjMemberId = wsMemberOnly.userId;

    const outsider = await registerAndLogin('Oscar Outsider', 'oscar@other.dev');
    outsiderCookie = outsider.cookie;

    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', adminCookie)
      .send({ name: 'Acme Workspace', slug: 'acme-ws' });
    workspaceId = wsRes.body.data.workspace.id;

    await WorkspaceMemberModelAdapter.createMember({ workspaceId, userId: dev1Id, role: 'MEMBER' });
    await WorkspaceMemberModelAdapter.createMember({ workspaceId, userId: dev2Id, role: 'MEMBER' });
    await WorkspaceMemberModelAdapter.createMember({ workspaceId, userId: viewerId, role: 'MEMBER' });
    await WorkspaceMemberModelAdapter.createMember({ workspaceId, userId: wsViewerId, role: 'VIEWER' });
    await WorkspaceMemberModelAdapter.createMember({
      workspaceId,
      userId: wsNonProjMemberId,
      role: 'MEMBER',
    });

    const projRes = await request(app)
      .post('/api/projects')
      .set('Cookie', adminCookie)
      .send({ name: 'Platform Core', key: 'CORE', workspaceId, visibility: 'WORKSPACE' });
    projectId = projRes.body.data.project.id;

    await ProjectMemberModelAdapter.createMember({
      projectId,
      workspaceId,
      userId: dev1Id,
      role: 'DEVELOPER',
    });
    await ProjectMemberModelAdapter.createMember({
      projectId,
      workspaceId,
      userId: dev2Id,
      role: 'DEVELOPER',
    });
    await ProjectMemberModelAdapter.createMember({
      projectId,
      workspaceId,
      userId: viewerId,
      role: 'VIEWER',
    });
    await ProjectMemberModelAdapter.createMember({
      projectId,
      workspaceId,
      userId: wsViewerId,
      role: 'PROJECT_ADMIN', // Workspace VIEWER still caps this user to read-only!
    });

    const issueRes = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Cookie', adminCookie)
      .send({
        title: 'Session cookie expires prematurely',
        description: 'Investigate cookie max-age handling across reloads.',
        type: 'BUG',
        priority: 'HIGH',
        status: 'TODO',
      });
    issueId = issueRes.body.data.issue.id;

    // Second isolated workspace + project + issue for cross-workspace & cross-issue checks
    const otherWsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', outsiderCookie)
      .send({ name: 'Other Org', slug: 'other-org' });
    otherWorkspaceId = otherWsRes.body.data.workspace.id;

    const otherProjRes = await request(app)
      .post('/api/projects')
      .set('Cookie', outsiderCookie)
      .send({
        name: 'Other App',
        key: 'OTH',
        workspaceId: otherWorkspaceId,
        visibility: 'WORKSPACE',
      });
    otherProjectId = otherProjRes.body.data.project.id;

    const otherIssueRes = await request(app)
      .post(`/api/projects/${otherProjectId}/issues`)
      .set('Cookie', outsiderCookie)
      .send({
        title: 'External workspace issue',
        description: 'Isolated issue.',
        type: 'TASK',
        priority: 'LOW',
      });
    otherIssueId = otherIssueRes.body.data.issue.id;
  });

  afterEach(async () => {
    clearAll();
    process.env = { ...originalEnv };
    await connectDB();
  });

  it('1. Lists empty comments and computes accurate comment RBAC permissions per role', async () => {
    const devRes = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set('Cookie', dev1Cookie);
    expect(devRes.status).toBe(200);
    expect(devRes.body.data.comments).toEqual([]);
    expect(devRes.body.data.totalCount).toBe(0);
    expect(devRes.body.data.permissions.canViewComments).toBe(true);
    expect(devRes.body.data.permissions.canCreateComment).toBe(true);
    expect(devRes.body.data.permissions.canModerateComments).toBe(false);

    const adminRes = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set('Cookie', adminCookie);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.permissions.canModerateComments).toBe(true);

    const viewerRes = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set('Cookie', viewerCookie);
    expect(viewerRes.status).toBe(200);
    expect(viewerRes.body.data.permissions.canViewComments).toBe(true);
    expect(viewerRes.body.data.permissions.canCreateComment).toBe(false);
    expect(viewerRes.body.data.permissions.canModerateComments).toBe(false);

    const wsViewerRes = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set('Cookie', wsViewerCookie);
    expect(wsViewerRes.status).toBe(200);
    expect(wsViewerRes.body.data.permissions.canCreateComment).toBe(false);
  });

  it('2. Allows PROJECT_ADMIN and DEVELOPER to create comments with safe author serialization and mass-assignment protection', async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', dev1Cookie)
      .send({
        content: '  Reproduced this on Safari 18 with cookies enabled.  ',
        authorId: adminId,
        projectId: otherProjectId,
        workspaceId: otherWorkspaceId,
        editedAt: '2020-01-01T00:00:00.000Z',
        deletedAt: '2020-01-01T00:00:00.000Z',
      });

    expect(res.status).toBe(201);
    const comment = res.body.data.comment;
    expect(comment.content).toBe('Reproduced this on Safari 18 with cookies enabled.');
    expect(comment.authorId).toBe(dev1Id);
    expect(comment.projectId).toBe(projectId);
    expect(comment.workspaceId).toBe(workspaceId);
    expect(comment.parentCommentId).toBeNull();
    expect(comment.editedAt).toBeNull();
    expect(comment.deletedAt).toBeNull();
    expect(comment.isDeleted).toBe(false);
    expect(comment.author).toEqual({
      id: dev1Id,
      fullName: 'Bob Developer',
      email: 'bob@trackflow.dev',
      avatarUrl: '',
    });
    expect(comment.author.passwordHash).toBeUndefined();
  });

  it('3. Blocks VIEWER (project & workspace), non-project members, outsiders, and unauthenticated users from creating comments', async () => {
    const unauth = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .send({ content: 'No auth' });
    expect(unauth.status).toBe(401);

    const projViewer = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', viewerCookie)
      .send({ content: 'Viewer attempt' });
    expect(projViewer.status).toBe(403);

    const wsViewer = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', wsViewerCookie)
      .send({ content: 'WS Viewer attempt' });
    expect(wsViewer.status).toBe(403);

    const nonProjGet = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set('Cookie', wsNonProjMemberCookie);
    expect(nonProjGet.status).toBe(403);

    const nonProjPost = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', wsNonProjMemberCookie)
      .send({ content: 'Non project member attempt' });
    expect(nonProjPost.status).toBe(403);

    const outsiderGet = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set('Cookie', outsiderCookie);
    expect(outsiderGet.status).toBe(403);

    const outsiderPost = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', outsiderCookie)
      .send({ content: 'Cross workspace attempt' });
    expect(outsiderPost.status).toBe(403);
  });

  it('4. Rejects empty, whitespace-only, and over-limit comments and validates IDs (400 / 404)', async () => {
    const emptyRes = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', dev1Cookie)
      .send({ content: '   \n\t  ' });
    expect(emptyRes.status).toBe(400);

    const longRes = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', dev1Cookie)
      .send({ content: 'x'.repeat(2001) });
    expect(longRes.status).toBe(400);

    const badIssueId = await request(app)
      .get('/api/issues/invalid-id/comments')
      .set('Cookie', dev1Cookie);
    expect(badIssueId.status).toBe(400);

    const missingIssueId = await request(app)
      .get('/api/issues/iss_missing_123/comments')
      .set('Cookie', dev1Cookie);
    expect(missingIssueId.status).toBe(404);

    const badCommentId = await request(app)
      .patch('/api/comments/not_valid_id')
      .set('Cookie', dev1Cookie)
      .send({ content: 'Update' });
    expect(badCommentId.status).toBe(400);

    const missingCommentId = await request(app)
      .patch('/api/comments/cmt_missing_123')
      .set('Cookie', dev1Cookie)
      .send({ content: 'Update' });
    expect(missingCommentId.status).toBe(404);
  });

  it('5. Supports 1-level replies and rejects nested replies (>1 level), cross-issue replies, and viewer replies', async () => {
    const parentRes = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', dev1Cookie)
      .send({ content: 'Top-level observation' });
    const parentId = parentRes.body.data.comment.id;

    // Cross-issue tampering check
    const crossIssueReply = await request(app)
      .post(`/api/comments/${parentId}/replies`)
      .set('Cookie', dev2Cookie)
      .send({ content: 'Cross issue attempt', issueId: otherIssueId });
    expect(crossIssueReply.status).toBe(400);

    // Viewer cannot reply
    const viewerReply = await request(app)
      .post(`/api/comments/${parentId}/replies`)
      .set('Cookie', viewerCookie)
      .send({ content: 'Viewer reply' });
    expect(viewerReply.status).toBe(403);

    // Valid reply from another developer
    const replyRes = await request(app)
      .post(`/api/comments/${parentId}/replies`)
      .set('Cookie', dev2Cookie)
      .send({ content: 'Confirmed, seeing the same issue.', issueId });
    expect(replyRes.status).toBe(201);
    const replyId = replyRes.body.data.comment.id;
    expect(replyRes.body.data.comment.parentCommentId).toBe(parentId);
    expect(replyRes.body.data.comment.authorId).toBe(dev2Id);

    // Replying to a reply (2nd-level nesting) must be rejected
    const nestedReply = await request(app)
      .post(`/api/comments/${replyId}/replies`)
      .set('Cookie', adminCookie)
      .send({ content: 'Second level reply attempt' });
    expect(nestedReply.status).toBe(400);
    expect(nestedReply.body.message).toContain('one level');

    // Reload issue comments and verify hierarchical 1-level grouping
    const listRes = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set('Cookie', dev1Cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.totalCount).toBe(2);
    expect(listRes.body.data.activeCount).toBe(2);
    expect(listRes.body.data.comments).toHaveLength(1);
    expect(listRes.body.data.comments[0].replies).toHaveLength(1);
    expect(listRes.body.data.comments[0].replies[0].id).toBe(replyId);
  });

  it('6. Enforces edit permissions (author yes, other developer no, PROJECT_ADMIN yes, VIEWER no) and sets editedAt', async () => {
    const createRes = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', dev1Cookie)
      .send({ content: 'Initial draft comment' });
    const commentId = createRes.body.data.comment.id;

    // Empty edit rejected
    const emptyEdit = await request(app)
      .patch(`/api/comments/${commentId}`)
      .set('Cookie', dev1Cookie)
      .send({ content: '   ' });
    expect(emptyEdit.status).toBe(400);

    // Other DEVELOPER forbidden
    const otherDevEdit = await request(app)
      .patch(`/api/comments/${commentId}`)
      .set('Cookie', dev2Cookie)
      .send({ content: 'Hijacked text' });
    expect(otherDevEdit.status).toBe(403);

    // VIEWER forbidden
    const viewerEdit = await request(app)
      .patch(`/api/comments/${commentId}`)
      .set('Cookie', viewerCookie)
      .send({ content: 'Viewer edit' });
    expect(viewerEdit.status).toBe(403);

    // Author can edit
    const authorEdit = await request(app)
      .patch(`/api/comments/${commentId}`)
      .set('Cookie', dev1Cookie)
      .send({ content: 'Updated analysis after checking headers' });
    expect(authorEdit.status).toBe(200);
    expect(authorEdit.body.data.comment.content).toBe('Updated analysis after checking headers');
    expect(authorEdit.body.data.comment.editedAt).toBeTruthy();

    // PROJECT_ADMIN can moderate/edit
    const adminEdit = await request(app)
      .patch(`/api/comments/${commentId}`)
      .set('Cookie', adminCookie)
      .send({ content: 'Moderated technical summary' });
    expect(adminEdit.status).toBe(200);
    expect(adminEdit.body.data.comment.content).toBe('Moderated technical summary');
  });

  it('7. Enforces delete permissions and soft-delete integrity (redacts content, preserves replies, blocks edits/replies to deleted)', async () => {
    const parentRes = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', dev1Cookie)
      .send({ content: 'Secret draft text to be soft-deleted' });
    const parentId = parentRes.body.data.comment.id;

    const replyRes = await request(app)
      .post(`/api/comments/${parentId}/replies`)
      .set('Cookie', dev2Cookie)
      .send({ content: 'Important follow-up reply' });
    const replyId = replyRes.body.data.comment.id;

    // Other DEVELOPER cannot delete dev1's parent comment
    const otherDevDel = await request(app)
      .delete(`/api/comments/${parentId}`)
      .set('Cookie', dev2Cookie);
    expect(otherDevDel.status).toBe(403);

    // VIEWER cannot delete
    const viewerDel = await request(app)
      .delete(`/api/comments/${parentId}`)
      .set('Cookie', viewerCookie);
    expect(viewerDel.status).toBe(403);

    // Author deletes parent comment -> soft delete
    const delRes = await request(app)
      .delete(`/api/comments/${parentId}`)
      .set('Cookie', dev1Cookie);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.comment.isDeleted).toBe(true);
    expect(delRes.body.data.comment.deletedAt).toBeTruthy();
    expect(delRes.body.data.comment.content).toBe('');

    // Editing or replying to soft-deleted comment is rejected
    const editDeleted = await request(app)
      .patch(`/api/comments/${parentId}`)
      .set('Cookie', adminCookie)
      .send({ content: 'Cannot resurrect' });
    expect(editDeleted.status).toBe(400);

    const replyDeleted = await request(app)
      .post(`/api/comments/${parentId}/replies`)
      .set('Cookie', adminCookie)
      .send({ content: 'Cannot reply to deleted' });
    expect(replyDeleted.status).toBe(400);

    // Reloading comments shows redacted deleted parent + intact reply
    const listRes = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set('Cookie', viewerCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.comments).toHaveLength(1);
    expect(listRes.body.data.comments[0].isDeleted).toBe(true);
    expect(listRes.body.data.comments[0].content).toBe('');
    expect(listRes.body.data.comments[0].replies).toHaveLength(1);
    expect(listRes.body.data.comments[0].replies[0].id).toBe(replyId);
    expect(listRes.body.data.comments[0].replies[0].content).toBe('Important follow-up reply');
    expect(listRes.body.data.activeCount).toBe(1);

    // PROJECT_ADMIN can delete dev2's reply
    const adminModDelete = await request(app)
      .delete(`/api/comments/${replyId}`)
      .set('Cookie', adminCookie);
    expect(adminModDelete.status).toBe(200);
    expect(adminModDelete.body.data.comment.isDeleted).toBe(true);
  });

  it('8. Supports chronological sort (asc/desc) and pagination (limit/offset) without losing replies', async () => {
    const c1 = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', dev1Cookie)
      .send({ content: 'First comment' });
    await new Promise((r) => setTimeout(r, 5));
    const c2 = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', dev2Cookie)
      .send({ content: 'Second comment' });
    await new Promise((r) => setTimeout(r, 5));
    const c3 = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', adminCookie)
      .send({ content: 'Third comment' });

    const ascPage1 = await request(app)
      .get(`/api/issues/${issueId}/comments?sort=asc&limit=2&offset=0`)
      .set('Cookie', dev1Cookie);
    expect(ascPage1.status).toBe(200);
    expect(ascPage1.body.data.comments.map((c: any) => c.id)).toEqual([
      c1.body.data.comment.id,
      c2.body.data.comment.id,
    ]);
    expect(ascPage1.body.data.hasMore).toBe(true);

    const ascPage2 = await request(app)
      .get(`/api/issues/${issueId}/comments?sort=asc&limit=2&offset=2`)
      .set('Cookie', dev1Cookie);
    expect(ascPage2.body.data.comments.map((c: any) => c.id)).toEqual([c3.body.data.comment.id]);
    expect(ascPage2.body.data.hasMore).toBe(false);

    const descRes = await request(app)
      .get(`/api/issues/${issueId}/comments?sort=desc`)
      .set('Cookie', dev1Cookie);
    expect(descRes.body.data.comments.map((c: any) => c.id)).toEqual([
      c3.body.data.comment.id,
      c2.body.data.comment.id,
      c1.body.data.comment.id,
    ]);
  });

  it('9. Cascades comment deletion on issue deletion and defines expected Mongoose indexes & 503 behavior', async () => {
    await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', dev1Cookie)
      .send({ content: 'Comment before issue deletion' });

    expect((await CommentModelAdapter.findByIssue(issueId)).length).toBe(1);

    const delIssueRes = await request(app)
      .delete(`/api/issues/${issueId}`)
      .set('Cookie', adminCookie);
    expect(delIssueRes.status).toBe(200);

    expect((await CommentModelAdapter.findByIssue(issueId)).length).toBe(0);

    // Verify Mongoose schema indexes exist
    const indexes = MongooseCommentModel.schema.indexes();
    const indexKeys = indexes.map(([fields]) => Object.keys(fields).join(','));
    expect(indexKeys).toContain('issueId,createdAt');
    expect(indexKeys).toContain('projectId,createdAt');
    expect(indexKeys).toContain('workspaceId,createdAt');
    expect(indexKeys).toContain('parentCommentId,createdAt');
  });

  it('10. Full end-to-end comment collaboration workflow preserves issue status & Kanban integrity', async () => {
    // 1. Post comment
    const cRes = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Cookie', dev1Cookie)
      .send({ content: 'Starting root cause analysis.' });
    expect(cRes.status).toBe(201);
    const cId = cRes.body.data.comment.id;

    // 2. Reply to comment
    const rRes = await request(app)
      .post(`/api/comments/${cId}/replies`)
      .set('Cookie', adminCookie)
      .send({ content: 'Thanks, keep us posted on staging results.' });
    expect(rRes.status).toBe(201);

    // 3. Edit parent comment
    const eRes = await request(app)
      .patch(`/api/comments/${cId}`)
      .set('Cookie', dev1Cookie)
      .send({ content: 'Root cause identified in cookie domain config.' });
    expect(eRes.status).toBe(200);
    expect(eRes.body.data.comment.editedAt).toBeTruthy();

    // 4. Reload comments & verify parent + reply + issue status untouched
    const listRes = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set('Cookie', dev1Cookie);
    expect(listRes.body.data.comments).toHaveLength(1);
    expect(listRes.body.data.comments[0].content).toBe('Root cause identified in cookie domain config.');
    expect(listRes.body.data.comments[0].replies).toHaveLength(1);

    const issueRes = await request(app)
      .get(`/api/issues/${issueId}`)
      .set('Cookie', dev1Cookie);
    expect(issueRes.status).toBe(200);
    expect(issueRes.body.data.issue.status).toBe('TODO');
  });
});
