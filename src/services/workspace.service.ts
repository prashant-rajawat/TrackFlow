import { api } from './api';
import {
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
  Invitation,
} from '../types/workspace';

export const workspaceService = {
  async createWorkspace(data: {
    name: string;
    slug?: string;
    description?: string;
  }): Promise<Workspace> {
    const res = await api.post<{ workspace: Workspace }>('/api/workspaces', data);
    if (!res.data?.workspace) throw new Error(res.message || 'Failed to create workspace');
    return res.data.workspace;
  },

  async listWorkspaces(): Promise<Workspace[]> {
    const res = await api.get<{ workspaces: Workspace[] }>('/api/workspaces');
    return res.data?.workspaces || [];
  },

  async getWorkspace(id: string): Promise<Workspace> {
    const res = await api.get<{ workspace: Workspace }>(`/api/workspaces/${id}`);
    if (!res.data?.workspace) throw new Error('Workspace not found');
    return res.data.workspace;
  },

  async updateWorkspace(
    id: string,
    data: { name?: string; description?: string }
  ): Promise<Workspace> {
    const res = await api.patch<{ workspace: Workspace }>(`/api/workspaces/${id}`, data);
    if (!res.data?.workspace) throw new Error(res.message || 'Failed to update workspace');
    return res.data.workspace;
  },

  async deleteWorkspace(id: string): Promise<void> {
    await api.delete(`/api/workspaces/${id}`);
  },

  // Members
  async listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const res = await api.get<{ members: WorkspaceMember[] }>(
      `/api/workspaces/${workspaceId}/members`
    );
    return res.data?.members || [];
  },

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ): Promise<WorkspaceMember> {
    const res = await api.patch<{ member: WorkspaceMember }>(
      `/api/workspaces/${workspaceId}/members/${userId}`,
      { role }
    );
    if (!res.data?.member) throw new Error(res.message || 'Failed to update member role');
    return res.data.member;
  },

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await api.delete(`/api/workspaces/${workspaceId}/members/${userId}`);
  },

  async leaveWorkspace(workspaceId: string): Promise<void> {
    await api.post(`/api/workspaces/${workspaceId}/leave`);
  },

  // Invitations
  async createInvitation(
    workspaceId: string,
    data: { email: string; role: WorkspaceRole }
  ): Promise<{ invitation: Invitation; inviteUrl: string; emailSent: boolean }> {
    const res = await api.post<{
      invitation: Invitation;
      inviteUrl: string;
      emailSent: boolean;
    }>(`/api/workspaces/${workspaceId}/invitations`, data);
    if (!res.data) throw new Error(res.message || 'Failed to create invitation');
    return res.data;
  },

  async listInvitations(workspaceId: string): Promise<Invitation[]> {
    const res = await api.get<{ invitations: Invitation[] }>(
      `/api/workspaces/${workspaceId}/invitations`
    );
    return res.data?.invitations || [];
  },

  async revokeInvitation(workspaceId: string, invitationId: string): Promise<void> {
    await api.delete(`/api/workspaces/${workspaceId}/invitations/${invitationId}`);
  },

  async getInvitationByToken(token: string): Promise<Invitation> {
    const res = await api.get<{ invitation: Invitation }>(`/api/invitations/${token}`);
    if (!res.data?.invitation) throw new Error(res.message || 'Invitation not found');
    return res.data.invitation;
  },

  async acceptInvitation(token: string): Promise<{ workspaceId: string }> {
    const res = await api.post<{ workspaceId: string }>(`/api/invitations/${token}/accept`);
    if (!res.data?.workspaceId) throw new Error(res.message || 'Failed to accept invitation');
    return res.data;
  },

  async declineInvitation(token: string): Promise<void> {
    await api.post(`/api/invitations/${token}/decline`);
  },
};
