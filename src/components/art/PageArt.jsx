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
