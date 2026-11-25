// Componentes visuais compartilhados pelas telas redesenhadas (cards com brilho,
// KPIs em gradiente, rosca com total no centro, paginação, menu de ações).
import { useEffect, useRef, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChevronLeft, ChevronRight, MoreVertical, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import { formatCurrency } from '../lib/utils.js';

export const TIP = { borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 };
export const pct1 = (v) => `${(Number.isFinite(v) ? v : 0).toFixed(1).replace('.', ',')}%`;

export const TONES = {
  teal: { hex: '#2dd4bf', ring: 'ring-teal-400/40', tile: 'bg-teal-500/20 text-teal-300 ring-teal-300/30', bg: 'linear-gradient(135deg,rgba(20,184,166,.22),rgba(14,116,144,.08) 70%)', glow: 'shadow-[0_0_24px_rgba(45,212,191,.15)]' },
  violet: { hex: '#a78bfa', ring: 'ring-violet-400/45', tile: 'bg-violet-500/25 text-violet-200 ring-violet-300/30', bg: 'linear-gradient(135deg,rgba(139,92,246,.28),rgba(91,33,182,.08) 70%)', glow: 'shadow-[0_0_24px_rgba(139,92,246,.2)]' },
  emerald: { hex: '#34d399', ring: 'ring-emerald-400/40', tile: 'bg-emerald-500/20 text-emerald-300 ring-emerald-300/30', bg: 'linear-gradient(135deg,rgba(16,185,129,.22),rgba(6,95,70,.08) 70%)', glow: 'shadow-[0_0_24px_rgba(52,211,153,.15)]' },
  amber: { hex: '#fbbf24', ring: 'ring-amber-400/45', tile: 'bg-amber-500/20 text-amber-300 ring-amber-300/30', bg: 'linear-gradient(135deg,rgba(245,158,11,.24),rgba(146,64,14,.08) 70%)', glow: 'shadow-[0_0_24px_rgba(251,191,36,.15)]' },
  rose: { hex: '#fb7185', ring: 'ring-rose-400/45', tile: 'bg-rose-500/20 text-rose-300 ring-rose-300/30', bg: 'linear-gradient(135deg,rgba(244,63,94,.24),rgba(136,19,55,.08) 70%)', glow: 'shadow-[0_0_24px_rgba(244,63,94,.15)]' },
  sky: { hex: '#38bdf8', ring: 'ring-sky-400/40', tile: 'bg-sky-500/20 text-sky-300 ring-sky-300/30', bg: 'linear-gradient(135deg,rgba(14,165,233,.22),rgba(30,64,175,.08) 70%)', glow: 'shadow-[0_0_24px_rgba(56,189,248,.15)]' },
  pink: { hex: '#f472b6', ring: 'ring-pink-400/45', tile: 'bg-pink-500/20 text-pink-300 ring-pink-300/30', bg: 'linear-gradient(135deg,rgba(236,72,153,.24),rgba(131,24,67,.08) 70%)', glow: 'shadow-[0_0_24px_rgba(236,72,153,.15)]' },
};

export function PageTitle({ icon: Icon, title, subtitle, actions, art, iconClass = 'text-teal-400' }) {
  return (
    <div className="relative flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div className="flex items-start gap-4 min-w-0">
        {Icon && <Icon className={`w-11 h-11 shrink-0 mt-1 ${iconClass}`} strokeWidth={1.6} />}
        <div className="min-w-0">
          <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
          <div className="h-1 w-14 rounded-full mt-2.5 bg-gradient-to-r from-teal-400 to-sky-500" />
        </div>
        {art}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>}
    </div>
  );
}

// KPI com gradiente, ícone em "azulejo" e onda decorativa no rodapé
export function StatCard({ tone = 'teal', icon: Icon, label, value, sub, chip, onClick, className = '' }) {
  const T = TONES[tone];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`relative overflow-hidden text-left rounded-2xl ring-1 ${T.ring} ${T.glow} bg-[hsl(var(--card))] p-4 flex items-center gap-4 ${onClick ? 'hover-lift' : ''} ${className}`} style={{ backgroundImage: T.bg }}>
      <svg className="absolute right-0 bottom-0 w-2/3 h-10 pointer-events-none opacity-60" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden><path d="M0 40 C40 30 60 10 100 20 C140 30 160 8 200 4 L200 40 Z" fill={T.hex} fillOpacity=".14" /></svg>
      {Icon && <span className={`relative w-12 h-12 rounded-xl ring-1 flex items-center justify-center shrink-0 ${T.tile}`}><Icon className="w-6 h-6" /></span>}
      <div className="relative min-w-0 flex-1">
        <p className="text-xs text-muted truncate">{label}</p>
        <p className="font-display text-2xl font-bold leading-tight whitespace-nowrap">{value}</p>
        {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
      </div>
      {chip && <div className="relative self-start shrink-0">{chip}</div>}
    </Tag>
  );
}

export function Panel({ title, icon: Icon, iconClass = 'text-sky-400', action, tone, glow, className = '', children, subtitle }) {
  const ring = tone ? TONES[tone].ring : 'ring-[hsl(var(--border))]';
  return (
    <section className={`rounded-3xl bg-[hsl(var(--card))] ring-1 ${ring} ${glow && tone ? TONES[tone].glow : 'shadow-soft'} p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-lg flex items-center gap-2">{Icon && <Icon className={`w-5 h-5 shrink-0 ${iconClass}`} />}{title}</h3>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Donut({ data, center, size = 180, thickness = 0.3 }) {
  const shown = data.filter((d) => d.value > 0);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={shown.length ? shown : [{ name: 'vazio', value: 1, color: 'hsl(var(--muted) / .2)' }]} dataKey="value" nameKey="name" innerRadius={`${(1 - thickness) * 100}%`} outerRadius="100%" paddingAngle={shown.length > 1 ? 1.5 : 0} stroke="none" startAngle={90} endAngle={-270}>
            {(shown.length ? shown : [{ color: 'hsl(var(--muted) / .2)' }]).map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          {shown.length > 0 && <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} />}
        </PieChart>
      </ResponsiveContainer>
      {center && <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">{center}</div>}
    </div>
  );
}

export function Ring({ value, size = 150, stroke = 14, from = '#2dd4bf', to = '#a855f7', children, track = 'hsl(var(--muted) / .18)' }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const v = Math.max(0, Math.min(100, value));
  const id = `rg${size}${Math.round(from.length * 7 + to.length)}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={from} /><stop offset="100%" stopColor={to} /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} style={{ transition: 'stroke-dasharray .8s ease', filter: `drop-shadow(0 0 6px ${from}66)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function DeltaChip({ v, invert = false, suffix = '%', className = '' }) {
  if (v == null || !Number.isFinite(v)) return null;
  const up = v >= 0; const good = invert ? !up : up;
  return <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${good ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-500 dark:text-rose-300'} ${className}`}>{up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{up ? '+' : ''}{v.toFixed(1).replace('.', ',')}{suffix}</span>;
}

export function Bar({ pct, color, className = 'h-2', glow }) {
  const v = Math.max(0, Math.min(100, pct || 0));
  return <div className={`rounded-full bg-black/10 dark:bg-white/10 overflow-hidden ${className}`}><div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, background: color, boxShadow: glow ? `0 0 10px ${typeof color === 'string' && color.startsWith('#') ? color : '#2dd4bf'}88` : undefined }} /></div>;
}

export function Segmented({ value, onChange, options, size = 'md' }) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-[hsl(var(--border))] overflow-x-auto max-w-full">
      {options.map(([v, l, Ic]) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v} className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'} ${value === v ? 'bg-teal-400/20 text-teal-700 dark:text-teal-200 ring-1 ring-teal-400/50 shadow-[0_0_12px_rgba(45,212,191,.25)]' : 'text-muted hover:text-[hsl(var(--text))]'}`}>{Ic && <Ic className="w-4 h-4" />}{l}</button>
      ))}
    </div>
  );
}

export function KebabMenu({ items, vertical = true, label = 'Mais ações' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span className="relative inline-block shrink-0" ref={ref}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} aria-label={label} aria-haspopup="menu" aria-expanded={open} className="p-1.5 rounded-lg text-muted hover:text-[hsl(var(--text))] hover:bg-black/5 dark:hover:bg-white/10"><MoreVertical className={`w-4 h-4 ${vertical ? '' : 'rotate-90'}`} /></button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-30 min-w-[12rem] rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl p-1 text-left">
          {items.filter(Boolean).map((it) => <button key={it.label} role="menuitem" onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5 ${it.danger ? 'text-rose-500' : ''}`}>{it.icon && <it.icon className="w-4 h-4" />} {it.label}</button>)}
        </div>
      )}
    </span>
  );
}

export function Pager({ page, pages, onPage }) {
  const nums = []; for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1 || (page <= 3 && i <= 5) || (page >= pages - 2 && i >= pages - 4)) nums.push(i);
  const items = []; nums.forEach((x, i) => { if (i && x - nums[i - 1] > 1) items.push('…' + x); items.push(x); });
  const btn = 'min-w-8 h-8 px-2 rounded-lg text-sm font-semibold flex items-center justify-center ring-1 ring-[hsl(var(--border))]';
  return (
    <nav className="flex items-center gap-1.5" aria-label="Paginação">
      <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className={`${btn} hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30`} aria-label="Anterior"><ChevronLeft className="w-4 h-4" /></button>
      {items.map((x) => typeof x === 'string' ? <span key={x} className="px-1 text-muted">…</span> : <button key={x} onClick={() => onPage(x)} aria-current={x === page ? 'page' : undefined} className={`${btn} ${x === page ? 'ring-teal-400 text-teal-600 dark:text-teal-200 bg-teal-400/15 shadow-[0_0_12px_rgba(45,212,191,.35)]' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}>{x}</button>)}
      <button onClick={() => onPage(Math.min(pages, page + 1))} disabled={page === pages} className={`${btn} hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30`} aria-label="Próxima"><ChevronRight className="w-4 h-4" /></button>
    </nav>
  );
}

// Linha de insight clicável (ícone + título + texto + seta)
export function InsightRow({ tone = 'teal', icon: Icon, kicker, title, text, onClick }) {
  const T = TONES[tone];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`w-full text-left rounded-2xl ring-1 ${T.ring} p-3.5 flex items-center gap-3 transition ${onClick ? 'hover:brightness-110' : ''}`} style={{ backgroundImage: T.bg }}>
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${T.tile} ring-1`}><Icon className="w-6 h-6" /></span>
      <span className="flex-1 min-w-0">
        {kicker && <span className="block text-[11px] text-muted">{kicker}</span>}
        <span className="block font-semibold leading-tight">{title}</span>
        {text && <span className="block text-xs text-muted mt-0.5 leading-snug">{text}</span>}
      </span>
      {onClick && <ChevronRight className="w-4 h-4 text-muted shrink-0" />}
    </Tag>
  );
}

// Botão primário em gradiente (independe da cor de destaque escolhida pelo usuário)
export function GlowButton({ children, onClick, tone = 'sky', className = '', ...rest }) {
  const g = { sky: 'from-sky-500 to-blue-600 shadow-[0_0_20px_rgba(56,189,248,.4)]', violet: 'from-violet-600 to-fuchsia-600 shadow-[0_0_20px_rgba(139,92,246,.45)]', emerald: 'from-emerald-500 to-teal-600 shadow-[0_0_20px_rgba(16,185,129,.4)]', pink: 'from-fuchsia-600 to-pink-500 shadow-[0_0_22px_rgba(217,70,239,.45)]', aurora: 'from-cyan-400 via-sky-500 to-fuchsia-500 shadow-[0_0_24px_rgba(34,211,238,.35)]' }[tone];
  return <button onClick={onClick} className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${g} hover:brightness-110 transition disabled:opacity-60 ${className}`} {...rest}>{children}</button>;
}


// Título com a segunda parte em destaque (ex.: "Dívidas &" + "Crédito"), ilustração opcional à direita
export function HeroTitle({ icon: Icon, lead, accent, subtitle, art, actions, iconClass = 'text-fuchsia-400' }) {
  return (
    <div className="relative flex flex-col xl:flex-row xl:items-start justify-between gap-4 min-h-[88px]">
      <div className="min-w-0 relative z-[1]">
        <h1 className="font-display text-3xl sm:text-[2.6rem] font-extrabold leading-tight flex items-center gap-3 flex-wrap">
          {Icon && <Icon className={`w-10 h-10 shrink-0 ${iconClass}`} strokeWidth={1.8} />}
          <span>{lead} <span className="bg-gradient-to-r from-cyan-500 to-teal-400 dark:from-cyan-300 dark:to-teal-300 bg-clip-text text-transparent">{accent}</span></span>
        </h1>
        {subtitle && <p className="text-sm sm:text-base text-muted mt-1">{subtitle}</p>}
        <div className="h-1 w-16 rounded-full mt-2.5 bg-gradient-to-r from-cyan-400 to-fuchsia-500" />
      </div>
      {art && <div className="hidden lg:block absolute right-0 xl:right-[var(--art-right,0px)] -top-4 pointer-events-none select-none" aria-hidden="true">{art}</div>}
      {actions && <div className="flex flex-wrap items-center gap-2 xl:justify-end relative z-[1]">{actions}</div>}
    </div>
  );
}

// Medidor em semicírculo (0–100) com gradiente vermelho→amarelo→verde
export function Gauge({ value, size = 150, label, sub, stroke = 12 }) {
  const v = value == null || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2; const c = Math.PI * r; const h = size / 2 + stroke;
  const id = `gg${size}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: h }}>
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#f43f5e" /><stop offset="45%" stopColor="#f59e0b" /><stop offset="75%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#a855f7" /></linearGradient></defs>
        <path d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`} fill="none" stroke="hsl(var(--muted) / .18)" strokeWidth={stroke} strokeLinecap="round" />
        {v != null && <path d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} style={{ transition: 'stroke-dasharray .8s ease', filter: 'drop-shadow(0 0 6px rgba(34,211,238,.45))' }} />}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center leading-none">
        <span className="font-display text-3xl font-extrabold">{v == null ? '—' : Math.round(v)}</span>{label && <span className="text-xs text-muted">{label}</span>}
        {sub && <div className="text-xs font-bold mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// Faixa de métricas em um único painel, separadas por divisórias (como nos cabeçalhos das telas)
export function MetricStrip({ children, className = '' }) {
  return <section className={`rounded-3xl bg-[hsl(var(--card))] ring-1 ring-violet-400/30 shadow-[0_0_32px_-12px_rgba(168,85,247,.45)] p-4 sm:p-5 grid gap-4 sm:gap-0 sm:divide-x divide-[hsl(var(--border))] ${className}`}>{children}</section>;
}
export function Metric({ icon: Icon, color = '#a855f7', label, value, sub, valueClass = '' }) {
  return (
    <div className="flex items-start gap-3 sm:px-5 first:sm:pl-1 min-w-0">
      {Icon && <Icon className="w-9 h-9 shrink-0 mt-0.5" style={{ color }} strokeWidth={1.6} />}
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className={`font-display text-2xl font-bold leading-tight truncate ${valueClass}`}>{value}</p>
        {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// Painel "Insights" padrão com selo
export function InsightsPanel({ title = 'Insights automáticos', subtitle, items, badge = 'Auto', className = '' }) {
  return (
    <Panel className={className} title={title} subtitle={subtitle} icon={Sparkles} iconClass="text-fuchsia-400" action={<span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-300 ring-1 ring-violet-400/40">{badge}</span>}>
      <div className="space-y-2.5">{items.filter(Boolean).map((x, k) => <InsightRow key={k} {...x} />)}</div>
    </Panel>
  );
}
