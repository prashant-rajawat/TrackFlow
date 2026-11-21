import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { issueService } from '../../services/issue.service';
import { projectService } from '../../services/project.service';
import { useToast } from '../../context/ToastContext';
import {
  Issue,
  IssuePermissions,
  IssuePriority,
  IssueStatus,
  UpdateIssuePayload,
} from '../../types/issue';
import { Project, ProjectMember } from '../../types/project';
import { IssueDetailsPanel } from '../../components/issues/IssueDetailsPanel';
import { DeleteIssueDialog } from '../../components/issues/DeleteIssueDialog';
import { Button } from '../../components/common/Button';

const READ_ONLY_PERMISSIONS: IssuePermissions = {
  canView: true,
  canCreate: false,
  canUpdate: false,
  canAssign: false,
  canUpdateStatus: false,
  canUpdatePriority: false,
  canDelete: false,
  canViewComments: true,
  canCreateComment: false,
  canModerateComments: false,
  canViewAttachments: true,
  canUploadAttachments: false,
  canDeleteOwnAttachment: false,
  canDeleteAnyAttachment: false,
};

export const IssueDetailsPage: React.FC = () => {
  const { projectId, issueId } = useParams<{ projectId?: string; issueId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [permissions, setPermissions] = useState<IssuePermissions>(READ_ONLY_PERMISSIONS);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [editServerError, setEditServerError] = useState<string | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchIssueDetails = useCallback(async () => {
    if (!issueId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await issueService.getIssue(issueId);
      setIssue(data.issue);
      setProject(data.project);
      if (data.permissions) {
        setPermissions(data.permissions);
      }

      const members = await projectService
        .listProjectMembers(data.issue.projectId)
        .catch(() => [] as ProjectMember[]);
      setProjectMembers(members);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load issue details');
    } finally {
      setIsLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    fetchIssueDetails();
  }, [fetchIssueDetails]);

  const handleUpdateIssue = async (payload: UpdateIssuePayload) => {
    if (!issue) return;
    setIsMutating(true);
    setEditServerError(null);
    try {
      const res = await issueService.updateIssue(issue.id, payload);
      setIssue(res.issue);
      if (res.permissions) setPermissions(res.permissions);
      addToast('Issue updated successfully', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to update issue';
      setEditServerError(msg);
      addToast(msg, 'error');
      throw err;
    } finally {
      setIsMutating(false);
    }
  };

  const handleQuickStatusChange = async (status: IssueStatus) => {
    if (!issue) return;
    setIsMutating(true);
    try {
      const res = await issueService.updateStatus(issue.id, status);
      setIssue(res.issue);
      addToast('Issue status updated', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to update status', 'error');
    } finally {
      setIsMutating(false);
    }
  };

  const handleQuickPriorityChange = async (priority: IssuePriority) => {
    if (!issue) return;
    setIsMutating(true);
    try {
      const res = await issueService.updatePriority(issue.id, priority);
      setIssue(res.issue);
      addToast('Issue priority updated', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to update priority', 'error');
    } finally {
      setIsMutating(false);
    }
  };

  const handleQuickAssigneeChange = async (assigneeId: string | null) => {
    if (!issue) return;
    setIsMutating(true);
    try {
      const res = await issueService.updateAssignee(issue.id, assigneeId);
      setIssue(res.issue);
      addToast(assigneeId ? 'Issue assignee updated' : 'Issue unassigned', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to update assignee', 'error');
    } finally {
      setIsMutating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!issue) return;
    setIsMutating(true);
    setDeleteError(null);
    try {
      await issueService.deleteIssue(issue.id);
      addToast(`Deleted ${issue.issueKey}`, 'success');
      navigate(`/projects/${projectId || issue.projectId}/issues`, { replace: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete issue';
      setDeleteError(msg);
      addToast(msg, 'error');
    } finally {
      setIsMutating(false);
    }
  };

  const backHref = projectId
    ? `/projects/${projectId}/issues`
    : issue
    ? `/projects/${issue.projectId}/issues`
    : '/issues';

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center text-sm text-slate-500">
        Loading issue details...
      </div>
    );
  }

  if (loadError || !issue) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div role="alert" className="bg-white rounded-xl border border-rose-200 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h1 className="text-base font-semibold text-slate-900">Unable to view issue</h1>
              <p className="text-sm text-slate-600 mt-1">{loadError || 'Issue not found.'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigate('/issues')}>
              Go to All Issues
            </Button>
            <Button variant="outline" size="sm" onClick={fetchIssueDetails}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Breadcrumb Back Navigation */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          to={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>
            Back to {project?.name ? `${project.name} Issues` : 'Issues'}
          </span>
        </Link>

        {project && (
          <Link
            to={`/projects/${project.id}`}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            Project: <span className="font-mono text-slate-700">{project.key}</span> · {project.name}
          </Link>
        )}
      </div>

      <IssueDetailsPanel
        issue={issue}
        permissions={permissions}
        projectMembers={projectMembers}
        isMutating={isMutating}
        editServerError={editServerError}
        onUpdateIssue={handleUpdateIssue}
        onQuickStatusChange={handleQuickStatusChange}
        onQuickPriorityChange={handleQuickPriorityChange}
        onQuickAssigneeChange={handleQuickAssigneeChange}
        onRequestDelete={() => {
          setDeleteError(null);
          setIsDeleteDialogOpen(true);
        }}
      />

      <DeleteIssueDialog
        isOpen={isDeleteDialogOpen}
        issue={issue}
        isDeleting={isMutating}
        error={deleteError}
        onCancel={() => {
          if (!isMutating) {
            setDeleteError(null);
            setIsDeleteDialogOpen(false);
          }
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
