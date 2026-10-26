import React from 'react';

export default function HealthBadge({ score }) {
  if (score === null || score === undefined) return null;

  let color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (score < 50) color = 'bg-rose-50 text-rose-700 border-rose-200';
  else if (score < 70) color = 'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
      }`} />
      {score}%
    </span>
  );
}