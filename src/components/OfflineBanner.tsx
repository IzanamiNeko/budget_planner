import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-5 left-4 right-4 sm:right-auto z-40 inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-medium shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>Offline-Modus — Zwischengespeicherte Daten aktiv</span>
    </div>
  );
}
