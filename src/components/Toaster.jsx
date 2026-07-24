import { useEffect, useState } from 'react';
import { subscribe } from '../lib/toast.js';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const CFG = {
  success: { icon: CheckCircle2, cls: 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  error: { icon: AlertTriangle, cls: 'border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  info: { icon: Info, cls: 'border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' },
};

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => subscribe((t) => {
    setItems((prev) => [...prev, t]);
    setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 5000);
  }), []);
  return (
    <div className="fixed z-[100] top-4 right-4 space-y-2 w-[calc(100%-2rem)] max-w-sm">
      {items.map((t) => {
        const c = CFG[t.type] || CFG.info; const Icon = c.icon;
        return (
          <div key={t.id} className={`flex items-start gap-2 p-3 rounded-xl border shadow-soft backdrop-blur ${c.cls} animate-[fadeIn_.2s_ease]`}>
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium flex-1">{t.message}</p>
            <button onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))}><X className="w-4 h-4 opacity-60" /></button>
          </div>
        );
      })}
    </div>
  );
}
