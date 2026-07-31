import { cn } from '../../lib/utils.js';
import { X, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export function Button({ variant = 'primary', size = 'md', className, children, ...props }) {
  const variants = {
    primary: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm',
    danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm',
    ghost: 'bg-transparent hover:bg-black/5 dark:hover:bg-white/10 text-[hsl(var(--text))]',
    outline: 'border border-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/5 text-[hsl(var(--text))]',
    dark: 'bg-slate-900 hover:bg-slate-800 text-white',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };
  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed', variants[variant], sizes[size], className)}
      {...props}
    >{children}</button>
  );
}

export function Card({ className, children, ...props }) {
  return <div className={cn('card p-5', className)} {...props}>{children}</div>;
}

export function Input({ className, ...props }) {
  return <input className={cn('input-base', className)} {...props} />;
}
export function Select({ className, children, ...props }) {
  return <select className={cn('input-base', className)} {...props}>{children}</select>;
}
export function Textarea({ className, ...props }) {
  return <textarea className={cn('input-base', className)} {...props} />;
}

export function Field({ label, children, hint }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-[hsl(var(--text))]">{label}</span>}
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Badge({ children, className, color = 'slate' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  };
  return <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', colors[color], className)}>{children}</span>;
}

export function Spinner({ className }) {
  return <Loader2 className={cn('animate-spin', className)} />;
}

export function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);
  if (!open) return null;
  // Portal para o body: garante que o modal fique centralizado na viewport
  // mesmo em paginas muito longas ou com ancestrais que usam transform/animacao.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative w-full card p-0 rounded-2xl overflow-hidden animate-[fadeIn_.15s_ease] flex flex-col max-h-[90vh]', maxWidth)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <h3 className="font-display font-bold text-lg truncate pr-2">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-[hsl(var(--border))] flex justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 text-muted">
      {Icon && <div className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3"><Icon className="w-7 h-7" /></div>}
      <p className="font-semibold text-[hsl(var(--text))]">{title}</p>
      {subtitle && <p className="text-sm mt-1 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
