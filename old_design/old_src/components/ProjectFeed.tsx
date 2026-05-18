import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Project, Profile } from '../types';
import { MessageSquare, Plus, Search, Tag, Loader2, User as UserIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const ProjectFeed: React.FC = () => {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Create state
  const [newProject, setNewProject] = useState({ title: '', description: '', tags: '' });

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*, profile:profiles(*)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(30);

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
    }
  }

  const filteredProjects = projects.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) || 
    p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Project Feed</h1>
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            Share Project
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search projects or technologies..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isCreating && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 animate-in fade-in slide-in-from-top-4">
            <h3 className="font-bold mb-4">New Project Breakthrough</h3>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Project Title"
                className="w-full p-3 bg-slate-50 border rounded-lg"
                value={newProject.title}
                onChange={(e) => setNewProject({...newProject, title: e.target.value})}
              />
              <textarea 
                placeholder="What did you build/learn?"
                className="w-full p-3 bg-slate-50 border rounded-lg h-24"
                value={newProject.description}
                onChange={(e) => setNewProject({...newProject, description: e.target.value})}
              />
              <input 
                type="text" 
                placeholder="Tags (comma separated: react, rust, tailwind)"
                className="w-full p-3 bg-slate-50 border rounded-lg"
                value={newProject.tags}
                onChange={(e) => setNewProject({...newProject, tags: e.target.value})}
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-slate-500"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateProject}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Post to Feed
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <Loader2 className="animate-spin mb-2" size={32} />
            <p>Loading projects...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredProjects.map((project) => (
              <div key={project.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                    {project.profile?.avatar_url ? (
                      <img src={project.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="text-slate-400" size={20} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">{project.profile?.username}</h4>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      {project.profile?.unique_id} • {formatDistanceToNow(new Date(project.created_at))} ago
                    </p>
                  </div>
                </div>

                <h3 className="text-xl font-bold mb-2 text-slate-900">{project.title}</h3>
                <p className="text-slate-600 mb-6 leading-relaxed text-sm">{project.description}</p>

                <div className="flex flex-wrap gap-2 items-center">
                  {project.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold">
                      <Tag size={12} />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
