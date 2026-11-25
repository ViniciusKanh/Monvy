// Ilustrações originais (SVG inline, sem imagens externas) usadas nas telas
// de Impostos e Minha Carga Tributária: calculadora + moedas + documento com %,
// e um pequeno robô para o bloco de análise com IA. Puramente decorativas.

export function TaxIllustration({ className = 'w-56 h-40', label = 'TAX' }) {
  return (
    <svg viewBox="0 0 240 170" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="taCalc" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#4c1d95" /></linearGradient>
        <linearGradient id="taScreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1e1b4b" /><stop offset="100%" stopColor="#312e81" /></linearGradient>
        <linearGradient id="taKey" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#2563eb" /></linearGradient>
        <linearGradient id="taDoc" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f5f3ff" /><stop offset="100%" stopColor="#c4b5fd" /></linearGradient>
        <linearGradient id="taCoin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a" /><stop offset="100%" stopColor="#d97706" /></linearGradient>
        <linearGradient id="taPct" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#c026d3" /><stop offset="100%" stopColor="#7c3aed" /></linearGradient>
        <filter id="taGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <ellipse cx="128" cy="150" rx="96" ry="12" fill="#2dd4bf" opacity=".18" filter="url(#taGlow)" />
      {/* documento */}
      <g transform="rotate(14 172 70)">
        <rect x="132" y="12" width="78" height="104" rx="10" fill="url(#taDoc)" />
        <text x="146" y="38" fontFamily="Syne, Inter, sans-serif" fontWeight="800" fontSize={label.length > 4 ? 10 : 15} fill="#4c1d95">{label}</text>
        {[52, 64, 76, 88].map((y) => <g key={y}><rect x="146" y={y} width="9" height="7" rx="2" fill="#a78bfa" /><rect x="160" y={y + 1} width="38" height="5" rx="2.5" fill="#ddd6fe" /></g>)}
      </g>
      {/* calculadora */}
      <g transform="rotate(-12 100 90)">
        <rect x="62" y="34" width="86" height="112" rx="14" fill="url(#taCalc)" />
        <rect x="72" y="44" width="66" height="24" rx="6" fill="url(#taScreen)" />
        <text x="80" y="61" fontFamily="Syne, Inter, sans-serif" fontWeight="800" fontSize={label.length > 4 ? 8 : 12} fill="#a5f3fc">{label}</text>
        {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={72 + c * 17} y={76 + r * 19} width="13" height="14" rx="3.5" fill="url(#taKey)" opacity={c === 3 ? 1 : 0.92} />))}
      </g>
      {/* moedas */}
      {[0, 1, 2, 3].map((i) => <g key={i}><ellipse cx="44" cy={142 - i * 9} rx="22" ry="7" fill="#b45309" /><ellipse cx="44" cy={139 - i * 9} rx="22" ry="7" fill="url(#taCoin)" /></g>)}
      <ellipse cx="44" cy="112" rx="13" ry="3.5" fill="#fef3c7" opacity=".7" />
      {/* selo % */}
      <g transform="rotate(-8 196 128)">
        <rect x="174" y="106" width="44" height="44" rx="11" fill="url(#taPct)" />
        <text x="196" y="136" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="24" fill="#fff">%</text>
      </g>
    </svg>
  );
}

export function RobotIllustration({ className = 'w-24 h-24' }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rbBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e0e7ff" /><stop offset="100%" stopColor="#a5b4fc" /></linearGradient>
        <linearGradient id="rbFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1e1b4b" /><stop offset="100%" stopColor="#0f172a" /></linearGradient>
        <filter id="rbGlow"><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      <line x1="60" y1="14" x2="60" y2="26" stroke="#a5b4fc" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="11" r="5" fill="#22d3ee" />
      <rect x="14" y="44" width="10" height="20" rx="5" fill="#818cf8" />
      <rect x="96" y="44" width="10" height="20" rx="5" fill="#818cf8" />
      <rect x="22" y="26" width="76" height="56" rx="22" fill="url(#rbBody)" />
      <rect x="31" y="35" width="58" height="38" rx="16" fill="url(#rbFace)" />
      <circle cx="47" cy="54" r="7" fill="#22d3ee" filter="url(#rbGlow)" /><circle cx="47" cy="54" r="5.5" fill="#67e8f9" />
      <circle cx="73" cy="54" r="7" fill="#22d3ee" filter="url(#rbGlow)" /><circle cx="73" cy="54" r="5.5" fill="#67e8f9" />
      <rect x="36" y="86" width="48" height="30" rx="12" fill="url(#rbBody)" />
      <circle cx="60" cy="100" r="6" fill="#8b5cf6" />
      <path d="M8 96 l3 -6 l3 6 l-3 6z M108 24 l2.5 -5 l2.5 5 l-2.5 5z" fill="#c4b5fd" />
    </svg>
  );
}

// Documento NF-e inclinado com selo de conferido e órbita luminosa (cabeçalho de Notas Fiscais)
export function NfeIllustration({ className = 'w-72 h-36' }) {
  return (
    <svg viewBox="0 0 320 150" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="nfDoc" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#1e3a8a" /></linearGradient>
        <linearGradient id="nfOrbit" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#2dd4bf" stopOpacity="0" /><stop offset="35%" stopColor="#2dd4bf" /><stop offset="70%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient>
        <linearGradient id="nfCheck" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5eead4" /><stop offset="100%" stopColor="#0d9488" /></linearGradient>
        <filter id="nfGlow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <ellipse cx="170" cy="96" rx="140" ry="34" fill="none" stroke="url(#nfOrbit)" strokeWidth="4" filter="url(#nfGlow)" opacity=".8" />
      <g transform="rotate(-14 170 70)">
        <rect x="112" y="8" width="118" height="112" rx="12" fill="url(#nfDoc)" opacity=".95" />
        <rect x="112" y="8" width="118" height="112" rx="12" fill="none" stroke="#bfdbfe" strokeOpacity=".5" />
        <text x="128" y="38" fontFamily="Syne, Inter, sans-serif" fontWeight="800" fontSize="20" fontStyle="italic" fill="#eff6ff">NF-e</text>
        {[54, 68, 82, 96].map((y, i) => <rect key={y} x="128" y={y} width={i === 3 ? 48 : 84} height="6" rx="3" fill="#dbeafe" opacity={0.75 - i * 0.1} />)}
      </g>
      <ellipse cx="170" cy="96" rx="140" ry="34" fill="none" stroke="url(#nfOrbit)" strokeWidth="2.5" strokeDasharray="230 600" strokeDashoffset="-40" />
      <circle cx="236" cy="34" r="22" fill="url(#nfCheck)" stroke="#ccfbf1" strokeWidth="2" />
      <path d="M226 34 l7 7 l13 -14" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
