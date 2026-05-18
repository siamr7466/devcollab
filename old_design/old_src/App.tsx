import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
import { ProjectFeed } from './components/ProjectFeed';
import { TeamManager } from './components/TeamManager';
import { SearchDevelopers } from './components/SearchDevelopers';
import { Chat } from './components/Chat';
import { Team } from './types';
import { Loader2, Zap, ArrowLeft, ShieldAlert, ExternalLink, Code } from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabase';
import { isCloudinaryConfigured } from './lib/cloudinary';

const ConfigGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (isSupabaseConfigured && isCloudinaryConfigured) return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-200">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-orange-100 rounded-2xl">
            <ShieldAlert className="text-orange-600" size={40} />
          </div>
        </div>
        <h2 className="text-2xl font-black text-slate-800 text-center mb-2 tracking-tighter">CONFIG REQUIRED</h2>
        <p className="text-slate-500 text-center text-sm mb-8">
          The DevCollab integration is ready, but your credentials are missing from the environment.
        </p>

        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600 text-white rounded-lg"><Code size={16} /></div>
              <h3 className="font-bold text-sm">1. Supabase Setup</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3 font-medium">URL format must include <span className="text-blue-600">https://</span></p>
            <div className="space-y-1 mb-3">
              <code className="block text-[9px] bg-slate-100 p-1 rounded font-mono">VITE_SUPABASE_URL</code>
              <code className="block text-[9px] bg-slate-100 p-1 rounded font-mono">VITE_SUPABASE_ANON_KEY</code>
            </div>
            <p className="text-[10px] text-slate-400 mb-3">Ensure the project is not "Paused" in your dashboard.</p>
            <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline">
              SUPABASE DASHBOARD <ExternalLink size={10} />
            </a>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-pink-600 text-white rounded-lg"><ExternalLink size={16} /></div>
              <h3 className="font-bold text-sm">2. Cloudinary Setup</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">Get a free account and Create an "Unsigned Upload Preset".</p>
            <div className="space-y-1 mb-3">
              <code className="block text-[9px] bg-slate-100 p-1 rounded font-mono">VITE_CLOUDINARY_CLOUD_NAME</code>
              <code className="block text-[9px] bg-slate-100 p-1 rounded font-mono">VITE_CLOUDINARY_UPLOAD_PRESET</code>
            </div>
            <a href="https://cloudinary.com" target="_blank" rel="noreferrer" className="text-[10px] font-bold text-pink-600 flex items-center gap-1 hover:underline">
              CLOUDINARY DASHBOARD <ExternalLink size={10} />
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center italic text-[10px] text-slate-400">
          Once keys are added to Settings, these warnings will disappear.
        </div>
      </div>
    </div>
  );
};

const MainApp: React.FC = () => {
  const { user, loading, signIn } = useAuth();
  const [activeTab, setActiveTab] = useState('feed');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-900">
        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-blue-500/40 transform -rotate-6">
          <Zap size={40} className="text-white fill-current" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white text-center mb-4 tracking-tighter italic">
          DEVCOLLAB <span className="text-blue-500">MVP</span>
        </h1>
        <p className="text-slate-400 text-center max-w-sm mb-10 leading-relaxed">
          The ultimate lightweight terminal for developer breakthroughs.
          Build your identity, sync with your team, and discover what the world is coding.
        </p>
        <button 
          onClick={signIn}
          className="bg-white text-slate-900 px-10 py-4 rounded-2xl font-bold text-lg hover:bg-blue-50 transition-all active:scale-95 shadow-xl"
        >
          Authenticate & Connect
        </button>
        <p className="mt-10 text-[10px] text-slate-600 uppercase font-bold tracking-[0.2em]">
          Optimized for performance • Supabase Driven
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans antialiased text-slate-900">
      <Navbar activeTab={activeTab} onTabChange={(tab) => {
        setActiveTab(tab);
        setSelectedTeam(null);
      }} />
      
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'feed' && <ProjectFeed />}
        {activeTab === 'world' && <Chat teamId={null} title="Global World Chat" />}
        {activeTab === 'search' && <SearchDevelopers />}
        {activeTab === 'teams' && !selectedTeam && (
          <TeamManager onTeamSelect={(team) => {
            setSelectedTeam(team);
          }} />
        )}
        {activeTab === 'teams' && selectedTeam && (
          <div className="h-full flex flex-col">
            <button 
              onClick={() => setSelectedTeam(null)}
              className="absolute top-4 left-4 z-50 p-2 bg-white/80 backdrop-blur rounded-full shadow-sm hover:bg-white transition-all transform hover:-translate-x-1"
            >
              <ArrowLeft size={18} />
            </button>
            <Chat teamId={selectedTeam.id} title={selectedTeam.name} />
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ConfigGuard>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ConfigGuard>
  );
};

export default App;
