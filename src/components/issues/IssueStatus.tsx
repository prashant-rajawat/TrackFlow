import React from 'react';
import { Circle, Clock, CheckCircle2 } from 'lucide-react';
import { IssueStatus as IssueStatusValue } from '../../types/issue';

interface IssueStatusProps {
  status: IssueStatusValue;
  className?: string;
}

const STATUS_META: Record<
  IssueStatusValue,
  { label: string; textClass: string; iconClass: string; Icon: React.FC<{ className?: string }> }
> = {
  TODO: {
    label: 'To Do',
    textClass: 'text-slate-700 font-medium',
    iconClass: 'text-slate-400',
    Icon: Circle,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    textClass: 'text-blue-700 font-medium',
    iconClass: 'text-blue-600',
    Icon: Clock,
  },
  DONE: {
    label: 'Done',
    textClass: 'text-emerald-700 font-medium',
    iconClass: 'text-emerald-600',
    Icon: CheckCircle2,
  },
};

export const IssueStatus: React.FC<IssueStatusProps> = ({ status, className = '' }) => {
  const meta = STATUS_META[status] || STATUS_META.TODO;
  const Icon = meta.Icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${meta.textClass} ${className}`}>
      <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.iconClass}`} aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
};
