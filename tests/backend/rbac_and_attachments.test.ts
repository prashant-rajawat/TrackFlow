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
import { CommentModelAdapter } from '../../server/src/models/Comment';
import {
  AttachmentModelAdapter,
  MongooseAttachmentModel,
  setSimulateAttachmentDbCreateFailure,
} from '../../server/src/models/Attachment';
import { InvitationModelAdapter } from '../../server/src/models/Invitation';
import { clearRevokedTokensTest } from '../../server/src/models/RevokedToken';
import {
  clearPendingStorageCleanups,
  getAttachmentStorageAdapter,
  getPendingStorageCleanups,
  setCustomStorageAdapterForTest,
  testMemoryStorage,
} from '../../server/src/services/storage/attachmentStorage';
import fs from 'fs';
import {
  resetUploadRateLimitForTest,
  setUploadRateLimitMaxForTest,
  TEMP_UPLOAD_DIR,
} from '../../server/src/middleware/upload.middleware';
import {
  resetAllRateLimitsForTest,
  setRateLimitMaxForTest,
} from '../../server/src/middleware/rateLimit.middleware';

// Valid minimal magic-byte payloads
const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
]);
const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
const VALID_WEBP = Buffer.from('RIFF\x24\x00\x00\x00WEBPVP8 \x18\x00\x00\x00', 'binary');
const VALID_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8');
const VALID_TXT = Buffer.from('Stack trace line 1\nError: Timeout at line 42\n', 'utf8');
const VALID_CSV = Buffer.from('id,title,status\n1,Login crash,TODO\n', 'utf8');
const VALID_DOCX = Buffer.from('PK\x03\x04\x14\x00\x00\x00[Content_Types].xml word/document.xml', 'binary');
const VALID_XLSX = Buffer.from('PK\x03\x04\x14\x00\x00\x00[Content_Types].xml xl/workbook.xml', 'binary');

describe('TrackFlow Phase 8: RBAC Hardening & Issue File Attachments Backend API', () => {
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
    AttachmentModelAdapter.clearMemory();
    InvitationModelAdapter.clearMemory();
    clearRevokedTokensTest();
    testMemoryStorage.clear();
    testMemoryStorage.setOutage(false);
    clearPendingStorageCleanups();
    setSimulateAttachmentDbCreateFailure(false);
    setCustomStorageAdapterForTest(null);
    resetUploadRateLimitForTest();
    resetAllRateLimitsForTest();
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
  let issueId: string;

  const registerAndLogin = async (fullName: string, email: string) => {
    const res = await request(app).post('/api/auth/register').send({
      fullName,
      email,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    return {
      cookie: res.headers['set-cookie']?.[0] || '',
      userId: res.body.data.user.id as string,
    };
  };

  beforeEach(async () => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    clearAll();
    await connectDB();

    const admin = await registerAndLogin('Alice Admin', 'alice@trackflow.dev');
    adminCookie = admin.cookie;
    adminId = admin.userId;

    const dev1 = await registerAndLogin('Bob Dev', 'bob@trackflow.dev');
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

    const wsMemberOnly = await registerAndLogin('Ned NonMember', 'ned@trackflow.dev');
    wsNonProjMemberCookie = wsMemberOnly.cookie;
    wsNonProjMemberId = wsMemberOnly.userId;

    const outsider = await registerAndLogin('Oscar Outsider', 'oscar@other.dev');
    outsiderCookie = outsider.cookie;

    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', adminCookie)
      .send({ name: 'Acme Workspace', slug: 'acme-att-ws' });
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
      .send({ name: 'Core Platform', key: 'CORE', workspaceId, visibility: 'WORKSPACE' });
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
      role: 'PROJECT_ADMIN', // workspace VIEWER overrides project admin -> read-only
    });

    const issueRes = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Cookie', adminCookie)
      .send({
        title: 'Investigate file preview rendering',
        description: 'Attach screenshots and server logs.',
        type: 'BUG',
        priority: 'HIGH',
      });
    issueId = issueRes.body.data.issue.id;

    const otherWsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', outsiderCookie)
      .send({ name: 'Other Co', slug: 'other-co' });
    otherWorkspaceId = otherWsRes.body.data.workspace.id;
  });

  afterEach(() => {
    clearAll();
    process.env = originalEnv;
  });

  it('1. Computes canonical projectPermissions & attachment IssuePermissions across roles', async () => {
    const adminProjRes = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', adminCookie);
    expect(adminProjRes.status).toBe(200);
    expect(adminProjRes.body.data.project.projectPermissions).toEqual({
      canView: true,
      canUpdate: true,
      canArchiveRestore: true,
      canDelete: true,
      canManageMembers: true,
    });

    const devProjRes = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', dev1Cookie);
    expect(devProjRes.status).toBe(200);
    expect(devProjRes.body.data.project.projectPermissions).toEqual({
      canView: true,
      canUpdate: true,
      canArchiveRestore: true,
      canDelete: false,
      canManageMembers: false,
    });

    const viewerProjRes = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', viewerCookie);
    expect(viewerProjRes.status).toBe(200);
    expect(viewerProjRes.body.data.project.projectPermissions).toEqual({
      canView: true,
      canUpdate: false,
      canArchiveRestore: false,
      canDelete: false,
      canManageMembers: false,
    });

    const devAttRes = await request(app)
      .get(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie);
    expect(devAttRes.status).toBe(200);
    expect(devAttRes.body.data.permissions).toMatchObject({
      canViewAttachments: true,
      canUploadAttachments: true,
      canDeleteOwnAttachment: true,
      canDeleteAnyAttachment: false,
    });

    const viewerAttRes = await request(app)
      .get(`/api/issues/${issueId}/attachments`)
      .set('Cookie', viewerCookie);
    expect(viewerAttRes.status).toBe(200);
    expect(viewerAttRes.body.data.permissions).toMatchObject({
      canViewAttachments: true,
      canUploadAttachments: false,
      canDeleteOwnAttachment: false,
      canDeleteAnyAttachment: false,
    });

    const wsViewerAttRes = await request(app)
      .get(`/api/issues/${issueId}/attachments`)
      .set('Cookie', wsViewerCookie);
    expect(wsViewerAttRes.status).toBe(200);
    expect(wsViewerAttRes.body.data.permissions.canUploadAttachments).toBe(false);
  });

  it('2. Uploads valid PNG/JPEG/WEBP/PDF/TXT attachments, strips storageKey, and serves secure download headers', async () => {
    const uploadRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', VALID_PNG, 'screenshot.png')
      .attach('files', VALID_JPEG, 'photo.jpg')
      .attach('files', VALID_WEBP, 'diagram.webp')
      .attach('files', VALID_PDF, 'spec.pdf')
      .attach('files', VALID_TXT, 'error.txt');

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.attachments).toHaveLength(5);

    const pngAtt = uploadRes.body.data.attachments.find(
      (a: any) => a.originalName === 'screenshot.png'
    );
    expect(pngAtt).toBeDefined();
    expect(pngAtt.storageKey).toBeUndefined();
    expect(pngAtt.storedFileName).toBeUndefined();
    expect(pngAtt.fileExtension).toBe('png');
    expect(pngAtt.mimeType).toBe('image/png');
    expect(pngAtt.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(pngAtt.uploader.id).toBe(dev1Id);

    const listRes = await request(app)
      .get(`/api/issues/${issueId}/attachments`)
      .set('Cookie', viewerCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.attachments).toHaveLength(5);

    // Download default Content-Disposition: attachment + security headers
    const dlRes = await request(app)
      .get(`/api/attachments/${pngAtt.id}/download`)
      .set('Cookie', viewerCookie);
    expect(dlRes.status).toBe(200);
    expect(dlRes.headers['x-content-type-options']).toBe('nosniff');
    expect(dlRes.headers['cache-control']).toBe('private, no-store');
    expect(dlRes.headers['content-disposition']).toContain('attachment');
    expect(dlRes.headers['content-type']).toContain('image/png');
    expect(Buffer.compare(dlRes.body, VALID_PNG)).toBe(0);

    // Inline preview allowed with ?inline=1
    const inlineRes = await request(app)
      .get(`/api/attachments/${pngAtt.id}/download?inline=1`)
      .set('Cookie', viewerCookie);
    expect(inlineRes.status).toBe(200);
    expect(inlineRes.headers['content-disposition']).toContain('inline');
  });

  it('3. Rejects MIME spoofing, disallowed extensions (.svg/.html/.exe), empty files, >10MB, >5 batch, and >20 issue cap', async () => {
    // Disallowed SVG extension
    const svgRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'xss.svg');
    expect(svgRes.status).toBe(400);

    // Spoofed PNG containing HTML/script
    const spoofRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', Buffer.from('<html><script>alert(1)</script></html>'), 'fake.png');
    expect(spoofRes.status).toBe(400);

    // Spoofed TXT containing HTML script payload
    const txtHtmlRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', Buffer.from('<!DOCTYPE html><script>alert(1)</script>'), 'notes.txt');
    expect(txtHtmlRes.status).toBe(400);

    // Empty file
    const emptyRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', Buffer.alloc(0), 'empty.txt');
    expect(emptyRes.status).toBe(400);

    // Oversized > 10 MB file
    const hugeBuf = Buffer.alloc(10 * 1024 * 1024 + 10, 0x41);
    const hugeRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', hugeBuf, 'huge.txt');
    expect(hugeRes.status).toBe(400);

    // > 5 files in single request
    const sixFilesReq = request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie);
    for (let i = 0; i < 6; i++) {
      sixFilesReq.attach('files', VALID_TXT, `batch-${i}.txt`);
    }
    const sixRes = await sixFilesReq;
    expect(sixRes.status).toBe(400);

    // Enforce 20 max attachments per issue
    for (let batch = 0; batch < 4; batch++) {
      const reqBatch = request(app)
        .post(`/api/issues/${issueId}/attachments`)
        .set('Cookie', dev1Cookie);
      for (let i = 0; i < 5; i++) {
        reqBatch.attach('files', VALID_TXT, `log-${batch}-${i}.txt`);
      }
      const r = await reqBatch;
      expect(r.status).toBe(201);
    }

    const twentyFirstRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', VALID_TXT, 'overflow.txt');
    expect(twentyFirstRes.status).toBe(400);
    expect(twentyFirstRes.body.message).toContain('20 max');
  });

  it('4. Enforces attachment RBAC, ownership deletion, cross-tenant isolation, and IDOR checks', async () => {
    const devUpload = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', VALID_PNG, 'dev1.png');
    expect(devUpload.status).toBe(201);
    const att1Id = devUpload.body.data.attachments[0].id;

    const dev2Upload = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev2Cookie)
      .attach('files', VALID_TXT, 'dev2.txt');
    expect(dev2Upload.status).toBe(201);
    const att2Id = dev2Upload.body.data.attachments[0].id;

    // Viewer cannot upload or delete
    const viewerUpload = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', viewerCookie)
      .attach('files', VALID_PNG, 'viewer.png');
    expect(viewerUpload.status).toBe(403);

    const wsViewerUpload = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', wsViewerCookie)
      .attach('files', VALID_PNG, 'wsviewer.png');
    expect(wsViewerUpload.status).toBe(403);

    const viewerDelete = await request(app)
      .delete(`/api/attachments/${att1Id}`)
      .set('Cookie', viewerCookie);
    expect(viewerDelete.status).toBe(403);

    // Non-project member inside workspace gets 403
    const nonMemberList = await request(app)
      .get(`/api/issues/${issueId}/attachments`)
      .set('Cookie', wsNonProjMemberCookie);
    expect(nonMemberList.status).toBe(403);

    const nonMemberDownload = await request(app)
      .get(`/api/attachments/${att1Id}/download`)
      .set('Cookie', wsNonProjMemberCookie);
    expect(nonMemberDownload.status).toBe(403);

    // Cross-workspace outsider gets 403
    const outsiderGet = await request(app)
      .get(`/api/attachments/${att1Id}`)
      .set('Cookie', outsiderCookie);
    expect(outsiderGet.status).toBe(403);

    // Invalid attachment ID -> 400; missing attachment ID -> 404
    const badId = await request(app)
      .get('/api/attachments/invalid-id-123')
      .set('Cookie', adminCookie);
    expect(badId.status).toBe(400);

    const missingId = await request(app)
      .get('/api/attachments/att_nonexistent_999')
      .set('Cookie', adminCookie);
    expect(missingId.status).toBe(404);

    // Developer cannot delete another user's attachment -> 403
    const dev1DeleteDev2 = await request(app)
      .delete(`/api/attachments/${att2Id}`)
      .set('Cookie', dev1Cookie);
    expect(dev1DeleteDev2.status).toBe(403);

    // Developer CAN delete own attachment -> 200
    const dev1DeleteOwn = await request(app)
      .delete(`/api/attachments/${att1Id}`)
      .set('Cookie', dev1Cookie);
    expect(dev1DeleteOwn.status).toBe(200);

    // PROJECT_ADMIN CAN delete another user's attachment -> 200
    const adminDeleteDev2 = await request(app)
      .delete(`/api/attachments/${att2Id}`)
      .set('Cookie', adminCookie);
    expect(adminDeleteDev2.status).toBe(200);

    const listAfter = await request(app)
      .get(`/api/issues/${issueId}/attachments`)
      .set('Cookie', adminCookie);
    expect(listAfter.body.data.attachments).toHaveLength(0);
  });

  it('5. Supports Idempotency-Key deduplication, rollback on metadata DB failure, and storage outage/production fail-closed 503', async () => {
    const idemKey = 'idem-upload-test-001';
    const first = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .set('Idempotency-Key', idemKey)
      .attach('files', VALID_PNG, 'retry.png');
    expect(first.status).toBe(201);
    expect(first.body.data.idempotentReplay).toBe(false);

    // Replay same request with same Idempotency-Key -> returns 200 without duplicating record
    const replay = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .set('Idempotency-Key', idemKey)
      .attach('files', VALID_PNG, 'retry.png');
    expect(replay.status).toBe(200);
    expect(replay.body.data.idempotentReplay).toBe(true);
    expect(replay.body.data.attachments[0].id).toBe(first.body.data.attachments[0].id);

    // Rollback on DB metadata failure cleans up newly written storage object
    const keysBeforeFail = (await AttachmentModelAdapter.findByIssue(issueId)).length;
    setSimulateAttachmentDbCreateFailure(true);
    const dbFailRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', VALID_PDF, 'rollback.pdf');
    setSimulateAttachmentDbCreateFailure(false);
    expect(dbFailRes.status).toBe(500);
    expect(await AttachmentModelAdapter.findByIssue(issueId)).toHaveLength(keysBeforeFail);
    // Only the 1 original object should remain in memory storage
    expect(testMemoryStorage.countObjects()).toBe(1);

    // Storage outage returns 503 and creates zero orphan metadata
    testMemoryStorage.setOutage(true);
    const outageRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', VALID_PNG, 'outage.png');
    expect(outageRes.status).toBe(503);
    expect(await AttachmentModelAdapter.findByIssue(issueId)).toHaveLength(1);
    testMemoryStorage.setOutage(false);

    // Production without cloud credentials fails closed with STORAGE_NOT_CONFIGURED (503)
    process.env.NODE_ENV = 'production';
    delete process.env.STORAGE_PROVIDER;
    delete process.env.S3_BUCKET;
    delete process.env.SUPABASE_URL;
    setCustomStorageAdapterForTest(null);
    const prodAdapter = getAttachmentStorageAdapter();
    const prodStatus = await prodAdapter.getStatus();
    expect(prodStatus.configured).toBe(false);
    expect(prodStatus.available).toBe(false);
    expect(prodStatus.provider).toBe('unconfigured');
    await expect(
      prodAdapter.putObject({
        storageKey: 'attachments/test/key.png',
        buffer: VALID_PNG,
        mimeType: 'image/png',
        originalName: 'key.png',
      })
    ).rejects.toThrow(/configured persistent object storage/i);
  });

  it('6. Cascades attachment metadata + object cleanup on issue/project deletion and defines Attachment indexes', async () => {
    const up = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', adminCookie)
      .attach('files', VALID_PNG, 'cascade-issue.png');
    expect(up.status).toBe(201);
    expect(testMemoryStorage.countObjects()).toBe(1);

    // Delete issue -> cascades attachment metadata and object deletion
    const delIssue = await request(app)
      .delete(`/api/issues/${issueId}`)
      .set('Cookie', adminCookie);
    expect(delIssue.status).toBe(200);
    expect(await AttachmentModelAdapter.findByIssue(issueId)).toHaveLength(0);
    expect(testMemoryStorage.countObjects()).toBe(0);

    // Create another issue + upload, then delete project -> cascades cleanup
    const issue2 = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Cookie', adminCookie)
      .send({ title: 'Project cascade issue', description: 'Test', type: 'TASK', priority: 'LOW' });
    const issue2Id = issue2.body.data.issue.id;

    await request(app)
      .post(`/api/issues/${issue2Id}/attachments`)
      .set('Cookie', adminCookie)
      .attach('files', VALID_TXT, 'cascade-proj.txt');
    expect(testMemoryStorage.countObjects()).toBe(1);

    const delProj = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Cookie', adminCookie);
    expect(delProj.status).toBe(200);
    expect(await AttachmentModelAdapter.findByProject(projectId)).toHaveLength(0);
    expect(testMemoryStorage.countObjects()).toBe(0);
    expect(getPendingStorageCleanups()).toHaveLength(0);

    // Verify Mongoose Attachment indexes
    const indexes = MongooseAttachmentModel.schema.indexes();
    const indexKeys = indexes.map(([fields]) => Object.keys(fields).join(','));
    expect(indexKeys).toContain('storageKey');
    expect(indexKeys).toContain('issueId,createdAt');
    expect(indexKeys).toContain('projectId,createdAt');
    expect(indexKeys).toContain('workspaceId,createdAt');
  });

  it('7. Supports CSV/DOCX/XLSX uploads with forced attachment disposition, temp-file cleanup, repeated delete 404, and workspace cascade cleanup', async () => {
    const officeUpload = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', VALID_CSV, 'export.csv')
      .attach('files', VALID_DOCX, 'requirements.docx')
      .attach('files', VALID_XLSX, 'metrics.xlsx');

    expect(officeUpload.status).toBe(201);
    expect(officeUpload.body.data.attachments).toHaveLength(3);

    const csvAtt = officeUpload.body.data.attachments.find((a: any) => a.originalName === 'export.csv');
    const docxAtt = officeUpload.body.data.attachments.find((a: any) => a.originalName === 'requirements.docx');
    const xlsxAtt = officeUpload.body.data.attachments.find((a: any) => a.originalName === 'metrics.xlsx');
    expect(csvAtt.fileExtension).toBe('csv');
    expect(docxAtt.fileExtension).toBe('docx');
    expect(xlsxAtt.fileExtension).toBe('xlsx');

    // CSV/DOCX/XLSX must ALWAYS force Content-Disposition: attachment even if ?inline=1 is requested
    const csvDownload = await request(app)
      .get(`/api/attachments/${csvAtt.id}/download?inline=1`)
      .set('Cookie', viewerCookie);
    expect(csvDownload.status).toBe(200);
    expect(csvDownload.headers['content-disposition']).toContain('attachment');

    // Spoofed JAR masquerading as .docx must be rejected
    const jarSpoof = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', Buffer.from('PK\x03\x04META-INF/MANIFEST.MF com/evil/Main.class', 'binary'), 'evil.docx');
    expect(jarSpoof.status).toBe(400);

    // Path traversal & executable rejection
    const exeRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', Buffer.from('MZ\x90\x00binary'), 'payload.exe');
    expect(exeRes.status).toBe(400);

    // Verify objectExists and repeated delete safety (200 first, 404 second)
    const rawDocx = await AttachmentModelAdapter.findById(docxAtt.id);
    expect(await testMemoryStorage.objectExists(rawDocx!.storageKey)).toBe(true);

    const firstDel = await request(app)
      .delete(`/api/attachments/${docxAtt.id}`)
      .set('Cookie', dev1Cookie);
    expect(firstDel.status).toBe(200);
    expect(await testMemoryStorage.objectExists(rawDocx!.storageKey)).toBe(false);

    const repeatedDel = await request(app)
      .delete(`/api/attachments/${docxAtt.id}`)
      .set('Cookie', dev1Cookie);
    expect(repeatedDel.status).toBe(404);

    // Verify no leaked Multer temporary files remain on disk
    if (fs.existsSync(TEMP_UPLOAD_DIR)) {
      const leftover = fs.readdirSync(TEMP_UPLOAD_DIR);
      expect(leftover).toHaveLength(0);
    }

    // Deleting the entire workspace cascades attachments and cleans storage objects
    expect(testMemoryStorage.countObjects()).toBe(2);
    const delWs = await request(app)
      .delete(`/api/workspaces/${workspaceId}`)
      .set('Cookie', adminCookie);
    expect(delWs.status).toBe(200);
    expect(testMemoryStorage.countObjects()).toBe(0);
    expect(await AttachmentModelAdapter.findByProject(projectId)).toHaveLength(0);
  });

  it('8. Enforces rate limits on login, registration, invitation acceptance, and file uploads, plus malformed JSON rejection', async () => {
    // Malformed JSON body returns clean 400 without leaking raw SyntaxError stack
    const badJson = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "broken');
    expect(badJson.status).toBe(400);
    expect(badJson.body.code).toBe('INVALID_JSON');

    // Login rate limiting
    setRateLimitMaxForTest('auth_login', 2);
    for (let i = 0; i < 2; i++) {
      await request(app).post('/api/auth/login').send({
        email: 'ratelimit@trackflow.dev',
        password: 'WrongPassword1!',
      });
    }
    const blockedLogin = await request(app).post('/api/auth/login').send({
      email: 'ratelimit@trackflow.dev',
      password: 'WrongPassword1!',
    });
    expect(blockedLogin.status).toBe(429);
    expect(blockedLogin.headers['retry-after']).toBeDefined();

    // Registration rate limiting
    setRateLimitMaxForTest('auth_register', 1);
    await request(app).post('/api/auth/register').send({
      fullName: 'First User',
      email: 'first.rl@trackflow.dev',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    const blockedReg = await request(app).post('/api/auth/register').send({
      fullName: 'Second User',
      email: 'second.rl@trackflow.dev',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    expect(blockedReg.status).toBe(429);

    // Invitation acceptance rate limiting
    setRateLimitMaxForTest('invitations', 1);
    await request(app)
      .post('/api/invitations/fake-token-123/accept')
      .set('Cookie', outsiderCookie);
    const blockedInvite = await request(app)
      .post('/api/invitations/fake-token-123/accept')
      .set('Cookie', outsiderCookie);
    expect(blockedInvite.status).toBe(429);

    // Upload rate limiting
    setUploadRateLimitMaxForTest(1);
    const okUp = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', VALID_TXT, 'first.txt');
    expect(okUp.status).toBe(201);

    const blockedUp = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Cookie', dev1Cookie)
      .attach('files', VALID_TXT, 'second.txt');
    expect(blockedUp.status).toBe(429);
    expect(blockedUp.headers['retry-after']).toBeDefined();
  });
});
