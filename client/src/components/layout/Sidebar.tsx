import React from 'react';
import { NavLink } from 'react-router-dom';
import { usePreferences } from '../../context/PreferencesContext';
import { 
  Home, 
  MapPin, 
  Flag, 
  Globe, 
  Clock, 
  Compass, 
  MessageSquare, 
  GraduationCap, 
  Bookmark, 
  Settings, 
  Shield 
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { selectedState } = usePreferences();

  const navItems = [
    { to: '/', label: "Today's Pulse", icon: Home },
    { to: '/state-news', label: 'State News', icon: MapPin, badge: selectedState },
    { to: '/national-news', label: 'National News', icon: Flag, badge: 'India' },
    { to: '/international-news', label: 'International News', icon: Globe },
    { to: '/hourly-pulse', label: 'Hourly Pulse', icon: Clock, highlight: true },
    { to: '/perspectives', label: 'Perspective Desk', icon: Compass },
    { to: '/ask', label: 'Ask the News', icon: MessageSquare },
    { to: '/vocabulary', label: 'Language & Vocab', icon: GraduationCap },
    { to: '/saved', label: 'Saved Stories', icon: Bookmark },
  ];

  return (
    <aside className="w-64 flex-shrink-0 hidden md:block py-6 pr-6 border-r border-paper-borderSubtle dark:border-night-borderSubtle">
      <nav className="space-y-1 sticky top-24">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-nightText-muted">
          Intelligence Feeds
        </div>

        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-paper-cream dark:bg-night-card text-sage-800 dark:text-sage-200 font-semibold'
                    : 'text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream/60 dark:hover:bg-night-surface/60 hover:text-ink-primary dark:hover:text-nightText-primary'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${item.highlight ? 'text-sage-600 dark:text-sage-400' : 'opacity-80'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-paper-borderSubtle dark:bg-night-border text-ink-muted dark:text-nightText-muted truncate max-w-[80px]">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}

        <div className="pt-6 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-nightText-muted">
          System & Settings
        </div>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              isActive
                ? 'bg-paper-cream dark:bg-night-card text-sage-800 dark:text-sage-200'
                : 'text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream/60 dark:hover:bg-night-surface/60'
            }`
          }
        >
          <Settings className="w-4 h-4 opacity-80" />
          <span>Preferences & Keys</span>
        </NavLink>

        <NavLink
          to="/admin"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              isActive
                ? 'bg-paper-cream dark:bg-night-card text-sage-800 dark:text-sage-200'
                : 'text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream/60 dark:hover:bg-night-surface/60'
            }`
          }
        >
          <Shield className="w-4 h-4 opacity-80" />
          <span>Admin & Ingestion</span>
        </NavLink>
      </nav>
    </aside>
  );
};
