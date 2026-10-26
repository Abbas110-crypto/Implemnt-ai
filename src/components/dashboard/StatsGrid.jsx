import React from 'react';
import { Users, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function StatsGrid({ clients, milestones }) {
  const activeClients = clients.filter(c => c.onboarding_stage !== 'completed').length;
  const completedClients = clients.filter(c => c.onboarding_stage === 'completed').length;
  const avgHealth = clients.length > 0
    ? Math.round(clients.reduce((sum, c) => sum + (c.health_score || 0), 0) / clients.length)
    : 0;
  const blockedMilestones = milestones.filter(m => m.status === 'blocked').length;

  const stats = [
    {
      label: 'Active Projects',
      value: activeClients,
      icon: Users,
      color: 'bg-indigo-50 text-indigo-600',
      accent: 'border-indigo-200',
    },
    {
      label: 'Avg Health',
      value: `${avgHealth}%`,
      icon: Clock,
      color: avgHealth >= 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
      accent: avgHealth >= 70 ? 'border-emerald-200' : 'border-amber-200',
    },
    {
      label: 'Completed Projects',
      value: completedClients,
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-600',
      accent: 'border-emerald-200',
    },
    {
      label: 'Blocked Items',
      value: blockedMilestones,
      icon: AlertTriangle,
      color: blockedMilestones > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500',
      accent: blockedMilestones > 0 ? 'border-rose-200' : 'border-slate-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`bg-white rounded-xl border ${stat.accent} p-5 transition-all hover:shadow-sm`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
              <stat.icon className="w-4.5 h-4.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}