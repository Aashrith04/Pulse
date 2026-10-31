import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CanonicalStory } from '../../types';
import { EvidenceBadge } from './EvidenceBadge';
import { SourceAttribution } from './SourceAttribution';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { Volume2, Compass, ArrowUpRight, Clock, Bookmark } from 'lucide-react';

interface Props {
  story: CanonicalStory;
  featured?: boolean;
}

export const EditorialCard: React.FC<Props> = ({ story, featured = false }) => {
  const { playStory, currentStoryId, isPlaying } = useAudioPlayer();
  const { isAuthenticated, openAuthModal } = useAuth();
  const isThisPlaying = currentStoryId === story.id && isPlaying;

  const [isBookmarked, setIsBookmarked] = useState<boolean>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pulse_saved_story_ids') || '[]');
      return saved.includes(story.id);
    } catch {
      return false;
    }
  });
  const [isSaving, setIsSaving] = useState(false);

  const toggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSaving) return;
    setIsSaving(true);

    const nextState = !isBookmarked;
    setIsBookmarked(nextState);

    // Update local storage cache
    try {
      const saved = JSON.parse(localStorage.getItem('pulse_saved_story_ids') || '[]');
      let updated: string[];
      if (nextState) {
        updated = Array.from(new Set([...saved, story.id]));
      } else {
        updated = saved.filter((id: string) => id !== story.id);
      }
      localStorage.setItem('pulse_saved_story_ids', JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to update local bookmark storage:', err);
    }

    // Persist to Supabase if authenticated
    if (isAuthenticated) {
      try {
        if (nextState) {
          await api.saveStory(story.id);
        } else {
          await api.removeSavedStory(story.id);
        }
      } catch (err) {
        console.error('Failed to sync bookmark to Supabase:', err);
      }
    }

    setIsSaving(false);
  };

  const timeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <article 
      className={`group relative bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-lg p-5 sm:p-6 transition-all duration-200 hover:border-stone-400 dark:hover:border-stone-600 ${
        featured ? 'ring-1 ring-sage-500/20 shadow-editorial' : 'shadow-editorial'
      }`}
    >
      {/* Top Metadata Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="uppercase tracking-wider font-semibold text-sage-700 dark:text-sage-300">
            {story.category}
          </span>
          <span className="text-stone-300 dark:text-stone-700">•</span>
          {story.state && (
            <>
              <span className="text-ink-secondary dark:text-nightText-secondary font-medium">
                {story.state}
              </span>
              <span className="text-stone-300 dark:text-stone-700">•</span>
            </>
          )}
          <span className="text-ink-muted dark:text-nightText-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(story.lastUpdatedAt)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {story.isLiveIngested ? (
            <span 
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              title="Ingested in real time from live publisher RSS feeds"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live RSS</span>
            </span>
          ) : (
            <span 
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 dark:bg-stone-900/60 dark:text-stone-400 border border-stone-200 dark:border-stone-800"
              title="Verified baseline story for editorial demonstration"
            >
              <span>Verified Baseline</span>
            </span>
          )}
          <EvidenceBadge status={story.evidenceStatus} />

          <button
            onClick={toggleBookmark}
            disabled={isSaving}
            className={`p-1.5 rounded-full hover:bg-paper-cream dark:hover:bg-night-surface transition-colors ml-1 ${
              isBookmarked 
                ? 'text-sage-700 dark:text-sage-400' 
                : 'text-ink-muted hover:text-ink-primary'
            }`}
            title={isBookmarked ? 'Remove from Saved Stories' : 'Save story to archive'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Headline */}
      <h2 className="mb-2.5">
        <Link
          to={`/stories/${story.id}`}
          className="font-serif text-xl sm:text-2xl font-semibold text-ink-primary dark:text-nightText-primary hover:text-sage-700 dark:hover:text-sage-300 transition-colors leading-snug tracking-tight"
        >
          {story.title}
        </Link>
      </h2>

      {/* Summary */}
      <p className="text-sm sm:text-base text-ink-secondary dark:text-nightText-secondary leading-relaxed mb-3">
        {story.summary}
      </p>

      {/* Why It Matters Callout */}
      {story.whyItMatters && (
        <div className="border-l-2 border-sage-500/60 dark:border-sage-400/50 pl-3 py-1 my-3 bg-paper-cream/50 dark:bg-night-surface/50 rounded-r">
          <p className="text-xs sm:text-sm text-ink-secondary dark:text-nightText-secondary">
            <strong className="font-medium text-ink-primary dark:text-nightText-primary">Why it matters: </strong>
            {story.whyItMatters}
          </p>
        </div>
      )}

      {/* India Implication for International Stories */}
      {story.indiaImplication && (
        <div className="border-l-2 border-terracotta-500/60 pl-3 py-1 my-3 bg-terracotta-50/30 dark:bg-night-surface/50 rounded-r">
          <p className="text-xs sm:text-sm text-ink-secondary dark:text-nightText-secondary">
            <strong className="font-medium text-terracotta-700 dark:text-terracotta-500">Implications for India: </strong>
            {story.indiaImplication}
          </p>
        </div>
      )}

      {/* Footer Actions & Source Attribution */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-paper-borderSubtle dark:border-night-borderSubtle">
        <div className="flex items-center gap-3">
          <Link
            to={`/stories/${story.id}`}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-sage-700 dark:text-sage-300 hover:underline"
          >
            <span>Read full story</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>

          <Link
            to={`/perspectives?storyId=${story.id}`}
            className="inline-flex items-center gap-1 text-xs sm:text-sm text-ink-muted dark:text-nightText-muted hover:text-ink-primary dark:hover:text-nightText-primary"
            title="Examine balanced perspectives, evidence status, and pros/cons"
          >
            <Compass className="w-3.5 h-3.5 text-sage-600 dark:text-sage-400" />
            <span>Perspectives</span>
          </Link>
        </div>

        <button
          onClick={() => playStory(story.id, story.title, `${story.summary}. Why it matters: ${story.whyItMatters}`)}
          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
            isThisPlaying
              ? 'bg-sage-600 text-white border-sage-600'
              : 'border-paper-border dark:border-night-border text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream dark:hover:bg-night-surface'
          }`}
          title="Listen to story read-aloud"
        >
          <Volume2 className="w-3 h-3" />
          <span>{isThisPlaying ? 'Playing' : 'Listen'}</span>
        </button>
      </div>

      <SourceAttribution articles={story.articles} />
    </article>
  );
};
