import React from 'react';
import { UserMinus } from 'lucide-react';
import { IssueUserSummary } from '../../types/issue';

interface IssueAssigneeProps {
  assignee?: IssueUserSummary | null;
  className?: string;
}

export const IssueAssignee: React.FC<IssueAssigneeProps> = ({ assignee, className = '' }) => {
  if (!assignee) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-slate-400 ${className}`}>
        <UserMinus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Unassigned</span>
      </span>
    );
  }

  const initial = assignee.fullName ? assignee.fullName.charAt(0).toUpperCase() : '?';

  return (
    <span className={`inline-flex items-center gap-2 min-w-0 ${className}`}>
      <span
        className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-semibold flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        {initial}
      </span>
      <span className="text-xs font-medium text-slate-700 truncate">{assignee.fullName}</span>
    </span>
  );
};
