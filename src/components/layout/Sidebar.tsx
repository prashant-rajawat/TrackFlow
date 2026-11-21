import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  Bug,
  Kanban,
  CheckSquare,
  Users,
  Bell,
  BarChart3,
  Settings,
  Layers,
  ChevronDown,
  Check,
  Plus,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface SidebarProps {
  onCloseMobile?: () => void;
  onOpenCreateWorkspaceModal?: () => void;
}

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  phaseNote?: string;
  isImplemented?: boolean;
}

export const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    isImplemented: true,
  },
  {
    label: 'Team Members',
    path: '/team',
    icon: <Users className="w-4 h-4 shrink-0" />,
    isImplemented: true,
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: <Settings className="w-4 h-4 shrink-0" />,
    isImplemented: true,
  },
  {
    label: 'My Projects',
    path: '/projects',
    icon: <FolderGit2 className="w-4 h-4 shrink-0" />,
    isImplemented: true,
  },
  {
    label: 'All Issues',
    path: '/issues',
    icon: <Bug className="w-4 h-4 shrink-0" />,
    isImplemented: true,
  },
  {
    label: 'Kanban Board',
    path: '/board',
    icon: <Kanban className="w-4 h-4 shrink-0" />,
    isImplemented: true,
  },
  {
    label: 'My Tasks',
    path: '/tasks',
    icon: <CheckSquare className="w-4 h-4 shrink-0" />,
    phaseNote: 'Phase 4',
    isImplemented: false,
  },
  {
    label: 'Notifications',
    path: '/notifications',
    icon: <Bell className="w-4 h-4 shrink-0" />,
    phaseNote: 'Phase 9',
    isImplemented: false,
  },
  {
    label: 'Reports & Analytics',
    path: '/reports',
    icon: <BarChart3 className="w-4 h-4 shrink-0" />,
    phaseNote: 'Phase 10',
    isImplemented: false,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  onCloseMobile,
  onOpenCreateWorkspaceModal,
}) => {
  const location = useLocation();
  const { workspaces, currentWorkspace, switchWorkspace } = useWorkspace();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <aside className="w-64 h-full bg-white border-r border-slate-200 flex flex-col justify-between select-none">
      <div>
        {/* Brand Lockup */}
        <div className="h-16 flex items-center px-6 border-b border-slate-200 gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-xs">
            T
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 tracking-tight leading-none">
              TrackFlow
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5 leading-none">
              Issue Tracking SaaS
            </div>
          </div>
        </div>

        {/* Real Workspace Context & Switcher */}
        <div className="p-3 border-b border-slate-100 relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
            className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-colors"
            aria-expanded={workspaceMenuOpen}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {currentWorkspace?.name ? currentWorkspace.name.charAt(0).toUpperCase() : 'W'}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {currentWorkspace?.name || 'No Workspace Selected'}
                </div>
                <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                  <span>{currentWorkspace?.role || 'Member'}</span>
                  {currentWorkspace && (
                    <>
                      <span>·</span>
                      <span className="tabular-nums">{currentWorkspace.memberCount} member{currentWorkspace.memberCount !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          </button>

          {/* Switcher Dropdown */}
          {workspaceMenuOpen && (
            <div className="absolute left-3 right-3 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Workspaces ({workspaces.length})
              </div>

              <div className="max-h-48 overflow-y-auto py-0.5">
                {workspaces.map((ws) => {
                  const isSelected = ws.id === currentWorkspace?.id;
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => {
                        switchWorkspace(ws.id);
                        setWorkspaceMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                        isSelected
                          ? 'bg-slate-50 font-semibold text-slate-900'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <div className="truncate">{ws.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal truncate">
                          {ws.role} · {ws.memberCount} member{ws.memberCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-slate-100 pt-1 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceMenuOpen(false);
                    if (onOpenCreateWorkspaceModal) onOpenCreateWorkspaceModal();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation list */}
        <div className="px-3 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2">
            Navigation
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/dashboard' && location.pathname.startsWith(`${item.path}/`));

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onCloseMobile}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 truncate">
                    <span className={isActive ? 'text-white' : 'text-slate-500'}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.phaseNote && (
                    <span
                      className={`text-[10px] tabular-nums font-normal shrink-0 ml-2 ${
                        isActive ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {item.phaseNote}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Version Notice */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Release Phase 5</span>
          <span className="text-[11px] text-emerald-600 font-medium">Online</span>
        </div>
      </div>
    </aside>
  );
};
