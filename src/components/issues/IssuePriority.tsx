import React from 'react';
import { AlertOctagon, ArrowUp, Minus, ArrowDown } from 'lucide-react';
import { IssuePriority as IssuePriorityValue } from '../../types/issue';

interface IssuePriorityProps {
  priority: IssuePriorityValue;
  className?: string;
}

const PRIORITY_META: Record<
  IssuePriorityValue,
  { label: string; textClass: string; iconClass: string; Icon: React.FC<{ className?: string }> }
> = {
  CRITICAL: {
    label: 'Critical',
    textClass: 'text-rose-700 font-semibold',
    iconClass: 'text-rose-600',
    Icon: AlertOctagon,
  },
  HIGH: {
    label: 'High',
    textClass: 'text-amber-700 font-medium',
    iconClass: 'text-amber-600',
    Icon: ArrowUp,
  },
  MEDIUM: {
    label: 'Medium',
    textClass: 'text-slate-700 font-medium',
    iconClass: 'text-sky-600',
    Icon: Minus,
  },
  LOW: {
    label: 'Low',
    textClass: 'text-slate-500 font-normal',
    iconClass: 'text-slate-400',
    Icon: ArrowDown,
  },
};

export const IssuePriority: React.FC<IssuePriorityProps> = ({ priority, className = '' }) => {
  const meta = PRIORITY_META[priority] || PRIORITY_META.MEDIUM;
  const Icon = meta.Icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${meta.textClass} ${className}`}>
      <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.iconClass}`} aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
};
