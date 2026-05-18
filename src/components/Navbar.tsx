import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Layout, Globe, Users, Search, LogOut, User as UserIcon, Sun, Moon, Bell, X, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  onTabChange: (tab: string) => void;
  activeTab: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onTabChange, activeTab }) => {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount, markAllRead, recentRequests, setTargetMessageId } = useNotifications();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [activeNotifTab, setActiveNotifTab] = useState<'inbox' | 'general'>('inbox');

  const navItems = [
    { id: 'projects', icon: Layout, label: 'Projects' },
    { id: 'world', icon: Globe, label: 'World' },
    { id: 'search', icon: Search, label: 'Search' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 bg-surface/80 backdrop-blur-2xl border-b border-border/50 px-4 py-2 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="hidden md:flex items-center gap-3 font-semibold text-xl text-text-primary tracking-tight">
          <div className="w-8 h-8 bg-brand-600 rounded flex items-center justify-center font-bold text-white italic">D</div>
          <span>DevCollab</span>
        </div>

        <div className="flex flex-1 md:flex-none justify-around md:justify-end items-center gap-1 md:gap-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col md:flex-row items-center gap-2 px-4 py-1.5 rounded-md transition-colors relative ${
                activeTab === item.id 
                  ? 'text-white bg-brand-600/10 border border-brand-500/20' 
                  : 'text-text-secondary hover:text-white hover:bg-card'
              }`}
            >
              <div className="relative">
                <item.icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] md:text-sm font-medium">{item.label}</span>
            </button>
          ))}
          
            <div className="h-6 w-[1px] bg-border mx-2 hidden md:block"></div>

            <div className="flex items-center gap-2 md:gap-3 ml-2">
              <div className="relative">
                <button
                  onClick={() => {
                    setIsNotifOpen(!isNotifOpen);
                    markAllRead();
                  }}
                  className="p-2 text-text-muted hover:text-brand-500 hover:bg-brand-500/10 rounded-full transition-colors relative"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-surface animate-pulse"></span>
                  )}
                </button>

                <AnimatePresence>
                  {isNotifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="fixed inset-x-4 top-16 md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-96 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      {/* Header */}
                      <div className="p-4 border-b border-border flex items-center justify-between">
                        <span className="text-base font-bold text-text-primary">Notifications</span>
                        <button 
                          onClick={() => {
                            markAllRead();
                            setIsNotifOpen(false);
                          }}
                          className="text-xs font-medium text-text-muted hover:text-white transition-colors"
                        >
                          Mark all as read
                        </button>
                      </div>

                      {/* Tabs */}
                      <div className="px-4 border-b border-border flex items-center gap-4 text-sm font-medium text-text-muted">
                        <button 
                          onClick={() => setActiveNotifTab('inbox')}
                          className={`py-2 border-b-2 transition-colors relative ${activeNotifTab === 'inbox' ? 'border-brand-500 text-white' : 'border-transparent hover:text-white'}`}
                        >
                          Inbox
                          {unreadCount > 0 && (
                            <span className="ml-1 bg-brand-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                          )}
                        </button>
                        <button 
                          onClick={() => setActiveNotifTab('general')}
                          className={`py-2 border-b-2 transition-colors ${activeNotifTab === 'general' ? 'border-brand-500 text-white' : 'border-transparent hover:text-white'}`}
                        >
                          General
                        </button>
                        <div className="flex-1"></div>
                        <button className="p-1 hover:bg-surface rounded-full text-text-muted hover:text-white transition-colors">
                          <Settings size={16} />
                        </button>
                      </div>

                      {/* List */}
                      <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {activeNotifTab === 'inbox' ? (
                          recentRequests.length === 0 ? (
                            <div className="p-4 text-center text-sm text-text-muted">No notifications yet.</div>
                          ) : (
                            recentRequests.map(req => {
                              const text = req.content || '';
                              const header = text.split('\n')[0];
                              const lastRead = localStorage.getItem('lastReadNotifications') || new Date(0).toISOString();
                              const isUnread = req.created_at > lastRead;
                              
                              return (
                                <div 
                                  key={req.id}
                                  onClick={() => {
                                    setTargetMessageId(req.id);
                                    onTabChange('world');
                                    setIsNotifOpen(false);
                                  }}
                                  className="p-4 border-b border-border/50 hover:bg-surface/50 cursor-pointer transition-colors flex items-start gap-3"
                                >
                                  <div className="w-10 h-10 rounded-full bg-surface border border-border overflow-hidden shrink-0">
                                    <img src={req.profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.profile?.username}`} alt="" className="w-full h-full object-cover" />
                                  </div>
                                  <div className="flex flex-col flex-1 gap-0.5">
                                    <span className="text-sm font-medium text-white">
                                      <span className="font-bold">{req.profile?.username || 'User'}</span> asked for help
                                    </span>
                                    <span className="text-xs text-text-secondary line-clamp-1">
                                      {header}
                                    </span>
                                    <span className="text-xs text-text-muted mt-0.5">
                                      {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Help Request
                                    </span>
                                  </div>
                                  {isUnread && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0"></div>
                                  )}
                                </div>
                              );
                            })
                          )
                        ) : (
                          /* General Tab - Dummy Data */
                          <div className="flex flex-col">
                            <div className="p-4 border-b border-border/50 hover:bg-surface/50 cursor-pointer transition-colors flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold shrink-0">T</div>
                              <div className="flex flex-col flex-1 gap-0.5">
                                <span className="text-sm font-medium text-white">
                                  <span className="font-bold">Tom</span> invited you to join <span className="font-bold">Team Alpha</span>
                                </span>
                                <span className="text-xs text-text-secondary">12 minutes ago • Team Invite</span>
                                <div className="flex items-center gap-2 mt-2">
                                  <button className="text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-full transition-colors">Accept</button>
                                  <button className="text-xs font-bold text-text-muted bg-surface hover:bg-card px-3 py-1.5 rounded-full border border-border transition-colors">Decline</button>
                                </div>
                              </div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0"></div>
                            </div>
                            
                            <div className="p-4 border-b border-border/50 hover:bg-surface/50 cursor-pointer transition-colors flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold shrink-0">S</div>
                              <div className="flex flex-col flex-1 gap-0.5">
                                <span className="text-sm font-medium text-white">
                                  <span className="font-bold">System</span>: Project <span className="font-bold">DevJournal</span> marked as complete
                                </span>
                                <span className="text-xs text-text-secondary">2 hours ago • Project</span>
                              </div>
                            </div>
                            
                            <div className="p-4 text-center text-sm text-text-muted py-6">
                              No more general notifications.
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <button
                onClick={toggleTheme}
                className="p-2 text-text-muted hover:text-brand-500 hover:bg-brand-500/10 rounded-full transition-colors"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {profile && (
                <button
                  onClick={() => onTabChange('profile')}
                  className="w-8 h-8 rounded-full bg-card border border-border overflow-hidden hover:opacity-80 transition-opacity flex shrink-0"
                  title="View Profile"
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-full h-full p-2 text-text-muted" />
                  )}
                </button>
              )}
              <button
                onClick={signOut}
                className="p-2 text-text-muted hover:text-red-500 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
        </div>
      </div>
    </nav>
  );
};
