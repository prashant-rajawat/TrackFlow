import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { projectService } from '../../services/project.service';
import { Project, ProjectStatus } from '../../types/project';
import { Button } from '../../components/common/Button';
import { CreateProjectModal } from '../../components/projects/CreateProjectModal';
import { FolderKanban, Plus, Search, Filter, Calendar, Users, ArrowUpRight, ShieldCheck, Archive } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const ProjectsPage: React.FC = () => {
  const { currentWorkspace, currentRole } = useWorkspace();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchProjects = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const data = await projectService.listProjects(currentWorkspace.id);
      setProjects(data);
    } catch (err: any) {
      addToast(err.message || 'Failed to load projects', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [currentWorkspace?.id]);

  const canCreate = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'MEMBER';

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (statusFilter === 'ACTIVE') return matchesSearch && p.status === 'ACTIVE';
    if (statusFilter === 'ARCHIVED') return matchesSearch && p.status === 'ARCHIVED';
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FolderKanban className="w-7 h-7 text-blue-600" />
            <span>Projects</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage engineering and product streams across workspace <strong className="text-slate-800">{currentWorkspace?.name}</strong>
          </p>
        </div>

        {canCreate && (
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 shadow-xs">
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </Button>
        )}
      </div>

      {/* Filters and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, key, or description..."
            className="w-full pl-9 pr-4 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'ACTIVE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter('ARCHIVED')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'ARCHIVED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Archived
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Projects
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 h-48 animate-pulse" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center max-w-xl mx-auto shadow-xs">
          <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No projects found</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6">
            {searchQuery ? 'No projects match your search criteria.' : 'Get started by creating your first project workspace.'}
          </p>
          {canCreate && !searchQuery && (
            <Button onClick={() => setIsCreateModalOpen(true)} className="inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Create Project</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all p-6 flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 text-xs font-mono font-semibold bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                      {p.key}
                    </span>
                    <span className="text-xs text-slate-500 capitalize">
                      {p.visibility.toLowerCase()}
                    </span>
                  </div>
                  {p.status === 'ARCHIVED' && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-md flex items-center gap-1">
                      <Archive className="w-3 h-3" />
                      <span>Archived</span>
                    </span>
                  )}
                </div>

                <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                  {p.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 min-h-[2rem]">
                  {p.description || 'No description provided.'}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{p.memberCount || 1}</span>
                  </span>
                  {p.targetDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(p.targetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </span>
                  )}
                </div>

                <span className="text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  <span>View</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onProjectCreated={(newProj) => {
          setProjects([newProj, ...projects]);
        }}
      />
    </div>
  );
};
