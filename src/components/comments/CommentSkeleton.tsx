import React from 'react';

interface CommentSkeletonProps {
  count?: number;
}

export const CommentSkeleton: React.FC<CommentSkeletonProps> = ({ count = 3 }) => {
  return (
    <div className="space-y-4" aria-label="Loading comments" aria-busy="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-start gap-3 py-3 border-t border-slate-100 first:border-t-0 animate-pulse"
        >
          <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-28 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
            <div className="h-3.5 w-full bg-slate-100 rounded" />
            <div className="h-3.5 w-3/4 bg-slate-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};
