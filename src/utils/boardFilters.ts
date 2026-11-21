import { Issue, IssuePriority, IssueStatus, IssueUserSummary } from '../types/issue';
import { ProjectMember } from '../types/project';

export interface BoardFilterState {
  search: string;
  priority: IssuePriority | '';
  assigneeId: string;
}

export const DEFAULT_BOARD_FILTERS: BoardFilterState = {
  search: '',
  priority: '',
  assigneeId: '',
};

export const filterBoardIssues = (issues: Issue[], filters: BoardFilterState): Issue[] => {
  const query = filters.search.trim().toLowerCase();

  return issues.filter((issue) => {
    if (query) {
      const titleMatch = issue.title.toLowerCase().includes(query);
      const keyMatch = issue.issueKey.toLowerCase().includes(query);
      if (!titleMatch && !keyMatch) {
        return false;
      }
    }

    if (filters.priority && issue.priority !== filters.priority) {
      return false;
    }

    if (filters.assigneeId) {
      if (filters.assigneeId === 'UNASSIGNED') {
        if (issue.assigneeId) return false;
      } else if (issue.assigneeId !== filters.assigneeId) {
        return false;
      }
    }

    return true;
  });
};

export const hasActiveBoardFilters = (filters: BoardFilterState): boolean => {
  return Boolean(filters.search.trim() || filters.priority || filters.assigneeId);
};

export const groupIssuesByStatus = (
  issues: Issue[]
): Record<IssueStatus, Issue[]> => {
  const grouped: Record<IssueStatus, Issue[]> = {
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  };

  for (const issue of issues) {
    if (issue.status === 'IN_PROGRESS') {
      grouped.IN_PROGRESS.push(issue);
    } else if (issue.status === 'DONE') {
      grouped.DONE.push(issue);
    } else {
      grouped.TODO.push(issue);
    }
  }

  return grouped;
};

export const extractBoardAssignees = (
  issues: Issue[],
  projectMembers?: ProjectMember[]
): IssueUserSummary[] => {
  const byId = new Map<string, IssueUserSummary>();

  if (projectMembers) {
    for (const member of projectMembers) {
      if (member.user && member.user.id) {
        byId.set(member.user.id, {
          id: member.user.id,
          fullName: member.user.fullName,
          email: member.user.email,
          avatarUrl: member.user.avatarUrl,
        });
      }
    }
  }

  for (const issue of issues) {
    if (issue.assignee && issue.assignee.id) {
      byId.set(issue.assignee.id, issue.assignee);
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    (a.fullName || a.email).localeCompare(b.fullName || b.email)
  );
};
