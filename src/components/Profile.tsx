import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Globe, Github, Twitter, Linkedin, Plus, X, Check, Edit2, Calendar, Award, Users } from 'lucide-react';
import { motion } from 'framer-motion';

export const Profile: React.FC = () => {
  const { profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [expertise, setExpertise] = useState<string[]>([]);
  const [newExpertise, setNewExpertise] = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [newSocialKey, setNewSocialKey] = useState('');
  const [newSocialValue, setNewSocialValue] = useState('');

  // Stats
  const [stats, setStats] = useState({
    projects: 0,
    collaborations: 0
  });

  useEffect(() => {
    if (authProfile) {
      fetchProfile();
      fetchStats();
    }
  }, [authProfile]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authProfile.id)
      .single();

    if (!error && data) {
      setProfile(data);
      setFullName(data.full_name || '');
      setExpertise(data.expertise || []);
      setSocialLinks(data.social_links || {});
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    if (!authProfile) return;

    // Fetch projects count (created)
    const { count: projCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', authProfile.id);

    // Fetch collaborations count (joined, approved, and completed)
    const { count: collabCount } = await supabase
      .from('project_members')
      .select('*, projects!inner(is_completed)', { count: 'exact', head: true })
      .eq('user_id', authProfile.id)
      .eq('leader_approved', true)
      .eq('projects.is_completed', true);

    setStats({
      projects: projCount || 0,
      collaborations: collabCount || 0
    });
  };

  const handleSave = async () => {
    if (!authProfile) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        expertise,
        social_links: socialLinks
      })
      .eq('id', authProfile.id);

    if (!error) {
      setEditing(false);
      fetchProfile();
    } else {
      alert("Failed to update profile: " + error.message);
    }
    setSaving(false);
  };

  const addExpertise = () => {
    if (!newExpertise.trim()) return;
    if (!expertise.includes(newExpertise.trim())) {
      setExpertise([...expertise, newExpertise.trim()]);
    }
    setNewExpertise('');
  };

  const removeExpertise = (tag: string) => {
    setExpertise(expertise.filter(t => t !== tag));
  };

  const addSocialLink = () => {
    if (!newSocialKey.trim() || !newSocialValue.trim()) return;
    setSocialLinks({ ...socialLinks, [newSocialKey.trim()]: newSocialValue.trim() });
    setNewSocialKey('');
    setNewSocialValue('');
  };

  const removeSocialLink = (key: string) => {
    const next = { ...socialLinks };
    delete next[key];
    setSocialLinks(next);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-300">
        <Loader2 className="animate-spin mb-2" size={32} />
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-6 md:p-8 rounded-2xl"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
          <div className="w-24 h-24 rounded-full bg-card border-2 border-border overflow-hidden shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted text-4xl font-bold">
                {profile.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          <div className="flex-1 text-center md:text-left">
            {editing ? (
              <input 
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="text-2xl font-bold bg-surface border-border text-text-primary rounded-lg px-3 py-1 focus:ring-2 focus:ring-brand-500/50 focus:outline-none"
                placeholder="Your Name"
              />
            ) : (
              <h1 className="text-2xl font-bold text-text-primary">{profile.full_name || 'Anonymous Developer'}</h1>
            )}
            <p className="text-text-muted text-sm font-medium">@{profile.username}</p>
            <p className="text-text-muted text-xs mt-1">ID: {profile.unique_id}</p>
          </div>

          <div className="flex gap-2">
            {editing ? (
              <>
                <button 
                  onClick={() => { setEditing(false); fetchProfile(); }}
                  className="px-4 py-2 text-slate-500 hover:text-text-primary transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm shadow-brand-500/20"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save
                </button>
              </>
            ) : (
              <button 
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-surface border border-border/50 text-text-primary rounded-lg hover:bg-surface/80 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
              >
                <Edit2 size={14} /> Edit Profile
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Info & Stats */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-surface/50 border border-border/50 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Activity</h3>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold text-text-primary">{stats.projects}</p>
                  <p className="text-[10px] text-text-muted uppercase font-bold">Projects</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-text-primary">{stats.collaborations}</p>
                  <p className="text-[10px] text-text-muted uppercase font-bold">Collabs</p>
                </div>
              </div>
            </div>

            {/* Meta */}
            <div className="bg-surface/50 border border-border/50 rounded-xl p-4 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-text-secondary">
                <Calendar size={14} className="text-text-muted" />
                <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-text-secondary">
                <Award size={14} className="text-text-muted" />
                <span>ID: {profile.unique_id}</span>
              </div>
            </div>
          </div>

          {/* Middle & Right Column: Expertise & Socials */}
          <div className="md:col-span-2 space-y-6">
            {/* Expertise */}
            <div className="bg-surface/50 border border-border/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">Expertise</h3>
                {editing && (
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={newExpertise}
                      onChange={(e) => setNewExpertise(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addExpertise()}
                      className="bg-surface border-border text-text-primary rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
                      placeholder="Add skill"
                    />
                    <button onClick={addExpertise} className="p-1 bg-brand-600 text-white rounded-md hover:bg-brand-700"><Plus size={16} /></button>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {expertise.length === 0 ? (
                  <p className="text-sm text-text-muted">No expertise added yet.</p>
                ) : (
                  expertise.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 bg-brand-500/10 text-brand-500 text-xs font-semibold px-2.5 py-1 rounded-full border border-brand-500/20">
                      {tag}
                      {editing && (
                        <button onClick={() => removeExpertise(tag)} className="ml-1 text-brand-500 hover:text-brand-700">
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Social Links */}
            <div className="bg-surface/50 border border-border/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">Social Links</h3>
                {editing && (
                  <div className="flex gap-2 text-sm">
                    <input 
                      type="text"
                      value={newSocialKey}
                      onChange={(e) => setNewSocialKey(e.target.value)}
                      className="w-24 bg-surface border-border text-text-primary rounded-lg px-2 py-1 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                      placeholder="Site (e.g. GitHub)"
                    />
                    <input 
                      type="text"
                      value={newSocialValue}
                      onChange={(e) => setNewSocialValue(e.target.value)}
                      className="flex-1 bg-surface border-border text-text-primary rounded-lg px-2 py-1 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                      placeholder="URL"
                    />
                    <button onClick={addSocialLink} className="p-1 bg-brand-600 text-white rounded-md hover:bg-brand-700"><Plus size={16} /></button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {Object.entries(socialLinks).length === 0 ? (
                  <p className="text-sm text-text-muted">No social links added yet.</p>
                ) : (
                  Object.entries(socialLinks).map(([key, value]) => {
                    const Icon = key.toLowerCase().includes('github') ? Github :
                                 key.toLowerCase().includes('twitter') ? Twitter :
                                 key.toLowerCase().includes('linkedin') ? Linkedin : Globe;
                    return (
                      <div key={key} className="flex items-center justify-between bg-surface p-3 rounded-lg border border-border/50">
                        <div className="flex items-center gap-3">
                          <Icon size={16} className="text-text-muted" />
                          <div>
                            <p className="text-sm font-bold text-text-primary capitalize">{key}</p>
                            <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-500 hover:underline">{value}</a>
                          </div>
                        </div>
                        {editing && (
                          <button onClick={() => removeSocialLink(key)} className="text-text-muted hover:text-red-500">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
