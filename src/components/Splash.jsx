// Splash animada (boot do app) e LoadingScreen (telas pesadas). CSS keyframes embutidos.
const CSS = `
@keyframes monvyPop { 0% { transform: scale(.7); opacity: 0 } 60% { transform: scale(1.06); opacity: 1 } 100% { transform: scale(1) } }
@keyframes monvyFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
@keyframes monvyRing { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
@keyframes monvyBar { 0% { transform: translateX(-100%) } 100% { transform: translateX(320%) } }
@keyframes monvyDots { 0%,80%,100% { opacity:.25; transform: translateY(0) } 40% { opacity:1; transform: translateY(-4px) } }
@keyframes monvyGrad { 0% { background-position: 0% 50% } 100% { background-position: 100% 50% } }
`;

function Mark({ size = 84 }) {
  return (
    <div style={{ width: size, height: size, animation: 'monvyFloat 3s ease-in-out infinite' }} className="relative">
      <div className="absolute inset-0 rounded-[26%]" style={{ background: 'linear-gradient(135deg,#10b981,#0d9488 55%,#6366f1)', boxShadow: '0 18px 40px -12px rgba(16,185,129,.6)' }} />
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="absolute inset-0 m-auto" style={{ width: size * 0.5, height: size * 0.5 }}>
        <path d="M3 21h18M4 10h16M5 10l7-6 7 6M6 10v11M18 10v11M10 10v11M14 10v11" />
      </svg>
      <div className="absolute -inset-2 rounded-full border-2 border-transparent" style={{ borderTopColor: 'rgba(16,185,129,.55)', borderRightColor: 'rgba(99,102,241,.35)', animation: 'monvyRing 1.1s linear infinite' }} />
    </div>
  );
}

export function Splash({ label = 'Preparando seu painel financeiro...' }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6" style={{ background: 'linear-gradient(120deg,#ecfdf5,#eef2ff,#ede9fe)', backgroundSize: '220% 220%', animation: 'monvyGrad 6s ease infinite alternate' }}>
      <style>{CSS}</style>
      <div style={{ animation: 'monvyPop .6s cubic-bezier(.2,.8,.2,1)' }} className="flex flex-col items-center gap-4">
        <Mark />
        <div className="text-center">
          <p className="font-display text-3xl font-extrabold tracking-tight" style={{ background: 'linear-gradient(135deg,#059669,#6366f1)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Monvy</p>
          <p className="text-sm text-slate-500 mt-1">{label}</p>
        </div>
      </div>
      <div className="w-48 h-1.5 rounded-full overflow-hidden bg-emerald-500/15">
        <div className="h-full w-1/3 rounded-full" style={{ background: 'linear-gradient(90deg,#10b981,#6366f1)', animation: 'monvyBar 1.2s ease-in-out infinite' }} />
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => <span key={i} className="w-2 h-2 rounded-full bg-emerald-500" style={{ animation: `monvyDots 1.2s ease-in-out ${i * 0.16}s infinite` }} />)}
      </div>
    </div>
  );
}

// Bloco inline para carregamento de telas (mantem o cabecalho da pagina visivel)
export function LoadingScreen({ label = 'Carregando seus dados...', height = 'py-24' }) {
  return (
    <div className={`flex flex-col items-center justify-center ${height} gap-4 animate-fadeIn`}>
      <style>{CSS}</style>
      <Mark size={64} />
      <p className="text-sm text-muted">{label}</p>
      <div className="w-40 h-1.5 rounded-full overflow-hidden bg-emerald-500/15">
        <div className="h-full w-1/3 rounded-full" style={{ background: 'linear-gradient(90deg,#10b981,#6366f1)', animation: 'monvyBar 1.2s ease-in-out infinite' }} />
      </div>
    </div>
  );
}
