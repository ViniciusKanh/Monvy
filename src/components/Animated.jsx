import { useEffect, useRef, useState } from 'react';

export function useCountUp(target, dur = 750) {
  const [v, setV] = useState(target || 0);
  const from = useRef(target || 0);
  useEffect(() => {
    let raf; const start = performance.now(); const a = from.current; const b = Number(target) || 0;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(a + (b - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}

// Número monetario/percentual que "sobe" ao aparecer/mudar
export function AnimatedValue({ value, hidden, format, dur }) {
  const v = useCountUp(Number(value) || 0, dur);
  if (hidden) return <>••••</>;
  return <>{format ? format(v) : Math.round(v)}</>;
}

// Envolve filhos com entrada escalonada
export function Reveal({ i = 0, className = '', children, as: Tag = 'div', ...rest }) {
  return <Tag className={`reveal ${className}`} style={{ animationDelay: `${i * 70}ms` }} {...rest}>{children}</Tag>;
}
