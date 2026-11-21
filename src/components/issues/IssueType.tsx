import React from 'react';
import { Bug, Sparkles, CheckSquare } from 'lucide-react';
import { IssueType as IssueTypeValue } from '../../types/issue';

interface IssueTypeProps {
  type: IssueTypeValue;
  className?: string;
}

const TYPE_META: Record<
  IssueTypeValue,
  { label: string; colorClass: string; Icon: React.FC<{ className?: string }> }
> = {
  BUG: {
    label: 'Bug',
    colorClass: 'text-rose-600',
    Icon: Bug,
  },
  FEATURE: {
    label: 'Feature',
    colorClass: 'text-indigo-600',
    Icon: Sparkles,
  },
  TASK: {
    label: 'Task',
    colorClass: 'text-sky-600',
    Icon: CheckSquare,
  },
};

export const IssueType: React.FC<IssueTypeProps> = ({ type, className = '' }) => {
  const meta = TYPE_META[type] || TYPE_META.BUG;
  const Icon = meta.Icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 ${className}`}>
      <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.colorClass}`} aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
};
