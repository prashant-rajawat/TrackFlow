import React from 'react';

export const LoadingSkeleton: React.FC<{ className?: string }> = ({
  className = 'h-4 w-full',
}) => {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded-md ${className}`}
      aria-hidden="true"
    />
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 rounded-md" />
          <div className="h-4 w-72 bg-slate-200 rounded-md" />
        </div>
        <div className="h-10 w-32 bg-slate-200 rounded-md" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="h-32 bg-slate-200 rounded-xl" />
        <div className="h-32 bg-slate-200 rounded-xl" />
        <div className="h-32 bg-slate-200 rounded-xl" />
      </div>

      <div className="h-64 bg-slate-200 rounded-xl" />
    </div>
  );
};
