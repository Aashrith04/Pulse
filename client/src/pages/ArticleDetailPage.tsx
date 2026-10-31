import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { CanonicalStory, PerspectiveAnalysis, LanguageCode } from '../types';
import { EvidenceBadge } from '../components/common/EvidenceBadge';
import { SourceAttribution } from '../components/common/SourceAttribution';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { usePreferences } from '../context/PreferencesContext';
import { TapToUnderstandModal } from '../components/article/TapToUnderstandModal';
import { useAuth } from '../context/AuthContext';
import { 
  Volume2, 
  Compass, 
  History, 
  ArrowLeft, 
  Languages, 
  BookOpen, 
  ExternalLink, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles,
  Loader2,
  Bookmark
} from 'lucide-react';

export const ArticleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { playStory, isPlaying, currentStoryId } = useAudioPlayer();
  const { readingLanguage } = usePreferences();
  const { isAuthenticated } = useAuth();

  const [story, setStory] = useState<CanonicalStory | null>(null);
  const [perspective, setPerspective] = useState<PerspectiveAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'article' | 'perspective' | 'timeline' | 'sources'>('article');

  // Bookmark state
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [isSavingBookmark, setIsSavingBookmark] = useState(false);

  // Translation State
  const [isTranslatedView, setIsTranslatedView] = useState(false);
  const [translation, setTranslation] = useState<any>(null);
  const [translating, setTranslating] = useState(false);

  // Tap-to-Understand Selection State
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedSentence, setSelectedSentence] = useState<string>('');
  const [selectionCoords, setSelectionCoords] = useState<{ x: number; y: number } | null>(null);
  const [isDictionaryModalOpen, setIsDictionaryModalOpen] = useState(false);

  const articleContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    // Initialize bookmark state from localStorage cache
    try {
      const saved = JSON.parse(localStorage.getItem('pulse_saved_story_ids') || '[]');
      setIsBookmarked(saved.includes(id));
    } catch {
      setIsBookmarked(false);
    }

    api.getStoryById(id)
      .then(s => {
        setStory(s);
        setLoading(false);
        // Pre-fetch perspective
        api.getPerspective(s.id).then(p => setPerspective(p)).catch(() => {});
      })
      .catch(() => setLoading(false));

    // Record reading history after 5 seconds of active engagement
    const timer = setTimeout(() => {
      api.recordReadingHistory(id, 30).catch(() => {});
    }, 5000);

    return () => clearTimeout(timer);
  }, [id]);

  const toggleBookmark = async () => {
    if (!story || isSavingBookmark) return;
    setIsSavingBookmark(true);

    const nextState = !isBookmarked;
    setIsBookmarked(nextState);

    // Cache locally
    try {
      const saved = JSON.parse(localStorage.getItem('pulse_saved_story_ids') || '[]');
      let updated: string[];
      if (nextState) {
        updated = Array.from(new Set([...saved, story.id]));
      } else {
        updated = saved.filter((sId: string) => sId !== story.id);
      }
      localStorage.setItem('pulse_saved_story_ids', JSON.stringify(updated));
    } catch (e) {
      console.warn('Local bookmark update error:', e);
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

    setIsSavingBookmark(false);
  };

  // Handle Text Selection for Tap-to-Understand
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionCoords(null);
      return;
    }

    const text = selection.toString().trim();
    // Support single words and short phrases up to 3 words
    const words = text.split(/\s+/);
    if (words.length > 0 && words.length <= 4 && text.length > 2) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Find enclosing sentence
      const fullText = range.startContainer.textContent || '';
      let sentence = text;
      const match = fullText.match(/[^.!?]+[.!?]+/g);
      if (match) {
        const found = match.find(s => s.includes(text));
        if (found) sentence = found.trim();
      }

      setSelectedWord(text);
      setSelectedSentence(sentence);
      setSelectionCoords({
        x: rect.left + rect.width / 2,
        y: rect.top - 10 + window.scrollY,
      });
    } else {
      setSelectionCoords(null);
    }
  };

  const handleTranslateToggle = async () => {
    if (!story) return;

    if (!isTranslatedView) {
      if (!translation) {
        setTranslating(true);
        try {
          const res = await api.translateNews(story.title, story.summary, story.whyItMatters, readingLanguage);
          setTranslation(res);
          setIsTranslatedView(true);
        } catch (e) {
          console.error(e);
        } finally {
          setTranslating(false);
        }
      } else {
        setIsTranslatedView(true);
      }
    } else {
      setIsTranslatedView(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-ink-muted">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600 mx-auto mb-2" />
        <p className="font-serif text-lg">Opening verified news intelligence record...</p>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="font-serif text-2xl font-bold">Story Not Found</h2>
        <p className="text-sm text-ink-muted">The requested intelligence entry does not exist or has been retracted.</p>
        <Link to="/" className="text-sage-700 underline font-medium text-sm">
          Return to Today's Pulse
        </Link>
      </div>
    );
  }

  const isAudioPlaying = currentStoryId === story.id && isPlaying;
  const displayTitle = isTranslatedView && translation?.title ? translation.title : story.title;
  const displaySummary = isTranslatedView && translation?.summary ? translation.summary : story.summary;
  const displayWhyItMatters = isTranslatedView && translation?.whyItMatters ? translation.whyItMatters : story.whyItMatters;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      {/* Back button */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary dark:hover:text-nightText-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Today's Pulse</span>
        </Link>
      </div>

      {/* Main Article Header */}
      <header className="space-y-4 border-b border-paper-border dark:border-night-border pb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wider text-sage-700 dark:text-sage-400">
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
            <span className="text-ink-muted flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(story.lastUpdatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {story.isLiveIngested ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Feed</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 dark:bg-stone-900/60 dark:text-stone-400 border border-stone-200 dark:border-stone-800">
                <span>Verified Baseline</span>
              </span>
            )}
            <EvidenceBadge status={story.evidenceStatus} size="md" />
          </div>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary leading-tight">
          {displayTitle}
        </h1>

        {/* Translation Banner Notice */}
        {isTranslatedView && (
          <div className="p-2.5 rounded-lg bg-sage-50/80 dark:bg-sage-950/30 border border-sage-200 dark:border-sage-800 text-xs text-sage-900 dark:text-sage-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-sage-600" />
              <span>
                Machine-translated into <strong>{readingLanguage.toUpperCase()}</strong>. Proper names and source citations preserved.
              </span>
            </div>
            <button
              onClick={() => setIsTranslatedView(false)}
              className="text-xs font-semibold underline text-sage-700 hover:text-sage-900"
            >
              View Original English
            </button>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Audio Button */}
          <button
            onClick={() => playStory(story.id, displayTitle, `${displaySummary}. Why it matters: ${displayWhyItMatters}`)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              isAudioPlaying
                ? 'bg-sage-600 text-white border-sage-600'
                : 'border-paper-border dark:border-night-border hover:bg-paper-cream dark:hover:bg-night-surface text-ink-secondary dark:text-nightText-secondary'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{isAudioPlaying ? 'Playing Audio' : 'Listen to Story'}</span>
          </button>

          {/* Language Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTranslateToggle}
              disabled={translating}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isTranslatedView
                  ? 'bg-sage-600 text-white border-sage-600'
                  : 'border-paper-border dark:border-night-border hover:bg-paper-cream dark:hover:bg-night-surface text-ink-secondary dark:text-nightText-secondary'
              }`}
            >
              <Languages className="w-3.5 h-3.5" />
              <span>
                {translating 
                  ? 'Translating...' 
                  : isTranslatedView 
                  ? `Translated (${readingLanguage.toUpperCase()})` 
                  : `Read in ${readingLanguage.toUpperCase()}`}
              </span>
            </button>

            {/* Bookmark Action */}
            <button
              onClick={toggleBookmark}
              disabled={isSavingBookmark}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isBookmarked
                  ? 'bg-sage-100 text-sage-900 border-sage-300 dark:bg-sage-950/60 dark:text-sage-200 dark:border-sage-800'
                  : 'border-paper-border dark:border-night-border hover:bg-paper-cream dark:hover:bg-night-surface text-ink-secondary dark:text-nightText-secondary'
              }`}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark this story'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current text-sage-700 dark:text-sage-400' : ''}`} />
              <span>{isBookmarked ? 'Saved' : 'Save Story'}</span>
            </button>
          </div>
        </div>

        {/* Feature Tabs: Article, Perspective Desk, Timeline, Sources */}
        <div className="flex items-center gap-2 border-b border-paper-borderSubtle dark:border-night-borderSubtle pt-4 overflow-x-auto scrollbar-none">
          {[
            { id: 'article', label: 'Article & Context', icon: BookOpen },
            { id: 'perspective', label: 'Perspective Desk', icon: Compass },
            { id: 'timeline', label: `Timeline (${story.timeline?.length || 0})`, icon: History },
            { id: 'sources', label: `Sources (${story.articles?.length || 0})`, icon: ShieldCheck },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 border-b-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-sage-600 text-sage-800 dark:text-sage-300 font-bold'
                    : 'border-transparent text-ink-muted hover:text-ink-primary hover:border-paper-border'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* FLOATING TAP-TO-UNDERSTAND BUTTON WHEN USER SELECTS TEXT */}
      {selectionCoords && selectedWord && (
        <div
          style={{
            position: 'absolute',
            left: `${selectionCoords.x}px`,
            top: `${selectionCoords.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className="z-50 animate-fade-in"
        >
          <button
            onClick={() => {
              setIsDictionaryModalOpen(true);
              setSelectionCoords(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sage-800 text-white text-xs font-semibold shadow-xl hover:bg-sage-900 active:scale-95 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-sage-300" />
            <span>Tap to Understand: "{selectedWord.slice(0, 15)}"</span>
          </button>
        </div>
      )}

      {/* TAB CONTENT 1: FULL ARTICLE & TAP-TO-UNDERSTAND READING AREA */}
      {activeTab === 'article' && (
        <div 
          ref={articleContentRef}
          onMouseUp={handleMouseUp}
          className="space-y-6 prose prose-lg dark:prose-invert max-w-none selectable-prose"
        >
          {/* Helper hint for reader */}
          <div className="p-3 rounded-lg bg-paper-cream/80 dark:bg-night-surface/60 border border-paper-borderSubtle dark:border-night-borderSubtle text-xs text-ink-muted flex items-center justify-between not-prose">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sage-600" />
              <span><strong>Tap-to-Understand Active:</strong> Highlight or tap any word to view its contextual dictionary definition in {readingLanguage.toUpperCase()}.</span>
            </span>
          </div>

          {/* Lead Image if available */}
          {story.leadImageUrl && (
            <div className="rounded-xl overflow-hidden not-prose mb-6 max-h-96 w-full">
              <img 
                src={story.leadImageUrl} 
                alt={story.title} 
                className="w-full h-full object-cover" 
              />
            </div>
          )}

          {/* Summary / Lead */}
          <p className="font-serif text-xl sm:text-2xl text-ink-primary dark:text-nightText-primary leading-relaxed">
            {displaySummary}
          </p>

          {/* Why It Matters Callout Box */}
          <div className="not-prose border-l-4 border-sage-600 dark:border-sage-400 pl-4 py-2 my-6 bg-paper-cream dark:bg-night-surface rounded-r-lg">
            <h4 className="text-xs font-bold uppercase tracking-wider text-sage-800 dark:text-sage-300 mb-1">
              Why This Matters
            </h4>
            <p className="text-sm text-ink-secondary dark:text-nightText-secondary leading-relaxed">
              {displayWhyItMatters}
            </p>
          </div>

          {/* Detailed Content Paragraphs */}
          <div className="text-base text-ink-secondary dark:text-nightText-secondary leading-relaxed space-y-4 font-sans">
            {story.articles.map((art, idx) => (
              <div key={idx} className="space-y-2">
                <p>{art.content}</p>
                <div className="not-prose text-xs text-ink-muted flex items-center gap-1">
                  <span>Reported by</span>
                  <a href={art.url} target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-sage-700">
                    {art.sourceName}
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* India Implication */}
          {story.indiaImplication && (
            <div className="not-prose border-l-4 border-terracotta-500 pl-4 py-2 my-6 bg-terracotta-50/40 dark:bg-night-surface rounded-r-lg">
              <h4 className="text-xs font-bold uppercase tracking-wider text-terracotta-700 dark:text-terracotta-400 mb-1">
                Potential Implications for India
              </h4>
              <p className="text-sm text-ink-secondary dark:text-nightText-secondary leading-relaxed">
                {story.indiaImplication}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: PERSPECTIVE DESK TAB */}
      {activeTab === 'perspective' && perspective && (
        <div className="space-y-6 animate-fade-in">
          {/* General Take AI Analysis */}
          <div className="p-5 rounded-xl border border-paper-border dark:border-night-border bg-paper-cream dark:bg-night-card space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-sage-800 dark:text-sage-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sage-600" />
              General Editorial Take (AI Analysis)
            </span>
            <p className="text-sm text-ink-secondary dark:text-nightText-secondary leading-relaxed">
              {perspective.generalTake}
            </p>
          </div>

          {/* Pros vs Cons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block border-b pb-2">
                Arguments in Favor
              </span>
              {perspective.perspectivesInFavor.map((p, idx) => (
                <div key={idx} className="text-xs space-y-1">
                  <p className="font-medium text-ink-primary dark:text-nightText-primary">"{p.argument}"</p>
                  <p className="text-ink-muted">Cited: {p.citedSource}</p>
                </div>
              ))}
            </div>

            <div className="p-5 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-terracotta-700 dark:text-terracotta-400 block border-b pb-2">
                Concerns & Counterarguments
              </span>
              {perspective.perspectivesAgainst.map((p, idx) => (
                <div key={idx} className="text-xs space-y-1">
                  <p className="font-medium text-ink-primary dark:text-nightText-primary">"{p.argument}"</p>
                  <p className="text-ink-muted">Cited: {p.citedSource}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Link
              to={`/perspectives?storyId=${story.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-sage-700 dark:text-sage-300 hover:underline"
            >
              <span>Open Full Evidence & Uncertainty Audit at Perspective Desk →</span>
            </Link>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-6 animate-fade-in">
          <h3 className="font-serif text-xl font-bold tracking-tight">
            Chronological Story Timeline
          </h3>

          <div className="relative border-l-2 border-stone-200 dark:border-stone-800 ml-3 space-y-6 pl-6 py-2">
            {story.timeline?.map((event, idx) => (
              <div key={idx} className="relative group">
                <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-sage-600 border-2 border-paper-card dark:border-night-card" />
                
                <div className="text-xs text-ink-muted font-mono mb-1">
                  {new Date(event.eventTimestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </div>

                <h4 className="font-serif text-base font-semibold text-ink-primary dark:text-nightText-primary mb-1">
                  {event.title}
                </h4>

                <p className="text-xs sm:text-sm text-ink-secondary dark:text-nightText-secondary mb-2 leading-relaxed">
                  {event.description}
                </p>

                {event.whatChanged && (
                  <div className="p-2.5 rounded bg-paper-cream/60 dark:bg-night-surface/60 border border-paper-borderSubtle text-xs text-ink-primary dark:text-nightText-primary">
                    <strong className="text-sage-800 dark:text-sage-300 font-semibold">What changed: </strong>
                    {event.whatChanged}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: SOURCES */}
      {activeTab === 'sources' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="font-serif text-xl font-bold tracking-tight">
            Original Publishers & Dispatches
          </h3>

          <div className="space-y-3">
            {story.articles.map(art => (
              <div key={art.id} className="p-4 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-sage-800 dark:text-sage-300">{art.sourceName}</span>
                    <EvidenceBadge status={art.evidenceLabel} size="sm" />
                  </div>
                  <h4 className="font-serif text-base font-bold text-ink-primary dark:text-nightText-primary">
                    {art.title}
                  </h4>
                  <p className="text-xs text-ink-secondary dark:text-nightText-secondary line-clamp-2">
                    {art.summary}
                  </p>
                </div>

                <a
                  href={art.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-paper-border hover:bg-paper-cream text-ink-secondary flex items-center gap-1 text-xs flex-shrink-0"
                >
                  <span>Visit Article</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTEXTUAL DICTIONARY MODAL */}
      {isDictionaryModalOpen && selectedWord && (
        <TapToUnderstandModal
          word={selectedWord}
          sentence={selectedSentence}
          storyId={story.id}
          storyTitle={story.title}
          onClose={() => {
            setIsDictionaryModalOpen(false);
            setSelectedWord(null);
          }}
        />
      )}
    </div>
  );
};
