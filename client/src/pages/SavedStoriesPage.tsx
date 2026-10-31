import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { CanonicalStory } from '../types';
import { EditorialCard } from '../components/common/EditorialCard';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { 
  Bookmark, 
  Clock, 
  Trash2, 
  BookOpen, 
  History, 
  ShieldCheck, 
  ArrowUpRight, 
  Loader2 
} from 'lucide-react';

export const SavedStoriesPage: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'saved' | 'history'>('saved');
  const [savedStories, setSavedStories] = useState<CanonicalStory[]>([]);
  const [readingHistory, setReadingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);

    if (isAuthenticated) {
      // Load from Supabase Cloud
      Promise.all([
        api.getSavedStories().catch(() => ({ savedStories: [] })),
        api.getReadingHistory(30).catch(() => ({ history: [] })),
      ]).then(([savedRes, histRes]) => {
        const storiesFromCloud = (savedRes.savedStories || [])
          .map((s: any) => s.story)
          .filter(Boolean);
        
        // If user has local bookmarks, merge gracefully
        const localIds: string[] = JSON.parse(localStorage.getItem('pulse_saved_story_ids') || '[]');
        if (storiesFromCloud.length === 0 && localIds.length > 0) {
          api.getStories({ limit: 50 }).then(allRes => {
            const matched = (allRes.stories || []).filter(s => localIds.includes(s.id));
            setSavedStories(matched);
          }).catch(() => {});
        } else {
          setSavedStories(storiesFromCloud);
        }

        setReadingHistory(histRes.history || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      // Guest local storage mode
      const savedIds: string[] = JSON.parse(localStorage.getItem('pulse_saved_story_ids') || '[]');
      api.getStories({ limit: 50 }).then(res => {
        const all = res.stories || [];
        const filtered = all.filter(s => savedIds.includes(s.id));
        setSavedStories(filtered);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  };

  useEffect(() => {
    loadData();
  }, [isAuthenticated]);

  const clearBookmarks = () => {
    localStorage.removeItem('pulse_saved_story_ids');
    setSavedStories([]);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-paper-border dark:border-night-border pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sage-700 dark:text-sage-400 mb-1">
            <Bookmark className="w-4 h-4" />
            <span>Personal Archive</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
            Saved Stories & History
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            {isAuthenticated 
              ? 'Synchronized with your Supabase Cloud account across devices.' 
              : 'Stored in your current session. Sign in to sync across devices.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isAuthenticated && (
            <button
              onClick={() => openAuthModal('login')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-sage-50 dark:bg-sage-950/40 text-sage-800 dark:text-sage-300 border border-sage-200 dark:border-sage-800 hover:bg-sage-100 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-sage-600" />
              <span>Sign in to Sync</span>
            </button>
          )}

          {savedStories.length > 0 && activeTab === 'saved' && (
            <button
              onClick={clearBookmarks}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-muted hover:text-terracotta-600 border border-paper-border dark:border-night-border hover:bg-paper-cream transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Archive</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs: Saved Stories vs Reading History */}
      <div className="flex items-center gap-2 border-b border-paper-borderSubtle dark:border-night-borderSubtle">
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'saved'
              ? 'border-sage-600 text-sage-800 dark:text-sage-300 font-bold'
              : 'border-transparent text-ink-muted hover:text-ink-primary'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Saved Stories ({savedStories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-sage-600 text-sage-800 dark:text-sage-300 font-bold'
              : 'border-transparent text-ink-muted hover:text-ink-primary'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Reading History ({readingHistory.length})</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2 text-ink-muted">
          <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
          <p className="text-sm">Retrieving your archive from Supabase...</p>
        </div>
      ) : activeTab === 'saved' ? (
        savedStories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {savedStories.map(story => (
              <EditorialCard key={story.id} story={story} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-ink-muted bg-paper-cream/40 dark:bg-night-surface/40 rounded-xl border border-dashed border-paper-border dark:border-night-border p-8">
            <BookOpen className="w-8 h-8 text-sage-600 mx-auto mb-2 opacity-60" />
            <p className="font-serif text-lg text-ink-primary dark:text-nightText-primary mb-1">
              No saved stories yet.
            </p>
            <p className="text-xs max-w-sm mx-auto mb-4">
              Click the bookmark icon on any story card or article detail page to save it here.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sage-700 dark:text-sage-300 hover:underline"
            >
              <span>Explore Today's Pulse →</span>
            </Link>
          </div>
        )
      ) : (
        /* Reading History Tab */
        readingHistory.length > 0 ? (
          <div className="space-y-3">
            {readingHistory.map((item, idx) => (
              <div 
                key={item.id || idx}
                className="p-4 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(item.readAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    <span>•</span>
                    <span>Time spent: {item.timeSpentSeconds || 30}s</span>
                  </div>
                  <h4 className="font-serif text-base font-semibold text-ink-primary dark:text-nightText-primary">
                    {item.story?.title || `Story: ${item.storyId?.substring(0, 18)}...`}
                  </h4>
                </div>

                <Link
                  to={`/stories/${item.storyId}`}
                  className="p-2 rounded-lg border border-paper-border hover:bg-paper-cream text-xs font-medium text-sage-700 dark:text-sage-300 inline-flex items-center gap-1 flex-shrink-0"
                >
                  <span>Re-read</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-ink-muted bg-paper-cream/40 dark:bg-night-surface/40 rounded-xl border border-dashed border-paper-border dark:border-night-border p-8">
            <History className="w-8 h-8 text-sage-600 mx-auto mb-2 opacity-60" />
            <p className="font-serif text-lg text-ink-primary dark:text-nightText-primary mb-1">
              No reading history recorded.
            </p>
            <p className="text-xs max-w-sm mx-auto">
              As you read stories in depth, your progress and reading session timestamps will automatically appear here.
            </p>
          </div>
        )
      )}
    </div>
  );
};
