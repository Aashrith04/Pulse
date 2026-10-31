import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { CanonicalStory } from '../types';
import { EditorialCard } from '../components/common/EditorialCard';
import { usePreferences } from '../context/PreferencesContext';
import { StateSelectorModal, ALL_INDIAN_STATES_AND_UTS } from '../components/common/StateSelectorModal';
import { MapPin, Filter, Loader2, Sparkles, ChevronDown } from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'governance', label: 'Governance & Admin' },
  { id: 'education', label: 'Education & Exams' },
  { id: 'infrastructure', label: 'Infrastructure & Transport' },
  { id: 'technology', label: 'Technology' },
  { id: 'economy', label: 'Business & Economy' },
  { id: 'agriculture', label: 'Agriculture' },
  { id: 'public-services', label: 'Public Services' },
];

export const StateNewsPage: React.FC = () => {
  const { selectedState, setSelectedState } = usePreferences();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stories, setStories] = useState<CanonicalStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.getStories({
      scope: 'state',
      state: selectedState,
      category: selectedCategory === 'all' ? undefined : selectedCategory,
    }).then(res => {
      if (isMounted) {
        setStories(res.stories || []);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, [selectedState, selectedCategory]);

  return (
    <div className="space-y-6 pb-16">
      {/* Header with State Selector Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-paper-border dark:border-night-border pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sage-700 dark:text-sage-400 mb-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>State Intelligence Desk</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary flex items-center gap-2">
            <span>{selectedState}</span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-xs font-sans font-medium px-2.5 py-1 rounded-full bg-paper-cream dark:bg-night-surface border border-paper-border dark:border-night-border text-sage-800 dark:text-sage-300 hover:border-sage-500 transition-colors inline-flex items-center gap-1"
            >
              <span>Change State</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </h1>
        </div>

        <div className="text-xs text-ink-muted">
          Showing verified developments from state gazettes and regional reporting.
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        <Filter className="w-3.5 h-3.5 text-ink-muted flex-shrink-0 mr-1" />
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-sage-600 text-white border-sage-600 font-medium'
                : 'border-paper-border dark:border-night-border text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream dark:hover:bg-night-surface'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Stories Grid */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2 text-ink-muted">
          <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
          <p className="text-sm">Retrieving state feeds for {selectedState}...</p>
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
            No active state stories found for {selectedState} in this category.
          </p>
          <p className="text-xs max-w-md mx-auto">
            Try switching categories or exploring other states. Pulse does not fabricate dummy regional news to fill pages.
          </p>
        </div>
      )}

      {/* State Selector Modal */}
      <StateSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};
