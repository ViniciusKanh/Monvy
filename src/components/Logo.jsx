export function Logo({ size = 'md', light = true }) {
  const dims = { sm: 'text-xl', md: 'text-2xl', lg: 'text-4xl' };
  return (
    <div className={`flex items-center gap-2 font-display font-extrabold ${dims[size]}`}>
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-white to-emerald-400 text-slate-900 shadow-lg">
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
          <path d="M3 20V5l6 9 6-9v15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      <span className={light ? 'text-white' : 'text-[hsl(var(--text))]'}>
        Mon<span className="text-emerald-400">vy</span>
      </span>
    </div>
  );
}
