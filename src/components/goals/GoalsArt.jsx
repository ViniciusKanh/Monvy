// Ilustração original do topo de Metas: montanha ao entardecer com bandeira no
// cume e uma pessoa olhando para o objetivo. SVG puro, sem imagens externas.
export function SummitIllustration({ className = 'w-[520px] h-48' }) {
  return (
    <svg viewBox="0 0 520 190" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="smSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1e1b4b" stopOpacity="0" /><stop offset="100%" stopColor="#4c1d95" stopOpacity=".55" /></linearGradient>
        <linearGradient id="smMt" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6d28d9" /><stop offset="60%" stopColor="#312e81" /><stop offset="100%" stopColor="#0f172a" /></linearGradient>
        <linearGradient id="smMt2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b0764" /><stop offset="100%" stopColor="#0b1026" /></linearGradient>
        <linearGradient id="smGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e879f9" /><stop offset="100%" stopColor="#e879f9" stopOpacity="0" /></linearGradient>
        <filter id="smBlur"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <rect x="0" y="0" width="520" height="190" fill="url(#smSky)" />
      {[[40, 30], [120, 18], [210, 40], [300, 12], [380, 34], [470, 20], [90, 70], [440, 64]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1.2 : 1.8} fill="#e9d5ff" opacity=".8" />)}
      <ellipse cx="200" cy="40" rx="60" ry="30" fill="#e879f9" opacity=".25" filter="url(#smBlur)" />
      <path d="M0 190 L70 120 L120 150 L200 52 L270 140 L330 110 L420 160 L520 120 L520 190 Z" fill="url(#smMt2)" opacity=".9" />
      <path d="M90 190 L200 52 L310 190 Z" fill="url(#smMt)" />
      <path d="M200 52 L222 80 L208 76 L200 88 L190 74 L178 80 Z" fill="#ede9fe" opacity=".9" />
      <path d="M200 52 L178 80 L200 190 Z" fill="#a855f7" opacity=".18" />
      <line x1="200" y1="52" x2="200" y2="20" stroke="#f5d0fe" strokeWidth="2" />
      <path d="M200 20 L222 26 L200 33 Z" fill="#f0abfc" />
      <rect x="196" y="16" width="8" height="40" fill="url(#smGlow)" opacity=".35" filter="url(#smBlur)" />
      {[[30, 178], [55, 176], [345, 180], [372, 177], [500, 178]].map(([x, y], i) => <path key={i} d={`M${x} ${y} l7 -22 l7 22 Z`} fill="#0b1026" />)}
      <g transform="translate(400 92)">
        <ellipse cx="18" cy="96" rx="34" ry="5" fill="#000" opacity=".35" />
        <path d="M6 40 Q18 30 30 40 L33 78 L3 78 Z" fill="#1e293b" />
        <rect x="9" y="42" width="20" height="26" rx="5" fill="#334155" />
        <text x="13" y="60" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="10" fill="#2dd4bf">M</text>
        <circle cx="18" cy="28" r="10" fill="#0f172a" />
        <path d="M6 78 L10 96 L16 96 L18 80 L20 96 L26 96 L30 78 Z" fill="#0f172a" />
      </g>
    </svg>
  );
}

// Arte de capa por tipo de meta (gradiente + ícone grande translúcido)
export const GOAL_THEMES = {
  home: { from: '#0f766e', to: '#1e3a8a', accent: '#34d399' },
  travel: { from: '#7c3aed', to: '#db2777', accent: '#c084fc' },
  emergency: { from: '#1d4ed8', to: '#0e7490', accent: '#60a5fa' },
  car: { from: '#b45309', to: '#7c2d12', accent: '#fbbf24' },
  education: { from: '#0369a1', to: '#4338ca', accent: '#38bdf8' },
  health: { from: '#be123c', to: '#7e22ce', accent: '#fb7185' },
  other: { from: '#334155', to: '#4c1d95', accent: '#a78bfa' },
};
