import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Team, Profile } from '../types';
import { Users, Plus, Shield, Search, ArrowRight, Loader2 } from 'lucide-react';

export const TeamManager: React.FC<{ onTeamSelect: (team: Team) => void }> = ({ onTeamSelect }) => {
  const { profile } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeams, setMyTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetchTeams();
  }, []);

  async function fetchTeams() {
    setLoading(true);
    const { data: allTeams } = await supabase.from('teams').select('*');
    if (profile) {
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', profile.id);
      setMyTeams(memberships?.map(m => m.team_id) || []);
    }
    setTeams(allTeams || []);
    setLoading(false);
  }

  async function handleCreateTeam() {
    if (!profile || !newName) return;
    const { data, error } = await supabase.from('teams').insert([{
      name: newName,
      created_by: profile.id
    }]).select().single();

    if (!error && data) {
      await supabase.from('team_members').insert([{
        team_id: data.id,
        user_id: profile.id
      }]);
      setIsCreating(false);
      setNewName('');
      fetchTeams();
    }
  }

  async function toggleJoin(teamId: string) {
    if (!profile) return;
    const isMember = myTeams.includes(teamId);

    if (isMember) {
      await supabase.from('team_members').delete().match({ team_id: teamId, user_id: profile.id });
    } else {
      await supabase.from('team_members').insert([{ team_id: teamId, user_id: profile.id }]);
    }
    fetchTeams();
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Collaborative Teams</h1>
            <p className="text-sm text-slate-500">Join teams to unlock private group channels</p>
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Plus size={20} />
          </button>
        </div>

        {isCreating && (
          <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-xl shadow-blue-500/10 mb-8">
            <h3 className="font-bold mb-4">Start New Team</h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Team Name (e.g. Frontend Ninjas)" 
                className="flex-1 p-3 bg-slate-50 border rounded-lg"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <button 
                onClick={handleCreateTeam}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Launch
              </button>
              <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-400">×</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map(team => {
              const isJoined = myTeams.includes(team.id);
              return (
                <div key={team.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-400 transition-all hover:shadow-lg group">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 font-bold text-xl">
                    {team.name[0]}
                  </div>
                  <h3 className="font-bold text-slate-800 mb-1">{team.name}</h3>
                  <p className="text-xs text-slate-400 mb-4 uppercase tracking-tighter font-black">
                    {team.created_by === profile?.id ? 'Admin Access' : 'Developer Pool'}
                  </p>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggleJoin(team.id)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                        isJoined 
                          ? 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600' 
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isJoined ? 'Leave' : 'Join Team'}
                    </button>
                    {isJoined && (
                      <button 
                        onClick={() => onTeamSelect(team)}
                        className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700"
                      >
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
