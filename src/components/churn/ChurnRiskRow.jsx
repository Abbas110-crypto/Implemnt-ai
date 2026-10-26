import React from 'react';

const levelConfig = {
  low: { label: 'Low', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  medium: { label: 'Medium', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  high: { label: 'High', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  critical: { label: 'Critical', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function ChurnRiskRow({ client }) {
  const level = client.churn_risk_level || 'low';
  const config = levelConfig[level] || levelConfig.low;
  const score = client.churn_risk_score ?? '—';

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
        {client.company_name?.charAt(0)?.toUpperCase()}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{client.company_name}</p>
        <p className="text-xs text-slate-400 truncate">{client.contact_name}</p>
      </div>

      {/* Score bar */}
      <div className="hidden sm:flex flex-col items-end gap-1 w-28">
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              level === 'critical' ? 'bg-rose-500' :
              level === 'high' ? 'bg-orange-500' :
              level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-xs text-slate-400">{score !== '—' ? `${score}/100` : '—'}</span>
      </div>

      {/* Risk badge */}
      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${config.cls}`}>
        {config.label}
      </span>

    </div>
  );
}
