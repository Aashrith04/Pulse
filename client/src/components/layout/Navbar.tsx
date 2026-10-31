import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { usePreferences } from '../../context/PreferencesContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { StateSelectorModal } from '../common/StateSelectorModal';
import { CatchMeUpModal } from '../catchmeup/CatchMeUpModal';
import { 
  Sun, 
  Moon, 
  Bell, 
  Search, 
  MapPin, 
  History, 
  Languages, 
  Settings,
  User,
  LogOut
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { selectedState, readingLanguage } = usePreferences();
  const { unreadCount, setIsOpen: setOpenNotifs, isOpen: notifsOpen } = useNotifications();
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();
  const [isStateModalOpen, setIsStateModalOpen] = useState(false);
  const [isCatchUpOpen, setIsCatchUpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <>
      <header className="sticky top-0 z-30 bg-paper-light/95 dark:bg-night-bg/95 backdrop-blur-md border-b border-paper-border dark:border-night-border transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo & Tagline */}
            <div className="flex items-center gap-6">
              <Link to="/" className="flex flex-col group">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif text-2xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary group-hover:text-sage-700 dark:group-hover:text-sage-300 transition-colors">
                    PULSE
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-sage-600 dark:bg-sage-400" />
                </div>
                <span className="text-[10px] font-sans text-ink-muted dark:text-nightText-muted tracking-widest uppercase">
                  The world, understood.
                </span>
              </Link>

              {/* Date & State Header Pill */}
              <div className="hidden lg:flex items-center gap-2 text-xs text-ink-secondary dark:text-nightText-secondary border-l border-paper-borderSubtle dark:border-night-borderSubtle pl-4">
                <span>{currentDate}</span>
                <span className="text-stone-300 dark:text-stone-700">•</span>
                <button
                  onClick={() => setIsStateModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-paper-cream dark:hover:bg-night-surface font-medium text-sage-800 dark:text-sage-300 transition-colors"
                  title="Change your active Indian state"
                >
                  <MapPin className="w-3 h-3 text-sage-600 dark:text-sage-400" />
                  <span>{selectedState}</span>
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md hidden md:block">
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search developments, policies, or topics..."
                  className="w-full pl-8 pr-4 py-1.5 text-xs sm:text-sm rounded-full bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border text-ink-primary dark:text-nightText-primary placeholder:text-ink-subtle focus:outline-none focus:ring-1 focus:ring-sage-500 transition-colors"
                />
              </form>
            </div>

            {/* Actions: Catch Me Up, Notifications, Theme, Settings */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile State Button */}
              <button
                onClick={() => setIsStateModalOpen(true)}
                className="lg:hidden p-1.5 text-xs font-medium text-sage-800 dark:text-sage-300 hover:bg-paper-cream dark:hover:bg-night-surface rounded-md flex items-center gap-1"
                title="Change state"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{selectedState}</span>
              </button>

              {/* Catch Me Up Action */}
              <button
                onClick={() => setIsCatchUpOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-sage-50 dark:bg-sage-950/40 border border-sage-200/80 dark:border-sage-800/40 text-sage-800 dark:text-sage-300 hover:bg-sage-100 dark:hover:bg-sage-900/60 transition-colors"
                title="Review what changed recently"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Catch Me Up</span>
              </button>

              {/* Quiet Notification Bell */}
              <button
                onClick={() => setOpenNotifs(!notifsOpen)}
                className="relative p-2 rounded-full text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream dark:hover:bg-night-surface transition-colors"
                title="Quiet Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-terracotta-500" />
                )}
              </button>

              {/* Reading Language Indicator */}
              <Link
                to="/settings"
                className="hidden sm:flex items-center gap-1 px-2 py-1 rounded text-xs text-ink-muted hover:text-ink-primary dark:hover:text-nightText-primary"
                title="Change reading or interface language"
              >
                <Languages className="w-3.5 h-3.5 text-sage-600" />
                <span className="uppercase font-mono">{readingLanguage}</span>
              </Link>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream dark:hover:bg-night-surface transition-colors"
                title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`}
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>

              {/* Settings */}
              <Link
                to="/settings"
                className="p-2 rounded-full text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream dark:hover:bg-night-surface transition-colors"
                title="Settings & Preferences"
              >
                <Settings className="w-4 h-4" />
              </Link>

              {/* User Account / Sign In */}
              {isAuthenticated && user ? (
                <div className="flex items-center gap-1.5 pl-1">
                  <div 
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sage-100 dark:bg-sage-900/50 text-sage-900 dark:text-sage-200 border border-sage-200 dark:border-sage-800"
                    title={`Signed in as ${user.email}`}
                  >
                    <User className="w-3.5 h-3.5 text-sage-600" />
                    <span className="max-w-[90px] truncate hidden md:inline font-medium">
                      {user.fullName || user.email.split('@')[0]}
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className="p-1.5 rounded-full text-ink-muted hover:text-terracotta-600 hover:bg-paper-cream dark:hover:bg-night-surface transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openAuthModal('login')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-sage-700 hover:bg-sage-800 text-white shadow-sm transition-all"
                  title="Sign in to sync saved stories and vocabulary"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* State Selector Modal */}
      <StateSelectorModal
        isOpen={isStateModalOpen}
        onClose={() => setIsStateModalOpen(false)}
      />

      {/* Catch Me Up Modal */}
      <CatchMeUpModal
        isOpen={isCatchUpOpen}
        onClose={() => setIsCatchUpOpen(false)}
      />
    </>
  );
};
