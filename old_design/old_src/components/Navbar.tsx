import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Layout, Globe, Users, Search, LogOut, User as UserIcon, Menu, X } from 'lucide-react';

interface NavbarProps {
  onTabChange: (tab: string) => void;
  activeTab: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onTabChange, activeTab }) => {
  const { profile, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    setIsMenuOpen(false);
  };

  return (
    <nav className="relative z-50">
      <div className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 md:px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-black italic">D</div>
          <span className="font-bold tracking-tighter sm:block">DEVCOLLAB</span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1 sm:gap-4">
          <NavButton 
            active={activeTab === 'feed'} 
            onClick={() => handleTabChange('feed')}
            icon={<Layout size={18} />}
            label="Feed"
          />
          <NavButton 
            active={activeTab === 'world'} 
            onClick={() => handleTabChange('world')}
            icon={<Globe size={18} />}
            label="World"
          />
          <NavButton 
            active={activeTab === 'teams'} 
            onClick={() => handleTabChange('teams')}
            icon={<Users size={18} />}
            label="Teams"
          />
          <NavButton 
            active={activeTab === 'search'} 
            onClick={() => handleTabChange('search')}
            icon={<Search size={18} />}
            label="Search"
          />
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {profile && (
            <div className="flex items-center gap-2 pr-2 md:pr-4 md:border-r border-slate-700">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-bold text-slate-400 leading-none mb-1">{profile.unique_id}</p>
                <p className="text-xs font-semibold leading-none">{profile.username}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={14} className="text-slate-500" />
                )}
              </div>
            </div>
          )}
          
          <button 
            onClick={signOut}
            className="hidden md:block text-slate-400 hover:text-white transition-colors"
          >
            <LogOut size={20} />
          </button>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {isMenuOpen && (
        <div className="absolute top-16 left-0 w-full bg-slate-900 border-t border-slate-800 p-4 space-y-2 md:hidden animate-in fade-in slide-in-from-top-2">
          <NavButton 
            active={activeTab === 'feed'} 
            onClick={() => handleTabChange('feed')}
            icon={<Layout size={18} />}
            label="Feed"
            isFullWidth
          />
          <NavButton 
            active={activeTab === 'world'} 
            onClick={() => handleTabChange('world')}
            icon={<Globe size={18} />}
            label="World Chat"
            isFullWidth
          />
          <NavButton 
            active={activeTab === 'teams'} 
            onClick={() => handleTabChange('teams')}
            icon={<Users size={18} />}
            label="Team Collaboration"
            isFullWidth
          />
          <NavButton 
            active={activeTab === 'search'} 
            onClick={() => handleTabChange('search')}
            icon={<Search size={18} />}
            label="Search Developers"
            isFullWidth
          />
          <div className="pt-4 border-t border-slate-800">
            <button 
              onClick={signOut}
              className="flex items-center gap-2 w-full px-3 py-3 rounded-lg text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

const NavButton: React.FC<{ 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  isFullWidth?: boolean;
}> = ({ 
  active, onClick, icon, label, isFullWidth 
}) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
      isFullWidth ? 'w-full py-3' : ''
    } ${
      active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon}
    <span className={`${isFullWidth ? 'block' : 'hidden lg:block'}`}>{label}</span>
  </button>
);
