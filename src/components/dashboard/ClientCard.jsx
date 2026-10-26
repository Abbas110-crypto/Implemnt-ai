import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight, Calendar } from 'lucide-react';
import HealthBadge from '../shared/HealthBadge';
import StageBadge from '../shared/StageBadge';

export default function ClientCard({ client }) {
  const initial = client.company_name?.charAt(0)?.toUpperCase() || '?';

  return (
    <Link
      to={`/ClientDetail?id=${client.id}`}
      className="group bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all block"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
            {initial}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
              {client.company_name}
            </h3>
            <p className="text-xs text-slate-500">{client.contact_name}</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors mt-1" />
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <StageBadge stage={client.onboarding_stage} />
        <HealthBadge score={client.health_score} />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        {client.target_go_live && (
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Target: {format(new Date(client.target_go_live), 'MMM d')}</span>
          </div>
        )}
        {client.arr && (
          <span className="font-medium text-slate-500">
            ${(client.arr / 1000).toFixed(0)}k budget
          </span>
        )}
      </div>
    </Link>
  );
}