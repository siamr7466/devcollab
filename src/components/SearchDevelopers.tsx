import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { Search, User as UserIcon, Shield, Hash, Calendar, Loader2 } from 'lucide-react';

export const SearchDevelopers: React.FC = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .or(`unique_id.ilike.%${query}%,username.ilike.%${query}%`)
      .limit(1)
      .single();

    if (err) {
      setError('Developer not found. Check the ID/Username.');
    } else {
      setResult(data);
    }
    setLoading(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black text-text-primary tracking-tighter mb-2">DEVELOPER DISCOVERY</h1>
          <p className="text-text-secondary">Locate specialists by their unique neural ID or handle</p>
        </div>

        <form onSubmit={handleSearch} className="relative mb-12">
          <input 
            type="text" 
            placeholder="Enter unique ID (e.g. DEV-XXXX) or username..." 
            className="w-full pl-6 pr-16 py-5 bg-surface border border-border rounded-2xl text-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 shadow-xl shadow-brand-500/5 transition-all"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button 
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-brand-600 text-white rounded-xl hover:bg-brand-500 transition-colors"
          >
            {loading ? <Loader2 className="animate-spin text-white" /> : <Search size={22} />}
          </button>
        </form>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-center font-medium animate-in">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl shadow-brand-500/5 animate-in">
            <div className="h-32 bg-gradient-to-r from-brand-600 to-brand-700 p-8 flex items-end justify-between">
              <div className="w-24 h-24 rounded-2xl border-4 border-card bg-surface overflow-hidden -mb-16 shadow-lg">
                {result.avatar_url ? (
                  <img src={result.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted">
                    <UserIcon size={40} />
                  </div>
                )}
              </div>
              <div className="text-white text-right pb-2">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-[10px] font-bold tracking-widest uppercase">
                  Verified Developer
                </span>
              </div>
            </div>

            <div className="pt-20 px-8 pb-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">{result.full_name || result.username}</h2>
                  <p className="text-brand-500 font-mono font-bold">@{result.username}</p>
                </div>
                <div className="px-4 py-2 bg-surface rounded-xl text-center border border-border">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Neural ID</p>
                  <p className="font-mono font-bold text-text-primary">{result.unique_id}</p>
                </div>
              </div>

              <p className="text-text-secondary mb-8 leading-relaxed">
                {result.bio || "No biography provided. This developer is busy building the future."}
              </p>

              <div className="grid grid-cols-2 gap-4 border-t border-border pt-6">
                <div className="flex items-center gap-3 text-text-secondary">
                  <div className="p-2 bg-surface border border-border rounded-lg"><Hash size={16} /></div>
                  <div className="text-xs">
                    <p className="font-bold text-text-muted uppercase">Commits</p>
                    <p className="text-text-primary font-semibold">412 Points</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-text-secondary">
                  <div className="p-2 bg-surface border border-border rounded-lg"><Calendar size={16} /></div>
                  <div className="text-xs">
                    <p className="font-bold text-text-muted uppercase">Joined</p>
                    <p className="text-text-primary font-semibold">{new Date(result.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
