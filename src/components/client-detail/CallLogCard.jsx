import React, { useState } from 'react';
import { format } from 'date-fns';
import { Phone, Clock, ChevronDown, ChevronUp, Zap, Smile, Meh, Frown, AlertCircle, Flag } from 'lucide-react';

const sentimentConfig = {
  positive: { icon: Smile, color: 'text-emerald-500', label: 'Positive' },
  neutral: { icon: Meh, color: 'text-slate-400', label: 'Neutral' },
  concerned: { icon: AlertCircle, color: 'text-amber-500', label: 'Concerned' },
  negative: { icon: Frown, color: 'text-rose-500', label: 'Negative' },
};

export default function CallLogCard({ call }) {
  const [expanded, setExpanded] = useState(false);
  const sentiment = sentimentConfig[call.sentiment] || sentimentConfig.neutral;
  const SentimentIcon = sentiment.icon;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50/50 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
          <Phone className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">{call.title}</p>
          <div className="flex items-center gap-3 mt-0.5">
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
        <div className="flex items-center gap-2">
          <SentimentIcon className={`w-4 h-4 ${sentiment.color}`} />
          {call.risk_flags?.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
              <Flag className="w-2.5 h-2.5" />
              {call.risk_flags.length} risk{call.risk_flags.length > 1 ? 's' : ''}
            </span>
          )}
          {call.milestone_updates?.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600 border border-violet-200">
              <Zap className="w-2.5 h-2.5" />
              {call.milestone_updates.length} updates
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
          {call.risk_flags?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Flag className="w-3 h-3" />
                Management Alerts
              </h4>
              <div className="space-y-2">
                {call.risk_flags.map((flag, i) => {
                  const severityColor = {
                    high: 'bg-rose-50 border-rose-300 text-rose-700',
                    medium: 'bg-amber-50 border-amber-300 text-amber-700',
                    low: 'bg-blue-50 border-blue-300 text-blue-700',
                  }[flag.severity] || 'bg-slate-50 border-slate-300 text-slate-700';

                  return (
                    <div key={i} className={`rounded-lg p-3 border ${severityColor}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wide">{flag.keyword}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 font-medium">
                          {flag.severity} severity
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed">{flag.context}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {call.summary && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Call Summary</h4>
              <p className="text-sm text-slate-600 leading-relaxed">{call.summary}</p>
            </div>
          )}

          {call.action_items?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Action Items</h4>
              <ul className="space-y-1.5">
                {call.action_items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <span>{item.action}{item.owner ? ` — ${item.owner}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {call.milestone_updates?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Timeline Updates</h4>
              <div className="space-y-1.5">
                {call.milestone_updates.map((update, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Zap className="w-3 h-3 text-violet-500 shrink-0" />
                    <span className="text-slate-600">{update.reason || 'Status changed'}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                      {update.old_status} → {update.new_status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {call.notes && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Notes</h4>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{call.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
