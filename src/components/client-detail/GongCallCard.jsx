import React, { useState } from 'react';
import { format } from 'date-fns';
import { Phone, Clock, ChevronDown, ChevronUp, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

const statusConfig = {
  pending_review: { label: 'Pending Review', color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  approved: { label: 'Approved & Synced', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  rejected: { label: 'Rejected', color: 'bg-slate-100 text-slate-500 border border-slate-200' },
};

export default function GongCallCard({ call }) {
  const [expanded, setExpanded] = useState(false);
  const status = statusConfig[call.status] || statusConfig.pending_review;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50/50 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
          <Phone className="w-4 h-4 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-slate-800 truncate">{call.title}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 border bg-violet-50 text-violet-600 border-violet-200">Gong</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {call.call_date ? format(new Date(call.call_date), 'MMM d, yyyy · h:mm a') : 'No date'}
            </span>
            {call.duration_minutes && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {call.duration_minutes}m
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status.color}`}>
            {status.label}
          </span>
          {call.extracted_milestones?.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600 border border-violet-200">
              <Zap className="w-2.5 h-2.5" />
              {call.extracted_milestones.length} milestones
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
          {call.summary && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Call Summary</h4>
              <p className="text-sm text-slate-600 leading-relaxed">{call.summary}</p>
            </div>
          )}

          {call.extracted_milestones?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Milestone Updates</h4>
              <div className="space-y-1.5">
                {call.extracted_milestones.map((m, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Zap className="w-3 h-3 text-violet-500 shrink-0 mt-0.5" />
                    <span className="text-slate-600">{m.reason}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">→ {m.suggested_status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {call.crm_updates?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">CRM Updates</h4>
              <div className="space-y-1.5">
                {call.crm_updates.map((u, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="text-slate-500 capitalize">{u.field.replace(/_/g, ' ')}:</span>
                    <span className="text-slate-400 line-through text-xs">{u.current_value}</span>
                    <span className="text-slate-700 font-medium text-xs">{u.suggested_value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {call.participants && (
            <p className="text-xs text-slate-400">Participants: {call.participants}</p>
          )}
        </div>
      )}
    </div>
  );
}
