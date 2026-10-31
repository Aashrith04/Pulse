import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { NewsSource } from '../types';
import { 
  Shield, 
  Activity, 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Cpu, 
  Server, 
  Radio,
  Key
} from 'lucide-react';

export const AdminPage: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    // Scrub legacy persistent storage
    localStorage.removeItem('pulse_admin_key');
    return sessionStorage.getItem('pulse_admin_key') || '';
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInputVal, setKeyInputVal] = useState('');

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.getAdminDiagnostics(),
      api.getSources(),
    ]).then(([diagRes, srcRes]) => {
      setDiagnostics(diagRes);
      setSources(srcRes || []);
      setLoading(false);
    }).catch((err) => {
      if (err.message?.includes('403') || err.message?.includes('Access denied')) {
        setActionMessage('Admin authorization required. Click "Configure Key" to start an ephemeral admin session.');
      }
      setLoading(false);
    });
  };

  const handleSaveAdminKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInputVal.trim()) return;
    const cleanKey = keyInputVal.trim();
    sessionStorage.setItem('pulse_admin_key', cleanKey);
    localStorage.removeItem('pulse_admin_key');
    setAdminKey(cleanKey);
    setShowKeyInput(false);
    setKeyInputVal('');
    setActionMessage('Session Admin Key saved (active for this browser tab only). Refreshing diagnostics...');
    fetchAll();
  };

  const handleClearAdminKey = () => {
    sessionStorage.removeItem('pulse_admin_key');
    localStorage.removeItem('pulse_admin_key');
    setAdminKey('');
    setShowKeyInput(false);
    setActionMessage('Admin session ended. Key cleared from browser memory.');
    fetchAll();
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleTriggerIngestion = async () => {
    setTriggering(true);
    setActionMessage(null);
    try {
      const res = await api.triggerIngestion();
      setActionMessage(`Ingestion triggered: ${res.result?.articlesCount || 0} articles fetched.`);
      fetchAll();
    } catch (e: any) {
      setActionMessage(`Error: ${e.message}`);
    } finally {
      setTriggering(false);
    }
  };

  const handleTriggerBriefing = async () => {
    setTriggering(true);
    setActionMessage(null);
    try {
      const res = await api.generateBriefing('global');
      setActionMessage(`Generated test briefing: ID ${res.briefing.id}`);
      fetchAll();
    } catch (e: any) {
      setActionMessage(`Error: ${e.message}`);
    } finally {
      setTriggering(false);
    }
  };

  const handleToggleSource = async (source: NewsSource) => {
    try {
      await api.updateSource(source.id, { isEnabled: !source.isEnabled });
      setSources(prev => prev.map(s => s.id === source.id ? { ...s, isEnabled: !s.isEnabled } : s));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-paper-border dark:border-night-border pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sage-700 dark:text-sage-400 mb-1">
            <Shield className="w-3.5 h-3.5" />
            <span>Administrative Console</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
            System Diagnostics & Ingestion Health
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Monitor RSS feed adapters, deduplication metrics, scheduled background workers, and AI request logs.
          </p>
        </div>

        {/* Safe Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTriggerIngestion}
            disabled={triggering}
            className="px-3 py-1.5 rounded-lg bg-sage-600 text-white text-xs font-medium hover:bg-sage-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${triggering ? 'animate-spin' : ''}`} />
            <span>Poll Live RSS Feeds</span>
          </button>

          <button
            onClick={handleTriggerBriefing}
            disabled={triggering}
            className="px-3 py-1.5 rounded-lg bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-xs font-medium hover:bg-stone-900 inline-flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Run Test Briefing</span>
          </button>

          <button
            onClick={() => setShowKeyInput(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
              adminKey 
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' 
                : 'border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-ink-secondary dark:text-nightText-secondary hover:bg-paper-cream'
            }`}
            title="Configure Admin Key for authenticated administrative triggers"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{adminKey ? 'Admin Key Set' : 'Configure Key'}</span>
          </button>
        </div>
      </div>

      {showKeyInput && (
        <form onSubmit={handleSaveAdminKey} className="p-4 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-[11px] font-semibold uppercase text-ink-muted mb-1">Ephemeral Admin Session Secret (Tab Session Only)</label>
            <input
              type="password"
              value={keyInputVal}
              onChange={(e) => setKeyInputVal(e.target.value)}
              placeholder="Paste ADMIN_API_KEY from server/.env..."
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-paper-border dark:border-night-border bg-paper-cream/60 dark:bg-night-surface text-ink-primary dark:text-nightText-primary font-mono focus:outline-none focus:ring-1 focus:ring-sage-600"
            />
          </div>
          <div className="flex items-center gap-2 self-end">
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-sage-600 text-white text-xs font-medium hover:bg-sage-700"
            >
              Start Admin Session
            </button>
            {adminKey && (
              <button
                type="button"
                onClick={handleClearAdminKey}
                className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                End Session / Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowKeyInput(false)}
              className="px-2.5 py-1.5 text-xs text-ink-muted hover:text-ink-primary"
            >
              Close
            </button>
          </div>
        </form>
      )}

      {actionMessage && (
        <div className="p-3 rounded-lg bg-paper-cream dark:bg-night-surface border border-paper-border text-xs text-ink-primary dark:text-nightText-primary">
          {actionMessage}
        </div>
      )}

      {/* METRIC TILES */}
      {diagnostics?.diagnostics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial">
            <span className="text-[11px] font-semibold uppercase text-ink-muted block mb-1">Canonical Stories</span>
            <span className="font-serif text-2xl font-bold text-ink-primary dark:text-nightText-primary">
              {diagnostics.diagnostics.storiesCount}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial">
            <span className="text-[11px] font-semibold uppercase text-ink-muted block mb-1">Articles Ingested</span>
            <span className="font-serif text-2xl font-bold text-ink-primary dark:text-nightText-primary">
              {diagnostics.diagnostics.articlesCount}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial">
            <span className="text-[11px] font-semibold uppercase text-ink-muted block mb-1">Hourly Briefings</span>
            <span className="font-serif text-2xl font-bold text-ink-primary dark:text-nightText-primary">
              {diagnostics.diagnostics.briefingsCount}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial">
            <span className="text-[11px] font-semibold uppercase text-ink-muted block mb-1">Active Sources</span>
            <span className="font-serif text-2xl font-bold text-sage-700 dark:text-sage-400">
              {diagnostics.diagnostics.activeSourcesCount} / {diagnostics.diagnostics.sourcesCount}
            </span>
          </div>
        </div>
      )}

      {/* SECTION: SOURCES TABLE */}
      <div className="p-6 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-4">
        <div className="flex items-center justify-between border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-sage-800 dark:text-sage-300">
            <Radio className="w-4 h-4 text-sage-600" />
            <span>Configured Reliable News Feeds</span>
          </div>
          <span className="text-xs text-ink-muted">Poll interval: 30 minutes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper-cream/60 dark:bg-night-surface/60 text-ink-muted uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3">Source Name</th>
                <th className="p-3">Trust Tier</th>
                <th className="p-3">Scope</th>
                <th className="p-3">Status</th>
                <th className="p-3">Last Fetch</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-borderSubtle dark:divide-night-borderSubtle">
              {sources.map(source => (
                <tr key={source.id} className="hover:bg-paper-cream/30 dark:hover:bg-night-surface/30">
                  <td className="p-3 font-semibold text-ink-primary dark:text-nightText-primary">
                    <div>{source.name}</div>
                    <span className="text-[10px] text-ink-muted font-normal font-mono">{source.rssUrl || source.url}</span>
                  </td>
                  <td className="p-3 capitalize text-ink-secondary dark:text-nightText-secondary">
                    {source.trustTier.replace(/_/g, ' ')}
                  </td>
                  <td className="p-3 capitalize text-ink-secondary dark:text-nightText-secondary">
                    {source.geographicScope} {source.state ? `(${source.state})` : ''}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      source.isEnabled
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-400'
                    }`}>
                      {source.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="p-3 text-ink-muted text-[11px]">
                    {source.lastFetchedAt 
                      ? new Date(source.lastFetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Pending'}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleToggleSource(source)}
                      className="text-xs text-sage-700 dark:text-sage-300 hover:underline"
                    >
                      {source.isEnabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION: INGESTION LOGS & BACKGROUND SCHEDULER STATUS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scheduler Status */}
        <div className="p-6 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-sage-800 dark:text-sage-300 border-b border-paper-borderSubtle pb-2">
            <Server className="w-4 h-4 text-sage-600" />
            <span>Server-Side Background Workers</span>
          </div>

          <div className="space-y-2.5 text-xs text-ink-secondary dark:text-nightText-secondary">
            <div className="flex items-center justify-between">
              <span>Ingestion Cron Worker:</span>
              <strong className="font-mono text-ink-primary dark:text-nightText-primary">*/30 * * * * (every 30m)</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Hourly Pulse Generator:</span>
              <strong className="font-mono text-ink-primary dark:text-nightText-primary">0 * * * * (hourly)</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Quiet Notification Evaluator:</span>
              <strong className="font-mono text-ink-primary dark:text-nightText-primary">*/15 * * * * (every 15m)</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Browser Independence:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">100% Server Managed</span>
            </div>
          </div>
        </div>

        {/* AI Metrics */}
        <div className="p-6 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-sage-800 dark:text-sage-300 border-b border-paper-borderSubtle pb-2">
            <Cpu className="w-4 h-4 text-sage-600" />
            <span>Recent AI Activity & Logs</span>
          </div>

          <div className="space-y-2 text-xs">
            {diagnostics?.aiLogs && diagnostics.aiLogs.length > 0 ? (
              diagnostics.aiLogs.slice(0, 5).map((log: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-paper-cream/60 dark:bg-night-surface/60 border border-paper-borderSubtle">
                  <span className="capitalize font-medium">{log.taskType} ({log.provider})</span>
                  <span className="text-ink-muted">{log.latencyMs}ms</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-ink-muted italic py-4 text-center">No AI request errors logged.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
