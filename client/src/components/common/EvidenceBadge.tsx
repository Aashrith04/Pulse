import React from 'react';
import { EvidenceStatus } from '../../types';
import { ShieldCheck, CheckCircle2, FileText, AlertCircle, HelpCircle } from 'lucide-react';

interface Props {
  status: EvidenceStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<EvidenceStatus, {
  label: string;
  tooltip: string;
  bgLight: string;
  bgDark: string;
  textLight: string;
  textDark: string;
  borderLight: string;
  borderDark: string;
  icon: React.ElementType;
}> = {
  official_documentation: {
    label: 'Official Documentation',
    tooltip: 'Directly supported by official government gazettes, regulatory orders, or institution releases.',
    bgLight: 'bg-emerald-50/70',
    bgDark: 'dark:bg-emerald-950/30',
    textLight: 'text-emerald-800',
    textDark: 'dark:text-emerald-300',
    borderLight: 'border-emerald-200/80',
    borderDark: 'dark:border-emerald-800/50',
    icon: ShieldCheck,
  },
  corroborated_by_sources: {
    label: 'Corroborated by Distinct Sources',
    tooltip: 'Confirmed across independent journalistic investigations without relying on a single dispatch.',
    bgLight: 'bg-stone-100/80',
    bgDark: 'dark:bg-stone-900/40',
    textLight: 'text-stone-800',
    textDark: 'dark:text-stone-300',
    borderLight: 'border-stone-300/70',
    borderDark: 'dark:border-stone-700/60',
    icon: CheckCircle2,
  },
  reported_by_one_source: {
    label: 'Single Source Report',
    tooltip: 'Reported by one credible publisher; awaiting independent secondary verification.',
    bgLight: 'bg-paper-cream',
    bgDark: 'dark:bg-night-card',
    textLight: 'text-ink-secondary',
    textDark: 'dark:text-nightText-secondary',
    borderLight: 'border-paper-border',
    borderDark: 'dark:border-night-border',
    icon: FileText,
  },
  attributed_claim: {
    label: 'Attributed Claim',
    tooltip: 'Directly stated by an identifiable official or spokesperson, not yet independently audited.',
    bgLight: 'bg-blue-50/60',
    bgDark: 'dark:bg-blue-950/20',
    textLight: 'text-blue-800',
    textDark: 'dark:text-blue-300',
    borderLight: 'border-blue-200/60',
    borderDark: 'dark:border-blue-900/40',
    icon: HelpCircle,
  },
  developing_unverified: {
    label: 'Developing / Unverified',
    tooltip: 'Early-stage emerging development. Initial details subject to substantive revision.',
    bgLight: 'bg-amber-50/70',
    bgDark: 'dark:bg-amber-950/30',
    textLight: 'text-amber-800',
    textDark: 'dark:text-amber-300',
    borderLight: 'border-amber-200',
    borderDark: 'dark:border-amber-800/40',
    icon: AlertCircle,
  },
  conflicting_reports: {
    label: 'Conflicting Reporting',
    tooltip: 'Different credible outlets report materially contradictory numbers, statements, or timelines.',
    bgLight: 'bg-rose-50/80',
    bgDark: 'dark:bg-rose-950/30',
    textLight: 'text-rose-800',
    textDark: 'dark:text-rose-300',
    borderLight: 'border-rose-200',
    borderDark: 'dark:border-rose-800/50',
    icon: AlertCircle,
  },
};

export const EvidenceBadge: React.FC<Props> = ({ status, showIcon = true, size = 'sm' }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.reported_by_one_source;
  const Icon = cfg.icon;

  const sizeClasses = size === 'sm' 
    ? 'text-xs px-2 py-0.5 tracking-tight' 
    : 'text-xs px-2.5 py-1 tracking-normal';

  return (
    <span
      title={cfg.tooltip}
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border transition-colors ${sizeClasses} ${cfg.bgLight} ${cfg.bgDark} ${cfg.textLight} ${cfg.textDark} ${cfg.borderLight} ${cfg.borderDark}`}
    >
      {showIcon && <Icon className="w-3 h-3 flex-shrink-0" />}
      <span>{cfg.label}</span>
    </span>
  );
};
