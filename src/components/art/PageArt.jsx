// Ilustrações originais (SVG) usadas nos cabeçalhos e estados vazios das telas de planejamento.
const Defs = ({ id }) => (
  <defs>
    <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22d3ee" /><stop offset="55%" stopColor="#6366f1" /><stop offset="100%" stopColor="#d946ef" /></linearGradient>
    <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0" /><stop offset="50%" stopColor="#a855f7" /><stop offset="100%" stopColor="#22d3ee" stopOpacity="0" /></linearGradient>
    <radialGradient id={`${id}g`} cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#a855f7" stopOpacity=".55" /><stop offset="100%" stopColor="#a855f7" stopOpacity="0" /></radialGradient>
    <filter id={`${id}f`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" /></filter>
  </defs>
);
const Sparkle = ({ x, y, s = 6, c = '#e9d5ff' }) => <path d={`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`} fill={c} />;
const Orbit = ({ id, cx, cy, rx, ry }) => <><ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={`url(#${id}b)`} strokeWidth="2.5" /><ellipse cx={cx} cy={cy} rx={rx * 0.8} ry={ry * 0.7} fill="none" stroke="#22d3ee" strokeOpacity=".35" strokeWidth="1.5" /><ellipse cx={cx} cy={cy} rx={rx * 0.6} ry={ry * 0.5} fill={`url(#${id}g)`} filter={`url(#${id}f)`} /></>;

export function CardArt({ className = 'w-80 h-36' }) {
  return (
    <svg viewBox="0 0 320 140" className={className}>
      <Defs id="ca" />
      <Orbit id="ca" cx={200} cy={110} rx={120} ry={24} />
      <g transform="rotate(-14 200 70)">
        <rect x="128" y="34" width="150" height="92" rx="12" fill="#1e1b4b" opacity=".7" transform="translate(10 8)" />
        <rect x="128" y="30" width="150" height="92" rx="12" fill="url(#caa)" />
        <rect x="128" y="30" width="150" height="92" rx="12" fill="none" stroke="#fff" strokeOpacity=".35" />
        <rect x="146" y="58" width="26" height="20" rx="4" fill="#bef264" opacity=".9" />
        <path d="M150 68h18M159 58v20" stroke="#365314" strokeOpacity=".5" />
        <path d="M244 60a10 10 0 0 1 0 16M250 55a17 17 0 0 1 0 26M256 50a24 24 0 0 1 0 36" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".85" />
        <rect x="146" y="98" width="70" height="6" rx="3" fill="#fff" opacity=".5" />
      </g>
      <Sparkle x={112} y={40} /><Sparkle x={300} y={24} s={4} /><Sparkle x={96} y={86} s={4} c="#67e8f9" />
    </svg>
  );
}

export function ChecklistArt({ className = 'w-72 h-36' }) {
  return (
    <svg viewBox="0 0 300 150" className={className}>
      <Defs id="cl" />
      <Orbit id="cl" cx={160} cy={122} rx={120} ry={22} />
      <g transform="rotate(10 160 70)">
        <rect x="104" y="20" width="110" height="104" rx="12" fill="url(#cla)" opacity=".95" />
        <rect x="112" y="30" width="94" height="88" rx="8" fill="#0f172a" opacity=".55" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(122 ${44 + i * 24})`}>
            <rect width="14" height="14" rx="3" fill="#34d399" />
            <path d="M3 7l3 3 6-6" stroke="#064e3b" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <rect x="22" y="3" width="50" height="7" rx="3.5" fill="#e0e7ff" opacity=".8" />
          </g>
        ))}
        {[0, 1, 2, 3].map((i) => <rect key={i} x={124 + i * 22} y="12" width="8" height="18" rx="4" fill="#c4b5fd" stroke="#7c3aed" />)}
      </g>
      <circle cx="226" cy="108" r="22" fill="#a855f7" stroke="#f5d0fe" strokeWidth="2" />
      <path d="M215 108l8 8 14-15" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
      <Sparkle x={70} y={40} /><Sparkle x={262} y={30} s={4} /><Sparkle x={84} y={84} s={4} c="#67e8f9" />
    </svg>
  );
}

export function DocCheckArt({ className = 'w-56 h-28' }) {
  return (
    <svg viewBox="0 0 240 120" className={className}>
      <Defs id="dc" />
      <Orbit id="dc" cx={120} cy={92} rx={100} ry={20} />
      <g transform="rotate(10 120 60)">
        <rect x="82" y="10" width="76" height="86" rx="10" fill="url(#dca)" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x="94" y={26 + i * 14} width={i === 3 ? 30 : 52} height="6" rx="3" fill="#e0f2fe" opacity=".85" />)}
      </g>
      <circle cx="152" cy="86" r="17" fill="#a855f7" stroke="#f5d0fe" strokeWidth="2" />
      <path d="M144 86l6 6 11-12" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Sparkle x={58} y={30} s={5} /><Sparkle x={190} y={24} s={4} c="#67e8f9" />
    </svg>
  );
}

export function MountainArt({ className = 'w-80 h-40' }) {
  return (
    <svg viewBox="0 0 320 160" className={className}>
      <Defs id="mt" />
      <path d="M10 150 L90 90 L130 112 L190 40 L250 104 L290 82 L320 150 Z" fill="#312e81" opacity=".55" />
      <path d="M60 150 L190 32 L310 150 Z" fill="url(#mta)" opacity=".9" />
      <path d="M190 32 L172 60 L184 56 L192 66 L200 54 L210 62 Z" fill="#f0f9ff" opacity=".9" />
      <path d="M110 150 C150 130 170 120 160 100 S190 70 190 40" stroke="#67e8f9" strokeWidth="3" fill="none" strokeDasharray="2 6" strokeLinecap="round" />
      <line x1="190" y1="32" x2="190" y2="2" stroke="#e9d5ff" strokeWidth="2.5" />
      <path d="M190 3 L222 10 L190 20 Z" fill="#e879f9" />
      <ellipse cx="190" cy="34" rx="34" ry="10" fill="url(#mtg)" filter="url(#mtf)" />
      <Sparkle x={250} y={30} /><Sparkle x={120} y={40} s={4} /><Sparkle x={290} y={56} s={4} c="#67e8f9" />
    </svg>
  );
}

export function HouseArt({ className = 'w-72 h-40' }) {
  return (
    <svg viewBox="0 0 300 160" className={className}>
      <Defs id="hs" />
      <Orbit id="hs" cx={150} cy={130} rx={130} ry={24} />
      <path d="M86 124 V74 L150 30 L214 74 V124 Z" fill="#3730a3" stroke="#a5b4fc" strokeWidth="2" />
      <path d="M74 80 L150 24 L226 80" stroke="url(#hsa)" strokeWidth="9" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <rect x="186" y="34" width="14" height="26" fill="#4338ca" stroke="#a5b4fc" />
      <rect x="104" y="84" width="30" height="24" rx="3" fill="#fcd34d" />
      <path d="M119 84v24M104 96h30" stroke="#92400e" strokeOpacity=".5" />
      <rect x="160" y="84" width="32" height="40" rx="3" fill="#fbbf24" />
      <circle cx="186" cy="105" r="2" fill="#78350f" />
      <rect x="138" y="54" width="24" height="18" rx="3" fill="#fde68a" opacity=".9" />
      <circle cx="232" cy="118" r="16" fill="#0d9488" opacity=".9" /><circle cx="250" cy="122" r="12" fill="#14b8a6" opacity=".8" /><circle cx="66" cy="120" r="12" fill="#0d9488" opacity=".8" />
      <Sparkle x={262} y={30} /><Sparkle x={46} y={50} s={4} c="#67e8f9" />
    </svg>
  );
}

export function CoinHouseArt({ className = 'w-56 h-40' }) {
  return (
    <svg viewBox="0 0 220 150" className={className}>
      <Defs id="ch" />
      <Orbit id="ch" cx={110} cy={124} rx={95} ry={20} />
      <ellipse cx="96" cy="120" rx="44" ry="10" fill="#4338ca" opacity=".7" />
      <g transform="rotate(-18 110 70)">
        <ellipse cx="112" cy="70" rx="46" ry="50" fill="#0e7490" />
        <ellipse cx="108" cy="68" rx="46" ry="50" fill="url(#cha)" />
        <ellipse cx="108" cy="68" rx="36" ry="40" fill="none" stroke="#e0f2fe" strokeOpacity=".6" strokeWidth="2" />
        <path d="M90 76 V62 L108 48 L126 62 V76 Z" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
        <rect x="103" y="64" width="10" height="12" fill="#fff" />
      </g>
      <Sparkle x={170} y={30} /><Sparkle x={40} y={50} s={4} c="#67e8f9" /><Sparkle x={184} y={96} s={4} />
    </svg>
  );
}

export function EnvelopesArt({ className = 'w-80 h-32' }) {
  const env = (x, y, r, c, sc = 1) => (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${sc})`}>
      <rect x="-48" y="-30" width="96" height="60" rx="8" fill={c} stroke="#e0f2fe" strokeOpacity=".5" />
      <path d="M-48 -26 L0 8 L48 -26" stroke="#e0f2fe" strokeOpacity=".7" strokeWidth="2.5" fill="none" />
    </g>
  );
  return (
    <svg viewBox="0 0 320 130" className={className}>
      <Defs id="ev" />
      <Orbit id="ev" cx={160} cy={108} rx={140} ry={18} />
      {env(90, 74, -10, '#0891b2', 0.85)}
      {env(236, 72, 10, '#7c3aed', 0.85)}
      {env(160, 58, -4, 'url(#eva)', 1.15)}
      <text x="160" y="66" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="22" fill="#fff">M</text>
      <Sparkle x={64} y={22} /><Sparkle x={282} y={20} s={4} c="#67e8f9" /><Sparkle x={210} y={14} s={4} />
    </svg>
  );
}

export function CalendarArt({ className = 'w-72 h-36' }) {
  return (
    <svg viewBox="0 0 300 150" className={className}>
      <Defs id="cc" />
      <Orbit id="cc" cx={150} cy={128} rx={130} ry={20} />
      <g transform="rotate(-8 140 70)">
        <rect x="76" y="26" width="128" height="96" rx="14" fill="url(#cca)" />
        <rect x="76" y="26" width="128" height="26" rx="12" fill="#1e3a8a" opacity=".6" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={94 + i * 28} y="16" width="9" height="22" rx="4.5" fill="#c7d2fe" stroke="#4338ca" />)}
        {Array.from({ length: 12 }).map((_, i) => <rect key={i} x={90 + (i % 4) * 26} y={62 + Math.floor(i / 4) * 18} width="18" height="12" rx="3" fill="#e0f2fe" opacity={i === 5 ? 1 : 0.55} />)}
      </g>
      {[0, 1, 2, 3].map((i) => <ellipse key={i} cx="226" cy={118 - i * 9} rx="24" ry="8" fill={i % 2 ? '#c026d3' : '#a855f7'} stroke="#f5d0fe" strokeOpacity=".6" />)}
      {[0, 1].map((i) => <ellipse key={i} cx="256" cy={122 - i * 9} rx="18" ry="6" fill="#6366f1" stroke="#c7d2fe" strokeOpacity=".6" />)}
      <Sparkle x={58} y={30} /><Sparkle x={270} y={30} s={4} c="#67e8f9" />
    </svg>
  );
}

export function PiggyArt({ className = 'w-28 h-24' }) {
  return (
    <svg viewBox="0 0 120 100" className={className}>
      <Defs id="pg" />
      <ellipse cx="58" cy="92" rx="44" ry="6" fill="#a855f7" opacity=".35" />
      <ellipse cx="58" cy="60" rx="40" ry="28" fill="url(#pga)" />
      <circle cx="94" cy="58" r="11" fill="#c084fc" /><circle cx="91" cy="56" r="1.8" fill="#3b0764" /><circle cx="97" cy="56" r="1.8" fill="#3b0764" />
      <path d="M40 34 L46 22 L54 33Z" fill="#a78bfa" />
      <circle cx="74" cy="48" r="2.5" fill="#1e1b4b" />
      <rect x="34" y="80" width="10" height="12" rx="3" fill="#7c3aed" /><rect x="66" y="80" width="10" height="12" rx="3" fill="#7c3aed" />
      <rect x="50" y="32" width="18" height="4" rx="2" fill="#1e1b4b" />
      <circle cx="59" cy="16" r="12" fill="#fbbf24" stroke="#fde68a" strokeWidth="2" /><text x="59" y="21" textAnchor="middle" fontSize="13" fontWeight="800" fill="#92400e">$</text>
    </svg>
  );
}

export function TargetArt({ className = 'w-32 h-28' }) {
  return (
    <svg viewBox="0 0 140 120" className={className}>
      <Defs id="tg" />
      {[48, 36, 24, 12].map((r, i) => <circle key={r} cx="66" cy="64" r={r} fill="none" stroke={i % 2 ? '#22d3ee' : '#a855f7'} strokeWidth="7" opacity=".9" />)}
      <circle cx="66" cy="64" r="5" fill="#f0abfc" />
      <path d="M66 64 L120 14" stroke="#e0f2fe" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M112 10 L130 6 L124 22 Z" fill="#22d3ee" />
      <Sparkle x={20} y={20} s={5} /><Sparkle x={124} y={92} s={4} c="#67e8f9" />
    </svg>
  );
}
