import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Navbar } from './components/Navbar';
import { Projects } from './components/Projects';
import { SearchDevelopers } from './components/SearchDevelopers';
import { Profile } from './components/Profile';
import { Chat } from './components/Chat';
import { ProjectWorkspace } from './components/ProjectWorkspace';
import { Project } from './types';
import { Loader2, Zap, ArrowLeft, ShieldAlert, ExternalLink, Code, LayoutDashboard, Rocket, Shield, Users, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('devcollab_activeTab') || 'projects';
  });
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  React.useEffect(() => {
    localStorage.setItem('devcollab_activeTab', activeTab);
  }, [activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-text-primary selection:bg-brand-500 selection:text-white">
        <header className="px-8 py-8 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3 font-semibold text-2xl text-text-primary tracking-tight">
            <div className="w-8 h-8 bg-brand-600 rounded flex items-center justify-center font-bold text-white italic">D</div>
            <span>DevCollab</span>
          </div>
          <button 
            onClick={signIn}
            className="px-6 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded text-sm font-semibold transition-all shadow-lg shadow-brand-600/20"
          >
            Get Started
          </button>
        </header>

        <main className="max-w-7xl mx-auto px-8 pt-20 pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-600/10 border border-brand-500/20 text-brand-500 text-xs font-bold uppercase tracking-widest mb-8">
                <Rocket className="w-3 h-3" />
                Invite-Only Platform
              </div>
              <h1 className="text-6xl md:text-8xl font-bold leading-[1] tracking-tighter mb-8">
                Build in public, <br/><span className="text-brand-500">privately.</span>
              </h1>
              <p className="text-lg text-text-secondary mb-10 leading-relaxed max-w-lg">
                The ultimate lightweight terminal for developer breakthroughs. Build your identity, sync with your team, and discover what the world is coding.
              </p>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={signIn}
                  className="bg-text-primary text-background px-8 py-4 rounded font-bold text-lg hover:bg-white transition-all flex items-center gap-3 shadow-2xl shadow-white/5"
                >
                  Join the Circle
                  <Users className="w-5 h-5" />
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="absolute -inset-10 bg-brand-600/10 rounded-full blur-[100px]"></div>
              <div className="relative bg-card rounded-2xl border border-border p-2 shadow-2xl overflow-hidden aspect-[4/3]">
                <img 
                  src="https://images.unsplash.com/photo-1550439062-609e1531270e?auto=format&fit=crop&q=80&w=1000" 
                  alt="Development"
                  className="w-full h-full object-cover rounded-xl"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent"></div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-40">
            {[
              { icon: Shield, title: 'Invite Only', desc: 'Secure, private space for your inner circle.' },
              { icon: Mic, title: 'Voice Updates', desc: 'Record and share progress notes instantly.' },
              { icon: LayoutDashboard, title: 'Stats Dashboard', desc: 'Track project milestones and team velocity.' },
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + (i * 0.1) }}
                className="p-8 rounded-xl bg-surface border border-border hover:border-brand-500/30 transition-colors group"
              >
                <div className="w-12 h-12 bg-card rounded-lg border border-border flex items-center justify-center mb-6 group-hover:text-brand-500 transition-colors">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-3">{feature.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <Navbar activeTab={activeTab} onTabChange={(tab) => {
        setActiveTab(tab);
        if (tab !== 'projects') {
          setSelectedProject(null);
        }
      }} />
      
      <main className="pt-16 h-screen flex flex-col">
        <div className="flex-1 w-full overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'projects' && !selectedProject && (
              <motion.div key="projects" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full overflow-y-auto pb-10">
                <Projects onProjectSelect={setSelectedProject} />
              </motion.div>
            )}
            {activeTab === 'projects' && selectedProject && (
              <motion.div key="project-workspace" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
                <ProjectWorkspace project={selectedProject} onBack={() => setSelectedProject(null)} />
              </motion.div>
            )}
            {activeTab === 'world' && (
              <motion.div key="world" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
                <Chat channelId={null} title="World Chat" />
              </motion.div>
            )}
            {activeTab === 'search' && (
              <motion.div key="search" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full overflow-y-auto pb-10">
                <SearchDevelopers />
              </motion.div>
            )}
            {activeTab === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full overflow-y-auto pb-10">
                <Profile />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ConfigGuard>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <MainApp />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ConfigGuard>
  );
};

export default App;
