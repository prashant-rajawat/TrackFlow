import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Sparkles } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { navItems } from '../../components/layout/Sidebar';

export const ComingSoonPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const currentItem = navItems.find((item) => item.path === location.pathname);
  const title = currentItem ? currentItem.label : 'Upcoming Feature';
  const phase = currentItem?.phaseNote || 'Future Phase';

  const featureDetails: Record<string, { desc: string; highlights: string[] }> = {
    '/projects': {
      desc: 'Project organization, custom keys, repository linking, and milestone tracking.',
      highlights: ['Custom project identifiers', 'Milestones and release roadmaps', 'Project-level permissions'],
    },
    '/issues': {
      desc: 'Detailed issue filing, severity triage, label tagging, and full lifecycle tracking.',
      highlights: ['Custom issue templates', 'Severity & priority matrices', 'Rich-text issue descriptions'],
    },
    '/board': {
      desc: 'Interactive Kanban workflow with real-time drag-and-drop state transitions.',
      highlights: ['Customizable column states', 'Swimlane grouping by assignee', 'Keyboard shortcuts'],
    },
    '/tasks': {
      desc: 'Personal task queues, assigned bug triage, and daily priority focus lists.',
      highlights: ['My open assignments', 'Due date reminders', 'Personal focus mode'],
    },
    '/team': {
      desc: 'Team member invitations, role management, and collaborator directories.',
      highlights: ['Admin, Member, Viewer roles', 'Email invitations', 'Workspace membership audit'],
    },
    '/notifications': {
      desc: 'Real-time alert delivery for issue assignments, mentions, and status updates.',
      highlights: ['In-app notification center', 'Email digest options', 'Mention alerts'],
    },
    '/reports': {
      desc: 'Cycle time metrics, bug velocity analytics, and sprint completion charts.',
      highlights: ['Issue throughput metrics', 'Lead time analytics', 'Exportable audit reports'],
    },
    '/settings': {
      desc: 'Workspace security policies, API tokens, webhook subscriptions, and profile options.',
      highlights: ['Security audit log', 'API tokens', 'Workspace preferences'],
    },
  };

  const details = featureDetails[location.pathname] || {
    desc: 'This module is planned as part of the TrackFlow 13-Phase architecture.',
    highlights: ['Phase-driven development', 'Zero mock data', 'Production-ready execution'],
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-xs">
        {/* Header kicker */}
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-3">
          <Clock className="w-4 h-4" />
          <span>PLANNED ROADMAP · {phase.toUpperCase()}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
          {title} is Under Active Development
        </h1>

        <p className="text-base text-slate-600 leading-relaxed mb-8">
          {details.desc} In accordance with our master roadmap, this capability will be released in <strong>{phase}</strong>. We do not display fabricated data or fake controls.
        </p>

        {/* Feature Highlights */}
        <div className="border-t border-b border-slate-100 py-6 mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Planned Capabilities for {phase}</span>
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {details.highlights.map((item, index) => (
              <li
                key={index}
                className="flex items-start gap-2.5 text-sm text-slate-700"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Back action */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </Button>

          <span className="text-xs text-slate-400">
            Phase 1 Foundation · Real Full-Stack SaaS
          </span>
        </div>
      </div>
    </div>
  );
};
