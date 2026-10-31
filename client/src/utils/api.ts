import { 
  CanonicalStory, 
  HourlyPulseBriefing, 
  PerspectiveAnalysis, 
  VocabularyEntry, 
  UserPreferences, 
  NotificationRecord, 
  NewsSource 
} from '../types';

let configuredBaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL)
  ? ((import.meta as any).env.VITE_API_BASE_URL as string).trim().replace(/\/$/, '')
  : '/api';

if (!configuredBaseUrl.startsWith('http://') && !configuredBaseUrl.startsWith('https://') && !configuredBaseUrl.startsWith('/')) {
  configuredBaseUrl = `https://${configuredBaseUrl}`;
}

if (configuredBaseUrl !== '/api' && !configuredBaseUrl.endsWith('/api')) {
  configuredBaseUrl = `${configuredBaseUrl}/api`;
}

const BASE_URL = configuredBaseUrl;

export function getOrCreateClientGuestId(): string {
  if (typeof window === 'undefined') return 'guest-ephemeral';
  let guestId = localStorage.getItem('pulse_guest_id');
  if (!guestId) {
    guestId = 'guest-' + (window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2, 12));
    localStorage.setItem('pulse_guest_id', guestId);
  }
  return guestId;
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const guestId = getOrCreateClientGuestId();
  const token = typeof window !== 'undefined' ? localStorage.getItem('pulse_auth_token') : null;

  // Retrieve admin key from ephemeral sessionStorage (scoped to active browser tab)
  let adminKey: string | null = null;
  if (typeof window !== 'undefined') {
    adminKey = sessionStorage.getItem('pulse_admin_key');
    // Clean up any legacy persistent keys in localStorage
    if (!adminKey && localStorage.getItem('pulse_admin_key')) {
      adminKey = localStorage.getItem('pulse_admin_key');
      if (adminKey) {
        sessionStorage.setItem('pulse_admin_key', adminKey);
      }
      localStorage.removeItem('pulse_admin_key');
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Guest-ID': guestId,
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Strictly scope X-Admin-Key to administrative or operational routes only
  const isAdminRoute = endpoint.startsWith('/admin') || 
                       endpoint.startsWith('/settings/ai-') || 
                       endpoint.startsWith('/sources') ||
                       endpoint === '/briefings/generate';
  if (adminKey && isAdminRoute) {
    headers['X-Admin-Key'] = adminKey;
  }

  const isGet = !options?.method || options.method.toUpperCase() === 'GET';
  const maxRetries = isGet ? 2 : 0;
  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!res.ok) {
        // If server returns gateway/service errors during cold start spinup on Render Free, retry with backoff
        if (isGet && (res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxRetries) {
          attempt++;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('pulse:cold-start-waking', { detail: { attempt } }));
          }
          await new Promise(r => setTimeout(r, attempt * 2000));
          continue;
        }

        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || `Request failed with status ${res.status}`);
      }

      return await res.json();
    } catch (err: any) {
      lastError = err;
      if (isGet && attempt < maxRetries) {
        attempt++;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pulse:cold-start-waking', { detail: { attempt } }));
        }
        await new Promise(r => setTimeout(r, attempt * 2000));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Request failed after retries');
}

export const api = {
  // Health
  getHealth: () => fetchApi<any>('/health'),

  // Stories
  getStories: (params?: { scope?: string; state?: string; category?: string; search?: string; importance?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.scope) query.append('scope', params.scope);
    if (params?.state) query.append('state', params.state);
    if (params?.category) query.append('category', params.category);
    if (params?.search) query.append('search', params.search);
    if (params?.importance) query.append('importance', params.importance);
    if (params?.limit) query.append('limit', params.limit.toString());
    return fetchApi<{ stories: CanonicalStory[]; total: number }>(`/stories?${query.toString()}`);
  },

  getStoryById: (id: string) => fetchApi<CanonicalStory>(`/stories/${id}`),

  getCatchMeUp: (timeframe: string = '24h', state?: string) => {
    const query = new URLSearchParams({ timeframe });
    if (state) query.append('state', state);
    return fetchApi<{
      timeframe: string;
      windowStart: string;
      summary: string;
      newStories: CanonicalStory[];
      updatedStories: CanonicalStory[];
      unresolvedStories: CanonicalStory[];
      unchangedStoriesCount: number;
    }>(`/catch-me-up?${query.toString()}`);
  },

  // Hourly Briefings
  getBriefings: (scope?: string, state?: string) => {
    const query = new URLSearchParams();
    if (scope) query.append('scope', scope);
    if (state) query.append('state', state);
    return fetchApi<{ briefings: HourlyPulseBriefing[] }>(`/briefings?${query.toString()}`);
  },

  getLatestBriefing: (scope: string = 'global') => fetchApi<HourlyPulseBriefing>(`/briefings/latest?scope=${scope}`),

  generateBriefing: (scope: string = 'global', state?: string) => 
    fetchApi<{ briefing: HourlyPulseBriefing; isNew: boolean }>('/briefings/generate', {
      method: 'POST',
      body: JSON.stringify({ scope, state }),
    }),

  // Perspectives
  getPerspective: (storyId: string) => fetchApi<PerspectiveAnalysis>(`/perspectives/${storyId}`),

  // Tap-to-Understand (Contextual Dictionary)
  getContextualDefinition: (word: string, sentence: string, language: string = 'en') =>
    fetchApi<{
      word: string;
      contextSentence: string;
      originalLanguage: string;
      targetLanguage: string;
      contextualMeaning: string;
      originalDefinition: string;
      pronunciation?: string;
      partOfSpeech?: string;
      exampleSentence?: string;
      synonyms?: string[];
      isDemoFallback?: boolean;
    }>('/dictionary/context', {
      method: 'POST',
      body: JSON.stringify({ word, sentence, language }),
    }),

  // Translation
  translateNews: (title: string, summary: string, whyItMatters: string, targetLanguage: string) =>
    fetchApi<{
      title: string;
      summary: string;
      whyItMatters: string;
      targetLanguage: string;
      isTranslated: boolean;
    }>('/translate', {
      method: 'POST',
      body: JSON.stringify({ title, summary, whyItMatters, targetLanguage }),
    }),

  // Grounded Ask the News
  askNews: (query: string, language: string = 'en', detailMode: 'concise' | 'deep' = 'concise') =>
    fetchApi<{
      answer: string;
      citations: any[];
      modelUsed?: string;
      isIncomplete?: boolean;
    }>('/ask', {
      method: 'POST',
      body: JSON.stringify({ query, language, detailMode }),
    }),

  // Vocabulary
  getVocabulary: (userId?: string, search?: string, mastery?: number) => {
    const query = new URLSearchParams();
    if (userId) query.append('userId', userId);
    if (search) query.append('search', search);
    if (mastery !== undefined) query.append('mastery', mastery.toString());
    return fetchApi<{ vocabulary: VocabularyEntry[]; count: number }>(`/vocabulary?${query.toString()}`);
  },

  saveVocabulary: (entry: Partial<VocabularyEntry>) =>
    fetchApi<VocabularyEntry>('/vocabulary', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),

  updateVocabulary: (id: string, updates: Partial<VocabularyEntry>) =>
    fetchApi<VocabularyEntry>(`/vocabulary/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteVocabulary: (id: string) =>
    fetchApi<{ success: boolean }>(`/vocabulary/${id}`, {
      method: 'DELETE',
    }),

  // Notifications & Web Push
  getNotifications: (userId?: string) => {
    const query = new URLSearchParams();
    if (userId) query.append('userId', userId);
    return fetchApi<{ notifications: NotificationRecord[]; unreadCount: number }>(`/notifications?${query.toString()}`);
  },

  markNotificationRead: (id: string) =>
    fetchApi<{ success: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),

  markAllNotificationsRead: (userId?: string) =>
    fetchApi<{ success: boolean }>('/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  getPushPublicKey: () =>
    fetchApi<{ publicKey: string; isConfigured: boolean }>('/notifications/push/public-key'),

  subscribePush: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, userId?: string) =>
    fetchApi<{ success: boolean; subscription: any }>('/notifications/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ ...subscription, userId }),
    }),

  unsubscribePush: (endpoint: string) =>
    fetchApi<{ success: boolean }>('/notifications/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    }),

  sendTestPush: (userId?: string) =>
    fetchApi<{ success: boolean; deliveredDevices: number; failedDevices: number }>('/notifications/push/test', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // Preferences
  getPreferences: (userId?: string) => {
    const query = new URLSearchParams();
    if (userId) query.append('userId', userId);
    return fetchApi<UserPreferences>(`/preferences?${query.toString()}`);
  },

  savePreferences: (prefs: Partial<UserPreferences>, userId?: string) =>
    fetchApi<UserPreferences>('/preferences', {
      method: 'POST',
      body: JSON.stringify({ userId, ...prefs }),
    }),

  // Authentication
  register: (payload: { email: string; password: string; fullName?: string; state?: string }) =>
    fetchApi<{
      user: { id: string; email: string; fullName?: string; state?: string };
      session?: { access_token: string; refresh_token: string; expires_at: number };
      message?: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    fetchApi<{
      user: { id: string; email: string; fullName?: string; state?: string };
      session: { access_token: string; refresh_token: string; expires_at: number };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () => fetchApi<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  getMe: () =>
    fetchApi<{
      authenticated: boolean;
      user: { id: string; email: string; isAdmin?: boolean } | null;
    }>('/auth/me'),

  // Saved Stories
  getSavedStories: () =>
    fetchApi<{ savedStories: any[]; count: number }>('/saved-stories'),

  saveStory: (storyId: string, personalNotes?: string) =>
    fetchApi<any>('/saved-stories', {
      method: 'POST',
      body: JSON.stringify({ storyId, personalNotes }),
    }),

  removeSavedStory: (storyId: string) =>
    fetchApi<{ success: boolean }>(`/saved-stories/${storyId}`, {
      method: 'DELETE',
    }),

  // Reading History
  recordReadingHistory: (storyId: string, timeSpentSeconds: number = 0) =>
    fetchApi<any>('/history/read', {
      method: 'POST',
      body: JSON.stringify({ storyId, timeSpentSeconds }),
    }),

  getReadingHistory: (limit: number = 50) =>
    fetchApi<{ history: any[]; count: number }>(`/history?limit=${limit}`),

  // Admin & Diagnostics
  getAdminDiagnostics: () => fetchApi<any>('/admin/diagnostics'),
  triggerIngestion: () => fetchApi<any>('/admin/trigger-ingestion', { method: 'POST' }),
  getSources: () => fetchApi<NewsSource[]>('/sources'),
  updateSource: (id: string, updates: Partial<NewsSource>) =>
    fetchApi<NewsSource>(`/sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  getAIConfig: () => fetchApi<any>('/settings/ai-config'),
  saveAIConfig: (config: any) => fetchApi<any>('/settings/ai-config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
};
