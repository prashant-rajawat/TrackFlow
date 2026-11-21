import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/src/app';
import { UserModelAdapter } from '../../server/src/models/User';
import { WorkspaceModelAdapter } from '../../server/src/models/Workspace';
import { WorkspaceMemberModelAdapter } from '../../server/src/models/WorkspaceMember';
import { InvitationModelAdapter } from '../../server/src/models/Invitation';
import { clearRevokedTokensTest } from '../../server/src/models/RevokedToken';

describe('TrackFlow Phase 2: Workspaces, Team Members, Invitations & RBAC', () => {
  const app = createApp();

  let userA: { token: string; user: any };
  let userB: { token: string; user: any };
  let userC: { token: string; user: any };

  beforeEach(async () => {
    UserModelAdapter.clearMemory();
    WorkspaceModelAdapter.clearMemory();
    WorkspaceMemberModelAdapter.clearMemory();
    InvitationModelAdapter.clearMemory();
    clearRevokedTokensTest();

    // Register User A (Workspace Owner)
    const resA = await request(app).post('/api/auth/register').send({
      fullName: 'Alice Owner',
      email: 'alice@acme.inc',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    userA = resA.body.data;

    // Register User B (Teammate to be invited)
    const resB = await request(app).post('/api/auth/register').send({
      fullName: 'Bob Member',
      email: 'bob@acme.inc',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    userB = resB.body.data;

    // Register User C (Third-party outsider)
    const resC = await request(app).post('/api/auth/register').send({
      fullName: 'Charlie Outsider',
      email: 'charlie@other.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    userC = resC.body.data;
  });

  describe('Token Revocation & Logout Security', () => {
    it('revokes JWT token on logout and rejects subsequent access', async () => {
      // User A can access /api/auth/me
      const meBefore = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userA.token}`);
      expect(meBefore.status).toBe(200);

      // User A logs out
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userA.token}`);
      expect(logoutRes.status).toBe(200);

      // Attempting to reuse revoked token must be rejected with 401
      const meAfter = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userA.token}`);
      expect(meAfter.status).toBe(401);
      expect(meAfter.body.message).toContain('logged out');
    });
  });

  describe('Workspace Management', () => {
    it('creates workspace and automatically grants OWNER membership to creator', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          name: 'Acme Engineering',
          slug: 'acme-eng',
          description: 'Core engineering workspace',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workspace.name).toBe('Acme Engineering');
      expect(res.body.data.workspace.slug).toBe('acme-eng');
      expect(res.body.data.workspace.role).toBe('OWNER');
      expect(res.body.data.workspace.memberCount).toBe(1);

      // Verify membership in database
      const member = await WorkspaceMemberModelAdapter.findMember(
        res.body.data.workspace.id,
        userA.user.id
      );
      expect(member).not.toBeNull();
      expect(member!.role).toBe('OWNER');
    });

    it('rejects duplicate workspace slug', async () => {
      await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Acme 1', slug: 'duplicate-slug' });

      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ name: 'Acme 2', slug: 'duplicate-slug' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('lists user workspaces and returns accurate member counts', async () => {
      await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Workspace One', slug: 'ws-one' });

      await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Workspace Two', slug: 'ws-two' });

      const res = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workspaces.length).toBe(2);
      expect(res.body.data.workspaces[0].role).toBe('OWNER');
    });

    it('denies workspace access to non-members (workspace isolation)', async () => {
      const createRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Secret Lab', slug: 'secret-lab' });
      const wsId = createRes.body.data.workspace.id;

      // User C (outsider) attempts to view
      const res = await request(app)
        .get(`/api/workspaces/${wsId}`)
        .set('Authorization', `Bearer ${userC.token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('not a member');
    });

    it('allows OWNER to update workspace settings and prevents unauthorized non-admins', async () => {
      const createRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Alpha Lab', slug: 'alpha-lab' });
      const wsId = createRes.body.data.workspace.id;

      // Update as OWNER
      const updateRes = await request(app)
        .patch(`/api/workspaces/${wsId}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Alpha Innovations Lab', description: 'Updated description' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.workspace.name).toBe('Alpha Innovations Lab');
    });
  });

  describe('Invitations & Acceptance Workflow', () => {
    let wsId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Rocket Propulsion', slug: 'rocket-propulsion' });
      wsId = res.body.data.workspace.id;
    });

    it('creates a secure invitation and returns invitation link', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${wsId}/invitations`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          email: 'bob@acme.inc',
          role: 'ADMIN',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inviteUrl).toBeDefined();
      expect(res.body.data.invitation.invitedEmail).toBe('bob@acme.inc');
      expect(res.body.data.invitation.role).toBe('ADMIN');
      expect(res.body.data.invitation.tokenHash).toBeUndefined(); // Never expose hash
    });

    it('rejects duplicate pending invitation for the same email', async () => {
      await request(app)
        .post(`/api/workspaces/${wsId}/invitations`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ email: 'bob@acme.inc', role: 'MEMBER' });

      const res = await request(app)
        .post(`/api/workspaces/${wsId}/invitations`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ email: 'bob@acme.inc', role: 'MEMBER' });

      expect(res.status).toBe(409);
    });

    it('rejects invitation acceptance if logged in with wrong email', async () => {
      // Invite Bob
      const invRes = await request(app)
        .post(`/api/workspaces/${wsId}/invitations`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ email: 'bob@acme.inc', role: 'MEMBER' });

      const inviteUrl = invRes.body.data.inviteUrl;
      const token = inviteUrl.split('/invite/')[1];

      // Charlie (charlie@other.com) attempts to accept Bob's invitation
      const acceptRes = await request(app)
        .post(`/api/invitations/${token}/accept`)
        .set('Authorization', `Bearer ${userC.token}`);

      expect(acceptRes.status).toBe(403);
      expect(acceptRes.body.message).toContain('bob@acme.inc');
    });

    it('successfully accepts invitation with matching email and creates membership', async () => {
      // Invite Bob as ADMIN
      const invRes = await request(app)
        .post(`/api/workspaces/${wsId}/invitations`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ email: 'bob@acme.inc', role: 'ADMIN' });

      const inviteUrl = invRes.body.data.inviteUrl;
      const token = inviteUrl.split('/invite/')[1];

      // Bob accepts
      const acceptRes = await request(app)
        .post(`/api/invitations/${token}/accept`)
        .set('Authorization', `Bearer ${userB.token}`);

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.success).toBe(true);
      expect(acceptRes.body.data.member.role).toBe('ADMIN');

      // Verify Bob is now a member in workspace
      const member = await WorkspaceMemberModelAdapter.findMember(wsId, userB.user.id);
      expect(member).not.toBeNull();
      expect(member!.role).toBe('ADMIN');

      // Attempting to reuse accepted token is rejected
      const reuseRes = await request(app)
        .post(`/api/invitations/${token}/accept`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.message).toContain('already been accepted');
    });

    it('allows revoking an invitation and prevents revoked token acceptance', async () => {
      const invRes = await request(app)
        .post(`/api/workspaces/${wsId}/invitations`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ email: 'david@acme.inc', role: 'VIEWER' });

      const invId = invRes.body.data.invitation.id;
      const token = invRes.body.data.inviteUrl.split('/invite/')[1];

      // Revoke
      const revokeRes = await request(app)
        .delete(`/api/workspaces/${wsId}/invitations/${invId}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(revokeRes.status).toBe(200);

      // Register David and attempt to accept
      const resD = await request(app).post('/api/auth/register').send({
        fullName: 'David',
        email: 'david@acme.inc',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });

      const acceptRes = await request(app)
        .post(`/api/invitations/${token}/accept`)
        .set('Authorization', `Bearer ${resD.body.data.token}`);

      expect(acceptRes.status).toBe(400);
      expect(acceptRes.body.message).toContain('revoked');
    });
  });

  describe('Team Member Directory, RBAC & Protection Rules', () => {
    let wsId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Platform Engineering', slug: 'platform-eng' });
      wsId = res.body.data.workspace.id;

      // Add User B directly as ADMIN
      await WorkspaceMemberModelAdapter.createMember({
        workspaceId: wsId,
        userId: userB.user.id,
        role: 'ADMIN',
      });

      // Add User C directly as MEMBER
      await WorkspaceMemberModelAdapter.createMember({
        workspaceId: wsId,
        userId: userC.user.id,
        role: 'MEMBER',
      });
    });

    it('lists all members with populated user information', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${wsId}/members`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.members.length).toBe(3);
      const roles = res.body.data.members.map((m: any) => m.role);
      expect(roles).toContain('OWNER');
      expect(roles).toContain('ADMIN');
      expect(roles).toContain('MEMBER');
    });

    it('enforces Last Owner Protection (sole owner cannot leave or remove themselves)', async () => {
      // User A (sole OWNER) attempts to leave
      const leaveRes = await request(app)
        .post(`/api/workspaces/${wsId}/leave`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(leaveRes.status).toBe(400);
      expect(leaveRes.body.message).toContain('only owner');
    });

    it('prevents ADMIN from promoting anyone to OWNER', async () => {
      // User B (ADMIN) attempts to promote User C to OWNER
      const res = await request(app)
        .patch(`/api/workspaces/${wsId}/members/${userC.user.id}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ role: 'OWNER' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Only current workspace owners');
    });

    it('prevents ADMIN from removing or demoting the workspace OWNER', async () => {
      // User B (ADMIN) attempts to remove User A (OWNER)
      const res = await request(app)
        .delete(`/api/workspaces/${wsId}/members/${userA.user.id}`)
        .set('Authorization', `Bearer ${userB.token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('cannot modify or remove workspace owners');
    });

    it('prevents MEMBER from modifying member roles or removing teammates', async () => {
      // User C (MEMBER) attempts to demote User B
      const res = await request(app)
        .patch(`/api/workspaces/${wsId}/members/${userB.user.id}`)
        .set('Authorization', `Bearer ${userC.token}`)
        .send({ role: 'VIEWER' });

      expect(res.status).toBe(403);
    });

    it('allows ordinary members to leave the workspace', async () => {
      // User C (MEMBER) leaves
      const leaveRes = await request(app)
        .post(`/api/workspaces/${wsId}/leave`)
        .set('Authorization', `Bearer ${userC.token}`);

      expect(leaveRes.status).toBe(200);
      expect(leaveRes.body.success).toBe(true);

      const member = await WorkspaceMemberModelAdapter.findMember(wsId, userC.user.id);
      expect(member).toBeNull();
    });
  });

  describe('Workspace Ownership Transfer', () => {
    let wsId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Transfer Corp', slug: 'transfer-corp' });
      wsId = res.body.data.workspace.id;

      // Add User B as member
      await WorkspaceMemberModelAdapter.createMember({
        workspaceId: wsId,
        userId: userB.user.id,
        role: 'MEMBER',
      });
    });

    it('allows owner to initiate transfer and recipient to accept atomically', async () => {
      // User A (Owner) initiates transfer to User B
      const initRes = await request(app)
        .post(`/api/workspaces/${wsId}/transfer-ownership`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ recipientUserId: userB.user.id });

      expect(initRes.status).toBe(200);
      expect(initRes.body.success).toBe(true);

      // User B accepts transfer
      const acceptRes = await request(app)
        .post(`/api/workspaces/${wsId}/transfer-ownership/accept`)
        .set('Authorization', `Bearer ${userB.token}`);

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.success).toBe(true);

      // Verify User B is now OWNER and User A is now ADMIN
      const memberB = await WorkspaceMemberModelAdapter.findMember(wsId, userB.user.id);
      const memberA = await WorkspaceMemberModelAdapter.findMember(wsId, userA.user.id);
      expect(memberB!.role).toBe('OWNER');
      expect(memberA!.role).toBe('ADMIN');

      // Now User A can leave workspace since User B is the new owner
      const leaveRes = await request(app)
        .post(`/api/workspaces/${wsId}/leave`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(leaveRes.status).toBe(200);
    });

    it('prevents non-owners from initiating ownership transfer', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${wsId}/transfer-ownership`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ recipientUserId: userB.user.id });

      expect(res.status).toBe(403);
    });
  });
});
