import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Bug,
  ShieldCheck,
  CheckCircle2,
  Database,
  ArrowRight,
  Plus,
  RefreshCw,
  ExternalLink,
  Users,
  Layers,
  Settings,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import { issueService } from '../../services/issue.service';
import { HealthData } from '../../types/auth';
import { Project } from '../../types/project';
import { Issue } from '../../types/issue';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/feedback/EmptyState';
import { CreateWorkspaceModal } from '../../components/workspaces/CreateWorkspaceModal';
import { IssuePriority } from '../../components/issues/IssuePriority';
import { IssueStatus } from '../../components/issues/IssueStatus';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { currentWorkspace, currentRole } = useWorkspace();
  const navigate = useNavigate();
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [createWorkspaceModalOpen, setCreateWorkspaceModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentIssues, setRecentIssues] = useState<Issue[]>([]);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);

  const fetchHealth = async () => {
    setIsHealthLoading(true);
    try {
      const data = await authService.checkHealth();
      setHealthData(data);
    } catch (_err) {
      setHealthData(null);
    } finally {
      setIsHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  useEffect(() => {
    if (!currentWorkspace) {
      setProjects([]);
      setRecentIssues([]);
      return;
    }

    let cancelled = false;
    setIsOverviewLoading(true);
    Promise.all([
      projectService.listProjects(currentWorkspace.id).catch(() => [] as Project[]),
      issueService
        .listWorkspaceIssues(currentWorkspace.id)
        .then((res) => res.issues)
        .catch(() => [] as Issue[]),
    ])
      .then(([projList, issueList]) => {
        if (cancelled) return;
        setProjects(projList);
        setRecentIssues(issueList);
      })
      .finally(() => {
        if (!cancelled) setIsOverviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id]);

  const hasWorkspace = !!currentWorkspace;

  return (
    <div className="space-y-8">
      {/* Welcome & Primary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            <span>Workspace Overview</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-600 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Phase 5 Active</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Welcome back, {user?.fullName || 'Engineer'}
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            {hasWorkspace
              ? `You are currently working in ${currentWorkspace.name} with ${currentWorkspace.role} permissions.`
              : 'Create or select a workspace to organize your engineering team, repositories, and issues.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<RefreshCw className={`w-4 h-4 ${isHealthLoading ? 'animate-spin' : ''}`} />}
            onClick={fetchHealth}
          >
            Refresh Status
          </Button>

          {hasWorkspace && (currentRole === 'OWNER' || currentRole === 'ADMIN') && (
            <Button
              variant="outline"
              size="md"
              leftIcon={<UserPlus className="w-4 h-4" />}
              onClick={() => navigate('/team')}
            >
              Invite Teammate
            </Button>
          )}

          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateWorkspaceModalOpen(true)}
          >
            New Workspace
          </Button>
        </div>
      </div>

      {/* System Status & Verification Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Workspace Context */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Active Workspace</span>
            </span>
            <span className={`font-medium ${hasWorkspace ? 'text-emerald-600' : 'text-amber-600'}`}>
              {hasWorkspace ? 'Connected' : 'Action Required'}
            </span>
          </div>
          <div className="text-base font-bold text-slate-900 truncate">
            {currentWorkspace?.name || 'No Workspace'}
          </div>
          <div className="text-xs text-slate-500 truncate mt-0.5">
            {hasWorkspace
              ? `${currentWorkspace.slug} · ${currentWorkspace.memberCount} member(s)`
              : 'Create a workspace to proceed'}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Your Role: {currentRole || 'None'}</span>
            {hasWorkspace && (
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <Settings className="w-3 h-3" />
                <span>Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Database Connection */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>Database Engine</span>
            </span>
            <span
              className={`font-medium ${
                healthData?.database.type === 'mongodb' && healthData?.database.connected
                  ? 'text-emerald-600'
                  : healthData?.database.connected
                  ? 'text-amber-600'
                  : 'text-rose-600'
              }`}
            >
              {healthData?.database.type === 'mongodb' && healthData?.database.connected
                ? 'Operational'
                : healthData?.database.type === 'memory'
                ? 'Dev Memory'
                : healthData?.database.type === 'test-mock'
                ? 'Test Mock'
                : 'Disconnected'}
            </span>
          </div>
          <div className="text-base font-bold text-slate-900">
            {healthData?.database.type === 'mongodb'
              ? 'MongoDB (Persistent)'
              : healthData?.database.type === 'memory'
              ? 'In-Memory (Ephemeral)'
              : healthData?.database.type === 'test-mock'
              ? 'Isolated Test Mock'
              : 'Database Offline'}
          </div>
          <div className="text-xs text-slate-500 truncate mt-0.5">
            Host: <span className="font-mono">{healthData?.database.host || 'none'}</span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Persistence</span>
            <span
              className={
                healthData?.database.type === 'mongodb' && healthData?.database.connected
                  ? 'text-emerald-600 font-medium'
                  : healthData?.database.connected
                  ? 'text-amber-700 font-medium'
                  : 'text-rose-600 font-medium'
              }
            >
              {healthData?.database.type === 'mongodb' && healthData?.database.connected
                ? 'Authoritative'
                : healthData?.database.type === 'memory'
                ? 'Non-Persistent (Resets on Restart)'
                : healthData?.database.type === 'test-mock'
                ? 'Test Ephemeral'
                : 'Action Required'}
            </span>
          </div>
        </div>

        {/* Card 3: Security & Session */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Security Protocols</span>
            </span>
            <span className="text-emerald-600 font-medium">Enforced</span>
          </div>
          <div className="text-base font-bold text-slate-900">
            JWT & Server Revocation
          </div>
          <div className="text-xs text-slate-500 truncate mt-0.5">
            HTTP-Only Cookie · RBAC Authorization
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Session Status</span>
            <span className="font-mono text-emerald-700 font-medium">Active (7d TTL)</span>
          </div>
        </div>
      </div>

      {/* Getting Started Guide */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            TrackFlow Implementation Progress
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Follow the phase progression to unlock project tracking and issue management.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Step 1 */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 mb-2">
                <span>STEP 01</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                User Authentication
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Registered account and verified encrypted session persistence with server-side revocation.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-emerald-200/60 text-xs font-medium text-emerald-700">
              Completed (Phase 1)
            </div>
          </div>

          {/* Step 2 */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${
            hasWorkspace
              ? 'border-emerald-200 bg-emerald-50/40'
              : 'border-blue-200 bg-blue-50/40'
          }`}>
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className={hasWorkspace ? 'text-emerald-700' : 'text-blue-700'}>STEP 02</span>
                {hasWorkspace ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <span className="text-[11px] font-mono text-blue-700 font-medium">Active</span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Workspace & Teams
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Configure shared workspaces, invite team members, and manage RBAC roles.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              {hasWorkspace ? (
                <button
                  type="button"
                  onClick={() => navigate('/team')}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-900 flex items-center justify-between w-full"
                >
                  <span>Manage Team ({currentWorkspace.memberCount})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreateWorkspaceModalOpen(true)}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900 flex items-center justify-between w-full"
                >
                  <span>Create Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Step 3 */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${
            projects.length > 0
              ? 'border-emerald-200 bg-emerald-50/40'
              : 'border-slate-200 bg-slate-50/60'
          }`}>
            <div>
              <div className={`flex items-center justify-between text-xs font-semibold mb-2 ${
                projects.length > 0 ? 'text-emerald-700' : 'text-slate-500'
              }`}>
                <span>STEP 03</span>
                {projects.length > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <span className="text-[11px] font-mono text-slate-400">Phase 3</span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Project Creation
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Define projects, issue prefixes, project members, and release milestones.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="mt-4 pt-3 border-t border-slate-200 text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center justify-between"
            >
              <span>Manage Projects ({projects.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-blue-700 mb-2">
                <span>STEP 04</span>
                <span className="text-[11px] font-mono text-blue-700 font-medium">Phase 4</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Issue &amp; Ticket Tracking
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                File bug reports, triage priorities, assign project members, and track resolution.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate('/issues')}
                className="text-xs font-medium text-blue-700 hover:text-blue-900 flex items-center gap-1"
              >
                <span>Issues ({recentIssues.length})</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/board')}
                className="text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center gap-1"
              >
                <span>Kanban Board</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Real Workspace Projects & Recent Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Active Projects
              </h2>
              <p className="text-xs text-slate-500">
                Projects in current workspace
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {projects.length} Project{projects.length === 1 ? '' : 's'}
            </span>
          </div>

          {isOverviewLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading projects...</div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={<FolderGit2 className="w-6 h-6" />}
              title="No projects configured yet"
              description="Create a project to start tracking bugs, features, and tasks with your team."
              action={{
                label: 'Go to Projects',
                onClick: () => navigate('/projects'),
                variant: 'outline',
                icon: <ExternalLink className="w-3.5 h-3.5" />,
              }}
            />
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {projects.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-semibold text-slate-600 shrink-0">
                      {p.key}
                    </span>
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {p.name}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-500 tabular-nums shrink-0 ml-3">
                    {p.issueCount ?? 0} issues
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Issues Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Recent Issues
              </h2>
              <p className="text-xs text-slate-500">
                Bugs and tasks across your accessible projects
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {recentIssues.length} Issue{recentIssues.length === 1 ? '' : 's'}
            </span>
          </div>

          {isOverviewLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading issues...</div>
          ) : recentIssues.length === 0 ? (
            <EmptyState
              icon={<Bug className="w-6 h-6" />}
              title="No issues filed yet"
              description="Open All Issues or any project to file bugs, features, and tasks."
              action={{
                label: 'Open All Issues',
                onClick: () => navigate('/issues'),
                variant: 'outline',
                icon: <ExternalLink className="w-3.5 h-3.5" />,
              }}
            />
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {recentIssues.slice(0, 5).map((iss) => (
                <button
                  key={iss.id}
                  type="button"
                  onClick={() => navigate(`/projects/${iss.projectId}/issues/${iss.id}`)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums shrink-0">
                      {iss.issueKey}
                    </span>
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {iss.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <IssuePriority priority={iss.priority} />
                    <IssueStatus status={iss.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Real Workspace Creation Modal */}
      <CreateWorkspaceModal
        isOpen={createWorkspaceModalOpen}
        onClose={() => setCreateWorkspaceModalOpen(false)}
      />
    </div>
  );
};
