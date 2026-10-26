import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, ArrowRight, Zap } from 'lucide-react';

const steps = [
  {
    id: 'monday',
    title: 'Connect Monday.com',
    description: 'Authorize your Monday.com account so risk alerts can automatically update your boards.',
    cta: 'Go to Integrations →',
    href: '/integrations',
  },
  {
    id: 'calendar',
    title: 'Connect your Calendar',
    description: 'Link Google Calendar so Recall AI bots automatically join your meetings and capture transcripts.',
    cta: 'Go to Calendar Bots →',
    href: '/calendarbots',
  },
  {
    id: 'keywords',
    title: 'Set up Risk Keywords',
    description: 'Define the words and phrases (e.g. "delayed", "at risk", "cancel") that signal a troubled account.',
    cta: 'Go to Risk Keywords →',
    href: '/riskkeywords',
  },
  {
    id: 'project',
    title: 'Add your first Project',
    description: 'Create a client project so call insights and risk flags are linked to the right account.',
    cta: 'Go to Projects →',
    href: '/clients',
  },
  {
    id: 'done',
    title: 'You\'re live — calls are analyzed automatically',
    description: 'Once a meeting ends, configured keyword rules scan the transcript for risks and prepare updates for review in Call Insights.',
    cta: 'View Call Insights →',
    href: '/callinsights',
    isInfo: true,
  },
];

export default function OnboardingChecklist() {
  const [collapsed, setCollapsed] = useState(false);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me(), staleTime: 60000 });

  const { data: mondayConnections = [] } = useQuery({
    queryKey: ['monday-connections-check', me?.email],
    enabled: !!me?.email,
    queryFn: () => appClient.entities.MondayConnection.filter({ user_email: me.email }),
  });
  const { data: calendars = [] } = useQuery({
    queryKey: ['recall-calendars-check'],
    queryFn: () => appClient.entities.RecallCalendar.list(),
  });
  const { data: keywords = [] } = useQuery({
    queryKey: ['risk-keywords-check'],
    queryFn: () => appClient.entities.RiskKeyword.list('-created_date', 1),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['clients-check'],
    queryFn: () => appClient.entities.Client.list('-created_date', 1),
  });

  const completed = {
    monday: mondayConnections.length > 0,
    calendar: calendars.length > 0,
    keywords: keywords.length > 0,
    project: projects.length > 0,
    done: mondayConnections.length > 0 && calendars.length > 0,
  };

  const allDone = Object.values(completed).every(Boolean);
  const completedCount = Object.values(completed).filter(Boolean).length;
  const totalCount = steps.length;

  if (allDone) return null;

  return (
    <div className="bg-white border border-indigo-100 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-indigo-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900">Get started with Implemnt</p>
            <p className="text-xs text-slate-400">{completedCount} of {totalCount} steps complete</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
          {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Steps */}
      {!collapsed && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {steps.map((step, idx) => {
            const done = completed[step.id];
            const isNext = !done && steps.slice(0, idx).every(s => completed[s.id]);

            return (
              <div
                key={step.id}
                className={`flex items-start gap-4 px-5 py-4 transition-colors ${isNext ? 'bg-indigo-50/60' : ''}`}
              >
                <div className="mt-0.5 shrink-0">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                  ) : (
                    <Circle className={`w-5 h-5 ${isNext ? 'text-indigo-300' : 'text-slate-200'}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {step.title}
                  </p>
                  {!done && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.description}</p>
                  )}
                </div>
                {!done && (
                  <Link
                    to={step.href}
                    className={`shrink-0 flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                      isNext
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'text-indigo-500 hover:text-indigo-700'
                    }`}
                  >
                    {step.cta}
                    {isNext && <ArrowRight className="w-3 h-3" />}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
