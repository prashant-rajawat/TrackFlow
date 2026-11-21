import React from 'react';
import { Button, ButtonProps } from '../common/Button';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
    icon?: React.ReactNode;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-slate-300 bg-white/60 ${className}`}
    >
      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {action && (
        <Button
          variant={action.variant || 'primary'}
          size="sm"
          onClick={action.onClick}
          leftIcon={action.icon}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};
