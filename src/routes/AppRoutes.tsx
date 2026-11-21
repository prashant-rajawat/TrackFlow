import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { TeamMembersPage } from '../pages/team/TeamMembersPage';
import { WorkspaceSettingsPage } from '../pages/workspaces/WorkspaceSettingsPage';
import { ProjectsPage } from '../pages/projects/ProjectsPage';
import { ProjectDetailsPage } from '../pages/projects/ProjectDetailsPage';
import { IssuesPage } from '../pages/issues/IssuesPage';
import { IssueDetailsPage } from '../pages/issues/IssueDetailsPage';
import { KanbanBoardPage } from '../pages/board/KanbanBoardPage';
import { AcceptInvitationPage } from '../pages/invitations/AcceptInvitationPage';
import { ComingSoonPage } from '../pages/feedback/ComingSoonPage';
import { NotFoundPage } from '../pages/feedback/NotFoundPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Public Authentication Routes */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Invitation Acceptance Route (accessible whether logged in or out) */}
      <Route path="/invite/:token" element={<AcceptInvitationPage />} />

      {/* Protected SaaS Application Shell Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailsPage />} />
        <Route path="/projects/:projectId/issues" element={<IssuesPage />} />
        <Route path="/projects/:projectId/issues/:issueId" element={<IssueDetailsPage />} />
        <Route path="/projects/:projectId/board" element={<KanbanBoardPage />} />
        <Route path="/issues" element={<IssuesPage />} />
        <Route path="/issues/:issueId" element={<IssueDetailsPage />} />
        <Route path="/board" element={<KanbanBoardPage />} />
        <Route path="/team" element={<TeamMembersPage />} />
        <Route path="/settings" element={<WorkspaceSettingsPage />} />

        {/* Planned Future Phase Modules */}
        <Route path="/tasks" element={<ComingSoonPage />} />
        <Route path="/notifications" element={<ComingSoonPage />} />
        <Route path="/reports" element={<ComingSoonPage />} />
      </Route>

      {/* Genuine 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
