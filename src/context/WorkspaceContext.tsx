import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { Workspace, WorkspaceRole } from '../types/workspace';
import { workspaceService } from '../services/workspace.service';
import { useAuth } from './AuthContext';

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentRole: WorkspaceRole | null;
  isLoadingWorkspaces: boolean;
  switchWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (data: {
    name: string;
    slug?: string;
    description?: string;
  }) => Promise<Workspace>;
  updateWorkspace: (
    id: string,
    data: { name?: string; description?: string }
  ) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY = 'trackflow_active_workspace_id';

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState<boolean>(false);

  const refreshWorkspaces = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      return;
    }

    setIsLoadingWorkspaces(true);
    try {
      const list = await workspaceService.listWorkspaces();
      setWorkspaces(list);

      // Determine active workspace
      if (list.length > 0) {
        const storedId = localStorage.getItem(STORAGE_KEY);
        const matched = list.find((w) => w.id === storedId);

        if (matched) {
          setCurrentWorkspace(matched);
        } else {
          setCurrentWorkspace(list[0]);
          localStorage.setItem(STORAGE_KEY, list[0].id);
        }
      } else {
        setCurrentWorkspace(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_error) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces, user?.id]);

  const switchWorkspace = (workspaceId: string) => {
    const target = workspaces.find((w) => w.id === workspaceId);
    if (target) {
      setCurrentWorkspace(target);
      localStorage.setItem(STORAGE_KEY, target.id);
    }
  };

  const createWorkspace = async (data: {
    name: string;
    slug?: string;
    description?: string;
  }): Promise<Workspace> => {
    const created = await workspaceService.createWorkspace(data);
    setWorkspaces((prev) => [created, ...prev]);
    setCurrentWorkspace(created);
    localStorage.setItem(STORAGE_KEY, created.id);
    return created;
  };

  const updateWorkspace = async (
    id: string,
    data: { name?: string; description?: string }
  ): Promise<Workspace> => {
    const updated = await workspaceService.updateWorkspace(id, data);
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? updated : w)));
    if (currentWorkspace?.id === id) {
      setCurrentWorkspace(updated);
    }
    return updated;
  };

  const deleteWorkspace = async (id: string): Promise<void> => {
    await workspaceService.deleteWorkspace(id);
    const remaining = workspaces.filter((w) => w.id !== id);
    setWorkspaces(remaining);
    if (remaining.length > 0) {
      setCurrentWorkspace(remaining[0]);
      localStorage.setItem(STORAGE_KEY, remaining[0].id);
    } else {
      setCurrentWorkspace(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        currentRole: currentWorkspace?.role || null,
        isLoadingWorkspaces,
        switchWorkspace,
        refreshWorkspaces,
        createWorkspace,
        updateWorkspace,
        deleteWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
