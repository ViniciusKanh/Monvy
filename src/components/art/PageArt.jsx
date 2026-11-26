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

// Blocos de "app" flutuantes com ícones genéricos (sem marcas)
const Tile = ({ x, y, r = 0, s = 1, from, to, children }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
    <rect x="-26" y="-22" width="52" height="52" rx="13" fill="#0f172a" opacity=".55" />
    <rect x="-26" y="-26" width="52" height="52" rx="13" fill={`url(#${from}${to})`} stroke="#fff" strokeOpacity=".25" />
    <defs><linearGradient id={`${from}${to}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={from} /><stop offset="100%" stopColor={to} /></linearGradient></defs>
    {children}
  </g>
);

export function AppsArt({ className = 'w-96 h-40' }) {
  return (
    <svg viewBox="0 0 380 160" className={className}>
      <Defs id="ap" />
      <ellipse cx="190" cy="96" rx="170" ry="40" fill="none" stroke="url(#apb)" strokeWidth="3" transform="rotate(-8 190 96)" />
      <ellipse cx="190" cy="96" rx="120" ry="30" fill="url(#apg)" filter="url(#apf)" />
      <Tile x={92} y={62} r={-12} from="#be123c" to="#7f1d1d"><path d="M-8 -12 L12 0 L-8 12 Z" fill="#fff" /></Tile>
      <Tile x={160} y={50} r={-4} s={1.1} from="#059669" to="#065f46"><path d="M-10 -6 Q0 -12 10 -6 M-8 1 Q0 -4 8 1 M-6 8 Q0 4 6 8" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" /></Tile>
      <Tile x={232} y={42} r={10} from="#0ea5e9" to="#1e3a8a"><path d="M-12 -2 L0 -12 L12 -2 L12 10 L-12 10 Z" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" /></Tile>
      <Tile x={292} y={84} r={12} from="#2563eb" to="#4c1d95"><path d="M-12 4 L-4 -8 L4 2 L12 -6" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" /></Tile>
      <Tile x={196} y={112} r={-6} s={0.95} from="#7c3aed" to="#3b0764"><text x="0" y="8" textAnchor="middle" fontSize="20" fontWeight="900" fill="#fff" fontFamily="system-ui">+</text></Tile>
      <Tile x={128} y={118} r={6} s={0.9} from="#ec4899" to="#9d174d"><rect x="-12" y="-9" width="24" height="18" rx="4" fill="#fff" /><path d="M-4 -4 L5 0 L-4 4 Z" fill="#be185d" /></Tile>
      <Tile x={348} y={118} r={-8} s={0.75} from="#38bdf8" to="#0369a1"><path d="M-12 6 a8 8 0 0 1 4 -14 a10 10 0 0 1 18 4 a6 6 0 0 1 2 10 Z" fill="#fff" /></Tile>
      <Sparkle x={40} y={40} /><Sparkle x={360} y={30} s={4} c="#67e8f9" /><Sparkle x={60} y={120} s={4} c="#f0abfc" />
    </svg>
  );
}

export function VaultArt({ className = 'w-96 h-44' }) {
  return (
    <svg viewBox="0 0 380 180" className={className}>
      <Defs id="va" />
      <Orbit id="va" cx={200} cy={152} rx={160} ry={22} />
      {[0, 1, 2, 3, 4].map((i) => <ellipse key={i} cx="70" cy={150 - i * 10} rx="22" ry="7" fill={i % 2 ? '#d97706' : '#f59e0b'} stroke="#fde68a" strokeOpacity=".7" />)}
      {[0, 1, 2].map((i) => <ellipse key={i} cx="104" cy={154 - i * 10} rx="18" ry="6" fill={i % 2 ? '#d97706' : '#fbbf24'} stroke="#fde68a" strokeOpacity=".7" />)}
      <rect x="128" y="22" width="132" height="128" rx="18" fill="#1e1b4b" />
      <rect x="122" y="16" width="132" height="128" rx="18" fill="url(#vaa)" />
      <rect x="134" y="28" width="108" height="104" rx="12" fill="#0f172a" opacity=".55" stroke="#c4b5fd" strokeOpacity=".5" />
      <circle cx="188" cy="80" r="34" fill="none" stroke="#67e8f9" strokeWidth="4" />
      <circle cx="188" cy="80" r="24" fill="#1e293b" stroke="#a78bfa" strokeWidth="3" />
      {Array.from({ length: 12 }).map((_, i) => { const a = (i / 12) * Math.PI * 2; return <line key={i} x1={188 + Math.cos(a) * 28} y1={80 + Math.sin(a) * 28} x2={188 + Math.cos(a) * 33} y2={80 + Math.sin(a) * 33} stroke="#67e8f9" strokeWidth="2" />; })}
      <text x="188" y="88" textAnchor="middle" fontSize="22" fontWeight="900" fill="#5eead4" fontFamily="system-ui">M</text>
      <rect x="244" y="56" width="10" height="34" rx="4" fill="#67e8f9" />
      <g transform="translate(300 118)">
        <ellipse cx="0" cy="0" rx="40" ry="28" fill="url(#vaa)" opacity=".95" />
        <circle cx="34" cy="-4" r="10" fill="#e879f9" /><circle cx="14" cy="-10" r="2.5" fill="#1e1b4b" />
        <path d="M-16 -26 L-10 -38 L-2 -27 Z" fill="#c084fc" />
        <rect x="-10" y="-30" width="18" height="4" rx="2" fill="#1e1b4b" />
        <rect x="-24" y="20" width="9" height="12" rx="3" fill="#7c3aed" /><rect x="12" y="20" width="9" height="12" rx="3" fill="#7c3aed" />
      </g>
      <ellipse cx="300" cy="78" rx="14" ry="5" fill="#fbbf24" stroke="#fde68a" />
      <Sparkle x={70} y={40} /><Sparkle x={356} y={36} s={4} c="#67e8f9" /><Sparkle x={278} y={22} s={4} />
    </svg>
  );
}

export function BrainArt({ className = 'w-96 h-40' }) {
  const nodes = [[60, 40], [110, 20], [300, 24], [340, 60], [40, 110], [330, 120], [90, 140], [280, 150]];
  return (
    <svg viewBox="0 0 380 170" className={className}>
      <Defs id="br" />
      {nodes.map(([x, y], i) => <g key={i}><line x1={x} y1={y} x2="190" y2="82" stroke="#a78bfa" strokeOpacity=".35" /><circle cx={x} cy={y} r="4" fill={i % 2 ? '#67e8f9' : '#f0abfc'} /></g>)}
      <ellipse cx="190" cy="140" rx="150" ry="16" fill="none" stroke="url(#brb)" strokeWidth="3" />
      <ellipse cx="190" cy="140" rx="110" ry="10" fill="url(#brg)" filter="url(#brf)" />
      <path d="M190 22 C150 18 128 40 132 62 C112 70 114 100 134 108 C136 128 164 136 190 128 C216 136 244 128 246 108 C266 100 268 70 248 62 C252 40 230 18 190 22 Z" fill="url(#bra)" opacity=".85" stroke="#e9d5ff" strokeOpacity=".6" strokeWidth="2" />
      {[[150, 50, 176, 62], [160, 88, 184, 98], [204, 50, 230, 66], [198, 96, 230, 92], [190, 24, 190, 128]].map(([a, b, c, d], i) => <path key={i} d={`M${a} ${b} Q${(a + c) / 2} ${b - 14} ${c} ${d}`} stroke="#fff" strokeOpacity=".45" strokeWidth="2.5" fill="none" />)}
      <rect x="160" y="62" width="60" height="38" rx="10" fill="#0f172a" stroke="#67e8f9" strokeWidth="2.5" />
      <text x="190" y="89" textAnchor="middle" fontSize="20" fontWeight="900" fill="#e0f2fe" fontFamily="system-ui">IA</text>
      <Sparkle x={250} y={18} /><Sparkle x={120} y={150} s={4} c="#67e8f9" />
    </svg>
  );
}

export function ChipArt({ className = 'w-44 h-36' }) {
  return (
    <svg viewBox="0 0 180 140" className={className}>
      <Defs id="cp" />
      <path d="M90 70 L160 100 L90 130 L20 100 Z" fill="#1e1b4b" stroke="#67e8f9" strokeOpacity=".7" strokeWidth="2" />
      <path d="M90 58 L150 86 L90 114 L30 86 Z" fill="url(#cpa)" opacity=".9" />
      {Array.from({ length: 8 }).map((_, i) => <line key={i} x1={44 + i * 13} y1={20 + (i % 3) * 8} x2={44 + i * 13} y2={78} stroke="#67e8f9" strokeOpacity=".6" />)}
      <rect x="62" y="42" width="56" height="40" rx="10" fill="#0f172a" stroke="#a78bfa" strokeWidth="2.5" />
      <text x="90" y="69" textAnchor="middle" fontSize="18" fontWeight="900" fill="#e0f2fe" fontFamily="system-ui">IA</text>
    </svg>
  );
}

export function HeartArt({ className = 'w-96 h-44' }) {
  return (
    <svg viewBox="0 0 380 180" className={className}>
      <Defs id="ht" />
      <Orbit id="ht" cx={190} cy={150} rx={150} ry={22} />
      {[0, 1, 2, 3].map((i) => <ellipse key={i} cx="110" cy={150 - i * 10} rx="30" ry="9" fill={i % 2 ? '#0e7490' : '#22d3ee'} stroke="#cffafe" strokeOpacity=".6" />)}
      {[0, 1, 2, 3].map((i) => <rect key={i} x={230 + i * 20} y={140 - (14 + i * 14)} width="14" height={14 + i * 14} rx="3" fill={i % 2 ? '#a855f7' : '#22d3ee'} opacity=".85" />)}
      <path d="M190 132 C120 92 118 42 152 34 C170 30 184 42 190 54 C196 42 210 30 228 34 C262 42 260 92 190 132 Z" fill="url(#hta)" opacity=".85" stroke="#f5d0fe" strokeWidth="2" />
      <path d="M128 78 L160 78 L172 58 L186 100 L200 70 L210 82 L252 82" stroke="#fff" strokeWidth="4" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M262 64 L286 56 L310 64 L310 92 C310 108 286 120 286 120 C286 120 262 108 262 92 Z" fill="#0e7490" stroke="#67e8f9" strokeWidth="2.5" />
      <path d="M274 88 L284 98 L300 78" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
      <Sparkle x={80} y={40} /><Sparkle x={320} y={30} s={4} c="#67e8f9" />
    </svg>
  );
}

export function HabitsArt({ className = 'w-96 h-44' }) {
  return (
    <svg viewBox="0 0 380 180" className={className}>
      <Defs id="hb" />
      <path d="M10 150 C90 120 140 170 230 120 S340 80 380 100" stroke="url(#hbb)" strokeWidth="4" fill="none" />
      <Tile x={120} y={60} r={-10} s={1.2} from="#6366f1" to="#1e1b4b"><path d="M-12 12 V2 M-4 12 V-6 M4 12 V-12 M12 12 V-2" stroke="#67e8f9" strokeWidth="4" strokeLinecap="round" /></Tile>
      <Tile x={300} y={46} r={8} from="#db2777" to="#701a75"><path d="M-10 -4 H10 L8 12 H-8 Z M-5 -4 V-9 A5 5 0 0 1 5 -9 V-4" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinejoin="round" /></Tile>
      <Tile x={318} y={128} r={-8} from="#0891b2" to="#164e63"><rect x="-14" y="-7" width="28" height="16" rx="8" fill="none" stroke="#fff" strokeWidth="2.5" /><circle cx="-6" cy="1" r="2" fill="#fff" /><circle cx="7" cy="1" r="2" fill="#fff" /></Tile>
      <Tile x={60} y={130} r={10} s={0.9} from="#f59e0b" to="#7c2d12"><path d="M-8 -10 H8 L6 12 H-6 Z" fill="#fff" /><path d="M8 -4 H12 V4 H7" stroke="#fff" strokeWidth="2.5" fill="none" /></Tile>
      <Tile x={210} y={110} r={-14} s={1.05} from="#0ea5e9" to="#312e81"><rect x="-15" y="-10" width="30" height="20" rx="4" fill="none" stroke="#fff" strokeWidth="2.5" /><line x1="-15" y1="-3" x2="15" y2="-3" stroke="#fff" strokeWidth="3" /></Tile>
      <Tile x={210} y={36} r={6} s={0.85} from="#a855f7" to="#4c1d95"><path d="M0 -12 L3 -3 L12 -3 L5 3 L8 12 L0 6 L-8 12 L-5 3 L-12 -3 L-3 -3 Z" fill="#fde68a" /></Tile>
      <Sparkle x={30} y={40} /><Sparkle x={360} y={30} s={4} c="#67e8f9" /><Sparkle x={160} y={150} s={4} c="#f0abfc" />
    </svg>
  );
}

export function WaveBarsArt({ className = 'w-96 h-28' }) {
  return (
    <svg viewBox="0 0 380 110" className={className}>
      <Defs id="wb" />
      <path d="M0 90 C60 60 110 100 170 70 S290 20 380 40" stroke="#22d3ee" strokeOpacity=".7" strokeWidth="3" fill="none" />
      <path d="M0 100 C70 80 120 104 190 84 S300 50 380 64" stroke="#a855f7" strokeOpacity=".7" strokeWidth="3" fill="none" />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={240 + i * 24} y={100 - (24 + i * 16)} width="16" height={24 + i * 16} rx="3" fill={i % 2 ? '#22d3ee' : '#6366f1'} opacity={0.5 + i * 0.1} />)}
      <rect x="336" y="4" width="16" height="96" rx="3" fill="url(#wba)" />
      <Sparkle x={210} y={20} s={4} /><Sparkle x={60} y={40} s={4} c="#67e8f9" />
    </svg>
  );
}

export function CardFlowArt({ className = 'w-56 h-32' }) {
  return (
    <svg viewBox="0 0 220 130" className={className}>
      <Defs id="cf" />
      <Orbit id="cf" cx={120} cy={110} rx={90} ry={16} />
      <path d="M0 110 C40 80 70 112 110 90" stroke="#a855f7" strokeWidth="3" fill="none" opacity=".6" />
      <g transform="rotate(-16 130 64)">
        <rect x="74" y="34" width="116" height="72" rx="11" fill="url(#cfa)" stroke="#fff" strokeOpacity=".35" />
        <rect x="88" y="58" width="20" height="15" rx="3" fill="#fde68a" />
        <path d="M160 52a8 8 0 0 1 0 12M165 48a14 14 0 0 1 0 20" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <text x="168" y="46" fontSize="14" fontWeight="900" fill="#fff" fontFamily="system-ui">M</text>
      </g>
      <Sparkle x={30} y={30} s={4} /><Sparkle x={200} y={24} s={4} c="#67e8f9" />
    </svg>
  );
}

export function AntArt({ className = 'w-96 h-40' }) {
  return (
    <svg viewBox="0 0 380 160" className={className}>
      <Defs id="an" />
      <Orbit id="an" cx={170} cy={140} rx={150} ry={16} />
      <g transform="translate(110 92)">
        {[[-30, 30], [0, 34], [30, 30]].map(([x, y], i) => <path key={i} d={`M${x} 0 L${x - 14} ${y}`} stroke="#a78bfa" strokeWidth="4" strokeLinecap="round" />)}
        {[[-30, 30], [0, 34], [30, 30]].map(([x, y], i) => <path key={`b${i}`} d={`M${x} 0 L${x + 14} ${y}`} stroke="#a78bfa" strokeWidth="4" strokeLinecap="round" />)}
        <ellipse cx="-44" cy="-4" rx="30" ry="22" fill="url(#ana)" />
        <ellipse cx="0" cy="-6" rx="16" ry="13" fill="#6366f1" />
        <circle cx="38" cy="-14" r="20" fill="url(#ana)" />
        <rect x="34" y="-22" width="22" height="10" rx="5" fill="#0f172a" /><rect x="38" y="-20" width="14" height="6" rx="3" fill="#67e8f9" />
        <path d="M46 -32 Q60 -64 84 -60 M38 -32 Q40 -66 62 -74" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="84" cy="-60" r="4" fill="#67e8f9" /><circle cx="62" cy="-74" r="4" fill="#67e8f9" />
      </g>
      {[0, 1, 2, 3].map((i) => <ellipse key={i} cx="232" cy={120 - i * 10} rx="24" ry="8" fill={i % 2 ? '#d97706' : '#f59e0b'} stroke="#fde68a" strokeOpacity=".7" />)}
      <g transform="rotate(-14 272 68)"><circle cx="272" cy="68" r="30" fill="#d97706" stroke="#fde68a" strokeWidth="3" /><text x="272" y="76" textAnchor="middle" fontSize="20" fontWeight="900" fill="#fff7ed" fontFamily="system-ui">R$</text></g>
      <circle cx="334" cy="44" r="26" fill="#0f172a" fillOpacity=".4" stroke="#c4b5fd" strokeWidth="6" />
      <line x1="352" y1="64" x2="372" y2="90" stroke="#c4b5fd" strokeWidth="9" strokeLinecap="round" />
      {[0, 1, 2].map((i) => <rect key={i} x={322 + i * 9} y={54 - (6 + i * 7)} width="6" height={6 + i * 7} rx="1.5" fill="#e879f9" />)}
      <Sparkle x={40} y={30} /><Sparkle x={200} y={24} s={4} c="#67e8f9" />
    </svg>
  );
}

export function ShieldArt({ className = 'w-60 h-40' }) {
  return (
    <svg viewBox="0 0 240 160" className={className}>
      <Defs id="sh" />
      <Orbit id="sh" cx={120} cy={140} rx={100} ry={16} />
      <path d="M120 10 L180 30 L180 78 C180 112 150 132 120 146 C90 132 60 112 60 78 L60 30 Z" fill="url(#sha)" opacity=".9" stroke="#e0f2fe" strokeOpacity=".6" strokeWidth="3" />
      <path d="M120 26 L166 42 L166 78 C166 104 144 120 120 132 C96 120 74 104 74 78 L74 42 Z" fill="#0f172a" fillOpacity=".35" />
      <path d="M96 80 L114 98 L148 60" stroke="#5eead4" strokeWidth="11" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Sparkle x={30} y={40} /><Sparkle x={214} y={30} s={4} c="#67e8f9" />
    </svg>
  );
}

// Gráfico + chip (simulador com aprendizado de máquina)
export function MlChartArt({ className = 'w-96 h-40' }) {
  return (
    <svg viewBox="0 0 380 160" className={className}>
      <Defs id="ml" />
      <Orbit id="ml" cx={190} cy={142} rx={160} ry={14} />
      <rect x="40" y="30" width="200" height="104" rx="12" fill="#0f172a" fillOpacity=".55" stroke="#818cf8" strokeOpacity=".5" />
      {[0, 1, 2].map((i) => <line key={i} x1="54" x2="226" y1={56 + i * 24} y2={56 + i * 24} stroke="#64748b" strokeOpacity=".3" strokeDasharray="3 4" />)}
      {[[62, 30], [86, 44], [110, 38], [134, 58], [158, 66], [182, 54]].map(([x, h], i) => <rect key={i} x={x} y={122 - h} width="14" height={h} rx="3" fill="url(#mla)" opacity=".75" />)}
      <path d="M56 104 L90 86 L118 92 L146 66 L176 58 L222 38" stroke="#5eead4" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M222 38 L214 36 M222 38 L220 46" stroke="#5eead4" strokeWidth="3.5" strokeLinecap="round" />
      <g transform="translate(290 78)">
        <rect x="-38" y="-38" width="76" height="76" rx="14" fill="url(#mla)" />
        <rect x="-26" y="-26" width="52" height="52" rx="8" fill="#0f172a" fillOpacity=".55" />
        {[-24, -8, 8, 24].map((p) => <g key={p}><line x1={p} y1="-38" x2={p} y2="-50" stroke="#a5b4fc" strokeWidth="3" /><line x1={p} y1="38" x2={p} y2="50" stroke="#a5b4fc" strokeWidth="3" /><line x1="-38" y1={p} x2="-50" y2={p} stroke="#a5b4fc" strokeWidth="3" /><line x1="38" y1={p} x2="50" y2={p} stroke="#a5b4fc" strokeWidth="3" /></g>)}
        <text x="0" y="8" textAnchor="middle" fontSize="22" fontWeight="900" fill="#e0e7ff" fontFamily="system-ui">ML</text>
      </g>
      <Sparkle x={26} y={24} /><Sparkle x={356} y={22} s={4} c="#67e8f9" />
    </svg>
  );
}

// Pilhas de moedas crescendo + seta (juros compostos)
export function CoinsGrowthArt({ className = 'w-80 h-40' }) {
  return (
    <svg viewBox="0 0 320 160" className={className}>
      <Defs id="cg" />
      <Orbit id="cg" cx={160} cy={142} rx={140} ry={14} />
      {[2, 4, 6, 8].map((n, k) => <g key={k}>{Array.from({ length: n }).map((_, i) => <ellipse key={i} cx={70 + k * 56} cy={136 - i * 9} rx="22" ry="7" fill={i % 2 ? '#d97706' : '#f59e0b'} stroke="#fde68a" strokeOpacity=".7" />)}</g>)}
      <path d="M50 110 Q120 100 170 70 T290 18" stroke="url(#cga)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M290 18 L276 18 M290 18 L288 32" stroke="#e879f9" strokeWidth="5" strokeLinecap="round" />
      <Sparkle x={30} y={36} /><Sparkle x={240} y={30} s={4} c="#67e8f9" />
    </svg>
  );
}

// Casa + calculadora (financiamento)
export function HouseCalcArt({ className = 'w-80 h-40' }) {
  return (
    <svg viewBox="0 0 320 160" className={className}>
      <Defs id="hc" />
      <Orbit id="hc" cx={160} cy={142} rx={140} ry={14} />
      <path d="M40 80 L110 26 L180 80" stroke="url(#hca)" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="58" y="76" width="104" height="60" rx="6" fill="#1e1b4b" fillOpacity=".7" stroke="#a5b4fc" strokeOpacity=".5" />
      <rect x="98" y="100" width="26" height="36" rx="3" fill="url(#hca)" />
      <rect x="70" y="88" width="20" height="16" rx="2" fill="#67e8f9" opacity=".6" /><rect x="132" y="88" width="20" height="16" rx="2" fill="#67e8f9" opacity=".6" />
      <g transform="rotate(8 248 84)">
        <rect x="204" y="30" width="88" height="110" rx="12" fill="url(#hca)" />
        <rect x="214" y="40" width="68" height="24" rx="5" fill="#0f172a" fillOpacity=".7" />
        <text x="276" y="58" textAnchor="end" fontSize="13" fontWeight="800" fill="#5eead4" fontFamily="monospace">R$</text>
        {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={214 + c * 24} y={72 + r * 21} width="18" height="15" rx="3" fill="#fff" fillOpacity={r === 2 && c === 2 ? '.85' : '.3'} />))}
      </g>
      <Sparkle x={24} y={34} /><Sparkle x={196} y={20} s={4} c="#67e8f9" />
    </svg>
  );
}

// Contracheque (salário líquido)
export function PayslipArt({ className = 'w-72 h-40' }) {
  return (
    <svg viewBox="0 0 300 160" className={className}>
      <Defs id="ps" />
      <Orbit id="ps" cx={150} cy={142} rx={130} ry={14} />
      <g transform="rotate(-6 130 80)">
        <rect x="70" y="16" width="130" height="122" rx="10" fill="#1e1b4b" fillOpacity=".8" stroke="#a5b4fc" strokeOpacity=".5" />
        <rect x="70" y="16" width="130" height="24" rx="10" fill="url(#psa)" />
        <circle cx="90" cy="60" r="10" fill="#a78bfa" />
        {[0, 1, 2, 3].map((i) => <g key={i}><rect x="84" y={80 + i * 12} width="60" height="5" rx="2.5" fill="#fff" opacity=".35" /><rect x={160 + (i % 2) * 8} y={80 + i * 12} width={28 - (i % 2) * 8} height="5" rx="2.5" fill={i === 3 ? '#5eead4' : '#fff'} opacity={i === 3 ? 1 : 0.35} /></g>)}
        <rect x="108" y="56" width="60" height="7" rx="3.5" fill="#fff" opacity=".5" />
      </g>
      <g transform="translate(230 92)"><circle r="30" fill="#d97706" stroke="#fde68a" strokeWidth="3" /><text y="7" textAnchor="middle" fontSize="20" fontWeight="900" fill="#fff7ed" fontFamily="system-ui">R$</text></g>
      <Sparkle x={40} y={30} /><Sparkle x={270} y={36} s={4} c="#67e8f9" />
    </svg>
  );
}

// Documento IRPF com leão estilizado não; apenas doc + selo de porcentagem
export function TaxDocArt({ className = 'w-56 h-32' }) {
  return (
    <svg viewBox="0 0 220 130" className={className}>
      <Defs id="td" />
      <g transform="rotate(-8 90 64)">
        <rect x="40" y="10" width="96" height="112" rx="10" fill="#0f172a" fillOpacity=".5" stroke="#bae6fd" strokeOpacity=".6" />
        <text x="88" y="36" textAnchor="middle" fontSize="15" fontWeight="900" fill="#e0f2fe" fontFamily="system-ui">IRPF</text>
        {[0, 1, 2, 3, 4].map((i) => <rect key={i} x="54" y={48 + i * 13} width={i % 2 ? 50 : 68} height="5" rx="2.5" fill="#fff" opacity=".35" />)}
      </g>
      <g transform="translate(160 78)"><circle r="30" fill="url(#tda)" /><text y="8" textAnchor="middle" fontSize="24" fontWeight="900" fill="#fff" fontFamily="system-ui">%</text></g>
      <Sparkle x={22} y={24} c="#bae6fd" /><Sparkle x={200} y={30} s={4} c="#67e8f9" />
    </svg>
  );
}

// Dois documentos com check (conciliação)
export function ReconcileArt({ className = 'w-80 h-40' }) {
  return (
    <svg viewBox="0 0 320 160" className={className}>
      <Defs id="rc" />
      <Orbit id="rc" cx={160} cy={142} rx={140} ry={14} />
      {[[70, -8], [150, 6]].map(([x, r], k) => (
        <g key={k} transform={`rotate(${r} ${x + 45} 76)`}>
          <rect x={x} y="18" width="90" height="112" rx="10" fill="#1e1b4b" fillOpacity=".8" stroke="#a5b4fc" strokeOpacity=".5" />
          {[0, 1, 2, 3, 4].map((i) => <g key={i}><rect x={x + 12} y={36 + i * 16} width="10" height="10" rx="2" fill={i < 3 ? '#34d399' : '#475569'} /><rect x={x + 28} y={39 + i * 16} width={44 - (i % 2) * 10} height="5" rx="2.5" fill="#fff" opacity=".35" /></g>)}
        </g>
      ))}
      <g transform="translate(266 56)"><circle r="28" fill="url(#rca)" /><path d="M-12 0 L-3 10 L14 -10" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>
      <path d="M140 66 l12 0 m-6 -6 l6 6 l-6 6" stroke="#5eead4" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Sparkle x={36} y={30} /><Sparkle x={300} y={110} s={4} c="#67e8f9" />
    </svg>
  );
}

// Candles + globo (mercado)
export function MarketArt({ className = 'w-80 h-40' }) {
  const c = [[60, 70, 100, 80, 96], [86, 60, 92, 66, 88], [112, 52, 84, 76, 58], [138, 40, 70, 46, 64], [164, 30, 60, 54, 36], [190, 20, 48, 24, 42]];
  return (
    <svg viewBox="0 0 320 160" className={className}>
      <Defs id="mk" />
      <Orbit id="mk" cx={160} cy={142} rx={140} ry={14} />
      {c.map(([x, hi, lo, o, cl], i) => { const up = cl < o; return <g key={i}><line x1={x + 7} x2={x + 7} y1={hi + 20} y2={lo + 30} stroke={up ? '#34d399' : '#fb7185'} strokeWidth="2" /><rect x={x} y={Math.min(o, cl) + 24} width="14" height={Math.max(6, Math.abs(o - cl))} rx="2" fill={up ? '#34d399' : '#fb7185'} /></g>; })}
      <g transform="translate(262 70)"><circle r="40" fill="url(#mka)" opacity=".9" /><ellipse rx="40" ry="14" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2" /><ellipse rx="16" ry="40" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2" /><line x1="-40" x2="40" stroke="#fff" strokeOpacity=".5" strokeWidth="2" /></g>
      <Sparkle x={34} y={30} /><Sparkle x={214} y={20} s={4} c="#67e8f9" />
    </svg>
  );
}

// Globo + moedas flutuando (conversor)
export function GlobeFxArt({ className = 'w-96 h-40' }) {
  const coin = (x, y, s, c, t) => <g key={t} transform={`translate(${x} ${y})`}><rect x={-s / 2} y={-s / 2} width={s} height={s} rx={s * 0.24} fill="#0f172a" fillOpacity=".7" stroke={c} strokeWidth="2.5" style={{ filter: `drop-shadow(0 0 6px ${c})` }} /><text y={s * 0.2} textAnchor="middle" fontSize={s * 0.58} fontWeight="900" fill={c} fontFamily="system-ui">{t}</text></g>;
  return (
    <svg viewBox="0 0 380 160" className={className}>
      <Defs id="gf" />
      <Orbit id="gf" cx={200} cy={138} rx={160} ry={16} />
      <circle cx="200" cy="78" r="58" fill="url(#gfa)" opacity=".35" />
      <circle cx="200" cy="78" r="58" fill="none" stroke="#67e8f9" strokeOpacity=".7" strokeWidth="2" />
      {[-36, -18, 0, 18, 36].map((dy) => <ellipse key={dy} cx="200" cy={78 + dy} rx={Math.sqrt(58 * 58 - dy * dy)} ry="5" fill="none" stroke="#67e8f9" strokeOpacity=".35" />)}
      {[16, 34, 52].map((rx) => <ellipse key={rx} cx="200" cy="78" rx={rx} ry="58" fill="none" stroke="#a78bfa" strokeOpacity=".35" />)}
      <path d="M150 112 Q260 150 330 60" stroke="#22d3ee" strokeWidth="2" fill="none" strokeDasharray="4 5" />
      <path d="M318 52 l16 4 -8 12" fill="none" stroke="#22d3ee" strokeWidth="2.5" />
      {coin(120, 40, 40, '#34d399', '$')}{coin(296, 82, 36, '#38bdf8', '€')}{coin(150, 126, 28, '#5eead4', '¥')}{coin(262, 132, 32, '#e879f9', '£')}
      <Sparkle x={60} y={70} /><Sparkle x={350} y={24} s={4} c="#67e8f9" />
    </svg>
  );
}

// Prédio com colunas + gráfico de velas (indicadores econômicos)
export function EconArt({ className = 'w-96 h-40' }) {
  return (
    <svg viewBox="0 0 380 160" className={className}>
      <Defs id="ec" />
      <Orbit id="ec" cx={190} cy={142} rx={160} ry={14} />
      <path d="M60 58 L130 30 L200 58 Z" fill="url(#eca)" />
      <rect x="66" y="58" width="128" height="8" fill="#a5b4fc" opacity=".8" />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={74 + i * 24} y="70" width="12" height="54" rx="3" fill="#1e1b4b" stroke="#818cf8" strokeOpacity=".6" />)}
      <rect x="60" y="124" width="140" height="10" rx="3" fill="url(#eca)" />
      {[[226, 90, 30, true], [246, 80, 36, false], [266, 66, 40, true], [286, 56, 34, true], [306, 44, 40, false], [326, 30, 44, true]].map(([x, y, h, up], i) => <g key={i}><line x1={x + 6} x2={x + 6} y1={y - 8} y2={y + h + 8} stroke={up ? '#34d399' : '#fb7185'} strokeWidth="2" /><rect x={x} y={y} width="12" height={h} rx="2" fill={up ? '#34d399' : '#fb7185'} /></g>)}
      <path d="M220 120 Q280 100 300 70 T356 24" stroke="#22d3ee" strokeWidth="3" fill="none" />
      <Sparkle x={34} y={40} /><Sparkle x={210} y={26} s={4} c="#67e8f9" />
    </svg>
  );
}

// Velas + seta para cima (ações & FIIs)
export function StocksArt({ className = 'w-96 h-40' }) {
  const c = [[40, 96, 22], [62, 88, 26], [84, 92, 18], [106, 76, 30], [128, 70, 22], [150, 58, 34], [172, 62, 20], [194, 46, 34], [216, 40, 26], [238, 28, 34]];
  return (
    <svg viewBox="0 0 380 160" className={className}>
      <Defs id="sk" />
      <Orbit id="sk" cx={190} cy={142} rx={170} ry={14} />
      {c.map(([x, y, h], i) => { const up = i % 3 !== 2; return <g key={i}><line x1={x + 7} x2={x + 7} y1={y - 8} y2={y + h + 8} stroke={up ? '#34d399' : '#fb7185'} strokeWidth="2" /><rect x={x} y={y} width="14" height={h} rx="2" fill={up ? '#34d399' : '#fb7185'} style={{ filter: `drop-shadow(0 0 4px ${up ? '#34d399' : '#fb7185'})` }} /></g>; })}
      <g transform="translate(300 76)">
        <rect x="-44" y="-50" width="88" height="100" rx="16" fill="url(#ska)" opacity=".9" />
        <rect x="-32" y="-38" width="64" height="76" rx="10" fill="#0f172a" fillOpacity=".55" />
        <path d="M-20 22 L-6 4 L6 12 L22 -16" stroke="#5eead4" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 -16 L10 -16 M22 -16 L22 -4" stroke="#5eead4" strokeWidth="5" strokeLinecap="round" />
      </g>
      <Sparkle x={26} y={30} /><Sparkle x={360} y={20} s={4} c="#67e8f9" />
    </svg>
  );
}

// Cofrinho × cofre (poupança × CDB)
export function PiggyVsVaultArt({ className = 'w-[26rem] h-40' }) {
  return (
    <svg viewBox="0 0 420 160" className={className}>
      <Defs id="pv" />
      <Orbit id="pv" cx={210} cy={142} rx={190} ry={14} />
      <g transform="translate(100 86)">
        <ellipse rx="56" ry="40" fill="#f9a8d4" /><ellipse rx="56" ry="40" fill="url(#pva)" opacity=".25" />
        <circle cx="44" cy="-6" r="16" fill="#f472b6" /><circle cx="40" cy="-8" r="2.5" fill="#831843" /><circle cx="48" cy="-8" r="2.5" fill="#831843" />
        <circle cx="16" cy="-20" r="4" fill="#1e1b4b" /><path d="M-12 -40 l10 -14 6 16" fill="#f472b6" />
        <rect x="-10" y="-44" width="24" height="5" rx="2.5" fill="#831843" />
        {[-34, 26].map((x) => <rect key={x} x={x} y="30" width="12" height="16" rx="4" fill="#f472b6" />)}
        <g transform="translate(0 -66)"><circle r="14" fill="#f59e0b" stroke="#fde68a" strokeWidth="2.5" /><text y="5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff7ed" fontFamily="system-ui">$</text></g>
      </g>
      <g transform="translate(210 80)"><rect x="-26" y="-20" width="52" height="40" rx="10" fill="#0f172a" fillOpacity=".6" stroke="#67e8f9" strokeWidth="2" /><text y="8" textAnchor="middle" fontSize="20" fontWeight="900" fill="#67e8f9" fontFamily="system-ui">VS</text></g>
      <g transform="translate(320 80)">
        <rect x="-62" y="-50" width="124" height="96" rx="14" fill="url(#pva)" stroke="#e0e7ff" strokeOpacity=".5" strokeWidth="2" />
        <rect x="-50" y="-38" width="100" height="72" rx="8" fill="#0f172a" fillOpacity=".45" />
        <text y="10" textAnchor="middle" fontSize="30" fontWeight="900" fill="#e0e7ff" fontFamily="system-ui" fontStyle="italic">CDB</text>
        {[0, 1, 2, 3].map((i) => <ellipse key={i} cx="58" cy={36 - i * 8} rx="18" ry="6" fill={i % 2 ? '#d97706' : '#f59e0b'} stroke="#fde68a" strokeOpacity=".7" />)}
      </g>
      <Sparkle x={30} y={30} /><Sparkle x={400} y={24} s={4} c="#67e8f9" />
    </svg>
  );
}

// Carro genérico (hatch) — FIPE
export function CarArt({ className = 'w-96 h-40' }) {
  return (
    <svg viewBox="0 0 380 160" className={className}>
      <Defs id="ca2" />
      <Orbit id="ca2" cx={190} cy={136} rx={170} ry={16} />
      <path d="M40 112 C40 92 60 86 86 82 L128 52 C140 44 156 40 176 40 L236 40 C262 40 280 50 298 66 L316 80 C338 84 350 94 350 112 Z" fill="url(#ca2a)" opacity=".92" />
      <path d="M136 56 L176 46 L234 46 C252 46 266 54 280 68 L140 72 Z" fill="#0f172a" fillOpacity=".55" stroke="#bae6fd" strokeOpacity=".5" />
      <line x1="200" y1="46" x2="198" y2="70" stroke="#bae6fd" strokeOpacity=".5" />
      <path d="M318 88 l24 4" stroke="#e0f2fe" strokeWidth="4" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px #67e8f9)' }} />
      {[110, 290].map((x) => <g key={x}><circle cx={x} cy="114" r="24" fill="#0f172a" stroke="#64748b" strokeWidth="4" /><circle cx={x} cy="114" r="10" fill="#94a3b8" /></g>)}
      <path d="M40 112 L350 112" stroke="#22d3ee" strokeOpacity=".5" />
      <Sparkle x={30} y={36} /><Sparkle x={350} y={30} s={4} c="#67e8f9" />
    </svg>
  );
}

// Painel de relatório inclinado (relatórios)
export function ReportArt({ className = 'w-96 h-40' }) {
  return (
    <svg viewBox="0 0 380 160" className={className}>
      <Defs id="rp" />
      <Orbit id="rp" cx={190} cy={142} rx={170} ry={14} />
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={30 + i * 22} y={110 - [20, 34, 28, 46, 40, 58][i]} width="14" height={[20, 34, 28, 46, 40, 58][i]} rx="3" fill="#34d399" opacity={0.35 + i * 0.1} />)}
      <g transform="rotate(-10 220 80)">
        <rect x="160" y="26" width="140" height="100" rx="12" fill="#0f172a" fillOpacity=".7" stroke="#a5b4fc" strokeOpacity=".6" />
        <circle cx="262" cy="64" r="22" fill="none" stroke="url(#rpa)" strokeWidth="9" strokeDasharray="100 40" />
        {[0, 1, 2].map((i) => <rect key={i} x="176" y={46 + i * 14} width={50 - i * 10} height="6" rx="3" fill="#fff" opacity=".4" />)}
        {[0, 1, 2, 3].map((i) => <rect key={`b${i}`} x={178 + i * 14} y={112 - (12 + i * 6)} width="9" height={12 + i * 6} rx="2" fill="#22d3ee" />)}
      </g>
      <path d="M300 120 Q330 80 360 40" stroke="#e879f9" strokeWidth="3" fill="none" />
      <Sparkle x={24} y={30} /><Sparkle x={350} y={110} s={4} c="#67e8f9" />
    </svg>
  );
}

// Sino com ondas (notificações)
export function BellArt({ className = 'w-80 h-36' }) {
  return (
    <svg viewBox="0 0 320 150" className={className}>
      <Defs id="bl" />
      <circle cx="110" cy="70" r="58" fill="none" stroke="#67e8f9" strokeOpacity=".5" strokeWidth="2" />
      <circle cx="110" cy="70" r="46" fill="url(#blg)" />
      <path d="M110 30 C88 30 78 48 78 66 L78 88 L68 100 L152 100 L142 88 L142 66 C142 48 132 30 110 30 Z" fill="url(#bla)" />
      <circle cx="110" cy="108" r="8" fill="#c4b5fd" /><circle cx="110" cy="27" r="5" fill="#c4b5fd" />
      <path d="M180 74 L200 74 L208 56 L218 94 L228 64 L236 74 L300 74" stroke="#e879f9" strokeWidth="3" fill="none" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px #e879f9)' }} />
      <Sparkle x={40} y={30} /><Sparkle x={176} y={30} s={4} c="#67e8f9" />
    </svg>
  );
}
