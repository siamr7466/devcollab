import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Message, Profile } from '../types';
import { Send, Image as ImageIcon, Mic, X, Play, Pause, Loader2, Volume2, Download, Square, Trash2, Users, Reply, ArrowUp, ArrowDown, MessageSquare, Plus, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { uploadToCloudinary } from '../lib/cloudinary';
import { format } from 'date-fns';

interface ChatProps {
  channelId: string | null; // null for World Chat
  title: string;
  isVisible?: boolean;
  onUnreadChange?: (count: number) => void;
}

const VoiceMessage: React.FC<{ url: string; isOwn: boolean }> = ({ url, isOwn }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  return (
    <div className="flex items-center gap-3 py-1">
      <button 
        onClick={togglePlay}
        className={`p-2 rounded-full flex items-center justify-center transition-all ${
          isOwn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-blue-100 hover:bg-blue-200 text-blue-600'
        }`}
      >
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-[120px]">
        <div className={`h-1.5 w-full rounded-full overflow-hidden ${isOwn ? 'bg-white/20' : 'bg-slate-100'}`}>
          <div 
            className={`h-full transition-all duration-100 ${isOwn ? 'bg-white' : 'bg-blue-600'}`} 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>
      <Volume2 size={14} className={isOwn ? 'text-white/60' : 'text-slate-400'} />
      <audio 
        ref={audioRef} 
        src={url} 
        onPlay={() => setPlaying(true)} 
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={onTimeUpdate}
        className="hidden" 
      />
    </div>
  );
};

export const Chat: React.FC<ChatProps> = ({ channelId, title, isVisible = true, onUnreadChange }) => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio Visualizer states
  const [audioVolumes, setAudioVolumes] = useState<number[]>(Array(30).fill(0));
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const cancelRecordingRef = useRef(false);

  const [typingUsers, setTypingUsers] = useState<{ [key: string]: string }>({});
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [shuffledUsers, setShuffledUsers] = useState<any[]>([]);
  const [projectMembers, setProjectMembers] = useState<Profile[]>([]);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [threadInputs, setThreadInputs] = useState<Record<string, string>>({});
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [subReplyInputs, setSubReplyInputs] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  
  const presenceChannelRef = useRef<any>(null);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchMessages();
    fetchProjectMembers();

    // Set up realtime subscription
    const channel = supabase
      .channel(`chat:${channelId || 'world'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          ...(channelId ? { filter: `channel_id=eq.${channelId}` } : {})
        },
        (payload) => {
          if (!payload.new) return;
          const newMessage = payload.new as Message;
          
          // Fallback manual filter for world chat (null channel_id)
          if (!channelId && newMessage.channel_id !== null) return;
          if (channelId && newMessage.channel_id !== channelId) return;
          
          if (payload.eventType === 'INSERT') {
            fetchMessageProfile(newMessage);
            
            // Increment unread count if not visible and not from self
            if (!isVisible && newMessage.sender_id !== profile?.id) {
              setUnreadCount(prev => {
                const next = prev + 1;
                onUnreadChange?.(next);
                return next;
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            // Handle votes update dynamically
            setMessages(prev => prev.map(m => m.id === newMessage.id ? { 
              ...m, 
              upvoted_by: newMessage.upvoted_by, 
              downvoted_by: newMessage.downvoted_by,
              content: newMessage.content
            } : m));
          }
        }
      )
      .subscribe();

    // Set up presence
    const presenceChannel = supabase.channel(`presence:chat:${channelId || 'world'}`, {
      config: { presence: { key: profile?.id } },
    });
    
    presenceChannelRef.current = presenceChannel;

    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      const currentTyping: { [key: string]: string } = {};
      const currentActive: any[] = [];
      const uniqueUsers = new Set();
      
      for (const id in state) {
        const userState: any = state[id][0];
        
        if (userState.user_id && !uniqueUsers.has(userState.user_id)) {
          uniqueUsers.add(userState.user_id);
          currentActive.push(userState);
        }

        if (id !== profile?.id) {
          if (userState.isTyping && userState.username) {
            currentTyping[id] = userState.username;
          }
        }
      }
      setActiveUsers(currentActive);
      setTypingUsers(currentTyping);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && profile) {
        await presenceChannel.track({
          user_id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          isTyping: false
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [channelId, profile?.id]);

  useEffect(() => {
    if (isVisible) {
      setUnreadCount(0);
      onUnreadChange?.(0);
    }
  }, [isVisible, onUnreadChange]);

  useEffect(() => {
    setShuffledUsers(activeUsers.slice(0, 10));
    
    if (activeUsers.length <= 10) return;
    
    const interval = setInterval(() => {
      const shuffled = [...activeUsers].sort(() => 0.5 - Math.random());
      setShuffledUsers(shuffled.slice(0, 10));
    }, 30000);

    return () => clearInterval(interval);
  }, [activeUsers]);

  const { targetMessageId, setTargetMessageId } = useNotifications();

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (targetMessageId && messages.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`message-${targetMessageId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('bg-brand-500/20', 'transition-colors', 'duration-1000', 'rounded-xl');
          setTimeout(() => {
            el.classList.remove('bg-brand-500/20', 'rounded-xl');
            setTargetMessageId(null);
          }, 2000);
        }
      }, 500); // Small delay to ensure DOM is rendered after tab switch
    }
  }, [targetMessageId, messages, setTargetMessageId]);

  async function fetchProjectMembers() {
    if (!channelId) return;
    const { data, error } = await supabase
      .from('project_members')
      .select('*, profile:profiles(*)')
      .eq('project_id', channelId);

    if (!error && data) {
      setProjectMembers(data.map((m: any) => m.profile).filter(Boolean));
    } else if (error) {
      console.error('Error fetching project members:', error);
    }
  }

  async function fetchMessages() {
    setLoading(true);
    let query = supabase
      .from('messages')
      .select('*, profile:profiles(*)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (channelId) {
      query = query.eq('channel_id', channelId);
    } else {
      query = query.is('channel_id', null);
    }

    const { data, error } = await query;
    if (!error && data) {
      setMessages(data.reverse());
    }
    setLoading(false);
  }

  async function fetchMessageProfile(message: Message) {
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', message.sender_id)
      .single();
    
    setMessages(prev => {
      // Prevent duplicates if already exists
      if (prev.some(m => m.id === message.id)) return prev;
      return [...prev, { ...message, profile: senderProfile || undefined }];
    });
  }



  const handleTyping = (val: string) => {
    setInput(val);
    if (!profile || !presenceChannelRef.current) return;
    
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      presenceChannelRef.current.track({ isTyping: true, username: profile.username, user_id: profile.id, avatar_url: profile.avatar_url });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      if (presenceChannelRef.current) {
        presenceChannelRef.current.track({ isTyping: false, username: profile.username, user_id: profile.id, avatar_url: profile.avatar_url });
      }
    }, 2000);
  };

  const handleVote = async (messageId: string, type: 'up' | 'down') => {
    if (!profile) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    let upvotes = msg.upvoted_by || [];
    let downvotes = msg.downvoted_by || [];

    if (type === 'up') {
      if (upvotes.includes(profile.id)) {
        upvotes = upvotes.filter(id => id !== profile.id);
      } else {
        upvotes = [...upvotes, profile.id];
        downvotes = downvotes.filter(id => id !== profile.id);
      }
    } else {
      if (downvotes.includes(profile.id)) {
        downvotes = downvotes.filter(id => id !== profile.id);
      } else {
        downvotes = [...downvotes, profile.id];
        upvotes = upvotes.filter(id => id !== profile.id);
      }
    }

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, upvoted_by: upvotes, downvoted_by: downvotes } : m));

    await supabase.from('messages').update({
      upvoted_by: upvotes,
      downvoted_by: downvotes
    }).eq('id', messageId);
  };

  const handleSend = async (e?: React.FormEvent | KeyboardEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!profile) return;
    
    // If we are recording, hitting Send (or Enter) should stop and send the voice memo
    if (isRecording) {
      await toggleRecording();
      return;
    }

    // Clear typing indicator immediately
    if (presenceChannelRef.current) {
      presenceChannelRef.current.track({ isTyping: false, username: profile.username, user_id: profile.id, avatar_url: profile.avatar_url });
    }
    isTypingRef.current = false;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Send Image with optional caption
    if (selectedImageFile) {
      setUploading(true);
      try {
        const url = await uploadToCloudinary(selectedImageFile);
        await supabase.from('messages').insert([
          { 
            channel_id: channelId, 
            sender_id: profile.id, 
            type: 'image', 
            media_url: url,
            content: input.trim() ? input : null,
            parent_id: replyingTo ? replyingTo.id : null,
          }
        ]);
        cancelImagePreview();
        setInput('');
        setReplyingTo(null);
      } catch (err) {
        console.error('Upload failed:', err);
      } finally {
        setUploading(false);
      }
      return; // Do not send a separate text message
    }

    // Send plain text
    if (!input.trim()) return;

    let finalContent = input;
    let isHelpRequest = false;
    
    // Help request logic: must start with /help and not be a reply itself
    if (finalContent.toLowerCase().startsWith('/help') && !replyingTo) {
      isHelpRequest = true;
      finalContent = finalContent.substring(5).trim();
    } else if (finalContent.startsWith('/') && !replyingTo) {
      isHelpRequest = true;
      finalContent = finalContent.substring(1).trim();
    }

    const content = finalContent;
    setInput('');
    const parentId = replyingTo ? replyingTo.id : null;
    setReplyingTo(null);

    const { error } = await supabase.from('messages').insert([
      { 
        channel_id: channelId, 
        sender_id: profile.id, 
        content, 
        type: 'text',
        is_help_request: isHelpRequest,
        parent_id: parentId
      }
    ]);

    if (error) console.error('Error sending message:', error);
  };

  const toggleThread = (id: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCommentReplies = (id: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleThreadSend = async (parentId: string) => {
    const text = threadInputs[parentId];
    if (!profile || !text || !text.trim()) return;

    setThreadInputs(prev => ({...prev, [parentId]: ''}));

    const { error } = await supabase.from('messages').insert([
      { 
        channel_id: channelId, 
        sender_id: profile.id, 
        content: text.trim(), 
        type: 'text',
        is_help_request: false,
        parent_id: parentId
      }
    ]);
    if (error) console.error('Error sending thread message:', error);
  };

  const handleSubReplySend = async (commentId: string, helpRequestId: string) => {
    const text = subReplyInputs[commentId];
    if (!profile || !text || !text.trim()) return;

    setSubReplyInputs(prev => ({...prev, [commentId]: ''}));
    setReplyingToCommentId(null);

    const { error } = await supabase.from('messages').insert([
      { 
        channel_id: channelId, 
        sender_id: profile.id, 
        content: text.trim(), 
        type: 'text',
        is_help_request: false,
        parent_id: commentId
      }
    ]);
    if (error) console.error('Error sending sub reply:', error);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setSelectedImageFile(file);
    setSelectedImagePreview(URL.createObjectURL(file));
  };

  const cancelImagePreview = () => {
    setSelectedImageFile(null);
    if (selectedImagePreview) URL.revokeObjectURL(selectedImagePreview);
    setSelectedImagePreview(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      await supabase.from('messages').insert([
        {
          channel_id: channelId,
          sender_id: profile.id,
          type: 'image',
          media_url: url,
          parent_id: replyingTo ? replyingTo.id : null,
        }
      ]);
      setReplyingTo(null);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop and send
      mediaRecorder.current?.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setRecordingTime(0);
      setAudioVolumes(Array(30).fill(0));
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder.current = new MediaRecorder(stream);
        audioChunks.current = [];

        // Set up Web Audio API for visualizer
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;
        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;
        
        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateVisualizer = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          setAudioVolumes(prev => [...prev.slice(1), average]);
          animationFrameRef.current = requestAnimationFrame(updateVisualizer);
        };
        updateVisualizer();

        mediaRecorder.current.ondataavailable = (e) => {
          audioChunks.current.push(e.data);
        };

        mediaRecorder.current.onstop = async () => {
          if (cancelRecordingRef.current) {
            cancelRecordingRef.current = false;
            return;
          }
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
          await uploadVoice(audioBlob);
        };

        mediaRecorder.current.start();
        setIsRecording(true);
        setRecordingTime(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('Error accessing microphone:', err);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const uploadVoice = async (blob: Blob) => {
    if (!profile) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(blob, 'video');
      await supabase.from('messages').insert([
        {
          channel_id: channelId,
          sender_id: profile.id,
          type: 'voice',
          media_url: url,
          content: input.trim() ? input : null,
          parent_id: replyingTo ? replyingTo.id : null,
        }
      ]);
      setInput('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Voice upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const cancelRecording = () => {
    if (isRecording) {
      cancelRecordingRef.current = true;
      mediaRecorder.current?.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setRecordingTime(0);
      setAudioVolumes(Array(30).fill(0));
    }
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative">
      <div className="flex flex-col flex-1 h-full min-w-0 relative border-r border-border/50">
        <div className="p-3 border-b border-border/50 bg-surface/80 backdrop-blur-2xl flex justify-between items-center shrink-0 z-10 shadow-sm relative gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h2 className="font-bold text-base text-text-primary truncate" title={title}>{title}</h2>
            <div className="shrink-0 px-2 py-0.5 bg-brand-500/10 text-brand-500 text-xs font-bold rounded-full border border-brand-500/20">
              {activeUsers.length} Active
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest hidden min-[400px]:inline-block">Live Sync</span>
            </div>
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className={`p-1.5 rounded-full transition-all flex items-center justify-center gap-1.5 text-xs font-semibold border ${showSidebar ? 'bg-brand-500/10 text-brand-500 border-brand-500/20' : 'bg-surface hover:bg-surface/80 text-text-muted hover:text-text-primary border-border/50 shadow-sm'}`}
            >
              <Users size={14} />
              <span className="pr-0.5">{channelId ? projectMembers.length : activeUsers.length}</span>
            </button>
          </div>
        </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-slate-300" />
          </div>
        ) : (
          (() => {
            const helpRequestIds = new Set(
              messages.filter(m => m.is_help_request).map(m => m.id)
            );
            const commentIds = new Set(
              messages.filter(m => m.parent_id && helpRequestIds.has(m.parent_id)).map(m => m.id)
            );
            const repliesMap = new Map<string, Message[]>();
            const topMessages: Message[] = [];
            
            // Note: messages are reversed (oldest first)
            messages.forEach(msg => {
              if (msg.parent_id && helpRequestIds.has(msg.parent_id)) {
                if (!repliesMap.has(msg.parent_id)) repliesMap.set(msg.parent_id, []);
                repliesMap.get(msg.parent_id)!.push(msg);
              } else if (msg.parent_id && commentIds.has(msg.parent_id)) {
                // Skip sub-replies from main chat as well
              } else {
                topMessages.push(msg);
              }
            });

            return topMessages.map((msg) => {
              const msgReplies = repliesMap.get(msg.id) || [];
              const isOwn = msg.sender_id === profile?.id;
              
              const MessageBubble = ({ message, isReply, quotedMessage, parentIsOwn, children }: { message: Message, isReply: boolean, quotedMessage?: Message, parentIsOwn?: boolean, children?: React.ReactNode }) => {
                const bubbleIsOwn = message.sender_id === profile?.id;
                const upvotes = message.upvoted_by || [];
                const downvotes = message.downvoted_by || [];
                
                if (isReply) {
                  const alignRight = parentIsOwn !== undefined ? parentIsOwn : bubbleIsOwn;
                  return (
                    <div className={`flex flex-col w-full animate-in fade-in ${alignRight ? 'items-end slide-in-from-right-2' : 'items-start slide-in-from-left-2'}`}>
                      <div className={`bg-card border border-border/50 rounded-2xl p-4 shadow-sm w-full sm:max-w-3xl ${bubbleIsOwn ? 'bg-brand-500/5' : ''}`}>
                        <div className={`flex items-center gap-2 mb-2 ${bubbleIsOwn ? 'flex-row-reverse' : ''}`}>
                          <img 
                            src={message.profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${message.profile?.username}`} 
                            alt={message.profile?.username || 'User'} 
                            className="w-6 h-6 rounded-full bg-surface border border-border/50 object-cover"
                          />
                          <span className="text-xs font-bold text-text-primary">
                            {message.profile?.full_name || message.profile?.username || 'Unknown'}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            • {format(new Date(message.created_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        
                        <div className="pl-8">
                          {message.type === 'text' && (
                            <p className="text-sm text-text-primary leading-relaxed break-words whitespace-pre-wrap">
                              {message.content}
                            </p>
                          )}
                          
                          {message.type === 'image' && (
                            <div className="flex flex-col gap-2">
                              <div className="relative cursor-pointer group/img" onClick={() => setViewingImage(message.media_url!)}>
                                <img 
                                  src={message.media_url!} 
                                  alt="Shared" 
                                  className="rounded-xl max-h-80 object-contain w-full hover:opacity-90 transition-opacity"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                                  <span className="text-white text-xs font-bold bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">View Fullscreen</span>
                                </div>
                              </div>
                              {message.content && (
                                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap overflow-wrap-anywhere">
                                  {message.content}
                                </p>
                              )}
                            </div>
                          )}
                          
                          {message.type === 'voice' && (
                            <div className="flex flex-col gap-2">
                              <VoiceMessage url={message.media_url!} isOwn={false} />
                              {message.content && (
                                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap overflow-wrap-anywhere">
                                  {message.content}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Action Bar for Votes */}
                          <div className="flex items-center gap-2 mt-3">
                            <button 
                              onClick={() => handleVote(message.id, 'up')} 
                              className={`px-2 py-1 rounded-full transition-colors flex items-center gap-1 text-xs font-medium border ${upvotes.includes(profile?.id || '') ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-text-muted hover:text-emerald-500 hover:bg-surface border-border/50'}`}
                            >
                              <ArrowUp size={14} /> {upvotes.length > 0 && upvotes.length}
                            </button>
                            <button 
                              onClick={() => handleVote(message.id, 'down')} 
                              className={`px-2 py-1 rounded-full transition-colors flex items-center gap-1 text-xs font-medium border ${downvotes.includes(profile?.id || '') ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-text-muted hover:text-red-500 hover:bg-surface border-border/50'}`}
                            >
                              <ArrowDown size={14} /> {downvotes.length > 0 && downvotes.length}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className={`flex flex-col ${bubbleIsOwn ? 'items-end' : 'items-start'} ${message.is_help_request ? 'w-full' : ''}`}>
                    <div className={`flex items-center gap-2 mb-1 ${message.is_help_request ? (bubbleIsOwn ? 'pr-4 mr-2 sm:mr-6 flex-row-reverse' : 'pl-4 ml-2 sm:ml-6') : ''}`}>
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-tight">
                        {message.profile?.username || 'Unknown'}
                      </span>
                      <span className="text-[10px] text-text-secondary">
                        {format(new Date(message.created_at), 'HH:mm')}
                      </span>
                    </div>
                    
                    <div className={`group relative flex flex-col ${message.is_help_request ? `w-full sm:max-w-3xl ${bubbleIsOwn ? 'pr-4 mr-2 sm:mr-6' : 'pl-4 ml-2 sm:ml-6'}` : 'max-w-[85%] sm:max-w-[70%]'}`}>
                      <div className={`rounded-2xl p-3 shadow-sm ${
                        message.is_help_request 
                          ? 'bg-gradient-to-r from-brand-600/20 to-purple-600/20 border border-brand-500/30 text-text-primary'
                          : bubbleIsOwn 
                            ? 'bg-brand-600 text-white rounded-tr-none' 
                            : 'bg-card border border-border text-text-primary rounded-tl-none'
                      }`}>
                        {quotedMessage && !message.is_help_request && (
                          <div 
                            onClick={() => {
                              const el = document.getElementById(`message-${quotedMessage.id}`);
                              if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                el.classList.add('bg-brand-500/20', 'transition-colors', 'duration-1000', 'rounded-xl');
                                setTimeout(() => el.classList.remove('bg-brand-500/20', 'rounded-xl'), 2000);
                              }
                            }}
                            className={`mb-2 p-2 rounded-lg border-l-4 text-xs opacity-90 flex flex-col cursor-pointer hover:opacity-100 transition-all ${bubbleIsOwn ? 'bg-black/20 border-white/50 hover:bg-black/30' : 'bg-black/5 border-brand-500/50 hover:bg-brand-500/10'}`}
                          >
                            <span className="font-bold mb-0.5" style={{ color: bubbleIsOwn ? '#fff' : '#6366f1' }}>{quotedMessage.profile?.username || 'Unknown'}</span>
                            <span className="truncate opacity-80">{quotedMessage.type === 'text' ? quotedMessage.content : (quotedMessage.type === 'image' ? '📸 Image' : '🎤 Voice Message')}</span>
                          </div>
                        )}
                        
                        {message.is_help_request && (
                          <div className="flex items-center gap-2 mb-2 text-brand-500 font-bold text-xs uppercase tracking-wider border-b border-brand-500/20 pb-2">
                            <MessageSquare size={14} />
                            Help Request
                          </div>
                        )}
                        
                        {message.type === 'text' && !message.is_help_request && (
                          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap overflow-wrap-anywhere">
                            {message.content}
                          </p>
                        )}

                        {message.type === 'text' && message.is_help_request && (
                          <div className="flex flex-col gap-1.5">
                            {(() => {
                               const text = message.content || '';
                               const lines = text.split('\n');
                               const header = lines[0];
                               const description = lines.slice(1).join('\n').trim();
                               return (
                                 <>
                                  <h3 className="text-base font-bold text-text-primary leading-tight">{header}</h3>
                                  {description && (
                                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap mt-0.5">
                                      {description}
                                    </p>
                                  )}
                                 </>
                               )
                            })()}
                          </div>
                        )}
                        
                        {message.type === 'image' && (
                          <div className="flex flex-col gap-2">
                            <div className="relative cursor-pointer group/img" onClick={() => setViewingImage(message.media_url!)}>
                              <img 
                                src={message.media_url!} 
                                alt="Shared" 
                                className="rounded-xl max-h-80 object-contain w-full hover:opacity-90 transition-opacity"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                                <span className="text-white text-xs font-bold bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">View Fullscreen</span>
                              </div>
                            </div>
                            {message.content && (
                              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap overflow-wrap-anywhere px-1">
                                {message.content}
                              </p>
                            )}
                          </div>
                        )}
                        
                        {message.type === 'voice' && (
                          <div className="flex flex-col gap-2">
                            <VoiceMessage url={message.media_url!} isOwn={bubbleIsOwn} />
                            {message.content && (
                              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap overflow-wrap-anywhere px-1">
                                {message.content}
                              </p>
                            )}
                          </div>
                        )}
                        
                        {message.is_help_request && children && (
                          <div className="mt-3 pt-3 border-t border-brand-500/20 flex items-center justify-end w-full">
                            {children}
                          </div>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${bubbleIsOwn ? 'justify-end' : 'justify-start'}`}>
                        {!isReply && !message.is_help_request && (
                          <button onClick={() => setReplyingTo(message)} className="p-1.5 text-text-muted hover:text-brand-500 hover:bg-brand-500/10 rounded-full transition-colors text-xs flex items-center gap-1">
                            <Reply size={14} /> Reply
                          </button>
                        )}

                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <div key={msg.id} id={`message-${msg.id}`} className="flex flex-col gap-2">
                  <MessageBubble 
                    message={msg} 
                    isReply={false} 
                    quotedMessage={msg.parent_id && !helpRequestIds.has(msg.parent_id) ? messages.find(m => m.id === msg.parent_id) : undefined} 
                  >
                    {msg.is_help_request && (
                      <div className="flex items-center">
                        {msgReplies.length > 0 && (
                          <div className="flex -space-x-2 mr-3">
                            {Array.from(new Map(msgReplies.map(r => [r.sender_id, r.profile])).values()).slice(0, 3).map((p, i) => (
                              <img key={i} src={p?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p?.username}`} className="w-6 h-6 rounded-full border-2 border-background object-cover bg-surface" title={p?.username || 'User'} />
                            ))}
                          </div>
                        )}
                        {msgReplies.length > 0 && (
                          <span className="text-xs text-text-muted font-medium mr-4">
                            {msgReplies.length} {msgReplies.length === 1 ? 'reply' : 'replies'}
                          </span>
                        )}
                        
                        <button 
                          onClick={() => toggleThread(msg.id)} 
                          className="text-text-muted hover:text-brand-500 text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 bg-background/50 border border-border/50 rounded-full transition-all shadow-sm"
                        >
                          <MessageSquare size={12} /> {expandedThreads.has(msg.id) ? 'Hide Comments' : (msgReplies.length > 0 ? `View Comments` : 'Add Comment')}
                        </button>
                      </div>
                    )}
                  </MessageBubble>

                  <AnimatePresence>
                    {msg.is_help_request && expandedThreads.has(msg.id) && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`${msg.sender_id === profile?.id ? 'pr-4 sm:pr-8 border-r-2 mr-6 sm:mr-10 items-end' : 'pl-4 sm:pl-8 border-l-2 ml-6 sm:ml-10 items-start'} border-border/50 mt-3 flex flex-col gap-4 overflow-hidden`}
                      >
                        {msgReplies.length > 0 ? (
                          <div className="flex flex-col gap-4 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                            {msgReplies.map(reply => {
                              const subReplies = messages.filter(m => m.parent_id === reply.id);
                              return (
                                <div key={reply.id} className="flex flex-col gap-2 w-full">
                                  <MessageBubble message={reply} isReply={true} parentIsOwn={msg.sender_id === profile?.id} />
                                  
                                  {/* Sub Replies (Level 2) */}
                                  {subReplies.length > 0 && (
                                    <div className={`flex flex-col gap-2 mt-1 ${msg.sender_id === profile?.id ? 'items-end' : 'items-start'}`}>
                                      <button 
                                        onClick={() => toggleCommentReplies(reply.id)}
                                        className="text-xs text-brand-500 hover:text-brand-400 flex items-center gap-1.5 transition-colors ml-2 mr-2 font-medium"
                                      >
                                        {expandedComments.has(reply.id) ? 'Hide replies' : `View ${subReplies.length} ${subReplies.length === 1 ? 'reply' : 'replies'}`}
                                      </button>
                                      
                                      {expandedComments.has(reply.id) && (
                                        <div className={`flex flex-col gap-3 mt-1 mb-2 w-full ${msg.sender_id === profile?.id ? 'mr-6 border-r-2 pr-4 items-end' : 'ml-6 border-l-2 pl-4 items-start'} border-border/30`}>
                                          {subReplies.map(sub => (
                                            <div key={sub.id} className={`flex flex-col ${sub.sender_id === profile?.id ? 'items-end' : 'items-start'} max-w-[85%]`}>
                                              <div className="flex items-center gap-2 mb-0.5 text-xs text-text-muted">
                                                <span className="font-bold text-text-primary">{sub.profile?.username || 'User'}</span>
                                                <span>{new Date(sub.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                              </div>
                                              <div className={`text-sm ${sub.sender_id === profile?.id ? 'bg-brand-600 text-white' : 'bg-surface text-text-primary'} p-2.5 rounded-2xl shadow-sm`}>
                                                {sub.content}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Reply Button & Inline Input */}
                                  <div className={`flex flex-col ${msg.sender_id === profile?.id ? 'items-end' : 'items-start'} gap-2`}>
                                    <button 
                                      onClick={() => setReplyingToCommentId(replyingToCommentId === reply.id ? null : reply.id)}
                                      className="text-xs text-text-muted hover:text-brand-500 flex items-center gap-1.5 transition-colors ml-2 mr-2"
                                    >
                                      <Reply size={12} /> {replyingToCommentId === reply.id ? 'Cancel' : 'Reply'}
                                    </button>
                                    
                                    {replyingToCommentId === reply.id && (
                                      <div className="flex items-center gap-2 mt-1 relative w-full sm:max-w-md bg-card border border-border p-1.5 rounded-full shadow-lg">
                                        <input
                                          type="text"
                                          value={subReplyInputs[reply.id] || ''}
                                          onChange={(e) => setSubReplyInputs(prev => ({...prev, [reply.id]: e.target.value}))}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleSubReplySend(reply.id, msg.id);
                                            }
                                          }}
                                          placeholder={`Reply to ${reply.profile?.username}...`}
                                          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted px-3 text-sm focus:outline-none"
                                        />
                                        <button 
                                          onClick={() => handleSubReplySend(reply.id, msg.id)}
                                          disabled={!subReplyInputs[reply.id]?.trim()}
                                          className="p-1.5 bg-brand-500 text-white rounded-full hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                        >
                                          <Send size={12} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-text-muted italic py-2">No comments yet. Be the first to help!</div>
                        )}
                        
                        {/* Inline Input Box */}
                        <div className="flex items-center gap-2 mt-1 relative w-full sm:max-w-2xl bg-card border border-border p-1.5 rounded-full">
                           <input
                             type="text"
                             value={threadInputs[msg.id] || ''}
                             onChange={(e) => setThreadInputs(prev => ({...prev, [msg.id]: e.target.value}))}
                             onKeyDown={(e) => {
                               if (e.key === 'Enter') {
                                 e.preventDefault();
                                 handleThreadSend(msg.id);
                               }
                             }}
                             placeholder="Write a comment..."
                             className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted px-3 text-sm focus:outline-none"
                           />
                           <button 
                             onClick={() => handleThreadSend(msg.id)}
                             disabled={!threadInputs[msg.id]?.trim()}
                             className="p-1.5 bg-brand-500 text-white rounded-full hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                           >
                             <Send size={14} />
                           </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            });
          })()
        )}
        
        {Object.keys(typingUsers).length > 0 && (
          <div className="flex items-center gap-2 text-text-muted text-xs font-bold animate-pulse">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 sm:p-4 bg-surface/80 backdrop-blur-2xl border-t border-border/50 shrink-0 flex flex-col gap-2 z-10 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        {selectedImagePreview && (
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden border-2 border-brand-500 shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <img src={selectedImagePreview} alt="Preview" className="w-full h-full object-cover" />
            <button 
              type="button"
              onClick={cancelImagePreview}
              className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-red-500 transition-colors backdrop-blur-sm"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {isRecording && (
          <div className="relative p-4 rounded-xl border border-red-500/30 shadow-lg animate-in fade-in slide-in-from-bottom-2 bg-card/90 backdrop-blur-md max-w-sm">
            <button  
              type="button"
              onClick={cancelRecording}
              className="absolute top-1 right-1 p-1 bg-surface text-text-muted rounded-full hover:bg-red-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
            <div className="flex items-center gap-3 w-full pr-4">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <span className="font-mono font-bold text-red-500 text-sm shrink-0">{formatTime(recordingTime)}</span>
              
              <div className="flex items-center gap-[2px] flex-1 h-6 ml-2 overflow-hidden justify-end">
                {audioVolumes.map((vol, i) => (
                  <div 
                    key={i} 
                    className="w-1 bg-red-400 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(4, (vol / 255) * 24)}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {replyingTo && (
          <div className="flex items-center justify-between p-3 bg-surface border border-border/50 rounded-xl mb-2 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-brand-500 flex items-center gap-1">
                <Reply size={12} /> Replying to {replyingTo.profile?.username}
              </span>
              <span className="text-xs text-text-muted truncate mt-0.5">
                {replyingTo.type === 'text' ? replyingTo.content : `Shared an ${replyingTo.type}`}
              </span>
            </div>
            <button 
              onClick={() => setReplyingTo(null)}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-card rounded-full transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-2 relative">
          <AnimatePresence>
            {input.startsWith('/') && !replyingTo && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full mb-2 left-12 bg-gradient-to-r from-brand-600 to-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 z-20 pointer-events-none"
              >
                <MessageSquare size={14} /> Create a Help Request
                <div className="absolute -bottom-1 left-4 w-2 h-2 bg-brand-600 transform rotate-45"></div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center">
            <label className="p-2 text-text-muted hover:text-brand-500 cursor-pointer transition-colors shrink-0">
              <ImageIcon size={20} />
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageSelect}
                disabled={uploading || isRecording}
              />
            </label>
            
            <button 
              type="button"
              onClick={toggleRecording}
              className={`p-2 transition-colors shrink-0 ${isRecording ? 'text-red-500 hover:text-red-600' : 'text-text-muted hover:text-brand-500'}`}
              disabled={uploading}
            >
              {isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={20} />}
            </button>
          </div>

          <input 
            type="text" 
            value={input}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={(selectedImagePreview || isRecording) ? "Add a caption..." : "Type message..."}
            className="flex-1 bg-card border border-border text-text-primary placeholder:text-text-muted rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            disabled={uploading}
          />

          <button 
            type="submit"
            className={`p-2.5 rounded-full transition-all active:scale-90 flex items-center justify-center ${
              isRecording 
                ? 'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-500/20' 
                : 'bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-50'
            }`}
            disabled={(!input.trim() && !isRecording && !selectedImageFile) || uploading}
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className={isRecording ? "ml-0.5" : ""} />}
          </button>
        </form>
      </div>

      {viewingImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center animate-in fade-in">
          <div className="absolute top-4 right-4 flex items-center gap-4">
            <a 
              href={viewingImage} 
              download 
              target="_blank"
              rel="noreferrer"
              className="p-3 bg-white/10 hover:bg-brand-500 text-white rounded-full transition-colors backdrop-blur-md flex items-center gap-2 group"
            >
              <Download size={20} />
              <span className="hidden group-hover:block pr-2 text-sm font-bold">Download</span>
            </a>
            <button 
              onClick={() => setViewingImage(null)}
              className="p-3 bg-white/10 hover:bg-red-500 text-white rounded-full transition-colors backdrop-blur-md"
            >
              <X size={24} />
            </button>
          </div>
          <img 
            src={viewingImage} 
            alt="Fullscreen" 
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl" 
          />
        </div>
      )}
      </div>

      <AnimatePresence>
        {showSidebar && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 350, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute lg:relative right-0 inset-y-0 z-40 bg-surface/95 backdrop-blur-3xl lg:bg-surface/50 border-l border-border/50 shadow-2xl lg:shadow-none flex flex-col shrink-0 overflow-hidden"
          >
            <div className="p-4 border-b border-border/50 shrink-0 flex justify-between items-center w-[350px]">
              <div>
                <h3 className="font-bold text-sm text-text-primary">{channelId ? 'Project Members' : 'Active Members'}</h3>
                <p className="text-xs text-text-muted">{`${activeUsers.length} online now`}</p>
              </div>
              <button onClick={() => setShowSidebar(false)} className="p-2 hover:bg-white/5 rounded-full text-text-muted hover:text-text-primary transition-colors">
                 <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6 w-[350px]">
              {(channelId ? projectMembers.map(m => ({
                user_id: m.id,
                username: m.username,
                avatar_url: m.avatar_url,
                isTyping: Object.keys(typingUsers).includes(m.id),
                isOnline: activeUsers.some(au => au.user_id === m.id)
              })) : shuffledUsers.map(u => ({...u, isOnline: true}))).map(u => (
                <button 
                  key={u.user_id} 
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 active:bg-white/10 rounded-xl transition-all group cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <div className="relative shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.username} className="w-10 h-10 rounded-full object-cover border-2 border-transparent group-hover:border-brand-500 transition-colors shadow-sm" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:shadow-brand-500/20 transition-all">
                        {u.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    {u.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface shadow-sm" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-semibold text-text-primary truncate group-hover:text-brand-500 transition-colors">{u.username || 'Unknown'}</span>
                    {u.isTyping ? (
                      <span className="text-xs text-brand-500 font-medium animate-pulse">Typing...</span>
                    ) : (
                      <span className="text-xs text-text-muted truncate">{u.isOnline ? 'Online' : 'Offline'}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
