import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ALL_INDIAN_STATES_AND_UTS } from '../common/StateSelectorModal';
import { 
  X, 
  ShieldCheck, 
  User, 
  Mail, 
  Lock, 
  MapPin, 
  Loader2, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, authModalMode, closeAuthModal, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(authModalMode);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [state, setState] = useState('Telangana');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync mode from context when modal opens
  React.useEffect(() => {
    setMode(authModalMode);
    setError(null);
  }, [authModalMode, isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, fullName.trim() || undefined, state);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={closeAuthModal}
    >
      <div 
        className="relative w-full max-w-md bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-xl shadow-2xl overflow-hidden p-6 text-ink-primary dark:text-nightText-primary"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-ink-muted hover:text-ink-primary dark:hover:text-nightText-primary hover:bg-paper-cream dark:hover:bg-night-surface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-serif text-xl font-bold tracking-tight text-ink-primary dark:text-nightText-primary">
            PULSE
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-sage-600 dark:bg-sage-400" />
          <span className="text-xs uppercase tracking-widest text-ink-muted font-sans pl-1">
            Account Sync
          </span>
        </div>

        <p className="text-xs text-ink-muted mb-5">
          {mode === 'login'
            ? 'Sign in to access your saved stories, vocabulary notebook, and customized state feeds.'
            : 'Create an account to synchronize your reading archive across devices with Supabase Cloud.'}
        </p>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 p-1 bg-paper-light dark:bg-night-surface rounded-lg mb-5 border border-paper-borderSubtle dark:border-night-borderSubtle">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'login'
                ? 'bg-paper-card dark:bg-night-card text-ink-primary dark:text-nightText-primary shadow-sm font-semibold'
                : 'text-ink-muted hover:text-ink-primary'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(null); }}
            className={`py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'register'
                ? 'bg-paper-card dark:bg-night-card text-ink-primary dark:text-nightText-primary shadow-sm font-semibold'
                : 'text-ink-muted hover:text-ink-primary'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-terracotta-50/70 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-800 text-xs text-terracotta-800 dark:text-terracotta-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {mode === 'register' && (
            <>
              <div>
                <label className="block font-medium text-ink-secondary dark:text-nightText-secondary mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Anand Sharma"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-paper-light dark:bg-night-surface border border-paper-border dark:border-night-border text-ink-primary dark:text-nightText-primary placeholder:text-ink-subtle focus:outline-none focus:ring-1 focus:ring-sage-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink-secondary dark:text-nightText-secondary mb-1">
                  Primary State / Union Territory
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <select
                    value={state}
                    onChange={e => setState(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-paper-light dark:bg-night-surface border border-paper-border dark:border-night-border text-ink-primary dark:text-nightText-primary focus:outline-none focus:ring-1 focus:ring-sage-500"
                  >
                    {ALL_INDIAN_STATES_AND_UTS.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block font-medium text-ink-secondary dark:text-nightText-secondary mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="reader@example.com"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-paper-light dark:bg-night-surface border border-paper-border dark:border-night-border text-ink-primary dark:text-nightText-primary placeholder:text-ink-subtle focus:outline-none focus:ring-1 focus:ring-sage-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-ink-secondary dark:text-nightText-secondary mb-1">
              Password {mode === 'register' && '(min. 6 characters)'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-paper-light dark:bg-night-surface border border-paper-border dark:border-night-border text-ink-primary dark:text-nightText-primary placeholder:text-ink-subtle focus:outline-none focus:ring-1 focus:ring-sage-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 rounded-lg bg-sage-700 hover:bg-sage-800 text-white font-medium text-xs flex items-center justify-center gap-2 shadow transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{mode === 'login' ? 'Authenticating...' : 'Creating Account...'}</span>
              </>
            ) : (
              <span>{mode === 'login' ? 'Sign In to Pulse' : 'Register & Sync to Cloud'}</span>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-paper-borderSubtle dark:border-night-borderSubtle text-[11px] text-ink-muted flex items-center justify-between">
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Supabase RLS Protected</span>
          </span>
          <button
            type="button"
            onClick={closeAuthModal}
            className="hover:underline text-ink-secondary dark:text-nightText-secondary"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
};
