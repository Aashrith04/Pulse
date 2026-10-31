import React from 'react';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { Play, Pause, Square, Volume2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AudioPlayerBar: React.FC = () => {
  const { 
    isPlaying, 
    currentStoryId, 
    currentStoryTitle, 
    speed, 
    progress, 
    pause, 
    resume, 
    stop, 
    setSpeed 
  } = useAudioPlayer();

  if (!currentStoryTitle) return null;

  const speeds = [0.75, 1.0, 1.25, 1.5];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-paper-card dark:bg-night-card border-t border-paper-border dark:border-night-border shadow-lg py-2.5 px-4 sm:px-8 transition-transform duration-300">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Story Info */}
        <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
          <div className="p-2 rounded-full bg-sage-100 dark:bg-sage-900/60 text-sage-700 dark:text-sage-300 flex-shrink-0">
            <Volume2 className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-sage-700 dark:text-sage-400">
              Listen to Your World
            </div>
            {currentStoryId ? (
              <Link 
                to={`/stories/${currentStoryId}`}
                className="font-serif text-sm font-medium text-ink-primary dark:text-nightText-primary hover:underline truncate block max-w-xs sm:max-w-md"
              >
                {currentStoryTitle}
              </Link>
            ) : (
              <span className="font-serif text-sm font-medium text-ink-primary dark:text-nightText-primary truncate block max-w-xs sm:max-w-md">
                {currentStoryTitle}
              </span>
            )}
          </div>
        </div>

        {/* Controls & Progress */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          {/* Progress bar */}
          <div className="w-32 sm:w-48 bg-paper-cream dark:bg-night-surface rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-sage-600 dark:bg-sage-400 h-full transition-all duration-200" 
              style={{ width: `${progress}%` }} 
            />
          </div>

          {/* Speed Buttons */}
          <div className="flex items-center border border-paper-border dark:border-night-border rounded-lg overflow-hidden text-xs">
            {speeds.map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-1.5 py-0.5 transition-colors ${
                  speed === s
                    ? 'bg-sage-600 text-white font-medium'
                    : 'text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream dark:hover:bg-night-surface'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Play/Pause */}
          <button
            onClick={isPlaying ? pause : resume}
            className="p-2 rounded-full bg-sage-700 text-white hover:bg-sage-800 transition-colors shadow-sm"
            title={isPlaying ? 'Pause' : 'Resume'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Stop / Close */}
          <button
            onClick={stop}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary dark:hover:text-nightText-primary hover:bg-paper-cream dark:hover:bg-night-surface transition-colors"
            title="Close audio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
