import React, { useState } from 'react';
import { Edit2, Trash2, Calendar, User, Clock, ShieldAlert } from 'lucide-react';
import {
  Issue,
  IssuePermissions,
  IssuePriority as IssuePriorityValue,
  IssueStatus as IssueStatusValue,
  UpdateIssuePayload,
} from '../../types/issue';
import { ProjectMember } from '../../types/project';
import { IssueType } from './IssueType';
import { IssuePriority } from './IssuePriority';
import { IssueStatus } from './IssueStatus';
import { IssueAssignee } from './IssueAssignee';
import { IssueForm } from './IssueForm';
import { AttachmentSection } from '../attachments/AttachmentSection';
import { CommentSection } from '../comments/CommentSection';
import { Button } from '../common/Button';

interface IssueDetailsPanelProps {
  issue: Issue;
  permissions: IssuePermissions;
  projectMembers: ProjectMember[];
  currentUserId?: string;
  isMutating?: boolean;
  editServerError?: string | null;
  onUpdateIssue: (payload: UpdateIssuePayload) => Promise<void>;
  onQuickStatusChange: (status: IssueStatusValue) => Promise<void>;
  onQuickPriorityChange: (priority: IssuePriorityValue) => Promise<void>;
  onQuickAssigneeChange: (assigneeId: string | null) => Promise<void>;
  onRequestDelete: () => void;
}

const formatTimestamp = (iso: string | null | undefined): string => {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not set';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const IssueDetailsPanel: React.FC<IssueDetailsPanelProps> = ({
  issue,
  permissions,
  projectMembers,
  currentUserId,
  isMutating = false,
  editServerError = null,
  onUpdateIssue,
  onQuickStatusChange,
  onQuickPriorityChange,
  onQuickAssigneeChange,
  onRequestDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveEdit = async (payload: UpdateIssuePayload) => {
    await onUpdateIssue(payload);
    setIsEditing(false);
  };

  const isReadOnlyViewer =
    !permissions.canUpdate &&
    !permissions.canUpdateStatus &&
    !permissions.canCreateComment &&
    !permissions.canUploadAttachments;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content Area + Attachments + Comments */}
      <div className="lg:col-span-2 space-y-6">
        {isReadOnlyViewer && (
          <div className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
            <span>
              Read-only viewer access: you can view issue details, download attachments, and read comments.
            </span>
          </div>
        )}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                {issue.issueKey}
              </span>
              <IssueType type={issue.type} />
              <span className="text-slate-300" aria-hidden="true">·</span>
              <IssueStatus status={issue.status} />
            </div>

            {!isEditing && (
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight break-words">
                {issue.title}
              </h1>
            )}
          </div>

          {!isEditing && (permissions.canUpdate || permissions.canDelete) && (
            <div className="flex items-center gap-2 shrink-0">
              {permissions.canUpdate && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                  onClick={() => setIsEditing(true)}
                  disabled={isMutating}
                >
                  Edit
                </Button>
              )}
              {permissions.canDelete && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={onRequestDelete}
                  disabled={isMutating}
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <IssueForm
            mode="edit"
            initialValues={{
              title: issue.title,
              description: issue.description,
              type: issue.type,
              priority: issue.priority,
              status: issue.status,
              assigneeId: issue.assigneeId,
              dueDate: issue.dueDate || '',
            }}
            projectMembers={projectMembers}
            isSubmitting={isMutating}
            serverError={editServerError}
            submitLabel="Save Changes"
            onCancel={() => setIsEditing(false)}
            onSubmit={handleSaveEdit}
          />
        ) : (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Description
            </h2>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
              {issue.description}
            </div>
          </div>
        )}
        </div>

        <AttachmentSection
          issueId={issue.id}
          permissions={permissions}
          currentUserId={currentUserId}
        />

        <CommentSection
          issueId={issue.id}
          permissions={permissions}
          currentUserId={currentUserId}
        />
      </div>

      {/* Metadata Sidebar */}
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Issue Details
          </h2>

          {/* Status */}
          <div>
            <label
              htmlFor="detail-status-select"
              className="block text-xs font-medium text-slate-500 mb-1.5"
            >
              Status
            </label>
            {permissions.canUpdateStatus ? (
              <select
                id="detail-status-select"
                aria-label="Issue status"
                value={issue.status}
                disabled={isMutating}
                onChange={(e) => onQuickStatusChange(e.target.value as IssueStatusValue)}
                className="w-full h-9 px-3 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10 disabled:bg-slate-50"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            ) : (
              <div className="py-1">
                <IssueStatus status={issue.status} />
              </div>
            )}
          </div>

          {/* Priority */}
          <div>
            <label
              htmlFor="detail-priority-select"
              className="block text-xs font-medium text-slate-500 mb-1.5"
            >
              Priority
            </label>
            {permissions.canUpdatePriority ? (
              <select
                id="detail-priority-select"
                aria-label="Issue priority"
                value={issue.priority}
                disabled={isMutating}
                onChange={(e) => onQuickPriorityChange(e.target.value as IssuePriorityValue)}
                className="w-full h-9 px-3 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10 disabled:bg-slate-50"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            ) : (
              <div className="py-1">
                <IssuePriority priority={issue.priority} />
              </div>
            )}
          </div>

          {/* Assignee */}
          <div>
            <label
              htmlFor="detail-assignee-select"
              className="block text-xs font-medium text-slate-500 mb-1.5"
            >
              Assignee
            </label>
            {permissions.canAssign ? (
              <select
                id="detail-assignee-select"
                aria-label="Issue assignee"
                value={issue.assigneeId || ''}
                disabled={isMutating}
                onChange={(e) => onQuickAssigneeChange(e.target.value || null)}
                className="w-full h-9 px-3 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10 disabled:bg-slate-50"
              >
                <option value="">Unassigned</option>
                {projectMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user?.fullName || member.user?.email || member.userId}
                  </option>
                ))}
              </select>
            ) : (
              <div className="py-1">
                <IssueAssignee assignee={issue.assignee} />
              </div>
            )}
          </div>

          {/* Reporter & Dates */}
          <div className="pt-4 border-t border-slate-100 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 inline-flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Reporter</span>
              </span>
              <span className="font-medium text-slate-800 truncate">
                {issue.reporter?.fullName || issue.reporter?.email || 'Unknown'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Due Date</span>
              </span>
              <span className="font-mono text-slate-700 tabular-nums">
                {formatTimestamp(issue.dueDate)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Created</span>
              </span>
              <span className="font-mono text-slate-700 tabular-nums">
                {formatTimestamp(issue.createdAt)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Updated</span>
              </span>
              <span className="font-mono text-slate-700 tabular-nums">
                {formatTimestamp(issue.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
