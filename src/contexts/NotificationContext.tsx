import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Message } from '../types';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, X, MessageSquare } from 'lucide-react';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  unreadCount: number;
  markAllRead: () => void;
  recentRequests: Message[];
  targetMessageId: string | null;
  setTargetMessageId: (id: string | null) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Message[]>([]);
  const [recentRequests, setRecentRequests] = useState<Message[]>([]);
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);
  const userProjectsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile) return;

    // Initial count fetch based on local storage timestamp
    const fetchUnreadCount = async () => {
      const lastRead = localStorage.getItem('lastReadNotifications') || new Date(0).toISOString();
      
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_help_request', true)
        .neq('sender_id', profile.id)
        .gt('created_at', lastRead);

      if (!error && count !== null) {
        setUnreadCount(count);
      }
    };

    const fetchRecentRequests = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profile:profiles(*)')
        .eq('is_help_request', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setRecentRequests(data);
      }
    };

    const fetchUserProjects = async () => {
      const [{ data: owned }, { data: member }] = await Promise.all([
        supabase.from('projects').select('id').eq('user_id', profile.id),
        supabase.from('project_members').select('project_id').eq('user_id', profile.id)
      ]);
      
      const p = new Set<string>();
      owned?.forEach(r => p.add(r.id));
      member?.forEach(r => p.add(r.project_id));
      userProjectsRef.current = p;
    };

    fetchUnreadCount();
    fetchRecentRequests();
    fetchUserProjects();

    // Listen for new messages (help requests & project updates)
    const channel = supabase.channel('public:messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages'
      }, async (payload) => {
        const newMessage = payload.new as Message;
        
        const isProjectUpdate = newMessage.channel_id && userProjectsRef.current.has(newMessage.channel_id);

        // Only notify for help requests or project updates
        if (!newMessage.is_help_request && !isProjectUpdate) return;
        
        // Don't notify for our own messages
        if (newMessage.sender_id === profile.id) return;

        // Fetch the sender's profile for the toast
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', newMessage.sender_id)
          .single();

        if (senderProfile) {
          newMessage.profile = senderProfile;
        }

        // Increment unread count
        setUnreadCount(prev => prev + 1);

        // Add to recent requests list
        setRecentRequests(prev => [newMessage, ...prev].slice(0, 10));

        // Show toast
        setToasts(prev => [...prev, newMessage]);
        
        // Auto remove toast after 5s
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== newMessage.id));
        }, 5000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const markAllRead = () => {
    localStorage.setItem('lastReadNotifications', new Date().toISOString());
    setUnreadCount(0);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ unreadCount, markAllRead, recentRequests, targetMessageId, setTargetMessageId }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 w-96 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => {
             const text = toast.content || '';
             const header = text.split('\n')[0];
             
             return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className="bg-card/95 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-5 shadow-2xl pointer-events-auto relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                <button 
                  onClick={() => removeToast(toast.id)}
                  className="absolute top-3 right-3 text-text-muted hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
                
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`${toast.is_help_request ? 'bg-emerald-500/20 text-emerald-500' : 'bg-brand-500/20 text-brand-500'} p-1.5 rounded-full`}>
                      <Bell size={14} />
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${toast.is_help_request ? 'text-emerald-500' : 'text-brand-500'}`}>
                      {toast.is_help_request ? 'New Brief Received' : 'Project Update'}
                    </span>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface border border-border overflow-hidden shrink-0">
                      <img src={toast.profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${toast.profile?.username}`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="text-sm font-bold text-white line-clamp-2 leading-tight mb-1">
                        {header}
                      </span>
                      <span className="text-xs text-text-secondary">
                        By {toast.profile?.username || 'someone'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-text-muted">Just now</span>
                    <button 
                      onClick={() => {
                        if (toast.channel_id) {
                          // Note: Need a global way to open the project, but for now we just remove the toast.
                        }
                        removeToast(toast.id);
                      }}
                      className={`text-xs font-bold text-white px-4 py-2 rounded-full transition-colors shadow-sm ${toast.is_help_request ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-brand-600 hover:bg-brand-700'}`}
                    >
                      {toast.is_help_request ? 'View Brief' : 'View Update'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
