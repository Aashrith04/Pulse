import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { VocabularyEntry } from '../types';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import { 
  GraduationCap, 
  Search, 
  Volume2, 
  Check, 
  Trash2, 
  RotateCcw, 
  Sparkles, 
  Loader2, 
  Eye, 
  BookOpen, 
  Calendar,
  ShieldCheck
} from 'lucide-react';

export const VocabularyPage: React.FC = () => {
  const { readingLanguage } = usePreferences();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [vocabulary, setVocabulary] = useState<VocabularyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [masteryFilter, setMasteryFilter] = useState<number | undefined>(undefined);

  // Practice Recall Quiz Mode
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });

  const fetchVocab = () => {
    setLoading(true);
    api.getVocabulary(undefined, search, masteryFilter)
      .then(res => {
        setVocabulary(res.vocabulary || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchVocab();
  }, [search, masteryFilter, isAuthenticated]);

  const handleUpdateMastery = async (id: string, newLevel: number) => {
    try {
      await api.updateVocabulary(id, { masteryLevel: newLevel });
      setVocabulary(prev => prev.map(v => v.id === id ? { ...v, masteryLevel: newLevel } : v));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteVocabulary(id);
      setVocabulary(prev => prev.filter(v => v.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const playWord = (word: string) => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(word);
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    }
  };

  // Practice Quiz Handlers
  const startPractice = () => {
    if (vocabulary.length === 0) return;
    setIsPracticeMode(true);
    setCurrentQuizIndex(0);
    setIsAnswerRevealed(false);
    setQuizScore({ correct: 0, total: 0 });
  };

  const currentQuizWord = vocabulary[currentQuizIndex];

  const handleQuizAnswer = (recalled: boolean) => {
    if (recalled) {
      setQuizScore(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
      if (currentQuizWord) {
        handleUpdateMastery(currentQuizWord.id, Math.min(2, currentQuizWord.masteryLevel + 1));
      }
    } else {
      setQuizScore(prev => ({ ...prev, total: prev.total + 1 }));
    }

    if (currentQuizIndex + 1 < vocabulary.length) {
      setCurrentQuizIndex(prev => prev + 1);
      setIsAnswerRevealed(false);
    } else {
      // Completed
      setIsAnswerRevealed(true);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-paper-border dark:border-night-border pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sage-700 dark:text-sage-400 mb-1">
            <GraduationCap className="w-4 h-4" />
            <span>Language Learning in Reading</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
            Personal Vocabulary Desk
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Words saved directly while reading verified news. Retains sentence context and definitions in your reading language.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isAuthenticated && (
            <button
              onClick={() => openAuthModal('login')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-sage-50 dark:bg-sage-950/40 text-sage-800 dark:text-sage-300 border border-sage-200 dark:border-sage-800 hover:bg-sage-100 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-sage-600" />
              <span>Sign in to Sync</span>
            </button>
          )}

          <button
            onClick={startPractice}
            disabled={vocabulary.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Practice Recall ({vocabulary.length})</span>
          </button>
        </div>
      </div>

      {/* PRACTICE MODE CARD */}
      {isPracticeMode && currentQuizWord && (
        <div className="p-6 sm:p-8 rounded-xl border border-sage-300 dark:border-sage-800 bg-sage-50/40 dark:bg-night-card shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-sage-800 dark:text-sage-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sage-600" />
              Recall Practice Session ({currentQuizIndex + 1} of {vocabulary.length})
            </span>

            <button
              onClick={() => setIsPracticeMode(false)}
              className="text-xs text-ink-muted hover:text-ink-primary underline"
            >
              Exit Practice
            </button>
          </div>

          <div className="space-y-3 text-center py-4">
            <div className="flex items-center justify-center gap-2">
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-ink-primary dark:text-nightText-primary">
                {currentQuizWord.word}
              </h2>
              <button
                onClick={() => playWord(currentQuizWord.word)}
                className="p-1.5 text-ink-muted hover:text-sage-700 rounded-full"
                title="Pronounce word"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {currentQuizWord.pronunciation && (
              <span className="text-xs font-mono text-ink-muted">
                {currentQuizWord.pronunciation}
              </span>
            )}

            {/* Context Sentence Hint */}
            <div className="max-w-xl mx-auto p-3 rounded-lg bg-paper-card dark:bg-night-surface border border-paper-border dark:border-night-border text-xs sm:text-sm text-ink-secondary dark:text-nightText-secondary italic">
              "{currentQuizWord.sourceSentence}"
            </div>
          </div>

          {/* Answer Reveal Section */}
          {!isAnswerRevealed ? (
            <div className="text-center pt-2">
              <button
                onClick={() => setIsAnswerRevealed(true)}
                className="px-5 py-2 rounded-lg bg-sage-700 text-white text-xs font-semibold hover:bg-sage-800 transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Reveal Meaning</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 pt-2 border-t border-paper-borderSubtle dark:border-night-borderSubtle animate-fade-in">
              <div className="p-4 rounded-lg bg-paper-card dark:bg-night-surface border border-paper-border dark:border-night-border space-y-2">
                <span className="text-xs font-semibold text-sage-800 dark:text-sage-300 block">
                  Contextual Meaning:
                </span>
                <p className="text-sm font-medium text-ink-primary dark:text-nightText-primary">
                  {currentQuizWord.contextualMeaning}
                </p>
                <p className="text-xs text-ink-muted">
                  {currentQuizWord.originalDefinition}
                </p>
              </div>

              {/* Recall Assessment Buttons */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => handleQuizAnswer(false)}
                  className="px-4 py-2 rounded-lg border border-terracotta-200 bg-terracotta-50 text-terracotta-800 text-xs font-medium hover:bg-terracotta-100 transition-colors"
                >
                  Need Review
                </button>
                <button
                  onClick={() => handleQuizAnswer(true)}
                  className="px-5 py-2 rounded-lg bg-sage-600 text-white text-xs font-semibold hover:bg-sage-700 transition-colors shadow-sm inline-flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>I Recalled This</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search saved words or definitions..."
            className="w-full pl-8 pr-4 py-1.5 text-xs rounded-lg bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border text-ink-primary dark:text-nightText-primary focus:outline-none focus:ring-1 focus:ring-sage-500"
          />
        </div>

        {/* Mastery Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-ink-muted">Filter:</span>
          {[
            { label: 'All', val: undefined },
            { label: 'New (0)', val: 0 },
            { label: 'Practicing (1)', val: 1 },
            { label: 'Learned (2)', val: 2 },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => setMasteryFilter(item.val)}
              className={`px-2.5 py-1 rounded-full border transition-colors ${
                masteryFilter === item.val
                  ? 'bg-sage-600 text-white border-sage-600 font-medium'
                  : 'border-paper-border dark:border-night-border text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream dark:hover:bg-night-surface'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Words Grid */}
      {loading ? (
        <div className="py-16 text-center text-ink-muted">
          <Loader2 className="w-6 h-6 animate-spin text-sage-600 mx-auto mb-2" />
          <p className="text-sm">Loading vocabulary list...</p>
        </div>
      ) : vocabulary.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vocabulary.map(entry => (
            <div
              key={entry.id}
              className="p-5 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-xl font-bold text-ink-primary dark:text-nightText-primary">
                      {entry.word}
                    </h3>
                    {entry.pronunciation && (
                      <span className="text-xs font-mono text-ink-muted">
                        {entry.pronunciation}
                      </span>
                    )}
                    <button
                      onClick={() => playWord(entry.word)}
                      className="p-1 text-ink-muted hover:text-sage-700"
                      title="Audio"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Mastery Badge */}
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    entry.masteryLevel === 2
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : entry.masteryLevel === 1
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'bg-paper-cream text-ink-secondary dark:bg-night-surface dark:text-nightText-secondary'
                  }`}>
                    {entry.masteryLevel === 2 ? 'Learned' : entry.masteryLevel === 1 ? 'Practicing' : 'New'}
                  </span>
                </div>

                {/* Contextual Meaning */}
                <div className="p-2.5 rounded-lg bg-sage-50/50 dark:bg-sage-950/20 border border-sage-200/50 dark:border-sage-800/30 text-xs mb-2">
                  <span className="font-semibold text-sage-800 dark:text-sage-300 block mb-0.5">
                    Contextual Meaning:
                  </span>
                  <p className="text-ink-primary dark:text-nightText-primary">
                    {entry.contextualMeaning}
                  </p>
                </div>

                {/* Source Sentence */}
                <p className="text-xs text-ink-muted dark:text-nightText-muted italic border-l-2 border-stone-300 dark:border-stone-700 pl-2 py-0.5">
                  "{entry.sourceSentence}"
                </p>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-paper-borderSubtle dark:border-night-borderSubtle text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleUpdateMastery(entry.id, entry.masteryLevel === 2 ? 0 : entry.masteryLevel + 1)}
                    className="text-xs text-sage-700 dark:text-sage-300 hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>{entry.masteryLevel === 2 ? 'Reset to New' : 'Mark Progressed'}</span>
                  </button>
                </div>

                <button
                  onClick={() => handleDelete(entry.id)}
                  className="text-xs text-ink-muted hover:text-terracotta-600 transition-colors p-1"
                  title="Remove from vocabulary"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-ink-muted bg-paper-cream/40 dark:bg-night-surface/40 rounded-xl border border-dashed p-8">
          <BookOpen className="w-8 h-8 text-sage-600 mx-auto mb-2 opacity-60" />
          <p className="font-serif text-lg text-ink-primary dark:text-nightText-primary mb-1">
            No words in your vocabulary yet.
          </p>
          <p className="text-xs max-w-sm mx-auto">
            While reading any article, simply select or tap a word to trigger Tap-to-Understand and save it here.
          </p>
        </div>
      )}
    </div>
  );
};
