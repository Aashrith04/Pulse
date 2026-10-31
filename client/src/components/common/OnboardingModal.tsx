import React, { useState, useEffect } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import { ALL_INDIAN_STATES_AND_UTS } from './StateSelectorModal';
import { LanguageCode } from '../../types';
import { 
  Sparkles, 
  MapPin, 
  Languages, 
  Check, 
  ArrowRight, 
  ShieldCheck 
} from 'lucide-react';

const POPULAR_LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
];

export const OnboardingModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { preferences, updatePreferences } = usePreferences();

  const [chosenState, setChosenState] = useState(preferences.state || 'Telangana');
  const [chosenLang, setChosenLang] = useState<LanguageCode>(preferences.newsReadingLanguage || 'en');

  useEffect(() => {
    const hasCompleted = localStorage.getItem('pulse_onboarding_completed');
    if (!hasCompleted) {
      setIsOpen(true);
    }
  }, []);

  if (!isOpen) return null;

  const handleFinishOnboarding = () => {
    updatePreferences({
      state: chosenState,
      newsReadingLanguage: chosenLang,
    });
    localStorage.setItem('pulse_onboarding_completed', 'true');
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-lg bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 text-ink-primary dark:text-nightText-primary"
        onClick={e => e.stopPropagation()}
      >
        {/* Subtle decorative accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sage-500 via-sage-600 to-terracotta-500" />

        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-50 dark:bg-sage-950/40 border border-sage-200 dark:border-sage-800 text-xs font-semibold text-sage-800 dark:text-sage-300">
            <Sparkles className="w-3.5 h-3.5 text-sage-600" />
            <span>Welcome to Pulse</span>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">
            The World, Understood.
          </h2>

          <p className="text-xs sm:text-sm text-ink-secondary dark:text-nightText-secondary max-w-sm mx-auto leading-relaxed">
            Calm, verified news intelligence from Indian gazettes and international publishers. Set your preferences to personalize your briefing.
          </p>
        </div>

        {/* Step 1: State Selection */}
        <div className="space-y-4 mb-6 text-xs">
          <div>
            <label className="flex items-center gap-1.5 font-semibold text-ink-primary dark:text-nightText-primary mb-1.5">
              <MapPin className="w-3.5 h-3.5 text-sage-600" />
              <span>1. Choose your primary State / Union Territory</span>
            </label>
            <p className="text-[11px] text-ink-muted mb-2">
              Powers your localized State Intelligence Desk.
            </p>
            <select
              value={chosenState}
              onChange={e => setChosenState(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-paper-light dark:bg-night-surface border border-paper-border dark:border-night-border text-ink-primary dark:text-nightText-primary focus:outline-none focus:ring-1 focus:ring-sage-500 text-xs font-medium"
            >
              {ALL_INDIAN_STATES_AND_UTS.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Step 2: Preferred Reading Language */}
          <div>
            <label className="flex items-center gap-1.5 font-semibold text-ink-primary dark:text-nightText-primary mb-1.5">
              <Languages className="w-3.5 h-3.5 text-sage-600" />
              <span>2. Choose your preferred reading language</span>
            </label>
            <p className="text-[11px] text-ink-muted mb-2">
              Enables real-time Tap-to-Understand dictionary & headline translations.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {POPULAR_LANGUAGES.map(lang => {
                const isSelected = chosenLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setChosenLang(lang.code)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-sage-600 text-white border-sage-600 shadow-sm font-semibold'
                        : 'border-paper-border dark:border-night-border bg-paper-light dark:bg-night-surface text-ink-secondary hover:border-stone-400'
                    }`}
                  >
                    <div className="text-xs font-medium">{lang.label}</div>
                    <div className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-ink-muted'}`}>{lang.native}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="pt-4 border-t border-paper-borderSubtle dark:border-night-borderSubtle flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Settings can be changed anytime</span>
          </div>

          <button
            type="button"
            onClick={handleFinishOnboarding}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sage-700 hover:bg-sage-800 text-white text-xs font-medium shadow-md transition-all active:scale-95"
          >
            <span>Begin Reading</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
