import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserPreferences, LanguageCode } from '../types';
import { api } from '../utils/api';

interface PreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  isLoading: boolean;
  selectedState: string;
  setSelectedState: (state: string) => void;
  readingLanguage: LanguageCode;
  setReadingLanguage: (lang: LanguageCode) => void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  countryCode: 'IN',
  state: 'Telangana',
  interfaceLanguage: 'en',
  newsReadingLanguage: 'en',
  summaryLength: 'balanced',
  theme: 'light',
  enableNotifications: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  topicsOfInterest: ['governance', 'technology', 'economy', 'infrastructure', 'education'],
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem('pulse_preferences');
    if (saved) {
      try {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      } catch (e) {
        // Ignore JSON error
      }
    }
    return DEFAULT_PREFERENCES;
  });

  const [isLoading, setIsLoading] = useState(false);

  // Sync with backend on mount
  useEffect(() => {
    api.getPreferences()
      .then(serverPrefs => {
        if (serverPrefs) {
          setPreferences(prev => ({ ...prev, ...serverPrefs }));
        }
      })
      .catch(() => {
        // Fall back to local storage silently
      });
  }, []);

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...updates };
    setPreferences(updated);
    localStorage.setItem('pulse_preferences', JSON.stringify(updated));

    try {
      await api.savePreferences(updates);
    } catch (e) {
      console.warn('[Preferences] Failed to persist updates to server, saved locally:', e);
    }
  };

  const setSelectedState = (state: string) => {
    updatePreferences({ state });
  };

  const setReadingLanguage = (newsReadingLanguage: LanguageCode) => {
    updatePreferences({ newsReadingLanguage });
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        updatePreferences,
        isLoading,
        selectedState: preferences.state,
        setSelectedState,
        readingLanguage: preferences.newsReadingLanguage,
        setReadingLanguage,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within a PreferencesProvider');
  return context;
};
