import React, { useState } from 'react';
import { api } from '../utils/api';
import { usePreferences } from '../context/PreferencesContext';
import { LanguageCode } from '../types';
import { EvidenceBadge } from '../components/common/EvidenceBadge';
import { 
  MessageSquare, 
  Send, 
  Sparkles, 
  ExternalLink, 
  ShieldCheck, 
  Loader2, 
  Languages, 
  HelpCircle 
} from 'lucide-react';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  modelUsed?: string;
  isIncomplete?: boolean;
}

const SAMPLE_QUESTIONS = [
  'What happened in Telangana today regarding the metro network?',
  'Explain the latest semiconductor sanction in simple English.',
  'Summarize today\'s important international developments.',
  'What are the strongest arguments for and against the new metro corridors?',
  'Which official source confirms the RBI interest rate status quo?',
];

export const AskTheNewsPage: React.FC = () => {
  const { readingLanguage } = usePreferences();
  const [responseLang, setResponseLang] = useState<LanguageCode>(readingLanguage || 'en');
  const [detailMode, setDetailMode] = useState<'concise' | 'deep'>('concise');
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: 'Welcome to **Ask the News**. I am your grounded research assistant. Ask me questions about today\'s verified state, national, or international developments. Every answer is substantiated with clickable source citations from official gazettes and credible reporting.',
      citations: [],
    }
  ]);

  const handleSend = async (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q || loading) return;

    const userMsg: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: q,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await api.askNews(q, responseLang, detailMode);
      const assistantMsg: ChatTurn = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        citations: res.citations || [],
        modelUsed: res.modelUsed,
        isIncomplete: res.isIncomplete,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content: 'An error occurred while retrieving news intelligence. Please verify your query or check your network connectivity.',
          citations: [],
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="border-b border-paper-border dark:border-night-border pb-5">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sage-700 dark:text-sage-400 mb-1">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Conversational Research Assistant</span>
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
          Ask the News
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted dark:text-nightText-muted mt-1 leading-relaxed">
          Grounded inquiry across verified news records. Pulse never hallucinates headlines or sources.
        </p>

        {/* Options Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-paper-borderSubtle dark:border-night-borderSubtle">
          {/* Detail Mode */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-muted">Detail Level:</span>
            <div className="flex items-center border border-paper-border dark:border-night-border rounded-lg overflow-hidden">
              <button
                onClick={() => setDetailMode('concise')}
                className={`px-2.5 py-1 transition-colors ${
                  detailMode === 'concise'
                    ? 'bg-sage-600 text-white font-medium'
                    : 'text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream dark:hover:bg-night-surface'
                }`}
              >
                Concise
              </button>
              <button
                onClick={() => setDetailMode('deep')}
                className={`px-2.5 py-1 transition-colors ${
                  detailMode === 'deep'
                    ? 'bg-sage-600 text-white font-medium'
                    : 'text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream dark:hover:bg-night-surface'
                }`}
              >
                Deeper Analysis
              </button>
            </div>
          </div>

          {/* Response Language Selector */}
          <div className="flex items-center gap-2 text-xs">
            <Languages className="w-3.5 h-3.5 text-sage-600" />
            <span className="text-ink-muted">Answer Language:</span>
            <select
              value={responseLang}
              onChange={e => setResponseLang(e.target.value as any)}
              className="text-xs px-2.5 py-1 rounded-lg bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border text-ink-primary dark:text-nightText-primary focus:outline-none focus:ring-1 focus:ring-sage-500"
            >
              <option value="en">English</option>
              <option value="te">Telugu (తెలుగు)</option>
              <option value="hi">Hindi (हिंदी)</option>
              <option value="ta">Tamil (தமிழ்)</option>
              <option value="kn">Kannada (ಕನ್ನಡ)</option>
              <option value="ml">Malayalam (മലയാളം)</option>
              <option value="bn">Bengali (বাংলা)</option>
              <option value="mr">Marathi (मराठी)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Suggested Queries */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-ink-muted flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-sage-600" />
          <span>Starter Inquiries:</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="text-xs px-3 py-1.5 rounded-full border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-ink-secondary dark:text-nightText-secondary hover:border-sage-500 hover:text-sage-700 dark:hover:text-sage-300 transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Thread */}
      <div className="space-y-4 pt-2">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`p-5 rounded-xl border transition-colors ${
              msg.role === 'user'
                ? 'bg-paper-cream/60 dark:bg-night-surface/60 border-paper-border dark:border-night-border ml-6 sm:ml-12'
                : 'bg-paper-card dark:bg-night-card border-paper-border dark:border-night-border mr-6 sm:mr-12 shadow-editorial'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-ink-muted mb-2">
              <span className="font-semibold uppercase tracking-wider text-sage-800 dark:text-sage-300">
                {msg.role === 'user' ? 'You' : 'Pulse Research Assistant'}
              </span>
              {msg.modelUsed && (
                <span className="text-[10px] font-mono opacity-70">
                  Engine: {msg.modelUsed}
                </span>
              )}
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none text-ink-primary dark:text-nightText-primary leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </div>

            {/* Citations Box */}
            {msg.citations && msg.citations.length > 0 && (
              <div className="mt-4 pt-3 border-t border-paper-borderSubtle dark:border-night-borderSubtle space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-nightText-muted flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Grounding Citations ({msg.citations.length})</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {msg.citations.map((cite: any, cIdx: number) => (
                    <a
                      key={cIdx}
                      href={cite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-lg border border-paper-borderSubtle dark:border-night-borderSubtle bg-paper-cream/30 dark:bg-night-surface/30 hover:border-sage-500 transition-colors block text-xs group"
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-sage-800 dark:text-sage-300 mb-1">
                        <span className="truncate">{cite.sourceName}</span>
                        <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 flex-shrink-0" />
                      </div>
                      <p className="font-serif font-semibold text-ink-primary dark:text-nightText-primary line-clamp-1 mb-1">
                        {cite.title}
                      </p>
                      <EvidenceBadge status={cite.evidenceStatus} size="sm" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="p-5 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card mr-12 flex items-center gap-3 text-sm text-ink-muted">
            <Loader2 className="w-4 h-4 animate-spin text-sage-600" />
            <span>Cross-referencing verified news index and citations...</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={e => { e.preventDefault(); handleSend(); }}
        className="relative sticky bottom-4 bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-xl shadow-lg p-2 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={e => setInputQuery(e.target.value)}
          placeholder={`Ask about verified events in ${responseLang.toUpperCase()}...`}
          className="flex-1 px-4 py-2.5 text-sm bg-transparent text-ink-primary dark:text-nightText-primary placeholder:text-ink-subtle focus:outline-none"
        />

        <button
          type="submit"
          disabled={!inputQuery.trim() || loading}
          className="px-4 py-2 bg-sage-600 text-white rounded-lg text-xs font-medium hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          <span>Ask</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
