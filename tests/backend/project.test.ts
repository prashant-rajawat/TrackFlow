import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/src/app';
import { UserModelAdapter } from '../../server/src/models/User';
import { WorkspaceModelAdapter } from '../../server/src/models/Workspace';
import { WorkspaceMemberModelAdapter } from '../../server/src/models/WorkspaceMember';
import { ProjectModelAdapter } from '../../server/src/models/Project';
import { ProjectMemberModelAdapter } from '../../server/src/models/ProjectMember';

describe('TrackFlow Phase 3: Project Management, Membership & RBAC', () => {
  const app = createApp();

  let userA: { token: string; user: any };
  let userB: { token: string; user: any };
  let userC: { token: string; user: any };
  let workspaceId: string;

  beforeEach(async () => {
    UserModelAdapter.clearMemory();
    WorkspaceModelAdapter.clearMemory();
    WorkspaceMemberModelAdapter.clearMemory();
    ProjectModelAdapter.clearMemory();
    ProjectMemberModelAdapter.clearMemory();

    // Register User A (Owner)
    const resA = await request(app).post('/api/auth/register').send({
      fullName: 'Alice Owner',
      email: 'alice@company.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    userA = resA.body.data;

    // Register User B (Member)
    const resB = await request(app).post('/api/auth/register').send({
      fullName: 'Bob Dev',
      email: 'bob@company.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    userB = resB.body.data;

    // Register User C (Outsider)
    const resC = await request(app).post('/api/auth/register').send({
      fullName: 'Charlie Outsider',
      email: 'charlie@other.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    userC = resC.body.data;

    // Create Workspace
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Acme Corp', slug: 'acme-corp' });
    workspaceId = wsRes.body.data.workspace.id;

    // Add Bob to workspace
    await WorkspaceMemberModelAdapter.createMember({
      workspaceId,
      userId: userB.user.id,
      role: 'MEMBER',
    });
  });

  describe('Project CRUD & Workspace Isolation', () => {
    it('creates project successfully and assigns creator as PROJECT_ADMIN', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          name: 'Core Platform',
          key: 'core',
          description: 'Main backend services',
          workspaceId,
          visibility: 'WORKSPACE',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.project.name).toBe('Core Platform');
      expect(res.body.data.project.key).toBe('CORE'); // Normalized uppercase
      expect(res.body.data.project.memberCount).toBe(1);

      // Verify membership
      const members = await ProjectMemberModelAdapter.findByProject(res.body.data.project.id);
      expect(members.length).toBe(1);
      expect(members[0].role).toBe('PROJECT_ADMIN');
    });

    it('rejects duplicate project key within the same workspace', async () => {
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Proj One', key: 'TEST', workspaceId });

      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Proj Two', key: 'TEST', workspaceId });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists');
    });

    it('lists workspace projects', async () => {
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Alpha', key: 'ALP', workspaceId });

      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Beta', key: 'BET', workspaceId });

      const res = await request(app)
        .get(`/api/projects?workspaceId=${workspaceId}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.projects.length).toBe(2);
    });

    it('denies project access to non-workspace members', async () => {
      const projRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Secret Proj', key: 'SEC', workspaceId });

      const projId = projRes.body.data.project.id;

      // User C (outsider to workspace) attempts to view
      const res = await request(app)
        .get(`/api/projects/${projId}`)
        .set('Authorization', `Bearer ${userC.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Project Lifecycle & Membership Management', () => {
    let projectId: string;

    beforeEach(async () => {
      const projRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Mobile App', key: 'MOB', workspaceId });
      projectId = projRes.body.data.project.id;
    });

    it('allows adding workspace member to project and updating role', async () => {
      // Add Bob (userB) to project as DEVELOPER
      const addRes = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ userId: userB.user.id, role: 'DEVELOPER' });

      expect(addRes.status).toBe(201);
      expect(addRes.body.data.member.role).toBe('DEVELOPER');

      // Update Bob to PROJECT_ADMIN
      const updateRes = await request(app)
        .patch(`/api/projects/${projectId}/members/${userB.user.id}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ role: 'PROJECT_ADMIN' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.member.role).toBe('PROJECT_ADMIN');
    });

    it('prevents removing the final project administrator', async () => {
      // Alice is the sole project admin
      const res = await request(app)
        .delete(`/api/projects/${projectId}/members/${userA.user.id}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot remove the final project administrator');
    });

    it('supports archiving and restoring projects', async () => {
      const archiveRes = await request(app)
        .post(`/api/projects/${projectId}/archive`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.data.project.status).toBe('ARCHIVED');

      const restoreRes = await request(app)
        .post(`/api/projects/${projectId}/restore`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.data.project.status).toBe('ACTIVE');
    });
  });
});
