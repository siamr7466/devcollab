import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Project, Profile } from '../types';
import { MessageSquare, Send, Loader2, ArrowLeft, X, Image as ImageIcon, Mic, Paperclip, Play, Pause, Download, Volume2 } from 'lucide-react';
import { Chat } from './Chat';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadToCloudinary } from '../lib/cloudinary';

interface ProjectWorkspaceProps {
  project: Project;
  onBack: () => void;
}

interface Update {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  type: string;
  media_url?: string;
  profile?: Profile;
}

const VoiceMessage: React.FC<{ url: string }> = ({ url }) => {
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
    <div className="flex items-center gap-3 py-2 bg-surface border border-border rounded-lg px-4 mt-2 max-w-sm">
      <button 
        onClick={togglePlay}
        className="p-2 rounded-full flex items-center justify-center bg-brand-100 hover:bg-brand-200 text-brand-600 transition-colors"
      >
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-[120px]">
        <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
          <div 
            className="h-full bg-brand-600 transition-all duration-100" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>
      <Volume2 size={14} className="text-text-muted" />
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

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({ project, onBack }) => {
  const { profile } = useAuth();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [newUpdate, setNewUpdate] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [members, setMembers] = useState<any[]>([]);

  // Media states
  const [uploading, setUploading] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchUpdates();
    fetchMembers();
  }, [project.id]);

  async function fetchMembers() {
    const { data, error } = await supabase
      .from('project_members')
      .select('*, profile:profiles(*)')
      .eq('project_id', project.id);

    if (!error && data) {
      setMembers(data);
    }
  }

  const updateRole = async (userId: string, role: string) => {
    const { error } = await supabase
      .from('project_members')
      .update({ role })
      .eq('project_id', project.id)
      .eq('user_id', userId);

    if (!error) {
      fetchMembers();
    }
  };

  async function fetchUpdates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_updates')
      .select('*, profile:profiles(*)')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUpdates(data);
    } else if (error) {
      console.error('Error fetching updates:', error);
    }
    setLoading(false);
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImageFile(file);
    setSelectedImagePreview(URL.createObjectURL(file));
    setSelectedFile(null); // Clear other file
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setSelectedImageFile(null); // Clear image
    setSelectedImagePreview(null);
  };

  const cancelSelection = () => {
    setSelectedImageFile(null);
    if (selectedImagePreview) URL.revokeObjectURL(selectedImagePreview);
    setSelectedImagePreview(null);
    setSelectedFile(null);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorder.current?.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingTime(0);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder.current = new MediaRecorder(stream);
        audioChunks.current = [];

        mediaRecorder.current.ondataavailable = (e) => {
          audioChunks.current.push(e.data);
        };

        mediaRecorder.current.onstop = async () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
          await uploadAndPost('voice', audioBlob);
        };

        mediaRecorder.current.start();
        setIsRecording(true);
        setRecordingTime(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Could not access microphone.');
      }
    }
  };

  async function uploadAndPost(type: 'text' | 'image' | 'voice' | 'file', fileBlob?: Blob | File) {
    if (!profile) return;
    setPosting(true);
    setUploading(true);

    try {
      let mediaUrl = '';
      if (fileBlob) {
        const uploadType = type === 'voice' ? 'video' : (type === 'image' ? 'image' : 'raw');
        mediaUrl = await uploadToCloudinary(fileBlob, uploadType);
      } else if (selectedImageFile) {
        mediaUrl = await uploadToCloudinary(selectedImageFile, 'image');
        type = 'image';
      } else if (selectedFile) {
        mediaUrl = await uploadToCloudinary(selectedFile, 'raw');
        type = 'file';
      }

      const { error } = await supabase.from('project_updates').insert([
        {
          project_id: project.id,
          user_id: profile.id,
          content: newUpdate.trim() || (type === 'voice' ? 'Voice Update' : type === 'file' ? selectedFile?.name : 'Update'),
          type: type,
          media_url: mediaUrl || null,
        },
      ]);

      if (!error) {
        setNewUpdate('');
        cancelSelection();
        fetchUpdates();
      } else {
        console.error('Error posting update:', error);
        alert('Failed to post update.');
      }
    } catch (err) {
      console.error('Upload or post failed:', err);
      alert('Failed to post update.');
    } finally {
      setPosting(false);
      setUploading(false);
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col relative bg-background text-text-primary">
      {/* Header */}
      <div className="border-b border-border/50 p-4 flex items-center gap-4 bg-surface/50 backdrop-blur-md sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/5 rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold">{project.title}</h2>
          <p className="text-xs text-text-muted">Project Workspace</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Left: Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Post Update Box */}
        <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-sm mb-3 text-text-primary uppercase tracking-wider">Share an Update</h3>
          
          {selectedImagePreview && (
            <div className="relative inline-block mb-3">
              <img src={selectedImagePreview} alt="Preview" className="h-32 w-auto rounded-lg object-cover border border-border" />
              <button 
                onClick={cancelSelection}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {selectedFile && (
            <div className="flex items-center gap-2 mb-3 bg-surface p-2 rounded-lg border border-border max-w-sm">
              <Paperclip size={16} className="text-text-muted" />
              <span className="text-sm text-text-primary truncate flex-1">{selectedFile.name}</span>
              <button 
                onClick={cancelSelection}
                className="text-text-muted hover:text-red-500 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {isRecording && (
            <div className="flex items-center gap-3 mb-3 bg-red-500/10 text-red-500 p-2 rounded-lg border border-red-500/20 max-w-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Recording: {formatTime(recordingTime)}</span>
              <button 
                onClick={toggleRecording}
                className="ml-auto text-sm font-bold hover:underline"
              >
                Stop & Send
              </button>
            </div>
          )}

          <textarea
            placeholder="What's the latest on this project?"
            className="w-full p-3 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 h-24 resize-none transition-colors"
            value={newUpdate}
            onChange={(e) => setNewUpdate(e.target.value)}
            onPaste={(e) => {
              const file = e.clipboardData.files[0];
              if (file && file.type.startsWith('image/')) {
                setSelectedImageFile(file);
                setSelectedImagePreview(URL.createObjectURL(file));
                setSelectedFile(null);
              }
            }}
          />
          
          <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-2">
              {/* Image Upload */}
              <label className="p-2 hover:bg-surface rounded-full cursor-pointer text-text-muted hover:text-brand-500 transition-colors">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                <ImageIcon size={20} />
              </label>
              
              {/* File Upload */}
              <label className="p-2 hover:bg-surface rounded-full cursor-pointer text-text-muted hover:text-brand-500 transition-colors">
                <input type="file" className="hidden" onChange={handleFileSelect} />
                <Paperclip size={20} />
              </label>
              
              {/* Voice Record */}
              <button
                onClick={toggleRecording}
                className={`p-2 rounded-full transition-colors ${
                  isRecording 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'text-text-muted hover:bg-surface hover:text-brand-500'
                }`}
              >
                <Mic size={20} />
              </button>
            </div>

            <button
              onClick={() => uploadAndPost('text')}
              disabled={posting || uploading || (!newUpdate.trim() && !selectedImageFile && !selectedFile)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {(posting || uploading) ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Post Update
            </button>
          </div>
        </div>

        {/* Updates List */}
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-text-muted uppercase tracking-wider">Project Feed</h3>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-brand-500" size={24} />
            </div>
          ) : updates.length === 0 ? (
            <div className="text-center py-10 text-text-muted text-sm border border-dashed border-border rounded-lg">
              No updates yet. Be the first to post something!
            </div>
          ) : (
            <AnimatePresence>
              {updates.map((update) => (
                <motion.div 
                  key={update.id} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-card border border-border/50 rounded-xl p-5 hover:border-brand-500/20 hover:shadow-md transition-all duration-300 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {update.profile?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-text-primary">@{update.profile?.username || 'unknown'}</span>
                        <span className="text-xs text-text-muted">
                          {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                        {update.content}
                      </p>
  
                      {/* Render Media */}
                      {update.type === 'image' && update.media_url && (
                        <div className="mt-3">
                          <img src={update.media_url} alt="Update" className="max-h-64 w-auto rounded-lg border border-border" />
                        </div>
                      )}
  
                      {update.type === 'voice' && update.media_url && (
                        <VoiceMessage url={update.media_url} />
                      )}
  
                      {update.type === 'file' && update.media_url && (
                        <div className="mt-2">
                          <a 
                            href={update.media_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-surface border border-border rounded-lg px-4 py-2 text-sm text-brand-500 hover:text-brand-600 transition-colors"
                          >
                            <Download size={14} />
                            <span>Download Attachment</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

        {/* Right: Sidebar */}
        <div className="w-80 border-l border-border/50 bg-surface/30 p-4 overflow-y-auto hidden md:block">
          <h3 className="font-bold text-sm mb-4 text-text-muted uppercase tracking-wider">Team Members</h3>
          <div className="space-y-4">
            {/* Leader */}
            <div className="flex items-center gap-3 bg-surface/50 p-3 rounded-xl border border-border/50">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white font-bold text-sm">
                {project.profile?.username?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-text-primary">@{project.profile?.username || 'unknown'}</p>
                <p className="text-xs text-brand-500 font-semibold">Leader</p>
              </div>
            </div>

            {/* Other Members */}
            {members.filter(m => m.user_id !== project.user_id).map(member => (
              <div key={member.user_id} className="flex items-center gap-3 bg-surface/50 p-3 rounded-xl border border-border/50">
                <div className="w-10 h-10 rounded-full bg-card border border-border overflow-hidden flex items-center justify-center text-text-muted font-bold text-sm">
                  {member.profile?.avatar_url ? (
                    <img src={member.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    member.profile?.username?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-text-primary">@{member.profile?.username || 'unknown'}</p>
                  {profile?.id === project.user_id ? (
                    <input 
                      type="text"
                      value={member.role || 'contributor'}
                      onChange={(e) => updateRole(member.user_id, e.target.value)}
                      className="text-xs text-brand-500 font-semibold bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-brand-500/20 rounded px-1 -mx-1"
                    />
                  ) : (
                    <p className="text-xs text-text-secondary font-semibold">{member.role || 'contributor'}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Chat Button */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-brand-600 text-white rounded-full shadow-2xl hover:bg-brand-500 transition-all transform hover:scale-105 z-40 flex items-center gap-2"
        >
          <MessageSquare size={24} />
          <span className="font-medium text-sm">Project Chat</span>
          {unreadCount > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-surface shadow-lg">
              {unreadCount}
            </div>
          )}
        </button>
      )}

      {/* Floating Chat Window */}
        <div className={`fixed bottom-4 right-4 left-4 md:left-auto md:bottom-6 md:right-6 w-auto md:w-[400px] h-[calc(100vh-2rem)] md:h-[600px] bg-surface border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 ${isChatOpen ? 'flex' : 'hidden'}`}>
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-card">
            <div>
              <h4 className="font-bold text-sm text-text-primary">Project Chat</h4>
              <p className="text-xs text-text-muted">{project.title}</p>
            </div>
            <button 
              onClick={() => setIsChatOpen(false)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-text-muted hover:text-text-primary"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <Chat channelId={project.id} title={project.title} isVisible={isChatOpen} onUnreadChange={setUnreadCount} />
          </div>
        </div>
    </div>
  );
};
