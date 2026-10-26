type RiskKeyword = { keyword: string; severity: string; active: boolean };
type Milestone = { id: string; title: string; status: string };

const blockedTerms = /\b(blocked|blocker|stuck|delayed|at risk|waiting on|unable to|cannot proceed)\b/i;
const completedTerms = /\b(completed|complete|finished|done|launched|approved|signed off)\b/i;
const startedTerms = /\b(started|starting|in progress|underway|kicked off|working on|began)\b/i;
const actionTerms = /\b(action item|todo|to-do|follow up|follow-up|will [a-z]+|need to|needs to|must [a-z]+|assigned to)\b/i;
const positiveTerms = /\b(great|good|excellent|happy|successful|on track|resolved|thank you|thanks)\b/i;
const concernTerms = /\b(concern|worried|risk|blocker|blocked|delay|delayed|issue|problem|unhappy|frustrated|escalat)\b/i;

export function analyzeTranscript(text: string, riskKeywords: RiskKeyword[], milestones: Milestone[]) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
  const summary = sentences.slice(0, 2).join(' ').slice(0, 500);
  const riskFlags = riskKeywords.flatMap((entry) => {
    if (!entry.active || !entry.keyword?.trim()) return [];
    const escaped = entry.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(escaped, 'i');
    const context = sentences.find((sentence) => matcher.test(sentence));
    return context ? [{ keyword: entry.keyword, context, severity: entry.severity || 'medium' }] : [];
  });
  const actionItems = sentences.filter((sentence) => actionTerms.test(sentence)).slice(0, 12)
    .map((action) => ({ action, owner: '', due_date: '' }));
  const milestoneUpdates = milestones.flatMap((milestone) => {
    const titleWords = milestone.title.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
    const context = sentences.find((sentence) => titleWords.some((word) => sentence.toLowerCase().includes(word)));
    if (!context) return [];
    const status = blockedTerms.test(context) ? 'blocked'
      : completedTerms.test(context) ? 'completed'
        : startedTerms.test(context) ? 'in_progress' : null;
    return status && status !== milestone.status
      ? [{ milestone_id: milestone.id, old_status: milestone.status || 'not_started', new_status: status, reason: context }]
      : [];
  });
  const positiveCount = sentences.filter((sentence) => positiveTerms.test(sentence)).length;
  const concernCount = sentences.filter((sentence) => concernTerms.test(sentence)).length + riskFlags.length;
  const sentiment = concernCount > positiveCount + 1 ? 'concerned' : positiveCount > concernCount ? 'positive' : 'neutral';
  return { summary, sentiment, action_items: actionItems, risk_flags: riskFlags, milestone_updates: milestoneUpdates };
}
