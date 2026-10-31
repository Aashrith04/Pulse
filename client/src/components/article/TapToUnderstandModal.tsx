import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { usePreferences } from '../../context/PreferencesContext';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Bookmark, Check, Volume2, X, Loader2, Sparkles } from 'lucide-react';

interface Props {
  word: string;
  sentence: string;
  storyId?: string;
  storyTitle?: string;
  onClose: () => void;
}

export const TapToUnderstandModal: React.FC<Props> = ({ 
  word, 
  sentence, 
  storyId, 
  storyTitle, 
  onClose 
}) => {
  const { readingLanguage } = usePreferences();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.getContextualDefinition(word, sentence, readingLanguage)
      .then(res => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [word, sentence, readingLanguage]);

  const handleSaveToVocabulary = async () => {
    if (!data || isSaved || saving) return;
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setSaving(true);

    try {
      await api.saveVocabulary({
        word: data.word,
        sourceSentence: sentence,
        storyId,
        storyTitle,
        originalLanguage: data.originalLanguage || 'en',
        targetLanguage: readingLanguage,
        contextualMeaning: data.contextualMeaning,
        originalDefinition: data.originalDefinition,
        pronunciation: data.pronunciation,
        partOfSpeech: data.partOfSpeech,
        exampleSentence: data.exampleSentence,
        synonyms: data.synonyms || [],
      });
      setIsSaved(true);
    } catch (e) {
      console.error('Failed to save word to vocabulary:', e);
    } finally {
      setSaving(false);
    }
  };

  const playPronunciation = () => {
    if ('speechSynthesis' in window && word) {
      const u = new SpeechSynthesisUtterance(word);
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-xl shadow-2xl p-5 overflow-hidden text-ink-primary dark:text-nightText-primary"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-paper-borderSubtle dark:border-night-borderSubtle">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-sage-100 dark:bg-sage-900/40 text-sage-700 dark:text-sage-300">
              <BookOpen className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-sage-600 dark:text-sage-400">
                Tap to Understand
              </span>
              <h3 className="font-serif text-2xl font-bold tracking-tight flex items-center gap-2">
                {word}
                {data?.pronunciation && (
                  <span className="text-xs font-mono font-normal text-ink-muted dark:text-nightText-muted">
                    {data.pronunciation}
                  </span>
                )}
                <button
                  onClick={playPronunciation}
                  className="p-1 text-ink-muted hover:text-sage-700 dark:hover:text-sage-300 rounded transition-colors"
                  title="Listen to pronunciation"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </h3>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1 rounded-md text-ink-muted hover:text-ink-primary dark:hover:text-nightText-primary hover:bg-paper-cream dark:hover:bg-night-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-ink-muted dark:text-nightText-muted text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-sage-600" />
            <span>Analyzing contextual sentence meaning...</span>
          </div>
        ) : data ? (
          <div className="space-y-3.5 pt-3">
            {/* Part of Speech */}
            {data.partOfSpeech && (
              <span className="inline-block text-xs font-mono px-2 py-0.5 rounded bg-paper-cream dark:bg-night-surface text-ink-secondary dark:text-nightText-secondary border border-paper-borderSubtle dark:border-night-borderSubtle">
                {data.partOfSpeech}
              </span>
            )}

            {/* Contextual Meaning in Reading Language */}
            <div className="p-3 rounded-lg bg-sage-50/70 dark:bg-sage-950/20 border border-sage-200/70 dark:border-sage-800/40">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-sage-800 dark:text-sage-300 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-sage-600" />
                <span>Meaning in Context ({readingLanguage.toUpperCase()}):</span>
              </div>
              <p className="text-sm font-medium text-ink-primary dark:text-nightText-primary leading-relaxed">
                {data.contextualMeaning}
              </p>
            </div>

            {/* Original English Definition */}
            <div>
              <span className="text-xs font-medium text-ink-muted dark:text-nightText-muted block mb-0.5">
                Editorial Definition:
              </span>
              <p className="text-xs text-ink-secondary dark:text-nightText-secondary leading-relaxed">
                {data.originalDefinition}
              </p>
            </div>

            {/* In the Sentence */}
            <div className="text-xs border-l-2 border-stone-300 dark:border-stone-700 pl-2.5 py-0.5 text-ink-muted dark:text-nightText-muted italic">
              "{sentence}"
            </div>

            {/* Example Sentence */}
            {data.exampleSentence && (
              <div className="text-xs text-ink-secondary dark:text-nightText-secondary">
                <span className="font-medium text-ink-primary dark:text-nightText-primary">Example: </span>
                {data.exampleSentence}
              </div>
            )}

            {/* Synonyms */}
            {data.synonyms && data.synonyms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                <span className="text-ink-muted">Synonyms:</span>
                {data.synonyms.map((s: string) => (
                  <span key={s} className="px-1.5 py-0.5 rounded bg-paper-cream dark:bg-night-surface text-ink-secondary dark:text-nightText-secondary">
                    {s}
                  </span>
                ))}
              </div>
            )}

            {/* Save to Vocabulary Button */}
            <div className="pt-3 border-t border-paper-borderSubtle dark:border-night-borderSubtle flex items-center justify-between">
              <span className="text-xs text-ink-muted dark:text-nightText-muted">
                {isSaved ? 'Saved to Vocabulary list' : 'Save word for future recall review'}
              </span>
              <button
                onClick={handleSaveToVocabulary}
                disabled={isSaved || saving}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  isSaved
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-sage-600 text-white hover:bg-sage-700 active:scale-95'
                }`}
              >
                {isSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save Word'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-ink-muted">
            Definition could not be retrieved.
          </div>
        )}
      </div>
    </div>
  );
};
