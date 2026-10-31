import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface AudioPlayerContextType {
  isPlaying: boolean;
  currentStoryId: string | null;
  currentStoryTitle: string | null;
  speed: number;
  progress: number;
  playStory: (id: string, title: string, text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setSpeed: (rate: number) => void;
  isSupported: boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);
  const [currentStoryTitle, setCurrentStoryTitle] = useState<string | null>(null);
  const [speed, setSpeedState] = useState(1.0);
  const [progress, setProgress] = useState(0);
  const [isSupported, setIsSupported] = useState(true);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const fullTextRef = useRef<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined' && !('speechSynthesis' in window)) {
      setIsSupported(false);
    }
  }, []);

  const stop = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setProgress(0);
    setCurrentStoryId(null);
    setCurrentStoryTitle(null);
  };

  const playStory = (id: string, title: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser environment.');
      return;
    }

    window.speechSynthesis.cancel();
    fullTextRef.current = `${title}. ${text}`;

    const utterance = new SpeechSynthesisUtterance(fullTextRef.current);
    utterance.rate = speed;
    utterance.lang = 'en-US';

    utterance.onstart = () => {
      setIsPlaying(true);
      setCurrentStoryId(id);
      setCurrentStoryTitle(title);
    };

    utterance.onboundary = (e) => {
      if (e.charIndex && fullTextRef.current.length > 0) {
        const pct = Math.min(100, Math.round((e.charIndex / fullTextRef.current.length) * 100));
        setProgress(pct);
      }
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setProgress(100);
      setTimeout(() => {
        setProgress(0);
      }, 1000);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const pause = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    }
  };

  const resume = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
    }
  };

  const setSpeed = (rate: number) => {
    setSpeedState(rate);
    if (isPlaying && utteranceRef.current && currentStoryId && currentStoryTitle) {
      // Restart with new rate
      playStory(currentStoryId, currentStoryTitle, fullTextRef.current);
    }
  };

  return (
    <AudioPlayerContext.Provider
      value={{
        isPlaying,
        currentStoryId,
        currentStoryTitle,
        speed,
        progress,
        playStory,
        pause,
        resume,
        stop,
        setSpeed,
        isSupported,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
  return context;
};
