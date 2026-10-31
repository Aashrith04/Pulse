import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, MapPin, Clock, Compass, MessageSquare, GraduationCap } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const items = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/state-news', label: 'State', icon: MapPin },
    { to: '/hourly-pulse', label: 'Hourly', icon: Clock },
    { to: '/perspectives', label: 'Perspectives', icon: Compass },
    { to: '/ask', label: 'Ask AI', icon: MessageSquare },
    { to: '/vocabulary', label: 'Vocab', icon: GraduationCap },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-paper-card dark:bg-night-card border-t border-paper-border dark:border-night-border px-2 py-1.5 flex items-center justify-around shadow-md">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                isActive
                  ? 'text-sage-800 dark:text-sage-300 font-bold'
                  : 'text-ink-muted dark:text-nightText-muted hover:text-ink-primary'
              }`
            }
          >
            <Icon className="w-4 h-4 mb-0.5" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
};
