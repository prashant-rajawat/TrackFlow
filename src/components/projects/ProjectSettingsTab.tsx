import React, { useState, useEffect } from 'react';
import { Project, ProjectVisibility } from '../../types/project';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { projectService } from '../../services/project.service';
import { workspaceService } from '../../services/workspace.service';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { AlertTriangle, Archive, RotateCcw, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WorkspaceMember } from '../../types/workspace';

interface ProjectSettingsTabProps {
  project: Project;
  onProjectUpdated: (updated: Project) => void;
}

export const ProjectSettingsTab: React.FC<ProjectSettingsTabProps> = ({ project, onProjectUpdated }) => {
  const { currentWorkspace } = useWorkspace();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const isWsPrivileged =
    currentWorkspace?.role === 'OWNER' || currentWorkspace?.role === 'ADMIN';
  const isWsViewer = currentWorkspace?.role === 'VIEWER';
  const isProjViewer = project.currentUserProjectRole === 'VIEWER';

  const canUpdate =
    project.projectPermissions?.canUpdate ??
    (!isWsViewer && !isProjViewer && (isWsPrivileged || !!project.currentUserProjectRole));
  const canArchiveRestore = project.projectPermissions?.canArchiveRestore ?? canUpdate;
  const canDelete =
    project.projectPermissions?.canDelete ??
    (!isWsViewer &&
      (currentWorkspace?.role === 'OWNER' ||
        project.currentUserProjectRole === 'PROJECT_ADMIN'));

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [leadId, setLeadId] = useState(project.leadId || '');
  const [visibility, setVisibility] = useState<ProjectVisibility>(project.visibility);
  const [startDate, setStartDate] = useState(project.startDate ? project.startDate.split('T')[0] : '');
  const [targetDate, setTargetDate] = useState(project.targetDate ? project.targetDate.split('T')[0] : '');
  const [color, setColor] = useState(project.color || 'blue');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      workspaceService.listMembers(currentWorkspace.id)
        .then((list) => setMembers(list))
        .catch(() => setMembers([]));
    }
  }, [currentWorkspace?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpdate) return;
    setIsSaving(true);
    try {
      const updated = await projectService.updateProject(project.id, {
        name: name.trim(),
        description: description.trim(),
        leadId: leadId || null,
        visibility,
        startDate: startDate || null,
        targetDate: targetDate || null,
        color,
      });
      addToast('Project settings updated successfully', 'success');
      onProjectUpdated(updated);
    } catch (err: any) {
      addToast(err.message || 'Failed to update project', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!canArchiveRestore) return;
    setIsArchiving(true);
    try {
      let updated: Project;
      if (project.status === 'ACTIVE') {
        updated = await projectService.archiveProject(project.id);
        addToast('Project archived successfully', 'success');
      } else {
        updated = await projectService.restoreProject(project.id);
        addToast('Project restored successfully', 'success');
      }
      onProjectUpdated(updated);
    } catch (err: any) {
      addToast(err.message || 'Failed to change project status', 'error');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete || deleteConfirmationText !== project.key) return;
    setIsDeleting(true);
    try {
      await projectService.deleteProject(project.id);
      addToast('Project deleted permanently', 'success');
      navigate('/projects');
    } catch (err: any) {
      addToast(err.message || 'Failed to delete project', 'error');
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      {!canUpdate && (
        <div className="px-4 py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          <span>
            Read-only project settings: viewers and non-members cannot modify project configuration.
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-1">General Project Settings</h3>
        <p className="text-xs text-slate-500 mb-6">Update project metadata, lead, and schedule</p>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Project Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canUpdate}
                required
              />
            </div>
            <div>
              <Input
                label="Project Key"
                value={project.key}
                disabled
                className="bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              disabled={!canUpdate}
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all resize-none disabled:bg-slate-50 disabled:text-slate-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Project Lead
              </label>
              <select
                disabled={!canUpdate}
                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
              >
                <option value="">No Lead</option>
                {members.map((m: WorkspaceMember) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.fullName} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Visibility
              </label>
              <select
                disabled={!canUpdate}
                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as ProjectVisibility)}
              >
                <option value="WORKSPACE">Workspace (All Members)</option>
                <option value="PRIVATE">Private (Members Only)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              disabled={!canUpdate}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="Target Date"
              type="date"
              disabled={!canUpdate}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          {canUpdate && (
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button type="submit" isLoading={isSaving}>
                Save Changes
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* Archive / Restore section */}
      {canArchiveRestore && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              {project.status === 'ACTIVE' ? 'Archive Project' : 'Restore Project'}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {project.status === 'ACTIVE'
                ? 'Archiving hides the project from active workflows and read-only locks issues.'
                : 'Restoring returns the project to active status and workflow participation.'}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={handleToggleArchive}
            isLoading={isArchiving}
            className="flex items-center gap-1.5 shrink-0"
          >
            {project.status === 'ACTIVE' ? (
              <>
                <Archive className="w-4 h-4 text-amber-600" />
                <span>Archive</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 text-emerald-600" />
                <span>Restore</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Danger Zone */}
      {canDelete && (
        <div className="bg-white rounded-xl border border-rose-200 shadow-xs p-6">
          <h4 className="text-sm font-semibold text-rose-700 mb-1">Danger Zone</h4>
          <p className="text-xs text-slate-500 mb-4">
            Permanently delete this project and all associated project memberships. This action cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              Delete Project
            </Button>
        ) : (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-rose-800 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Are you sure you want to delete project <strong className="font-mono">{project.key}</strong>?</span>
            </div>
            <p className="text-xs text-slate-600">
              Type <strong className="font-mono">{project.key}</strong> below to confirm permanent deletion:
            </p>
            <input
              type="text"
              className="w-full px-3 py-1.5 text-sm font-mono text-slate-900 bg-white border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              placeholder={project.key}
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmationText('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={deleteConfirmationText !== project.key}
                isLoading={isDeleting}
                onClick={handleDelete}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
};
