import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireDatabase } from '../middleware/db.middleware.js';
import {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  archiveProject,
  restoreProject,
} from '../controllers/project.controller.js';
import {
  listProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
} from '../controllers/projectMember.controller.js';
import {
  listProjectIssues,
  createIssue,
} from '../controllers/issue.controller.js';
import {
  requireProjectAccess,
  ProjectAction,
} from '../services/project.rbac.service.js';
import {
  requireProjectIssueAccess,
  IssueAction,
} from '../services/issue.rbac.service.js';

const router = Router();

// All project routes require database availability and authentication
router.use(requireDatabase);
router.use(requireAuth as any);

// Project CRUD & Lifecycle
router.get('/', listProjects as any);
router.post('/', createProject as any);
router.get('/:projectId', requireProjectAccess(ProjectAction.VIEW_PROJECT) as any, getProject as any);
router.patch('/:projectId', requireProjectAccess(ProjectAction.UPDATE_PROJECT) as any, updateProject as any);
router.delete('/:projectId', requireProjectAccess(ProjectAction.DELETE_PROJECT) as any, deleteProject as any);
router.post('/:projectId/archive', requireProjectAccess(ProjectAction.ARCHIVE_RESTORE) as any, archiveProject as any);
router.post('/:projectId/restore', requireProjectAccess(ProjectAction.ARCHIVE_RESTORE) as any, restoreProject as any);

// Project Membership
router.get('/:projectId/members', requireProjectAccess(ProjectAction.VIEW_PROJECT) as any, listProjectMembers as any);
router.post('/:projectId/members', requireProjectAccess(ProjectAction.MANAGE_MEMBERS) as any, addProjectMember as any);
router.patch('/:projectId/members/:userId', requireProjectAccess(ProjectAction.MANAGE_MEMBERS) as any, updateProjectMemberRole as any);
router.delete('/:projectId/members/:userId', requireProjectAccess(ProjectAction.MANAGE_MEMBERS) as any, removeProjectMember as any);

// Project Issues (Phase 4)
router.get('/:projectId/issues', requireProjectIssueAccess(IssueAction.VIEW_ISSUE) as any, listProjectIssues as any);
router.post('/:projectId/issues', requireProjectIssueAccess(IssueAction.CREATE_ISSUE) as any, createIssue as any);

export default router;
