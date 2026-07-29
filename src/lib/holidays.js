import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

// Feriados nacionais via BrasilAPI (gratuito, sem chave). Cache por ano.
export async function fetchHolidays(year) {
  const r = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
  if (!r.ok) throw new Error('Falha ao buscar feriados');
  return r.json();
}

// Hook que devolve um Map<YYYY-MM-DD, nome do feriado> para o ano informado.
export function useHolidayMap(year) {
  const { data } = useQuery({ queryKey: ['holidays', year], queryFn: () => fetchHolidays(year), staleTime: 24 * 3_600_000, retry: 1 });
  return useMemo(() => {
    const m = new Map();
    (Array.isArray(data) ? data : []).forEach((h) => m.set(h.date, h.name));
    return m;
  }, [data]);
}
