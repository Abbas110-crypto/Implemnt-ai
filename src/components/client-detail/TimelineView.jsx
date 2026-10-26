import React, { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Loader2 as Spinner, Ban, Zap, Pencil, User } from 'lucide-react';
import MilestoneEditDialog from './MilestoneEditDialog';

const statusConfig = {
  not_started: { icon: Circle, color: 'text-slate-300', bg: 'bg-slate-100', label: 'Not Started' },
  in_progress: { icon: Spinner, color: 'text-indigo-500', bg: 'bg-indigo-50', label: 'In Progress' },
  completed: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Completed' },
  blocked: { icon: Ban, color: 'text-rose-500', bg: 'bg-rose-50', label: 'Blocked' },
};

const DEFAULT_STAGES = ['kickoff', 'configuration', 'integration', 'training', 'go_live'];
const stageLabel = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function TimelineView({ milestones, onUpdateStatus, onMilestoneSaved, stageOrder }) {
  const [editingMilestone, setEditingMilestone] = useState(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Use template stage order, or derive from milestones, or fallback to defaults
  const stages = stageOrder?.length
    ? stageOrder
    : [...new Set([
        ...DEFAULT_STAGES,
        ...milestones.map(m => m.stage),
      ])].filter(s => milestones.some(m => m.stage === s));

  // Build a milestone id→title map for dependency display
  const msMap = Object.fromEntries(milestones.map(m => [m.id, m]));

  const grouped = stages.reduce((acc, stage) => {
    acc[stage] = milestones
      .filter(m => m.stage === stage)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return acc;
  }, {});

  const getStageProgress = (stageMilestones) => {
    if (stageMilestones.length === 0) return 0;
    const completed = stageMilestones.filter(m => m.status === 'completed').length;
    return Math.round((completed / stageMilestones.length) * 100);
  };

  return (
    <>
    <div className="space-y-6">
      {stages.map((stage) => {
        const items = grouped[stage];
        if (items.length === 0) return null;
        const progress = getStageProgress(items);

        return (
          <div key={stage} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm">{stageLabel(stage)}</h3>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 font-medium">{progress}%</span>
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {items.map((milestone) => {
                const config = statusConfig[milestone.status] || statusConfig.not_started;
                const Icon = config.icon;
                const isOverdue = milestone.due_date
                  && new Date(milestone.due_date) < today
                  && milestone.status !== 'completed';

                return (
                  <div key={milestone.id} className={`px-5 py-3.5 flex items-center gap-3 group transition-colors ${isOverdue ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50'}`}>
                    <button
                      onClick={() => {
                        const nextStatus = {
                          not_started: 'in_progress',
                          in_progress: 'completed',
                          completed: 'not_started',
                          blocked: 'in_progress',
                        };
                        onUpdateStatus(milestone.id, nextStatus[milestone.status] || 'not_started');
                      }}
                      className={`w-7 h-7 rounded-full ${config.bg} flex items-center justify-center shrink-0 hover:scale-110 transition-transform`}
                    >
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${milestone.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                        {milestone.title}
                      </p>
                      {milestone.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{milestone.description}</p>
                      )}
                      {milestone.depends_on?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {milestone.depends_on.map(depId => {
                            const dep = msMap[depId];
                            if (!dep) return null;
                            const blocked = dep.status !== 'completed';
                            return (
                              <span key={depId} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                                blocked ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              }`}>
                                {blocked ? '🔒 ' : '✓ '}{dep.title}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {milestone.owner && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {milestone.owner}
                        </span>
                      )}
                      {milestone.auto_updated && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600 border border-violet-200">
                          <Zap className="w-2.5 h-2.5" />
                          Auto
                        </span>
                      )}
                      {milestone.due_date && (
                        <span className={`text-xs ${isOverdue ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}>
                          {isOverdue ? '⚠ ' : ''}{format(new Date(milestone.due_date), 'MMM d')}
                        </span>
                      )}
                      <button
                        onClick={() => setEditingMilestone(milestone)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
    <MilestoneEditDialog
      milestone={editingMilestone}
      open={!!editingMilestone}
      onOpenChange={(open) => !open && setEditingMilestone(null)}
      onSaved={() => onMilestoneSaved?.()}
      allMilestones={milestones}
    />
    </>
  );
}
