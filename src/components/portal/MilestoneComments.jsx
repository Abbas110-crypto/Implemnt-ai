import React, { useState, useRef, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';

function renderContent(content) {
  // Highlight @mentions
  const parts = content.split(/(@\w[\w\s]*)/g);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-indigo-600 font-medium bg-indigo-50 rounded px-0.5">{part}</span>
      : part
  );
}

export default function MilestoneComments({ milestoneId, clientId, portalToken, teamMembers }) {
  const [expanded, setExpanded] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null); // string or null
  const [mentionStart, setMentionStart] = useState(null);
  const textareaRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', milestoneId, portalToken],
    queryFn: async () => {
      const result = await appClient.functions.invoke('getMilestoneComments', { milestone_id: milestoneId, portal_token: portalToken });
      if (result.error) throw result.error;
      return result.data.comments;
    },
    enabled: expanded,
  });

  const filteredSuggestions = mentionQuery !== null
    ? teamMembers.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : [];

  const handleInput = (e) => {
    const val = e.target.value;
    setContent(val);

    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const atIdx = before.lastIndexOf('@');

    if (atIdx !== -1 && !before.slice(atIdx + 1).includes(' ')) {
      setMentionQuery(before.slice(atIdx + 1));
      setMentionStart(atIdx);
    } else {
      setMentionQuery(null);
      setMentionStart(null);
    }
  };

  const insertMention = (member) => {
    const before = content.slice(0, mentionStart);
    const after = content.slice(mentionStart + 1 + (mentionQuery?.length || 0));
    const newContent = `${before}@${member.name} ${after}`;
    setContent(newContent);
    setMentions(prev => [...prev.filter(m => m.name !== member.name), member]);
    setMentionQuery(null);
    setMentionStart(null);
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!content.trim() || !authorName.trim()) return;
    setSubmitting(true);
    const result = await appClient.functions.invoke('addMilestoneComment', {
      milestone_id: milestoneId,
      client_id: clientId,
      portal_token: portalToken,
      author_name: authorName,
      content,
      mentions,
    });
    if (result.error) {
      setSubmitting(false);
      toast.error('Could not post your comment');
      return;
    }
    setContent('');
    setMentions([]);
    queryClient.invalidateQueries({ queryKey: ['comments', milestoneId] });
    setSubmitting(false);
    toast.success('Comment posted');
  };

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        {comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? 's' : ''}` : 'Add comment'}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 pl-2 border-l-2 border-slate-100">
          {comments.length === 0 && (
            <p className="text-xs text-slate-400 italic">No comments yet. Be the first!</p>
          )}
          {comments.map(c => (
            <div key={c.id} className="text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">{c.author_name}</span>
                {c.mentions?.length > 0 && (
                  <span className="text-slate-400">tagged {c.mentions.map(m => m.name).join(', ')}</span>
                )}
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">{format(new Date(c.created_date), 'MMM d, h:mm a')}</span>
              </div>
              <p className="text-slate-600 mt-0.5 leading-relaxed">{renderContent(c.content)}</p>
            </div>
          ))}

          {/* Composer */}
          <div className="pt-2 space-y-2">
            <Input
              placeholder="Your name"
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              className="h-7 text-xs"
            />

            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleInput}
                placeholder="Write a comment… use @ to tag someone"
                className="w-full text-xs border border-input rounded-md px-3 py-2 min-h-[64px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />

              {/* @ mention suggestions */}
              {filteredSuggestions.length > 0 && (
                <div className="absolute bottom-full mb-1 left-0 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                  <div className="px-2 py-1 border-b border-slate-100 flex items-center gap-1.5">
                    <AtSign className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Tag someone</span>
                  </div>
                  {filteredSuggestions.map(member => (
                    <button
                      key={member.name}
                      onMouseDown={e => { e.preventDefault(); insertMention(member); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-50 text-left transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-800">{member.name}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{member.team} team</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Team pills */}
            {teamMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {teamMembers.map(m => (
                  <button
                    key={m.name}
                    onClick={() => {
                      setContent(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + `@${m.name} `);
                      setMentions(prev => [...prev.filter(x => x.name !== m.name), m]);
                      textareaRef.current?.focus();
                    }}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-slate-500"
                  >
                    <AtSign className="w-2.5 h-2.5" />
                    {m.name}
                    <span className="text-slate-300 capitalize">· {m.team}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={submitting || !content.trim() || !authorName.trim()}
                onClick={handleSubmit}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-7 text-xs"
              >
                <Send className="w-3 h-3" />
                Post
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
