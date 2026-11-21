import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import {
  Issue,
  IssuePermissions,
  IssuePriority,
  IssueStatus,
  UpdateIssuePayload,
} from '../../types/issue';
import { ProjectMember } from '../../types/project';
import { issueService } from '../../services/issue.service';
import { projectService } from '../../services/project.service';
import { useToast } from '../../context/ToastContext';
import { IssueDetailsPanel } from '../issues/IssueDetailsPanel';
import { DeleteIssueDialog } from '../issues/DeleteIssueDialog';

interface KanbanIssueDrawerProps {
  issue: Issue | null;
  initialPermissions?: IssuePermissions;
  onClose: () => void;
  onIssueSynchronized: (updated: Issue) => void;
  onIssueDeleted: (deletedId: string) => void;
}

const DEFAULT_READ_ONLY: IssuePermissions = {
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

export const KanbanIssueDrawer: React.FC<KanbanIssueDrawerProps> = ({
  issue,
  initialPermissions,
  onClose,
  onIssueSynchronized,
  onIssueDeleted,
}) => {
  const { addToast } = useToast();
  const [permissions, setPermissions] = useState<IssuePermissions>(
    initialPermissions || DEFAULT_READ_ONLY
  );
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [editServerError, setEditServerError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setPermissions(initialPermissions || DEFAULT_READ_ONLY);
  }, [initialPermissions, issue?.id]);

  useEffect(() => {
    if (!issue) {
      setEditServerError(null);
      setDeleteError(null);
      setIsDeleteOpen(false);
      return;
    }

    let cancelled = false;
    setIsRefreshing(true);
    setEditServerError(null);

    Promise.all([
      issueService.getIssue(issue.id).catch(() => null),
      projectService.listProjectMembers(issue.projectId).catch(() => [] as ProjectMember[]),
    ])
      .then(([detailRes, members]) => {
        if (cancelled) return;
        setProjectMembers(members);
        if (detailRes) {
          onIssueSynchronized(detailRes.issue);
          if (detailRes.permissions) {
            setPermissions(detailRes.permissions);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setIsRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [issue?.id]);

  useEffect(() => {
    if (!issue) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isMutating && !isDeleteOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [issue, isMutating, isDeleteOpen, onClose]);

  if (!issue) return null;

  const handleUpdateIssue = async (payload: UpdateIssuePayload) => {
    setIsMutating(true);
    setEditServerError(null);
    try {
      const res = await issueService.updateIssue(issue.id, payload);
      onIssueSynchronized(res.issue);
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
    setIsMutating(true);
    try {
      const res = await issueService.updateStatus(issue.id, status);
      onIssueSynchronized(res.issue);
      if (res.permissions) setPermissions(res.permissions);
      addToast(`Moved ${issue.issueKey} to ${status.replace('_', ' ')}`, 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to update status', 'error');
    } finally {
      setIsMutating(false);
    }
  };

  const handleQuickPriorityChange = async (priority: IssuePriority) => {
    setIsMutating(true);
    try {
      const res = await issueService.updatePriority(issue.id, priority);
      onIssueSynchronized(res.issue);
      addToast('Issue priority updated', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to update priority', 'error');
    } finally {
      setIsMutating(false);
    }
  };

  const handleQuickAssigneeChange = async (assigneeId: string | null) => {
    setIsMutating(true);
    try {
      const res = await issueService.updateAssignee(issue.id, assigneeId);
      onIssueSynchronized(res.issue);
      addToast(assigneeId ? 'Issue assignee updated' : 'Issue unassigned', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to update assignee', 'error');
    } finally {
      setIsMutating(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsMutating(true);
    setDeleteError(null);
    try {
      await issueService.deleteIssue(issue.id);
      addToast(`Deleted ${issue.issueKey}`, 'success');
      setIsDeleteOpen(false);
      onIssueDeleted(issue.id);
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete issue';
      setDeleteError(msg);
      addToast(msg, 'error');
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs"
        onClick={() => {
          if (!isMutating && !isDeleteOpen) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Issue details for ${issue.issueKey}`}
          className="w-full max-w-4xl bg-slate-50 h-full shadow-xl border-l border-slate-200 flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className="px-5 sm:px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums shrink-0">
                {issue.issueKey}
              </span>
              {issue.project?.name && (
                <>
                  <span className="text-slate-300" aria-hidden="true">
                    /
                  </span>
                  <span className="text-xs font-medium text-slate-600 truncate">
                    {issue.project.name}
                  </span>
                </>
              )}
              {isRefreshing && (
                <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" aria-hidden="true" />
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to={`/projects/${issue.projectId}/issues/${issue.id}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Full Page</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (!isMutating) onClose();
                }}
                aria-label="Close issue details"
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Drawer Body reusing canonical IssueDetailsPanel */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
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
                setIsDeleteOpen(true);
              }}
            />
          </div>
        </div>
      </div>

      <DeleteIssueDialog
        isOpen={isDeleteOpen}
        issue={issue}
        isDeleting={isMutating}
        error={deleteError}
        onCancel={() => {
          if (!isMutating) {
            setDeleteError(null);
            setIsDeleteOpen(false);
          }
        }}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
};
