import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Project, Profile } from '../types';
import { MessageSquare, Plus, Search, Tag, Loader2, User as UserIcon, Edit2, Trash2, X, Check, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectsProps {
  onProjectSelect?: (project: Project) => void;
}

export const Projects: React.FC<ProjectsProps> = ({ onProjectSelect }) => {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Create state
  const [newProject, setNewProject] = useState({ title: '', description: '', tags: '' });
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProject, setEditProject] = useState({ title: '', description: '', tags: '' });
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteUsername, setInviteUsername] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*, profile:profiles!projects_leader_id_fkey(*)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error("Error fetching projects:", error);
    }
    
    if (!error && data) {
      setProjects(data);
    }
    setLoading(false);
  }

  async function handleCreateProject() {
    if (!profile || !newProject.title) return;

    const { error } = await supabase.from('projects').insert([
      {
        title: newProject.title,
        description: newProject.description,
        tags: newProject.tags.split(',').map(t => t.trim()).filter(t => t),
        user_id: profile.id
      }
    ]);

    if (!error) {
      setIsCreating(false);
      setNewProject({ title: '', description: '', tags: '' });
      fetchProjects();
    } else {
      alert("Failed to create project: " + error.message);
      console.error(error);
    }
  }
  
  async function handleUpdateProject(id: string) {
    if (!profile || !editProject.title) return;

    const { error } = await supabase
      .from('projects')
      .update({
        title: editProject.title,
        description: editProject.description,
        tags: editProject.tags.split(',').map(t => t.trim()).filter(t => t),
      })
      .eq('id', id)
      .eq('user_id', profile.id);

    if (!error) {
      setEditingId(null);
      fetchProjects();
    }
  }
  
  async function handleDeleteProject(id: string) {
    if (!profile || !window.confirm('Are you sure you want to delete this project?')) return;

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', profile.id);

    if (!error) {
      fetchProjects();
    }
  }

  const startEditing = (p: Project) => {
    setEditingId(p.id);
    setEditProject({
      title: p.title,
      description: p.description,
      tags: p.tags.join(', ')
    });
  };

  const handleAddMember = async (projectId: string) => {
    if (!inviteUsername.trim()) return;

    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', inviteUsername.trim())
      .single();

    if (userError || !user) {
      alert("Developer not found!");
      return;
    }

    const { error } = await supabase
      .from('project_members')
      .insert({ project_id: projectId, user_id: user.id });

    if (error) {
      alert("Failed to add member: " + error.message);
    } else {
      alert("Member added successfully!");
      setInvitingId(null);
      setInviteUsername('');
    }
  };

  const filteredProjects = projects.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) || 
    p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold text-text-primary">Projects</h1>
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            Create Project
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search projects or technologies..."
            className="w-full pl-10 pr-4 py-3 glass rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all text-text-primary placeholder:text-text-muted"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isCreating && (
          <div className="glass p-6 rounded-2xl mb-8 animate-in fade-in slide-in-from-top-4">
            <h3 className="font-bold mb-4 text-text-primary">Create New Project</h3>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Project Title"
                className="w-full p-3 bg-surface border-border text-text-primary rounded-lg placeholder:text-text-muted focus:ring-2 focus:ring-brand-500/50 focus:outline-none"
                value={newProject.title}
                onChange={(e) => setNewProject({...newProject, title: e.target.value})}
              />
              <textarea 
                placeholder="What did you build/learn?"
                className="w-full p-3 bg-surface border-border text-text-primary rounded-lg h-24 placeholder:text-text-muted focus:ring-2 focus:ring-brand-500/50 focus:outline-none"
                value={newProject.description}
                onChange={(e) => setNewProject({...newProject, description: e.target.value})}
              />
              <input 
                type="text" 
                placeholder="Tags (comma separated: react, rust, tailwind)"
                className="w-full p-3 bg-surface border-border text-text-primary rounded-lg placeholder:text-text-muted focus:ring-2 focus:ring-brand-500/50 focus:outline-none"
                value={newProject.tags}
                onChange={(e) => setNewProject({...newProject, tags: e.target.value})}
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateProject}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <Loader2 className="animate-spin mb-2" size={32} />
            <p>Loading projects...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence>
              {filteredProjects.map((project) => (
                <motion.div 
                  key={project.id} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="glass p-6 rounded-2xl hover:border-brand-500/50 hover:shadow-md transition-all duration-300 group"
                >
                {editingId === project.id ? (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-text-primary">Edit Project</h4>
                      <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:text-text-primary rounded-md"><X size={18} /></button>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Project Title"
                      className="w-full p-3 bg-surface border-border text-text-primary rounded-lg placeholder:text-text-muted focus:ring-2 focus:ring-brand-500/50 focus:outline-none"
                      value={editProject.title}
                      onChange={(e) => setEditProject({...editProject, title: e.target.value})}
                    />
                    <textarea 
                      placeholder="What did you build/learn?"
                      className="w-full p-3 bg-surface border-border text-text-primary rounded-lg h-24 placeholder:text-text-muted focus:ring-2 focus:ring-brand-500/50 focus:outline-none"
                      value={editProject.description}
                      onChange={(e) => setEditProject({...editProject, description: e.target.value})}
                    />
                    <input 
                      type="text" 
                      placeholder="Tags (comma separated: react, rust, tailwind)"
                      className="w-full p-3 bg-surface border-border text-text-primary rounded-lg placeholder:text-text-muted focus:ring-2 focus:ring-brand-500/50 focus:outline-none"
                      value={editProject.tags}
                      onChange={(e) => setEditProject({...editProject, tags: e.target.value})}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                      <button 
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleUpdateProject(project.id)}
                        className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm shadow-brand-500/20"
                      >
                        <Check size={16} /> Save Changes
                      </button>
                    </div>
                  </div>
                ) : invitingId === project.id ? (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-text-primary">Invite Developer</h4>
                      <button onClick={() => { setInvitingId(null); setInviteUsername(''); }} className="p-1 text-slate-400 hover:text-text-primary rounded-md"><X size={18} /></button>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Enter exact username"
                      className="w-full p-3 bg-surface border-border text-text-primary rounded-lg placeholder:text-text-muted focus:ring-2 focus:ring-brand-500/50 focus:outline-none"
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                      <button 
                        onClick={() => { setInvitingId(null); setInviteUsername(''); }}
                        className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleAddMember(project.id)}
                        className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm shadow-brand-500/20"
                      >
                        <UserPlus size={16} /> Invite
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center overflow-hidden">
                          {project.profile?.avatar_url ? (
                            <img src={project.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon className="text-text-muted" size={20} />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-text-primary">{project.profile?.username}</h4>
                          <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">
                            {project.profile?.unique_id} • {formatDistanceToNow(new Date(project.created_at))} ago
                          </p>
                        </div>
                      </div>
                      
                      {/* Action buttons (only show if logged in user owns the project) */}
                      {profile?.id === project.user_id && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setInvitingId(project.id); }}
                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="Add Member"
                          >
                            <UserPlus size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); startEditing(project); }}
                            className="p-2 text-slate-400 hover:text-brand-500 hover:bg-brand-500/10 rounded-lg transition-colors"
                            title="Edit Project"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete Project"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="cursor-pointer" onClick={() => onProjectSelect && onProjectSelect(project)}>
                      <h3 className="text-xl font-bold mb-2 text-text-primary hover:text-brand-500 transition-colors">{project.title}</h3>
                      <p className="text-text-secondary mb-6 leading-relaxed text-sm whitespace-pre-wrap">{project.description}</p>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex flex-wrap gap-2 items-center">
                        {project.tags.map(tag => (
                          <span key={tag} className="flex items-center gap-1 px-3 py-1 bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 rounded-full text-xs font-semibold backdrop-blur-sm">
                            <Tag size={12} />
                            {tag}
                          </span>
                        ))}
                      </div>
                      
                      <button 
                        onClick={() => onProjectSelect && onProjectSelect(project)}
                        className="flex items-center gap-2 text-xs font-bold text-brand-500 hover:text-brand-600 transition-colors"
                      >
                        <MessageSquare size={14} /> Updates & Chat
                      </button>
                    </div>
                  </>
                )}
                </motion.div>
              ))}
            </AnimatePresence>
            
            {filteredProjects.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                <p>No projects found. Create one to get started!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
