import { useEffect, useState } from 'react';

let deferred = null;
const subs = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; subs.forEach((f) => f(true)); });
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach((f) => f(false)); });
}
export function useInstallPrompt() {
  const [can, setCan] = useState(!!deferred);
  useEffect(() => { const f = (v) => setCan(v); subs.add(f); setCan(!!deferred); return () => subs.delete(f); }, []);
  const promptInstall = async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch {} deferred = null; setCan(false); };
  const installed = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  return { canInstall: can, promptInstall, installed };
}
