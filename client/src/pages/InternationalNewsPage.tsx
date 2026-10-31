import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { CanonicalStory } from '../types';
import { EditorialCard } from '../components/common/EditorialCard';
import { Globe, Filter, Loader2, Compass } from 'lucide-react';

const REGIONS = [
  { id: 'all', label: 'All Regions' },
  { id: 'asia', label: 'Asia' },
  { id: 'europe', label: 'Europe' },
  { id: 'north-america', label: 'North America' },
  { id: 'middle-east', label: 'Middle East' },
  { id: 'africa', label: 'Africa' },
  { id: 'global', label: 'Multilateral & UN' },
];

export const InternationalNewsPage: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [stories, setStories] = useState<CanonicalStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.getStories({
      scope: 'international',
    }).then(res => {
      if (isMounted) {
        setStories(res.stories || []);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, [selectedRegion]);

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-paper-border dark:border-night-border pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sage-700 dark:text-sage-400 mb-1">
            <Globe className="w-3.5 h-3.5" />
            <span>International Intelligence Desk</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
            Around the World
          </h1>
        </div>

        <div className="text-xs text-ink-muted">
          Global diplomacy, climate, technology governance, and economic transitions.
        </div>
      </div>

      {/* Region Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        <Filter className="w-3.5 h-3.5 text-ink-muted flex-shrink-0 mr-1" />
        {REGIONS.map(reg => (
          <button
            key={reg.id}
            onClick={() => setSelectedRegion(reg.id)}
            className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
              selectedRegion === reg.id
                ? 'bg-sage-600 text-white border-sage-600 font-medium'
                : 'border-paper-border dark:border-night-border text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream dark:hover:bg-night-surface'
            }`}
          >
            {reg.label}
          </button>
        ))}
      </div>

      {/* Stories Grid */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2 text-ink-muted">
          <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
          <p className="text-sm">Retrieving international dispatches...</p>
        </div>
      ) : stories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {stories.map(story => (
            <EditorialCard key={story.id} story={story} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-ink-muted bg-paper-cream/40 dark:bg-night-surface/40 rounded-xl border border-dashed border-paper-border dark:border-night-border p-8">
          <p className="font-serif text-lg text-ink-primary dark:text-nightText-primary mb-1">
            No international developments matching this filter.
          </p>
        </div>
      )}
    </div>
  );
};
