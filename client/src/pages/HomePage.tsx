import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { CanonicalStory, HourlyPulseBriefing } from '../types';
import { EditorialCard } from '../components/common/EditorialCard';
import { usePreferences } from '../context/PreferencesContext';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Sparkles, 
  Clock, 
  MapPin, 
  Flag, 
  Globe, 
  Compass, 
  ArrowRight, 
  Loader2, 
  History,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { EvidenceBadge } from '../components/common/EvidenceBadge';

export const HomePage: React.FC = () => {
  const { selectedState } = usePreferences();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  const [loading, setLoading] = useState(true);
  const [isWaking, setIsWaking] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [stories, setStories] = useState<CanonicalStory[]>([]);
  const [latestBriefing, setLatestBriefing] = useState<HourlyPulseBriefing | null>(null);

  const loadData = () => {
    setLoading(true);
    setFetchError(null);
    setIsWaking(false);

    const wakeTimer = setTimeout(() => {
      setIsWaking(true);
    }, 3500);

    Promise.all([
      api.getStories({ search: searchQuery }),
      api.getLatestBriefing('global').catch(() => null),
    ]).then(([storiesRes, briefingRes]) => {
      clearTimeout(wakeTimer);
      setStories(storiesRes.stories || []);
      setLatestBriefing(briefingRes);
      setLoading(false);
      setIsWaking(false);
    }).catch((err) => {
      clearTimeout(wakeTimer);
      setFetchError(err.message || 'Unable to connect to news service');
      setLoading(false);
      setIsWaking(false);
    });
  };

  useEffect(() => {
    loadData();
    const handleColdStart = () => setIsWaking(true);
    window.addEventListener('pulse:cold-start-waking', handleColdStart);
    return () => {
      window.removeEventListener('pulse:cold-start-waking', handleColdStart);
    };
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-ink-muted">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
        <p className="font-serif text-lg">Gathering today's intelligence...</p>
        {isWaking && (
          <p className="text-xs text-ink-muted/80 max-w-sm text-center animate-pulse">
            Connecting to cloud services... The free server is waking up from quiet mode.
          </p>
        )}
      </div>
    );
  }

  if (fetchError && stories.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center gap-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-paper-cream dark:bg-night-surface border border-paper-border dark:border-night-border flex items-center justify-center text-sage-600">
          <Clock className="w-6 h-6" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-ink-primary dark:text-nightText-primary">
          News Intelligence Reconnecting
        </h2>
        <p className="text-xs text-ink-muted leading-relaxed">
          The free cloud backend may be completing its initial wake-up cycle. Please retry to load fresh intelligence.
        </p>
        <button
          onClick={loadData}
          className="px-4 py-2 rounded-lg bg-sage-600 text-white text-xs font-medium hover:bg-sage-700 transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  // Filter story categories for editorial sections
  const stateStories = stories.filter(s => s.geographicScope === 'state' && (!s.state || s.state.toLowerCase() === selectedState.toLowerCase()));
  const nationalStories = stories.filter(s => s.geographicScope === 'national');
  const internationalStories = stories.filter(s => s.geographicScope === 'international');
  const perspectiveStory = stories.find(s => s.isPerspectiveAvailable) || stories[0];

  return (
    <div className="space-y-10 pb-16">
      {/* Search Filter Notice */}
      {searchQuery && (
        <div className="p-4 rounded-lg bg-paper-cream dark:bg-night-surface border border-paper-border dark:border-night-border flex items-center justify-between">
          <div className="text-sm">
            Showing results for query: <strong className="font-semibold text-ink-primary dark:text-nightText-primary">"{searchQuery}"</strong> ({stories.length} stories found)
          </div>
          <Link to="/" className="text-xs text-sage-700 dark:text-sage-300 hover:underline">
            Clear search
          </Link>
        </div>
      )}

      {/* A. TODAY'S BRIEFING HERO BANNER */}
      {!searchQuery && (
        <section className="border-b border-paper-border dark:border-night-border pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-sage-700 dark:text-sage-400 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Today's Executive Briefing</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
                The Day in Focus
              </h1>
            </div>

            <div className="text-xs text-ink-muted dark:text-nightText-muted flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Independent & Official Source Grounded</span>
            </div>
          </div>

          {/* Featured Top Story */}
          {stories.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <EditorialCard story={stories[0]} featured={true} />
              </div>

              {/* Side Column: Hourly Pulse Quick Entry & Since You Last Checked */}
              <div className="space-y-4">
                {/* Hourly Pulse Entry */}
                <div className="p-5 rounded-lg border border-paper-border dark:border-night-border bg-paper-cream/60 dark:bg-night-card shadow-editorial">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold uppercase tracking-wider text-sage-800 dark:text-sage-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-sage-600" />
                      Hourly Pulse
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium">
                      Fresh
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-semibold text-ink-primary dark:text-nightText-primary mb-2">
                    {latestBriefing ? latestBriefing.importantDevelopments[0]?.headline || 'Continuous Hour-by-Hour Briefing' : 'Continuous Hour-by-Hour Briefing'}
                  </h3>

                  <p className="text-xs text-ink-secondary dark:text-nightText-secondary line-clamp-3 mb-3 leading-relaxed">
                    {latestBriefing?.summaryOverview || 'Synthesizing verified incoming reports without manufactured urgency.'}
                  </p>

                  <Link
                    to="/hourly-pulse"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sage-700 dark:text-sage-300 hover:underline"
                  >
                    <span>Read Hourly Digest</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Perspective of the Day Callout */}
                {perspectiveStory && (
                  <div className="p-5 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-2">
                      <Compass className="w-3.5 h-3.5 text-sage-600" />
                      <span>Perspective of the Day</span>
                    </div>

                    <h4 className="font-serif text-base font-semibold text-ink-primary dark:text-nightText-primary mb-2 leading-snug">
                      {perspectiveStory.title}
                    </h4>

                    <p className="text-xs text-ink-secondary dark:text-nightText-secondary line-clamp-2 mb-3">
                      {perspectiveStory.generalTake || perspectiveStory.summary}
                    </p>

                    <Link
                      to={`/perspectives?storyId=${perspectiveStory.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-sage-700 dark:text-sage-300 hover:underline"
                    >
                      <span>Explore Evidence & Arguments</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* B. MY STATE TODAY */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-sage-600 dark:text-sage-400" />
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
              {selectedState} Today
            </h2>
          </div>

          <Link
            to="/state-news"
            className="text-xs font-semibold text-sage-700 dark:text-sage-300 hover:underline flex items-center gap-1"
          >
            <span>All State News</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {stateStories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {stateStories.map(story => (
              <EditorialCard key={story.id} story={story} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-ink-muted bg-paper-cream/40 dark:bg-night-surface/30 rounded-lg border border-dashed border-paper-border">
            No active state stories recorded for {selectedState} in current cycle. Showing national developments.
          </div>
        )}
      </section>

      {/* C. INDIA TODAY (NATIONAL) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-sage-600 dark:text-sage-400" />
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
              India Today
            </h2>
          </div>

          <Link
            to="/national-news"
            className="text-xs font-semibold text-sage-700 dark:text-sage-300 hover:underline flex items-center gap-1"
          >
            <span>All National News</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {nationalStories.map(story => (
            <EditorialCard key={story.id} story={story} />
          ))}
        </div>
      </section>

      {/* D. AROUND THE WORLD (INTERNATIONAL) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-sage-600 dark:text-sage-400" />
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
              Around the World
            </h2>
          </div>

          <Link
            to="/international-news"
            className="text-xs font-semibold text-sage-700 dark:text-sage-300 hover:underline flex items-center gap-1"
          >
            <span>All World Coverage</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {internationalStories.map(story => (
            <EditorialCard key={story.id} story={story} />
          ))}
        </div>
      </section>
    </div>
  );
};
