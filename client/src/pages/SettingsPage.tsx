import React, { useState, useEffect } from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../utils/api';
import { ALL_INDIAN_STATES_AND_UTS } from '../components/common/StateSelectorModal';
import { 
  Settings, 
  MapPin, 
  Languages, 
  Bell, 
  Cpu, 
  ShieldCheck, 
  Check, 
  Key, 
  Moon, 
  Sun,
  Loader2
} from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'hi', label: 'Hindi (हिंदी)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'or', label: 'Odia (ଓଡ଼ିଆ)' },
  { code: 'ur', label: 'Urdu (اردو)' },
];

export const SettingsPage: React.FC = () => {
  const { preferences, updatePreferences } = usePreferences();
  const { theme, setTheme } = useTheme();

  // Local form states
  const [stateVal, setStateVal] = useState(preferences.state);
  const [readingLang, setReadingLang] = useState(preferences.newsReadingLanguage);
  const [interfaceLang, setInterfaceLang] = useState(preferences.interfaceLanguage);
  const [summaryLen, setSummaryLen] = useState(preferences.summaryLength);
  const [enableNotifs, setEnableNotifs] = useState(preferences.enableNotifications);
  const [quietStart, setQuietStart] = useState(preferences.quietHoursStart);
  const [quietEnd, setQuietEnd] = useState(preferences.quietHoursEnd);

  // AI Configuration State
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [primaryProvider, setPrimaryProvider] = useState('fallback');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [xaiKey, setXaiKey] = useState('');
  const [isSavingAI, setIsSavingAI] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Web Push Subscription State
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getAIConfig().then(res => {
      setAiConfig(res);
      if (res.config?.primaryProvider) setPrimaryProvider(res.config.primaryProvider);
    }).catch(() => {});

    // Check service worker and notification support
    if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      setPushSupported(true);
      setPushPermission(Notification.permission);
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsPushSubscribed(Boolean(sub));
        });
      });
    }
  }, []);

  const handleTogglePushNotifications = async () => {
    if (!pushSupported) return;
    setIsPushLoading(true);
    setPushStatusMessage(null);

    try {
      if (isPushSubscribed) {
        // Unsubscribe
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await api.unsubscribePush(sub.endpoint);
          await sub.unsubscribe();
          setIsPushSubscribed(false);
          setPushStatusMessage('Successfully unsubscribed from browser push notifications.');
        }
      } else {
        // Request Permission
        const permission = await Notification.requestPermission();
        setPushPermission(permission);

        if (permission !== 'granted') {
          setPushStatusMessage('Browser notification permission was not granted.');
          setIsPushLoading(false);
          return;
        }

        // Register Service Worker
        await navigator.serviceWorker.register('/sw.js');
        const reg = await navigator.serviceWorker.ready;

        // Fetch Public VAPID Key from Backend
        const { publicKey } = await api.getPushPublicKey();

        // Convert base64 VAPID to Uint8Array
        const rawData = window.atob(publicKey.replace(/-/g, '+').replace(/_/g, '/'));
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }

        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray,
        });

        const subJson = subscription.toJSON();
        await api.subscribePush({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh || '',
            auth: subJson.keys?.auth || '',
          },
        });

        setIsPushSubscribed(true);
        setPushStatusMessage('Browser push notifications enabled with quiet interval limits.');
      }
    } catch (err: any) {
      console.error(err);
      setPushStatusMessage(err.message || 'Failed to update push subscription.');
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleTestPushNotification = async () => {
    setIsPushLoading(true);
    try {
      const res = await api.sendTestPush();
      setPushStatusMessage(`Test notification sent! Delivered to ${res.deliveredDevices} device(s).`);
    } catch (err: any) {
      setPushStatusMessage('Failed to deliver test notification: ' + err.message);
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    await updatePreferences({
      state: stateVal,
      newsReadingLanguage: readingLang,
      interfaceLanguage: interfaceLang,
      summaryLength: summaryLen,
      enableNotifications: enableNotifs,
      quietHoursStart: quietStart,
      quietHoursEnd: quietEnd,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSaveAIKeys = async () => {
    setIsSavingAI(true);
    try {
      const res = await api.saveAIConfig({
        primaryProvider,
        ...(openaiKey && { openaiApiKey: openaiKey }),
        ...(anthropicKey && { anthropicApiKey: anthropicKey }),
        ...(xaiKey && { xaiApiKey: xaiKey }),
      });
      setAiConfig(res);
      setOpenaiKey('');
      setAnthropicKey('');
      setXaiKey('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingAI(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="border-b border-paper-border dark:border-night-border pb-5">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sage-700 dark:text-sage-400 mb-1">
          <Settings className="w-3.5 h-3.5" />
          <span>System & Preferences</span>
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
          Preferences & Intelligence Configuration
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted dark:text-nightText-muted mt-1 leading-relaxed">
          Configure geographic feeds, language settings, quiet intervals, and multi-model AI routing.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Settings successfully updated and saved.</span>
        </div>
      )}

      {/* FORM: Preferences */}
      <form onSubmit={handleSavePreferences} className="space-y-6">
        {/* SECTION 1: REGION & LOCALIZATION */}
        <div className="p-6 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-5">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-sage-800 dark:text-sage-300 border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
            <MapPin className="w-4 h-4 text-sage-600" />
            <span>Geographic Preferences</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-primary dark:text-nightText-primary mb-1">
                Default Country
              </label>
              <input
                type="text"
                disabled
                value="India (IN)"
                className="w-full px-3 py-2 text-xs rounded-lg bg-paper-light dark:bg-night-surface border border-paper-border dark:border-night-border text-ink-muted cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-primary dark:text-nightText-primary mb-1">
                Active Indian State or Union Territory
              </label>
              <select
                value={stateVal}
                onChange={e => setStateVal(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-paper-light dark:bg-night-surface border border-paper-border dark:border-night-border text-ink-primary dark:text-nightText-primary focus:outline-none focus:ring-1 focus:ring-sage-500"
              >
                {ALL_INDIAN_STATES_AND_UTS.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: LANGUAGES */}
        <div className="p-6 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-5">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-sage-800 dark:text-sage-300 border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
            <Languages className="w-4 h-4 text-sage-600" />
            <span>Multilingual Reading & Interface</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-primary dark:text-nightText-primary mb-1">
                News Reading Language
              </label>
              <p className="text-[11px] text-ink-muted mb-1.5">
                Controls translated summaries, perspectives, and Tap-to-Understand dictionary explanations.
              </p>
              <select
                value={readingLang}
                onChange={e => setReadingLang(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-paper-light dark:bg-night-surface border border-paper-border dark:border-night-border text-ink-primary dark:text-nightText-primary focus:outline-none focus:ring-1 focus:ring-sage-500"
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-primary dark:text-nightText-primary mb-1">
                Interface Language
              </label>
              <p className="text-[11px] text-ink-muted mb-1.5">
                Controls navigation buttons, headers, and UI text labels.
              </p>
              <select
                value={interfaceLang}
                onChange={e => setInterfaceLang(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-paper-light dark:bg-night-surface border border-paper-border dark:border-night-border text-ink-primary dark:text-nightText-primary focus:outline-none focus:ring-1 focus:ring-sage-500"
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 3: THEME & SUMMARY DEPTH */}
        <div className="p-6 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-5">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-sage-800 dark:text-sage-300 border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
            <span>Reading Style & Theme</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-primary dark:text-nightText-primary mb-1">
                Appearance Theme
              </label>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs transition-colors ${
                    theme === 'light'
                      ? 'bg-sage-600 text-white border-sage-600 font-medium'
                      : 'border-paper-border dark:border-night-border text-ink-secondary dark:text-nightText-secondary'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Warm Ivory (Light)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs transition-colors ${
                    theme === 'dark'
                      ? 'bg-sage-600 text-white border-sage-600 font-medium'
                      : 'border-paper-border dark:border-night-border text-ink-secondary dark:text-nightText-secondary'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Muted Charcoal (Dark)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-primary dark:text-nightText-primary mb-1">
                Summary Length
              </label>
              <div className="flex items-center gap-2 pt-1">
                {(['concise', 'balanced', 'detailed'] as const).map(len => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => setSummaryLen(len)}
                    className={`px-3 py-1.5 rounded-lg border text-xs capitalize transition-colors ${
                      summaryLen === len
                        ? 'bg-sage-600 text-white border-sage-600 font-medium'
                        : 'border-paper-border dark:border-night-border text-ink-secondary dark:text-nightText-secondary'
                    }`}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: QUIET NOTIFICATIONS */}
        <div className="p-6 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-5">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-sage-800 dark:text-sage-300 border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
            <Bell className="w-4 h-4 text-sage-600" />
            <span>Quiet Notification Preferences</span>
          </div>

          <div className="space-y-4 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enableNotifs}
                onChange={e => setEnableNotifs(e.target.checked)}
                className="rounded border-paper-border text-sage-600 focus:ring-sage-500 w-4 h-4"
              />
              <span className="font-medium text-ink-primary dark:text-nightText-primary">
                Enable Infrequent, Bundled News Notifications
              </span>
            </label>

            <div className="p-3 rounded-lg bg-paper-cream/60 dark:bg-night-surface/60 border border-paper-borderSubtle text-[11px] text-ink-muted leading-relaxed">
              <strong>Quiet Policy:</strong> Pulse enforces a 3-hour quiet interval between ordinary alerts, permits at most 2 notifications in any rolling 3-hour window, and bundles multiple stories into single digests to protect mental tranquility.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-ink-primary dark:text-nightText-primary mb-1">
                  Quiet Hours Start
                </label>
                <input
                  type="time"
                  value={quietStart}
                  onChange={e => setQuietStart(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-paper-light dark:bg-night-surface border border-paper-border dark:border-night-border text-xs text-ink-primary dark:text-nightText-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-primary dark:text-nightText-primary mb-1">
                  Quiet Hours End
                </label>
                <input
                  type="time"
                  value={quietEnd}
                  onChange={e => setQuietEnd(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-paper-light dark:bg-night-surface border border-paper-border dark:border-night-border text-xs text-ink-primary dark:text-nightText-primary"
                />
              </div>
            </div>

            {/* BROWSER WEB PUSH (SERVICE WORKER & VAPID) */}
            <div className="pt-4 border-t border-paper-borderSubtle dark:border-night-borderSubtle">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-ink-primary dark:text-nightText-primary">
                      Browser Native Web Push (Service Worker)
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isPushSubscribed 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                        : 'bg-paper-border dark:bg-night-border text-ink-muted'
                    }`}>
                      {isPushSubscribed ? 'Subscribed & Active' : 'Not Subscribed'}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    Delivers OS-level desktop and mobile notifications when high-priority updates emerge, adhering to 3-hour quiet intervals.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isPushLoading || !pushSupported}
                    onClick={handleTogglePushNotifications}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      isPushSubscribed
                        ? 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400'
                        : 'bg-sage-600 text-white hover:bg-sage-700 border-sage-600'
                    }`}
                  >
                    {isPushLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isPushSubscribed ? (
                      'Unsubscribe Device'
                    ) : (
                      'Enable Web Push'
                    )}
                  </button>

                  {isPushSubscribed && (
                    <button
                      type="button"
                      disabled={isPushLoading}
                      onClick={handleTestPushNotification}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-paper-border dark:border-night-border hover:bg-paper-cream dark:hover:bg-night-surface text-ink-secondary dark:text-nightText-secondary"
                    >
                      Send Test Push
                    </button>
                  )}
                </div>
              </div>

              {pushStatusMessage && (
                <div className="mt-3 p-2.5 rounded-lg bg-sage-50 dark:bg-night-surface text-[11px] text-sage-900 dark:text-sage-300 border border-sage-200 dark:border-sage-800">
                  {pushStatusMessage}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg bg-sage-600 text-white text-xs font-semibold hover:bg-sage-700 transition-colors shadow-sm"
          >
            Save User Preferences
          </button>
        </div>
      </form>

      {/* SECTION 5: MULTI-MODEL AI ROUTING & API CREDENTIALS */}
      <div className="p-6 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-editorial space-y-6">
        <div className="flex items-center justify-between border-b border-paper-borderSubtle dark:border-night-borderSubtle pb-2">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-sage-800 dark:text-sage-300">
            <Cpu className="w-4 h-4 text-sage-600" />
            <span>Multi-Model AI Orchestrator (Backend Routing)</span>
          </div>

          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
            {aiConfig?.status?.isFallbackActive ? 'Deterministic Fallback Active' : 'Live API Active'}
          </span>
        </div>

        <p className="text-xs text-ink-muted leading-relaxed">
          Pulse orchestrates OpenAI, Anthropic Claude, and xAI Grok. When external API keys are not provided, Pulse automatically runs using its intelligent, deterministic, evidence-grounded local engine with zero network failure.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-paper-cream/60 dark:bg-night-surface/60 border border-paper-borderSubtle">
          <div>
            <label className="block text-xs font-semibold text-ink-primary dark:text-nightText-primary mb-0.5">
              Active Primary Provider Routing
            </label>
            <p className="text-[11px] text-ink-muted">
              Select which engine is assigned for standard synthesis and query resolution.
            </p>
          </div>
          <select
            value={primaryProvider}
            onChange={e => {
              const val = e.target.value;
              setPrimaryProvider(val);
              api.saveAIConfig({ primaryProvider: val }).then(res => setAiConfig(res));
            }}
            className="px-3 py-1.5 text-xs rounded-lg bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border font-medium text-ink-primary dark:text-nightText-primary"
          >
            <option value="fallback">Intelligent Grounded Fallback (No API Keys Required)</option>
            <option value="openai">OpenAI (Synthesis & Multilingual QA)</option>
            <option value="anthropic">Anthropic Claude (Perspective Synthesis)</option>
            <option value="xai">xAI Grok (External Research)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* OpenAI */}
          <div className="p-3.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-light dark:bg-night-surface space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold">OpenAI API</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${aiConfig?.status?.openaiConfigured ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-400'}`}>
                {aiConfig?.status?.openaiConfigured ? 'Connected' : 'Offline'}
              </span>
            </div>
            <div className="text-[11px] text-ink-muted font-mono truncate">
              {aiConfig?.config?.openaiApiKey || 'Set via OPENAI_API_KEY'}
            </div>
            <span className="text-[10px] text-ink-muted block">Model: {aiConfig?.config?.openaiModel || 'gpt-4o-mini'}</span>
          </div>

          {/* Anthropic Claude */}
          <div className="p-3.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-light dark:bg-night-surface space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Anthropic Claude</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${aiConfig?.status?.anthropicConfigured ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-400'}`}>
                {aiConfig?.status?.anthropicConfigured ? 'Connected' : 'Offline'}
              </span>
            </div>
            <div className="text-[11px] text-ink-muted font-mono truncate">
              {aiConfig?.config?.anthropicApiKey || 'Set via ANTHROPIC_API_KEY'}
            </div>
            <span className="text-[10px] text-ink-muted block">Model: {aiConfig?.config?.anthropicModel || 'claude-3-5-sonnet'}</span>
          </div>

          {/* xAI Grok */}
          <div className="p-3.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-light dark:bg-night-surface space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold">xAI Grok</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${aiConfig?.status?.xaiConfigured ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-400'}`}>
                {aiConfig?.status?.xaiConfigured ? 'Connected' : 'Offline'}
              </span>
            </div>
            <div className="text-[11px] text-ink-muted font-mono truncate">
              {aiConfig?.config?.xaiApiKey || 'Set via XAI_API_KEY'}
            </div>
            <span className="text-[10px] text-ink-muted block">Model: {aiConfig?.config?.xaiModel || 'grok-2-1212'}</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-stone-100/70 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800 text-[11px] text-ink-muted flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-ink-primary dark:text-nightText-primary font-medium">Server-Side Secret Isolation: </strong>
            To protect your credentials from browser storage exposure or cross-site extraction, API keys must be declared in the server's <code className="font-mono bg-paper-card dark:bg-night-card px-1 py-0.5 rounded border border-stone-300 dark:border-stone-700">.env</code> configuration file.
          </div>
        </div>
      </div>
    </div>
  );
};
