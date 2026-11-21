import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, LogOut, User as UserIcon, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLocation } from 'react-router-dom';
import { navItems } from './Sidebar';

import { useWorkspace } from '../../context/WorkspaceContext';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onOpenNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  onOpenNotifications,
}) => {
  const { user, logout } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { addToast } = useToast();
  const location = useLocation();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentItem = navItems.find((item) => item.path === location.pathname);
  const pageTitle = currentItem ? currentItem.label : 'Dashboard';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      addToast('You have been safely logged out', 'info');
    } catch (err: any) {
      addToast(err.message || 'Error logging out', 'error');
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Left: Mobile trigger & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Clean Breadcrumb Trail */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 font-medium">TrackFlow</span>
          <span className="text-slate-300" aria-hidden="true">/</span>
          {currentWorkspace && (
            <>
              <span className="text-slate-600 font-medium truncate max-w-[120px] sm:max-w-[200px]">
                {currentWorkspace.name}
              </span>
              <span className="text-slate-300" aria-hidden="true">/</span>
            </>
          )}
          <span className="text-slate-900 font-semibold truncate">{pageTitle}</span>
        </nav>
      </div>

      {/* Right: Actions & User Menu */}
      <div className="flex items-center gap-3">
        {/* Notifications Trigger */}
        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
          aria-label="View notifications (Phase 9 preview)"
        >
          <Bell className="w-5 h-5" />
          <span className="sr-only">Notifications</span>
        </button>

        {/* User Profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-expanded={profileDropdownOpen}
            aria-haspopup="true"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {getInitials(user?.fullName)}
            </div>
            <div className="hidden sm:block text-left max-w-[140px] truncate">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {user?.fullName || 'User'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {user?.email || 'Authenticated'}
              </div>
            </div>
          </button>

          {/* Profile Dropdown Menu */}
          {profileDropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2"
              role="menu"
            >
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs text-slate-500">Signed in as</p>
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user?.fullName}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-600 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Authenticated Session (JWT)</span>
                </div>
              </div>

              <div className="py-1">
                <div className="px-4 py-2 text-xs text-slate-500 flex items-center gap-2">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Role: {user?.role || 'Member'}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors font-medium"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
