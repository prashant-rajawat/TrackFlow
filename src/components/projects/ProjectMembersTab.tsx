import React, { useState, useEffect, useCallback } from 'react';
import { Project, ProjectMember, ProjectRole } from '../../types/project';
import { projectService } from '../../services/project.service';
import { workspaceService } from '../../services/workspace.service';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { UserPlus, ShieldAlert, User, Trash2, X, AlertTriangle } from 'lucide-react';
import { WorkspaceMember } from '../../types/workspace';

interface ProjectMembersTabProps {
  project: Project;
}

const ROLE_LABELS: Record<ProjectRole, string> = {
  PROJECT_ADMIN: 'Project Admin',
  DEVELOPER: 'Developer',
  VIEWER: 'Viewer',
};

export const ProjectMembersTab: React.FC<ProjectMembersTabProps> = ({ project }) => {
  const { currentWorkspace } = useWorkspace();
  const { addToast } = useToast();

  const canManageMembers =
    project.projectPermissions?.canManageMembers ??
    (currentWorkspace?.role === 'OWNER' ||
      currentWorkspace?.role === 'ADMIN' ||
      project.currentUserProjectRole === 'PROJECT_ADMIN');

  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedWorkspaceUserId, setSelectedWorkspaceUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<ProjectRole>('DEVELOPER');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const [pMembers, wMembers] = await Promise.all([
        projectService.listProjectMembers(project.id),
        canManageMembers
          ? workspaceService.listMembers(currentWorkspace.id).catch(() => [] as WorkspaceMember[])
          : Promise.resolve([] as WorkspaceMember[]),
      ]);
      setProjectMembers(pMembers);
      setWorkspaceMembers(wMembers);
    } catch (err: any) {
      addToast(err.message || 'Failed to load members', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [project.id, currentWorkspace?.id, canManageMembers, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const existingProjectUserIds = new Set(projectMembers.map((m) => m.userId));
  const availableWorkspaceMembers = workspaceMembers.filter(
    (wm: WorkspaceMember) => !existingProjectUserIds.has(wm.userId)
  );

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspaceUserId || !canManageMembers) return;

    setIsSubmitting(true);
    try {
      await projectService.addProjectMember(project.id, selectedWorkspaceUserId, selectedRole);
      addToast('Project member added successfully', 'success');
      setIsAddModalOpen(false);
      setSelectedWorkspaceUserId('');
      setSelectedRole('DEVELOPER');
      fetchData();
    } catch (err: any) {
      addToast(err.message || 'Failed to add project member', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: ProjectRole) => {
    if (!canManageMembers) return;
    try {
      await projectService.updateMemberRole(project.id, userId, newRole);
      addToast('Project member role updated', 'success');
      fetchData();
    } catch (err: any) {
      addToast(err.message || 'Failed to update role', 'error');
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove || !canManageMembers) return;
    setIsRemoving(true);
    setRemoveError(null);
    try {
      await projectService.removeProjectMember(project.id, memberToRemove.userId);
      addToast('Project member removed', 'success');
      setMemberToRemove(null);
      fetchData();
    } catch (err: any) {
      const msg = err.message || 'Failed to remove member';
      setRemoveError(msg);
      addToast(msg, 'error');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Project Members (<span className="font-mono tabular-nums">{projectMembers.length}</span>)
          </h3>
          <p className="text-xs text-slate-500">
            Manage team collaboration and role access for this project
          </p>
        </div>
        {canManageMembers && (
          <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" />
            <span>Add Member</span>
          </Button>
        )}
      </div>

      {!canManageMembers && (
        <div className="px-4 py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          <span>
            Read-only membership view: only Project Admins or Workspace Admins/Owners can add, update, or remove project members.
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading project members...</div>
        ) : projectMembers.length === 0 ? (
          <div className="p-12 text-center">
            <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">No project members yet</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {canManageMembers
                ? 'Add workspace members to collaborate on this project.'
                : 'No members have been assigned to this project yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {projectMembers.map((m) => (
              <div
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-6 py-4 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center text-sm shrink-0">
                    {m.user?.fullName ? m.user.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {m.user?.fullName || 'Unknown User'}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{m.user?.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {canManageMembers ? (
                    <>
                      <select
                        aria-label={`Role for ${m.user?.fullName || m.user?.email || m.userId}`}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.userId, e.target.value as ProjectRole)}
                      >
                        <option value="PROJECT_ADMIN">Project Admin</option>
                        <option value="DEVELOPER">Developer</option>
                        <option value="VIEWER">Viewer</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          setRemoveError(null);
                          setMemberToRemove(m);
                        }}
                        aria-label={`Remove ${m.user?.fullName || m.user?.email || 'member'}`}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-medium text-slate-700">
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {isAddModalOpen && canManageMembers && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-project-member-title"
            className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 id="add-project-member-title" className="text-base font-semibold text-slate-900">
                Add Workspace Member to Project
              </h3>
              <button
                type="button"
                aria-label="Close add member modal"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Workspace Member
                </label>
                <select
                  className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  value={selectedWorkspaceUserId}
                  onChange={(e) => setSelectedWorkspaceUserId(e.target.value)}
                  required
                >
                  <option value="">Select Member...</option>
                  {availableWorkspaceMembers.map((wm: WorkspaceMember) => (
                    <option key={wm.userId} value={wm.userId}>
                      {wm.user?.fullName} ({wm.user?.email}) - {wm.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Project Role
                </label>
                <select
                  className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as ProjectRole)}
                >
                  <option value="PROJECT_ADMIN">Project Admin</option>
                  <option value="DEVELOPER">Developer</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting} disabled={!selectedWorkspaceUserId}>
                  Add Member
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Dialog (replaces window.confirm) */}
      {memberToRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={() => {
            if (!isRemoving) setMemberToRemove(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-project-member-title"
            className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
                <h3 id="remove-project-member-title" className="text-base font-semibold text-slate-900">
                  Remove Project Member
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close remove member dialog"
                disabled={isRemoving}
                onClick={() => setMemberToRemove(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Remove{' '}
                <strong className="font-semibold text-slate-900">
                  {memberToRemove.user?.fullName || memberToRemove.user?.email || 'this user'}
                </strong>{' '}
                from <strong className="font-semibold text-slate-900">{project.name}</strong>? They will lose project-scoped permissions immediately.
              </p>

              {removeError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700"
                >
                  {removeError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isRemoving}
                  onClick={() => setMemberToRemove(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  isLoading={isRemoving}
                  onClick={handleConfirmRemoveMember}
                >
                  Remove Member
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
