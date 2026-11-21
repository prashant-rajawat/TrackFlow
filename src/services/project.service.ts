import { api } from './api';
import { Project, ProjectMember, ProjectRole, ProjectStatus, ProjectVisibility } from '../types/project';

export const projectService = {
  async listProjects(workspaceId: string): Promise<Project[]> {
    const res = await api.get<{ projects: Project[] }>(`/api/projects?workspaceId=${workspaceId}`);
    return res.data!.projects;
  },

  async createProject(data: {
    name: string;
    key: string;
    description?: string;
    workspaceId: string;
    leadId?: string;
    visibility?: ProjectVisibility;
    startDate?: string | null;
    targetDate?: string | null;
    color?: string;
  }): Promise<Project> {
    const res = await api.post<{ project: Project }>('/api/projects', data);
    return res.data!.project;
  },

  async getProject(projectId: string): Promise<Project> {
    const res = await api.get<{ project: Project }>(`/api/projects/${projectId}`);
    return res.data!.project;
  },

  async updateProject(
    projectId: string,
    data: {
      name?: string;
      description?: string;
      leadId?: string | null;
      status?: ProjectStatus;
      visibility?: ProjectVisibility;
      startDate?: string | null;
      targetDate?: string | null;
      color?: string;
    }
  ): Promise<Project> {
    const res = await api.patch<{ project: Project }>(`/api/projects/${projectId}`, data);
    return res.data!.project;
  },

  async archiveProject(projectId: string): Promise<Project> {
    const res = await api.post<{ project: Project }>(`/api/projects/${projectId}/archive`);
    return res.data!.project;
  },

  async restoreProject(projectId: string): Promise<Project> {
    const res = await api.post<{ project: Project }>(`/api/projects/${projectId}/restore`);
    return res.data!.project;
  },

  async deleteProject(projectId: string): Promise<void> {
    await api.delete(`/api/projects/${projectId}`);
  },

  async listProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const res = await api.get<{ members: ProjectMember[] }>(`/api/projects/${projectId}/members`);
    return res.data!.members;
  },

  async addProjectMember(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember> {
    const res = await api.post<{ member: ProjectMember }>(`/api/projects/${projectId}/members`, { userId, role });
    return res.data!.member;
  },

  async updateMemberRole(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember> {
    const res = await api.patch<{ member: ProjectMember }>(`/api/projects/${projectId}/members/${userId}`, { role });
    return res.data!.member;
  },

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    await api.delete(`/api/projects/${projectId}/members/${userId}`);
  },
};
