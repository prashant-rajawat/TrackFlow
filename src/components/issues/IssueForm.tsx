import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
  CreateIssuePayload,
} from '../../types/issue';
import { ProjectMember } from '../../types/project';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

export interface IssueFormValues {
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  assigneeId: string | null;
  dueDate: string;
}

interface IssueFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<IssueFormValues>;
  projectMembers: ProjectMember[];
  isSubmitting?: boolean;
  serverError?: string | null;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit: (payload: CreateIssuePayload & { status: IssueStatus }) => Promise<void> | void;
}

export const IssueForm: React.FC<IssueFormProps> = ({
  mode,
  initialValues,
  projectMembers,
  isSubmitting = false,
  serverError = null,
  submitLabel,
  onCancel,
  onSubmit,
}) => {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [type, setType] = useState<IssueType>(initialValues?.type || 'BUG');
  const [priority, setPriority] = useState<IssuePriority>(initialValues?.priority || 'MEDIUM');
  const [status, setStatus] = useState<IssueStatus>(initialValues?.status || 'TODO');
  const [assigneeId, setAssigneeId] = useState<string>(initialValues?.assigneeId || '');
  const [dueDate, setDueDate] = useState<string>(
    initialValues?.dueDate ? String(initialValues.dueDate).slice(0, 10) : ''
  );

  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    description?: string;
  }>({});

  useEffect(() => {
    if (initialValues) {
      if (initialValues.title !== undefined) setTitle(initialValues.title);
      if (initialValues.description !== undefined) setDescription(initialValues.description);
      if (initialValues.type !== undefined) setType(initialValues.type);
      if (initialValues.priority !== undefined) setPriority(initialValues.priority);
      if (initialValues.status !== undefined) setStatus(initialValues.status);
      if (initialValues.assigneeId !== undefined) setAssigneeId(initialValues.assigneeId || '');
      if (initialValues.dueDate !== undefined) {
        setDueDate(initialValues.dueDate ? String(initialValues.dueDate).slice(0, 10) : '');
      }
    }
  }, [initialValues]);

  const validate = (): boolean => {
    const errors: { title?: string; description?: string } = {};
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      errors.title = 'Issue title is required';
    } else if (trimmedTitle.length < 3) {
      errors.title = 'Issue title must be at least 3 characters';
    } else if (trimmedTitle.length > 120) {
      errors.title = 'Issue title cannot exceed 120 characters';
    }

    if (!trimmedDescription) {
      errors.description = 'Issue description is required';
    } else if (trimmedDescription.length > 10000) {
      errors.description = 'Issue description cannot exceed 10,000 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      type,
      priority,
      status,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {serverError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      <Input
        id="issue-title"
        label="Issue Title"
        required
        placeholder="e.g., Fix OAuth token refresh race condition"
        value={title}
        error={fieldErrors.title}
        disabled={isSubmitting}
        onChange={(e) => {
          setTitle(e.target.value);
          if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: undefined }));
        }}
      />

      <div>
        <label
          htmlFor="issue-description"
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          Description
          <span className="text-rose-500 ml-1" aria-hidden="true">*</span>
        </label>
        <textarea
          id="issue-description"
          rows={4}
          required
          disabled={isSubmitting}
          placeholder="Describe steps to reproduce, expected behavior, and technical context..."
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (fieldErrors.description) {
              setFieldErrors((prev) => ({ ...prev, description: undefined }));
            }
          }}
          aria-invalid={!!fieldErrors.description}
          className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-white text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 ${
            fieldErrors.description
              ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20'
              : 'border-slate-300 focus:border-slate-800 focus:ring-slate-900/10'
          }`}
        />
        {fieldErrors.description && (
          <p role="alert" className="mt-1.5 text-xs text-rose-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{fieldErrors.description}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="issue-type"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Type
          </label>
          <select
            id="issue-type"
            disabled={isSubmitting}
            value={type}
            onChange={(e) => setType(e.target.value as IssueType)}
            className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10 disabled:bg-slate-50"
          >
            <option value="BUG">Bug</option>
            <option value="FEATURE">Feature</option>
            <option value="TASK">Task</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="issue-priority"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Priority
          </label>
          <select
            id="issue-priority"
            disabled={isSubmitting}
            value={priority}
            onChange={(e) => setPriority(e.target.value as IssuePriority)}
            className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10 disabled:bg-slate-50"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 ${
          mode === 'edit' || initialValues?.status !== undefined ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
        } gap-4`}
      >
        {(mode === 'edit' || initialValues?.status !== undefined) && (
          <div>
            <label
              htmlFor="issue-status"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Status
            </label>
            <select
              id="issue-status"
              disabled={isSubmitting}
              value={status}
              onChange={(e) => setStatus(e.target.value as IssueStatus)}
              className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10 disabled:bg-slate-50"
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
            </select>
          </div>
        )}

        <div>
          <label
            htmlFor="issue-assignee"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Assignee
          </label>
          <select
            id="issue-assignee"
            disabled={isSubmitting}
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10 disabled:bg-slate-50"
          >
            <option value="">Unassigned</option>
            {projectMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.user?.fullName || member.user?.email || member.userId} ({member.role})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="issue-due-date"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Due Date (Optional)
          </label>
          <input
            id="issue-due-date"
            type="date"
            disabled={isSubmitting}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10 disabled:bg-slate-50"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel || (mode === 'create' ? 'Create Issue' : 'Save Changes')}
        </Button>
      </div>
    </form>
  );
};
