import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Message, Profile } from '../types';
import { Send, Image as ImageIcon, Mic, X, Play, Pause, Loader2, Volume2 } from 'lucide-react';
import { uploadToCloudinary } from '../lib/cloudinary';
import { format } from 'date-fns';

interface ChatProps {
  teamId: string | null; // null for World Chat
  title: string;
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

export const Chat: React.FC<ChatProps> = ({ teamId, title }) => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  useEffect(() => {
    fetchMessages();

    // Set up realtime subscription
    const channel = supabase
      .channel(`chat:${teamId || 'world'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: teamId ? `channel_id=eq.${teamId}` : 'channel_id=is.null',
        },
        (payload) => {
          const newMessage = payload.new as Message;
          // Fetch profile for the new message
          fetchMessageProfile(newMessage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function fetchMessages() {
    setLoading(true);
    let query = supabase
      .from('messages')
      .select('*, profile:profiles(*)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (teamId) {
      query = query.eq('channel_id', teamId);
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
    
    setMessages(prev => [...prev, { ...message, profile: senderProfile || undefined }]);
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !profile) return;

    const content = input;
    setInput('');

    const { error } = await supabase.from('messages').insert([
      {
        channel_id: teamId,
        sender_id: profile.id,
        content,
        type: 'text'
      }
    ]);

    if (error) console.error('Error sending message:', error);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      await supabase.from('messages').insert([
        {
          channel_id: teamId,
          sender_id: profile.id,
          type: 'image',
          media_url: url
        }
      ]);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        await uploadVoice(audioBlob);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  const uploadVoice = async (blob: Blob) => {
    if (!profile) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(blob, 'video');
      await supabase.from('messages').insert([
        {
          channel_id: teamId,
          sender_id: profile.id,
          type: 'voice',
          media_url: url
        }
      ]);
    } catch (err) {
      console.error('Voice upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="p-4 border-b bg-white flex justify-between items-center shrink-0">
        <h2 className="font-bold text-lg truncate max-w-[200px] sm:max-w-md">{title}</h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest">Live Sync</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-slate-300" />
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.sender_id === profile?.id ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                  {msg.profile?.username || 'Unknown'}
                </span>
                <span className="text-[10px] text-slate-300">
                  {format(new Date(msg.created_at), 'HH:mm')}
                </span>
              </div>
              
              <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-sm ${
                msg.sender_id === profile?.id 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-white border text-slate-800 rounded-tl-none'
              }`}>
                {msg.type === 'text' && (
                  <p className="text-sm leading-relaxed break-words whitespace-pre-wrap overflow-wrap-anywhere">
                    {msg.content}
                  </p>
                )}
                
                {msg.type === 'image' && (
                  <img 
                    src={msg.media_url!} 
                    alt="Shared" 
                    className="rounded-xl max-h-80 object-contain w-full cursor-pointer hover:opacity-95 transition-opacity"
                    loading="lazy"
                    onClick={() => window.open(msg.media_url!, '_blank')}
                  />
                )}
                
                {msg.type === 'voice' && (
                  <VoiceMessage url={msg.media_url!} isOwn={msg.sender_id === profile?.id} />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 sm:p-4 bg-white border-t shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <div className="flex items-center">
            <label className="p-2 text-slate-400 hover:text-blue-600 cursor-pointer transition-colors shrink-0">
              <ImageIcon size={20} />
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageUpload}
                disabled={uploading}
              />
            </label>
            
            <button 
              type="button"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`p-2 transition-colors shrink-0 ${isRecording ? 'text-red-500 bg-red-50 rounded-full scale-110' : 'text-slate-400 hover:text-blue-600'}`}
              disabled={uploading}
            >
              <Mic size={20} />
            </button>
          </div>

          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type message..."
            className="flex-1 bg-slate-50 border border-slate-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            disabled={uploading}
          />

          <button 
            type="submit"
            className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-90"
            disabled={(!input.trim() && !isRecording) || uploading}
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};
