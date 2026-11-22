import { signInWithPopup } from 'firebase/auth';
import { BarChart3, Lock, Moon, Repeat, Sun } from 'lucide-react';
import { useState } from 'react';
import { auth, googleProvider } from '../lib/firebase';
import { OfflineBanner } from './OfflineBanner';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthGateScreenProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function AuthGateScreen({ isDark, onToggleTheme }: AuthGateScreenProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Die Anmeldung wurde abgebrochen.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'Das Anmeldefenster wurde vom Browser blockiert. Bitte erlaube Pop-ups für diese Seite.',
        );
      } else {
        setAuthError(
          'Anmeldung fehlgeschlagen. Bitte versuche es erneut.',
        );
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 font-display whitespace-nowrap shrink-0">
            BudgetPlanner
          </span>

          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln'}
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Hell</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Dunkel</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Persönliches Finanzkonto · Cloud-Synchronisierung
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
              Dein Monatsbudget sicher im eigenen Account verwalten
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              Melde dich mit deinem Google-Konto an, um Budgetlimits, Ausgaben, wiederkehrende Abos und Sparziele geräteübergreifend und privat zu speichern.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Auswertungen in Echtzeit
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Kategorieverteilung, 30-Tage-Trend und Monatsrückblick.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Repeat className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Abos & Sparziele
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Wiederkehrende Buchungen und gezielte Rücklagen.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 space-y-5">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Konto anmelden
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Deine Daten sind ausschließlich für deine eigene Google-ID zugänglich.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 text-sm font-medium transition-colors flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                  />
                </svg>
                <span>
                  {isSigningIn ? 'Anmeldung läuft...' : 'Mit Google anmelden'}
                </span>
              </button>

              {authError && (
                <p
                  role="alert"
                  className="text-xs text-[#C62828] dark:text-red-400 leading-relaxed"
                >
                  {authError}
                </p>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Gesicherte Speicherung über Firebase Auth & Firestore</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <OfflineBanner />
    </div>
  );
}
