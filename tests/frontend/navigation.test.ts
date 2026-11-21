import { describe, it, expect } from 'vitest';
import { navItems } from '../../src/components/layout/Sidebar';

describe('Sidebar Navigation Config and Separation of Concerns', () => {
  it('defines the 9 planned SaaS modules', () => {
    expect(navItems.length).toBe(9);
    const labels = navItems.map((n) => n.label);
    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Team Members');
    expect(labels).toContain('Settings');
    expect(labels).toContain('My Projects');
    expect(labels).toContain('All Issues');
    expect(labels).toContain('Kanban Board');
    expect(labels).toContain('My Tasks');
    expect(labels).toContain('Notifications');
    expect(labels).toContain('Reports & Analytics');
  });

  it('marks Dashboard, Team Members, and Settings as implemented in Phase 2', () => {
    const dashboard = navItems.find((n) => n.label === 'Dashboard');
    expect(dashboard?.isImplemented).toBe(true);

    const team = navItems.find((n) => n.label === 'Team Members');
    expect(team?.isImplemented).toBe(true);

    const settings = navItems.find((n) => n.label === 'Settings');
    expect(settings?.isImplemented).toBe(true);

    const projects = navItems.find((n) => n.label === 'My Projects');
    expect(projects?.isImplemented).toBe(true);

    const issues = navItems.find((n) => n.label === 'All Issues');
    expect(issues?.isImplemented).toBe(true);
    expect(issues?.phaseNote).toBeUndefined();

    const board = navItems.find((n) => n.label === 'Kanban Board');
    expect(board?.isImplemented).toBe(true);
    expect(board?.phaseNote).toBeUndefined();

    const tasks = navItems.find((n) => n.label === 'My Tasks');
    expect(tasks?.isImplemented).toBe(false);
  });
});
