const BLOCKED_TERMS = /\b(blocked|blocker|stuck|delayed|at risk|waiting on|unable to|can't proceed|cannot proceed)\b/i;
const COMPLETED_TERMS = /\b(completed|complete|finished|done|launched|approved|signed off)\b/i;
const STARTED_TERMS = /\b(started|starting|in progress|underway|kicked off|working on|began)\b/i;
const ACTION_TERMS = /\b(action item|todo|to-do|follow up|follow-up|will [a-z]+|need to|needs to|must [a-z]+|assigned to)\b/i;
const POSITIVE_TERMS = /\b(great|good|excellent|happy|successful|on track|resolved|thank you|thanks)\b/i;
const CONCERN_TERMS = /\b(concern|worried|risk|blocker|blocked|delay|delayed|issue|problem|unhappy|frustrated|escalat)\b/i;

function getSentences(text = '') {
  return text.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
}

function matchesMilestone(sentence, milestone) {
  const significantWords = (milestone.title || '').toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  return significantWords.some((word) => sentence.toLowerCase().includes(word));
}

export function analyzeTranscript(text = '', { riskKeywords = [], milestones = [] } = {}) {
  const sentences = getSentences(text);
  const summary = sentences.slice(0, 2).join(' ').slice(0, 500);

  const riskFlags = riskKeywords
    .filter((entry) => entry.active !== false && entry.keyword?.trim())
    .flatMap((entry) => {
      const matcher = new RegExp(entry.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const match = sentences.find((sentence) => matcher.test(sentence));
      return match ? [{
        keyword: entry.keyword,
        context: match,
        severity: entry.severity || 'medium',
      }] : [];
    });

  const actionItems = sentences
    .filter((sentence) => ACTION_TERMS.test(sentence))
    .slice(0, 12)
    .map((sentence) => ({ action: sentence, owner: '', due_date: '' }));

  const milestoneUpdates = milestones.flatMap((milestone) => {
    const related = sentences.find((sentence) => matchesMilestone(sentence, milestone));
    if (!related) return [];
    const status = BLOCKED_TERMS.test(related) ? 'blocked'
      : COMPLETED_TERMS.test(related) ? 'completed'
        : STARTED_TERMS.test(related) ? 'in_progress' : null;
    return status && status !== milestone.status
      ? [{ milestone_id: milestone.id, old_status: milestone.status || 'not_started', new_status: status, reason: related }]
      : [];
  });

  const positiveCount = sentences.filter((sentence) => POSITIVE_TERMS.test(sentence)).length;
  const concernCount = sentences.filter((sentence) => CONCERN_TERMS.test(sentence)).length + riskFlags.length;
  const sentiment = concernCount > positiveCount + 1 ? 'concerned'
    : positiveCount > concernCount ? 'positive' : 'neutral';

  return {
    summary,
    sentiment,
    action_items: actionItems,
    milestone_updates: milestoneUpdates,
    risk_flags: riskFlags,
    extracted_milestones: milestoneUpdates.map(({ milestone_id, new_status, reason }) => ({
      milestone_id,
      suggested_status: new_status,
      reason,
    })),
    crm_updates: [],
    structured_notes: [summary, ...riskFlags.map((flag) => `Risk (${flag.severity}): ${flag.context}`)].filter(Boolean).join('\n\n'),
  };
}
