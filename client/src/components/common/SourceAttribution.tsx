import React from 'react';
import { Article } from '../../types';
import { ExternalLink, Check, Shield } from 'lucide-react';

interface Props {
  articles: Article[];
}

export const SourceAttribution: React.FC<Props> = ({ articles }) => {
  if (!articles || articles.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-ink-muted dark:text-nightText-muted border-t border-paper-borderSubtle dark:border-night-borderSubtle mt-3">
      <span className="font-medium text-ink-secondary dark:text-nightText-secondary">Sources:</span>
      {articles.map((art, idx) => (
        <a
          key={art.id || idx}
          href={art.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-sage-700 dark:hover:text-sage-300 underline decoration-paper-border hover:decoration-sage-500 transition-colors"
          title={`Read original dispatch on ${art.sourceName}`}
        >
          {art.evidenceLabel === 'official_documentation' ? (
            <Shield className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500" />
          )}
          <span>{art.sourceName}</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
        </a>
      ))}
    </div>
  );
};
