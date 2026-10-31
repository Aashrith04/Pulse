import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { usePreferences } from '../../context/PreferencesContext';
import { Link } from 'react-router-dom';
import { History, X, Clock, Sparkles, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';
import { EvidenceBadge } from '../common/EvidenceBadge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CatchMeUpModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { selectedState } = usePreferences();
  const [timeframe, setTimeframe] = useState<'3h' | '6h' | '12h' | '24h' | '7d'>('24h');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchCatchUp = (tf: string) => {
    setLoading(true);
    api.getCatchMeUp(tf, selectedState)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      fetchCatchUp(timeframe);
    }
  }, [isOpen, timeframe, selectedState]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-ink-primary dark:text-nightText-primary"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-paper-border dark:border-night-border bg-paper-cream/40 dark:bg-night-surface/40">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-sage-100 dark:bg-sage-900/50 text-sage-700 dark:text-sage-300">
              <History className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-serif text-xl font-bold tracking-tight">
                Catch Me Up
              </h2>
              <p className="text-xs text-ink-muted dark:text-nightText-muted">
                What changed recently across {selectedState} and verified national developments
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary dark:hover:text-nightText-primary hover:bg-paper-cream dark:hover:bg-night-surface"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeframe Selector Chips */}
        <div className="px-6 py-3 border-b border-paper-borderSubtle dark:border-night-borderSubtle flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-muted dark:text-nightText-muted mr-1">Time Window:</span>
          {(['3h', '6h', '12h', '24h', '7d'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                timeframe === tf
                  ? 'bg-sage-600 text-white border-sage-600 font-medium'
                  : 'border-paper-border dark:border-night-border text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream dark:hover:bg-night-surface'
              }`}
            >
              {tf === '3h' ? 'Last 3 Hours' : tf === '6h' ? 'Last 6 Hours' : tf === '12h' ? 'Last 12 Hours' : tf === '24h' ? 'Last 24 Hours' : 'Last 7 Days'}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-ink-muted">
              <RefreshCw className="w-6 h-6 animate-spin text-sage-600" />
              <p className="text-sm">Synthesizing recent changes and timeline updates...</p>
            </div>
          ) : data ? (
            <>
              {/* Overview Summary */}
              <div className="p-3.5 rounded-lg bg-sage-50/60 dark:bg-sage-950/20 border border-sage-200/60 dark:border-sage-800/30 text-xs sm:text-sm text-ink-secondary dark:text-nightText-secondary leading-relaxed">
                <strong className="text-ink-primary dark:text-nightText-primary font-medium">Summary: </strong>
                {data.summary}
              </div>

              {/* 1. New Stories */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-ink-primary dark:text-nightText-primary">
                    Genuinely New Developments ({data.newStories?.length || 0})
                  </h3>
                </div>

                {data.newStories?.length > 0 ? (
                  <div className="space-y-3">
                    {data.newStories.map((story: any) => (
                      <div 
                        key={story.id} 
                        className="p-3 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card hover:border-stone-400 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-sage-700 dark:text-sage-400 uppercase tracking-wider">
                            {story.category}
                          </span>
                          <EvidenceBadge status={story.evidenceStatus} size="sm" />
                        </div>
                        <Link
                          to={`/stories/${story.id}`}
                          onClick={onClose}
                          className="font-serif text-base font-semibold hover:text-sage-700 dark:hover:text-sage-300 transition-colors block mb-1"
                        >
                          {story.title}
                        </Link>
                        <p className="text-xs text-ink-secondary dark:text-nightText-secondary line-clamp-2">
                          {story.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted italic pl-6">
                    No entirely new stories emerged within this exact time window.
                  </p>
                )}
              </div>

              {/* 2. Material Updates */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-ink-primary dark:text-nightText-primary">
                    Material Updates to Existing Stories ({data.updatedStories?.length || 0})
                  </h3>
                </div>

                {data.updatedStories?.length > 0 ? (
                  <div className="space-y-3">
                    {data.updatedStories.map((story: any) => (
                      <div 
                        key={story.id}
                        className="p-3 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card hover:border-stone-400 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                            Updated Reporting
                          </span>
                          <EvidenceBadge status={story.evidenceStatus} size="sm" />
                        </div>
                        <Link
                          to={`/stories/${story.id}`}
                          onClick={onClose}
                          className="font-serif text-base font-semibold hover:text-sage-700 dark:hover:text-sage-300 transition-colors block mb-1"
                        >
                          {story.title}
                        </Link>
                        <p className="text-xs text-ink-secondary dark:text-nightText-secondary">
                          {story.timeline?.[story.timeline.length - 1]?.whatChanged || story.whyItMatters}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted italic pl-6">
                    No existing stories underwent substantive delta updates.
                  </p>
                )}
              </div>

              {/* 3. Unresolved Stories Worth Following */}
              {data.unresolvedStories?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-ink-primary dark:text-nightText-primary">
                      Unresolved Stories Worth Following ({data.unresolvedStories.length})
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {data.unresolvedStories.map((story: any) => (
                      <div key={story.id} className="p-3 rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/20 dark:bg-night-card">
                        <Link
                          to={`/stories/${story.id}`}
                          onClick={onClose}
                          className="font-serif text-sm font-medium hover:underline block mb-1"
                        >
                          {story.title}
                        </Link>
                        <p className="text-xs text-ink-muted">
                          Status: {story.evidenceStatus.replace(/_/g, ' ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unchanged Stories Counter */}
              <div className="pt-2 text-xs text-ink-muted text-center border-t border-paper-borderSubtle dark:border-night-borderSubtle">
                {data.unchangedStoriesCount} stories remained steady with no new factual changes.
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-paper-border dark:border-night-border bg-paper-cream/30 dark:bg-night-surface/30 flex items-center justify-between">
          <span className="text-xs text-ink-muted">
            Pulse prioritizes genuine changes over recycled headlines.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-sage-600 text-white rounded-lg text-xs font-medium hover:bg-sage-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
