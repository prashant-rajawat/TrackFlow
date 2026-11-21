import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Project, ProjectMember } from '../../types/project';
import { Issue, IssueStatus, CreateIssuePayload } from '../../types/issue';
import { projectService } from '../../services/project.service';
import { issueService } from '../../services/issue.service';
import { useToast } from '../../context/ToastContext';
import { IssueForm } from './IssueForm';

interface CreateIssueModalProps {
  isOpen: boolean;
  project: Project;
  projectMembers?: ProjectMember[];
  defaultStatus?: IssueStatus;
  onClose: () => void;
  onIssueCreated: (issue: Issue) => void;
}

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  isOpen,
  project,
  projectMembers: initialMembers,
  defaultStatus,
  onClose,
  onIssueCreated,
}) => {
  const { addToast } = useToast();
  const [members, setMembers] = useState<ProjectMember[]>(initialMembers || []);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setServerError(null);
      return;
    }

    if (initialMembers && initialMembers.length > 0) {
      setMembers(initialMembers);
      return;
    }

    let cancelled = false;
    setIsLoadingMembers(true);
    projectService
      .listProjectMembers(project.id)
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch(() => {
        // Non-blocking: user can still file an unassigned issue
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMembers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, project.id, initialMembers]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleCreate = async (payload: CreateIssuePayload) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const res = await issueService.createIssue(project.id, payload);
      addToast(`Created ${res.issue.issueKey}`, 'success');
      onIssueCreated(res.issue);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to create issue';
      setServerError(msg);
      addToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-issue-modal-title"
        className="w-full max-w-xl bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div>
            <h2 id="create-issue-modal-title" className="text-base font-semibold text-slate-900">
              Create Issue
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Filing in <span className="font-mono font-medium text-slate-700">{project.key}</span> · {project.name}
              {isLoadingMembers ? ' · Loading project members...' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <IssueForm
            key={`${project.id}-${defaultStatus || 'default'}`}
            mode="create"
            initialValues={defaultStatus ? { status: defaultStatus } : undefined}
            projectMembers={members}
            isSubmitting={isSubmitting}
            serverError={serverError}
            onCancel={onClose}
            onSubmit={handleCreate}
          />
        </div>
      </div>
    </div>
  );
};
