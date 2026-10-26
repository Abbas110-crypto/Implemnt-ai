import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Loader2, Ban, Lock, Users, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import MilestoneComments from '../components/portal/MilestoneComments';

async function fetchPortalData(token) {
  const res = await appClient.functions.invoke('getClientPortalData', { token });
  if (res.error) throw res.error;
  return res.data;
}

const statusConfig = {
  not_started: { icon: Circle, color: 'text-slate-300', bg: 'bg-slate-100', label: 'Not Started' },
  in_progress: { icon: Loader2, color: 'text-indigo-500', bg: 'bg-indigo-50', label: 'In Progress' },
  completed: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Completed' },
  blocked: { icon: Ban, color: 'text-rose-500', bg: 'bg-rose-50', label: 'Blocked' },
};

const stages = ['kickoff', 'configuration', 'integration', 'training', 'go_live'];

function TeamSetup({ teamMembers, onAdd, onRemove }) {
  const [name, setName] = useState('');
  const [team, setTeam] = useState('client');
  const [open, setOpen] = useState(false);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), team });
    setName('');
    setOpen(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-800">Team Members</h3>
          <span className="text-xs text-slate-400">— tag people in comments</span>
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setOpen(!open)}>
          <Plus className="w-3 h-3" /> Add
        </Button>
      </div>
      {open && (
        <div className="flex gap-2 mb-3">
          <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="h-7 text-xs flex-1" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <select value={team} onChange={e => setTeam(e.target.value)} className="h-7 text-xs border border-input rounded-md px-2 bg-background">
            <option value="client">Client</option>
            <option value="csm">Our Team</option>
          </select>
          <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleAdd}>Add</Button>
        </div>
      )}
      {teamMembers.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No team members added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {teamMembers.map((m, i) => (
            <div key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${m.team === 'csm' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
              <span>{m.name}</span>
              <span className="text-[10px] opacity-60 capitalize">· {m.team === 'csm' ? 'Our team' : 'Client'}</span>
              <button onClick={() => onRemove(i)} className="ml-0.5 hover:text-rose-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
const stageLabels = { kickoff: 'Kickoff', configuration: 'Configuration', integration: 'Integration', training: 'Training', go_live: 'Go Live' };


export default function ClientPortal() {
  const urlParams = new URLSearchParams(window.location.search);
  const portalToken = urlParams.get('token');
  const [teamMembers, setTeamMembers] = useState([]);

  const { data: portalData, isLoading } = useQuery({
    queryKey: ['portal-data', portalToken],
    queryFn: () => fetchPortalData(portalToken),
    enabled: !!portalToken,
  });

  const client = portalData?.client || null;
  const milestones = portalData?.milestones || [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!portalToken) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-500">This portal link is missing its access token.</p>
    </div>
  );

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
    </div>
  );

  if (!client) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-500">Client not found.</p>
    </div>
  );

  const completed = milestones.filter(m => m.status === 'completed').length;
  const progress = milestones.length > 0 ? Math.round((completed / milestones.length) * 100) : 0;

  const grouped = stages.reduce((acc, stage) => {
    acc[stage] = milestones.filter(m => m.stage === stage).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold">
              {client.company_name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h1 className="font-bold text-slate-900">{client.company_name}</h1>
              <p className="text-xs text-slate-500">Onboarding Portal</p>
            </div>
          </div>
          {client.target_go_live && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400">Target Go-Live</p>
              <p className="text-sm font-semibold text-slate-700">{format(new Date(client.target_go_live), 'MMM d, yyyy')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Team setup */}
        <TeamSetup
          teamMembers={teamMembers}
          onAdd={m => setTeamMembers(prev => [...prev, m])}
          onRemove={i => setTeamMembers(prev => prev.filter((_, idx) => idx !== i))}
        />

        {/* Progress card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700">Overall Progress</p>
            <span className="text-sm font-bold text-indigo-600">{progress}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">{completed} of {milestones.length} milestones completed</p>
        </div>

        {/* Milestones by stage */}
        {stages.map(stage => {
          const items = grouped[stage];
          if (items.length === 0) return null;
          return (
            <div key={stage} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
                <h2 className="font-semibold text-slate-800 text-sm">{stageLabels[stage]}</h2>
              </div>
              <div className="divide-y divide-slate-50 px-5">
                {items.map(milestone => {
                  const config = statusConfig[milestone.status] || statusConfig.not_started;
                  const Icon = config.icon;
                  const isOverdue = milestone.due_date
                    && new Date(milestone.due_date) < today
                    && milestone.status !== 'completed';

                  return (
                    <div key={milestone.id} className="py-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-full ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-medium ${milestone.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                              {milestone.title}
                            </p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                              milestone.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              milestone.status === 'in_progress' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              milestone.status === 'blocked' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-slate-50 text-slate-500 border-slate-200'
                            }`}>
                              {config.label}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                Overdue
                              </span>
                            )}
                          </div>
                          {milestone.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{milestone.description}</p>
                          )}
                          {milestone.due_date && (
                            <p className={`text-xs mt-0.5 ${isOverdue ? 'text-rose-500 font-medium' : 'text-slate-400'}`}>
                              Due {format(new Date(milestone.due_date), 'MMM d, yyyy')}
                            </p>
                          )}
                          <MilestoneComments milestoneId={milestone.id} clientId={client.id} portalToken={portalToken} teamMembers={teamMembers} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-4">
          <Lock className="w-3.5 h-3.5" />
          Powered by Implemnt
        </div>
      </div>
    </div>
  );
}
