import React from 'react';

const stageConfig = {
  kickoff: { label: 'Kickoff', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  configuration: { label: 'Configuration', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  integration: { label: 'Integration', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  training: { label: 'Training', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  go_live: { label: 'Go Live', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  completed: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

export default function StageBadge({ stage }) {
  const config = stageConfig[stage] || stageConfig.kickoff;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.label}
    </span>
  );
}