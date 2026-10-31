import React, { useState } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import { MapPin, Search, X, Check } from 'lucide-react';

export const ALL_INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const StateSelectorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { selectedState, setSelectedState } = usePreferences();
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = ALL_INDIAN_STATES_AND_UTS.filter(s => 
    s.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleSelect = (state: string) => {
    setSelectedState(state);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-lg bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-paper-border dark:border-night-border">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-sage-600 dark:text-sage-400" />
            <div>
              <h3 className="font-serif text-lg font-semibold text-ink-primary dark:text-nightText-primary">
                Select Your State / UT
              </h3>
              <p className="text-xs text-ink-muted dark:text-nightText-muted">
                Personalize your localized state news feed (Default: India)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-ink-muted hover:text-ink-primary dark:hover:text-nightText-primary hover:bg-paper-cream dark:hover:bg-night-surface"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-paper-borderSubtle dark:border-night-borderSubtle">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Indian states or Union Territories..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-paper-light dark:bg-night-surface border border-paper-border dark:border-night-border text-ink-primary dark:text-nightText-primary placeholder:text-ink-subtle focus:outline-none focus:ring-1 focus:ring-sage-500"
            />
          </div>
        </div>

        {/* States List */}
        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
          {filtered.map(state => {
            const isSelected = selectedState.toLowerCase() === state.toLowerCase();
            return (
              <button
                key={state}
                onClick={() => handleSelect(state)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-md text-left transition-colors ${
                  isSelected
                    ? 'bg-sage-100/70 dark:bg-sage-900/30 text-sage-800 dark:text-sage-200 font-medium'
                    : 'text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream dark:hover:bg-night-surface'
                }`}
              >
                <span>{state}</span>
                {isSelected && <Check className="w-4 h-4 text-sage-600 dark:text-sage-400" />}
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-2 py-8 text-center text-sm text-ink-muted dark:text-nightText-muted">
              No matching state found for "{search}".
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-paper-cream/60 dark:bg-night-surface/60 border-t border-paper-borderSubtle dark:border-night-borderSubtle flex items-center justify-between text-xs text-ink-muted">
          <span>Active State: <strong className="text-ink-primary dark:text-nightText-primary">{selectedState}</strong></span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-sage-600 text-white rounded font-medium hover:bg-sage-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
