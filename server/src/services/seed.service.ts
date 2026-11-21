import { isProductionEnvironment } from '../config/db.js';
import { UserModelAdapter } from '../models/User.js';
import { WorkspaceModelAdapter } from '../models/Workspace.js';
import { WorkspaceMemberModelAdapter } from '../models/WorkspaceMember.js';
import { ProjectModelAdapter } from '../models/Project.js';
import { ProjectMemberModelAdapter } from '../models/ProjectMember.js';

/**
 * Explicitly opt-in, idempotent development demo data seeder.
 * Strictly disabled in production and skipped unless ENABLE_DEMO_SEED=true
 * and DEMO_USER_PASSWORD is configured.
 */
export async function seedDemoData(): Promise<boolean> {
  if (isProductionEnvironment()) {
    console.warn('[TrackFlow Security] Demo seeding is strictly prohibited in production mode.');
    return false;
  }

  if (process.env.ENABLE_DEMO_SEED !== 'true') {
    return false;
  }

  const demoUser = await UserModelAdapter.seedDemoUser();
  if (!demoUser || !demoUser.id) {
    return false;
  }

  try {
    let ws = await WorkspaceModelAdapter.findBySlug('trackflow-core');
    if (!ws) {
      ws = await WorkspaceModelAdapter.create({
        name: 'TrackFlow Core',
        slug: 'trackflow-core',
        description: 'Official product development workspace for TrackFlow',
        ownerId: demoUser.id,
      });
    }

    const existingWsMember = await WorkspaceMemberModelAdapter.findMember(ws.id!, demoUser.id);
    if (!existingWsMember) {
      await WorkspaceMemberModelAdapter.createMember({
        workspaceId: ws.id!,
        userId: demoUser.id,
        role: 'OWNER',
      });
    }

    let proj = await ProjectModelAdapter.findByKey(ws.id!, 'WEB');
    if (!proj) {
      proj = await ProjectModelAdapter.create({
        name: 'Web Platform',
        key: 'WEB',
        description: 'Frontend client, UI design system and issue tracker',
        workspaceId: ws.id!,
        createdBy: demoUser.id,
        leadId: demoUser.id,
        visibility: 'WORKSPACE',
        color: 'blue',
      });
    }

    const existingProjMember = await ProjectMemberModelAdapter.findMember(proj.id!, demoUser.id);
    if (!existingProjMember) {
      await ProjectMemberModelAdapter.createMember({
        projectId: proj.id!,
        workspaceId: ws.id!,
        userId: demoUser.id,
        role: 'PROJECT_ADMIN',
      });
    }

    console.log('[TrackFlow] Verified idempotent development demo workspace (TrackFlow Core) and project (WEB).');
    return true;
  } catch (err: any) {
    console.warn('[TrackFlow] Demo workspace seed note:', err.message);
    return false;
  }
}
