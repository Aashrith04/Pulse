import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { HourlyPulseBriefing, GeographicScope } from '../types';
import { usePreferences } from '../context/PreferencesContext';
import { Link } from 'react-router-dom';
import { 
  Clock, 
  Sparkles, 
  RefreshCw, 
  ExternalLink, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Calendar 
} from 'lucide-react';
import { EvidenceBadge } from '../components/common/EvidenceBadge';

export const HourlyPulsePage: React.FC = () => {
  const { selectedState } = usePreferences();
  const [scope, setScope] = useState<GeographicScope>('global');
  const [briefings, setBriefings] = useState<HourlyPulseBriefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchBriefings = () => {
    setLoading(true);
    api.getBriefings(scope, scope === 'state' ? selectedState : undefined)
      .then(res => {
        setBriefings(res.briefings || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBriefings();
  }, [scope, selectedState]);

  const handleManualGenerate = async () => {
    setGenerating(true);
    try {
      await api.generateBriefing(scope, scope === 'state' ? selectedState : undefined);
      fetchBriefings();
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const activeBriefing = briefings[0];

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-paper-border dark:border-night-border pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sage-700 dark:text-sage-400 mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Signature Feature</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
            Hourly World Pulse
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Automated intelligence synthesized each hour from newly verified developments and official updates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-paper-cream dark:bg-night-surface border border-paper-border dark:border-night-border hover:border-sage-500 text-ink-primary dark:text-nightText-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin text-sage-600' : ''}`} />
            <span>{generating ? 'Synthesizing...' : 'Generate Fresh Briefing'}</span>
          </button>
        </div>
      </div>

      {/* Scope Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
        <span className="text-xs font-medium text-ink-muted mr-1">Scope:</span>
        {(['global', 'national', 'state', 'international'] as const).map(s => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
              scope === s
                ? 'bg-sage-600 text-white border-sage-600 font-medium'
                : 'border-paper-border dark:border-night-border text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream dark:hover:bg-night-surface'
            }`}
          >
            {s === 'state' ? `${selectedState} (State)` : s}
          </button>
        ))}
      </div>

      {/* Active Latest Briefing Card */}
      {loading ? (
        <div className="py-16 text-center text-ink-muted">
          <RefreshCw className="w-6 h-6 animate-spin text-sage-600 mx-auto mb-2" />
          <p className="text-sm">Synthesizing latest hourly intelligence...</p>
        </div>
      ) : activeBriefing ? (
        <div className="space-y-6">
          {/* Main Briefing Banner */}
          <div className="p-6 sm:p-8 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-paper-borderSubtle dark:border-night-borderSubtle mb-6 text-xs text-ink-muted">
              <div className="flex items-center gap-2 font-mono">
                <Calendar className="w-3.5 h-3.5 text-sage-600" />
                <span>
                  Window: {new Date(activeBriefing.timeWindowStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(activeBriefing.timeWindowEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium text-[11px]">
                  Freshness: {activeBriefing.dataFreshnessMinutes}m ago
                </span>
                <span>•</span>
                <span>{activeBriefing.sourceCount} verified source citations</span>
              </div>
            </div>

            {/* Overview */}
            <div className="mb-8">
              <span className="text-xs uppercase tracking-wider font-semibold text-sage-700 dark:text-sage-400 block mb-2">
                Executive Overview
              </span>
              <p className="font-serif text-lg sm:text-xl text-ink-primary dark:text-nightText-primary leading-relaxed">
                {activeBriefing.summaryOverview}
              </p>
            </div>

            {/* What Changed Since Previous */}
            {activeBriefing.whatChangedSincePrevious && (
              <div className="p-4 rounded-lg bg-paper-cream dark:bg-night-surface/50 border border-paper-borderSubtle dark:border-night-borderSubtle mb-8">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-sage-800 dark:text-sage-300 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-sage-600" />
                  <span>What Changed Since Last Briefing:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink-secondary dark:text-nightText-secondary mb-3">
                  <div>• <strong>{activeBriefing.whatChangedSincePrevious.newStoriesCount}</strong> new developments confirmed.</div>
                  <div>• <strong>{activeBriefing.whatChangedSincePrevious.substantiveUpdatesCount}</strong> stories received substantive updates.</div>
                </div>
                {activeBriefing.whatChangedSincePrevious.highlights.map((hl, idx) => (
                  <p key={idx} className="text-xs text-ink-muted italic">
                    {hl}
                  </p>
                ))}
              </div>
            )}

            {/* Important Developments List */}
            <div className="space-y-6">
              <h2 className="font-serif text-xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
                Significant Developments in this Hour ({activeBriefing.importantDevelopments.length})
              </h2>

              <div className="divide-y divide-paper-borderSubtle dark:divide-night-borderSubtle">
                {activeBriefing.importantDevelopments.map((dev, idx) => (
                  <div key={idx} className="py-5 first:pt-0 last:pb-0 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        to={`/stories/${dev.storyId}`}
                        className="font-serif text-lg font-bold text-ink-primary dark:text-nightText-primary hover:text-sage-700 dark:hover:text-sage-300 transition-colors"
                      >
                        {dev.headline}
                      </Link>
                      <EvidenceBadge status={dev.evidenceStatus} size="sm" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
                      <div className="space-y-1">
                        <span className="font-semibold text-ink-muted text-xs uppercase tracking-wider block">What Happened</span>
                        <p className="text-ink-secondary dark:text-nightText-secondary leading-relaxed">{dev.whatHappened}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="font-semibold text-ink-muted text-xs uppercase tracking-wider block">Why It Matters</span>
                        <p className="text-ink-secondary dark:text-nightText-secondary leading-relaxed">{dev.whyItMatters}</p>
                      </div>

                      <div className="space-y-1 bg-paper-cream/60 dark:bg-night-surface/60 p-3 rounded-lg border border-paper-borderSubtle dark:border-night-borderSubtle">
                        <span className="font-semibold text-sage-800 dark:text-sage-300 text-xs uppercase tracking-wider block">What Changed</span>
                        <p className="text-ink-primary dark:text-nightText-primary leading-relaxed">{dev.whatChanged}</p>
                      </div>
                    </div>

                    {/* Source Links */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-ink-muted">
                      <span>Citations:</span>
                      {dev.sources.map((src, sIdx) => (
                        <a
                          key={sIdx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-sage-700 dark:hover:text-sage-300 underline"
                        >
                          <span>{src.name}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-16 text-center text-ink-muted bg-paper-cream/40 rounded-xl border border-dashed p-8">
          No briefings generated for {scope} yet. Click "Generate Fresh Briefing" above.
        </div>
      )}
    </div>
  );
};
