import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { CanonicalStory, PerspectiveAnalysis } from '../types';
import { 
  Compass, 
  CheckCircle2, 
  HelpCircle, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Scale, 
  ShieldCheck, 
  Sparkles, 
  Loader2 
} from 'lucide-react';

export const PerspectivesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const storyIdParam = searchParams.get('storyId');

  const [stories, setStories] = useState<CanonicalStory[]>([]);
  const [selectedStory, setSelectedStory] = useState<CanonicalStory | null>(null);
  const [perspective, setPerspective] = useState<PerspectiveAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  // Load candidate stories
  useEffect(() => {
    api.getStories({ limit: 15 }).then(res => {
      const list = res.stories || [];
      setStories(list);

      const target = storyIdParam 
        ? list.find(s => s.id === storyIdParam) || list[0]
        : list[0];

      setSelectedStory(target || null);
    }).catch(() => setLoading(false));
  }, [storyIdParam]);

  // Load perspective for selected story
  useEffect(() => {
    if (!selectedStory) return;
    setLoading(true);

    api.getPerspective(selectedStory.id)
      .then(p => {
        setPerspective(p);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [selectedStory]);

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="border-b border-paper-border dark:border-night-border pb-5">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sage-700 dark:text-sage-400 mb-1">
          <Compass className="w-4 h-4" />
          <span>Core Differentiating Feature</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
          The Perspective Desk
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted dark:text-nightText-muted mt-1 max-w-3xl leading-relaxed">
          Understanding the implications of news without telling you what opinion you must hold. Strict separation of established facts, preliminary claims, and institutional viewpoints.
        </p>
      </div>

      {/* Story Selector Carousel / Pill Switcher */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-ink-muted block">Select Story to Examine:</span>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {stories.map(s => {
            const isSelected = selectedStory?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedStory(s);
                  setSearchParams({ storyId: s.id });
                }}
                className={`text-xs px-3.5 py-2 rounded-lg border text-left flex-shrink-0 max-w-xs truncate transition-all ${
                  isSelected
                    ? 'bg-sage-600 text-white border-sage-600 font-medium shadow-sm'
                    : 'bg-paper-card dark:bg-night-card border-paper-border dark:border-night-border text-ink-secondary dark:text-nightText-secondary hover:border-stone-400'
                }`}
              >
                {s.title}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-ink-muted">
          <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
          <p className="font-serif text-lg">Synthesizing verified perspectives & evidence breakdown...</p>
        </div>
      ) : perspective && selectedStory ? (
        <div className="space-y-8 animate-fade-in">
          {/* Main Selected Story Headline Card */}
          <div className="p-6 sm:p-8 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial">
            <div className="flex items-center gap-2 text-xs text-sage-700 dark:text-sage-400 font-semibold uppercase tracking-wider mb-2">
              <span>{selectedStory.category}</span>
              <span>•</span>
              <span>{selectedStory.geographicScope}</span>
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink-primary dark:text-nightText-primary mb-4 leading-snug">
              {selectedStory.title}
            </h2>

            {/* A. WHAT HAPPENED */}
            <div className="mb-6 space-y-1.5">
              <span className="text-xs uppercase tracking-wider font-bold text-ink-muted dark:text-nightText-muted block">
                A. What Happened (Factual Record)
              </span>
              <p className="text-sm sm:text-base text-ink-primary dark:text-nightText-primary leading-relaxed">
                {perspective.whatHappened}
              </p>
            </div>

            {/* B. THE GENERAL TAKE (Clearly labeled as AI analysis) */}
            <div className="p-4 rounded-lg bg-paper-cream dark:bg-night-surface/60 border-l-4 border-sage-600 dark:border-sage-400 mb-6 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-sage-800 dark:text-sage-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sage-600" />
                  B. The General Take (AI-Generated Analysis)
                </span>
                <span className="text-[10px] text-ink-muted italic">
                  Not a factual news dispatch
                </span>
              </div>
              <p className="text-xs sm:text-sm text-ink-secondary dark:text-nightText-secondary leading-relaxed">
                {perspective.generalTake}
              </p>
            </div>

            {/* C. WHY IT MATTERS */}
            <div className="mb-6 space-y-1.5">
              <span className="text-xs uppercase tracking-wider font-bold text-ink-muted dark:text-nightText-muted block">
                C. Why It Matters
              </span>
              <p className="text-sm text-ink-secondary dark:text-nightText-secondary leading-relaxed">
                {perspective.whyItMatters}
              </p>
            </div>
          </div>

          {/* D. DIFFERENT PERSPECTIVES & STAKEHOLDERS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Arguments in Favor */}
            <div className="p-6 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Arguments in Favor</span>
              </div>

              {perspective.perspectivesInFavor.map((p, idx) => (
                <div key={idx} className="space-y-1.5 text-xs sm:text-sm">
                  <p className="font-medium text-ink-primary dark:text-nightText-primary leading-relaxed">
                    "{p.argument}"
                  </p>
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    <span>Source: <strong className="text-ink-secondary dark:text-nightText-secondary">{p.citedSource}</strong></span>
                    {p.affectedGroup && <span>• ({p.affectedGroup})</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Arguments Against & Concerns */}
            <div className="p-6 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-terracotta-700 dark:text-terracotta-400 border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
                <TrendingDown className="w-4 h-4 text-terracotta-600" />
                <span>Concerns & Counterpoints</span>
              </div>

              {perspective.perspectivesAgainst.map((p, idx) => (
                <div key={idx} className="space-y-1.5 text-xs sm:text-sm">
                  <p className="font-medium text-ink-primary dark:text-nightText-primary leading-relaxed">
                    "{p.argument}"
                  </p>
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    <span>Source: <strong className="text-ink-secondary dark:text-nightText-secondary">{p.citedSource}</strong></span>
                    {p.affectedGroup && <span>• ({p.affectedGroup})</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* E. EVIDENCE & UNCERTAINTY MATRIX */}
          <div className="p-6 sm:p-8 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-6">
            <div className="flex items-center justify-between border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sage-600" />
                <h3 className="font-serif text-xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
                  E. Evidence & Uncertainty Audit
                </h3>
              </div>
              <span className="text-xs text-ink-muted">Transparent evidential accounting</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Well Established */}
              <div className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/30 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Well Established
                </span>
                <ul className="text-xs text-ink-secondary dark:text-nightText-secondary space-y-1.5 list-disc pl-4">
                  {perspective.evidenceWellEstablished.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Preliminary Evidence */}
              <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-800/30 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                  Preliminary Evidence
                </span>
                <ul className="text-xs text-ink-secondary dark:text-nightText-secondary space-y-1.5 list-disc pl-4">
                  {perspective.evidencePreliminary.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Disputed Claims */}
              <div className="p-4 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/30 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Disputed Claims
                </span>
                <ul className="text-xs text-ink-secondary dark:text-nightText-secondary space-y-1.5 list-disc pl-4">
                  {perspective.evidenceDisputed.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Missing Information */}
              <div className="p-4 rounded-lg bg-stone-100/70 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-stone-600" />
                  Missing Info
                </span>
                <ul className="text-xs text-ink-secondary dark:text-nightText-secondary space-y-1.5 list-disc pl-4">
                  {perspective.evidenceMissing.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* F & G. CONSEQUENCES & WHAT TO WATCH NEXT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Possible Consequences */}
            <div className="p-6 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-4">
              <h3 className="font-serif text-lg font-bold text-ink-primary dark:text-nightText-primary border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
                F. Possible Consequences (Projected Outcomes)
              </h3>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                    Plausible Positive Consequences:
                  </span>
                  <ul className="text-xs text-ink-secondary dark:text-nightText-secondary space-y-1 list-disc pl-4">
                    {perspective.possibleConsequencesPositive.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="text-xs font-semibold text-terracotta-700 dark:text-terracotta-400 uppercase tracking-wider block">
                    Plausible Negative Risks:
                  </span>
                  <ul className="text-xs text-ink-secondary dark:text-nightText-secondary space-y-1 list-disc pl-4">
                    {perspective.possibleConsequencesNegative.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* What to Watch Next */}
            <div className="p-6 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-4">
              <h3 className="font-serif text-lg font-bold text-ink-primary dark:text-nightText-primary border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
                G. What to Watch Next (Verifiable Milestones)
              </h3>

              <div className="space-y-3">
                {perspective.whatToWatchNext.map((w, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-paper-cream/60 dark:bg-night-surface/60 border border-paper-borderSubtle dark:border-night-borderSubtle space-y-1 text-xs">
                    <p className="font-medium text-ink-primary dark:text-nightText-primary">
                      {w.eventDescription}
                    </p>
                    <div className="flex items-center justify-between text-ink-muted pt-1">
                      <span>Timeline: <strong>{w.expectedTimeline}</strong></span>
                      <span>Source: {w.verifiableSource}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* H. PERSPECTIVE COMPARISON MATRIX */}
          {perspective.perspectiveComparison && perspective.perspectiveComparison.length > 0 && (
            <div className="p-6 sm:p-8 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-5">
              <div className="flex items-center gap-2 border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-3">
                <Scale className="w-5 h-5 text-sage-600" />
                <h3 className="font-serif text-xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
                  H. Structured Perspective Comparison
                </h3>
              </div>

              <div className="space-y-4">
                {perspective.perspectiveComparison.map((comp, idx) => (
                  <div key={idx} className="border border-paper-border dark:border-night-border rounded-lg overflow-hidden">
                    <div className="bg-paper-cream dark:bg-night-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink-primary dark:text-nightText-primary border-b border-paper-border dark:border-night-border">
                      Topic: {comp.topic}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-paper-border dark:divide-night-border text-xs sm:text-sm">
                      {/* Position A */}
                      <div className="p-4 space-y-2">
                        <span className="font-semibold text-sage-800 dark:text-sage-300 block">
                          {comp.positionA.title}
                        </span>
                        <p className="text-ink-secondary dark:text-nightText-secondary">
                          {comp.positionA.argument}
                        </p>
                        <p className="text-xs text-ink-muted italic">
                          <strong className="font-medium">Limitation: </strong>{comp.positionA.limitation}
                        </p>
                      </div>

                      {/* Position B */}
                      <div className="p-4 space-y-2">
                        <span className="font-semibold text-stone-800 dark:text-stone-300 block">
                          {comp.positionB.title}
                        </span>
                        <p className="text-ink-secondary dark:text-nightText-secondary">
                          {comp.positionB.argument}
                        </p>
                        <p className="text-xs text-ink-muted italic">
                          <strong className="font-medium">Limitation: </strong>{comp.positionB.limitation}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
