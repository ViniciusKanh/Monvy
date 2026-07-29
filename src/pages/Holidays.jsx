import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Spinner, Badge } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { CalendarDays, RefreshCw, AlertTriangle, PartyPopper, CalendarClock } from 'lucide-react';

const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEK = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

async function fetchHolidays(year) {
  const r = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
  if (!r.ok) throw new Error('Falha ao buscar feriados');
  return r.json();
}

export default function Holidays() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading, isError, isFetching, refetch } = useQuery({ queryKey: ['holidays', year], queryFn: () => fetchHolidays(year), retry: 1, staleTime: 24 * 3_600_000 });

  const holidays = useMemo(() => (Array.isArray(data) ? data : []).map((h) => {
    const d = new Date(h.date + 'T00:00');
    return { ...h, d, month: d.getMonth(), weekday: WEEK[d.getDay()], day: d.getDate() };
  }).sort((a, b) => a.d - b.d), [data]);

  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00');
  const next = holidays.find((h) => h.d >= today);
  const daysTo = next ? Math.round((next.d - today) / 86400000) : null;

  const byMonth = useMemo(() => {
    const map = {};
    for (const h of holidays) { (map[h.month] = map[h.month] || []).push(h); }
    return Object.entries(map).map(([m, items]) => ({ month: Number(m), items }));
  }, [holidays]);

  const years = [new Date().getFullYear(), new Date().getFullYear() + 1];

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title={<span className="flex items-center gap-2"><CalendarDays className="w-6 h-6 text-sky-500" /> Feriados Nacionais</span>}
        subtitle="Planeje pagamentos e agenda — feriados podem alterar compensacoes bancarias"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center card p-1">
              {years.map((y) => (<button key={y} onClick={() => setYear(y)} className={`px-3 py-1 rounded-lg text-sm font-semibold ${year === y ? 'bg-sky-500 text-white' : 'text-muted'}`}>{y}</button>))}
            </div>
            <button onClick={() => refetch()} className="p-2.5 rounded-xl card hover:bg-black/5 dark:hover:bg-white/10" title="Atualizar"><RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} /></button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="w-6 h-6 text-sky-500" /></div>
      ) : isError ? (
        <Card className="py-8 text-center text-sm text-muted"><AlertTriangle className="w-7 h-7 mx-auto mb-2 text-amber-500" />Nao foi possivel carregar os feriados. Tente atualizar.</Card>
      ) : (
        <>
          {/* Proximo feriado */}
          {next && (
            <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft" style={{ background: 'linear-gradient(135deg,#0369a1 0%,#0ea5e9 60%,#38bdf8 100%)' }}>
              <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.25), transparent 70%)' }} />
              <div className="relative flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[11px] tracking-[0.28em] font-medium text-sky-100"><PartyPopper className="w-3.5 h-3.5" /> PROXIMO FERIADO</div>
                  <p className="font-display text-2xl sm:text-3xl font-extrabold mt-2">{next.name}</p>
                  <p className="text-sky-100 mt-1">{next.weekday}, {next.day} de {MESES[next.month]} de {year}</p>
                </div>
                <div className="text-center bg-white/15 rounded-2xl px-6 py-4">
                  <p className="font-display text-4xl font-extrabold">{daysTo === 0 ? 'Hoje' : daysTo}</p>
                  <p className="text-xs text-sky-100">{daysTo === 0 ? '🎉' : daysTo === 1 ? 'dia' : 'dias'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted"><CalendarClock className="w-4 h-4" /> {holidays.length} feriados nacionais em {year}</div>

          {/* Por mes */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {byMonth.map(({ month, items }, gi) => (
              <Reveal key={month} i={gi}>
                <Card className="hover-lift h-full">
                  <h3 className="font-semibold text-sm text-muted uppercase tracking-wider mb-3">{MESES[month]}</h3>
                  <div className="space-y-2">
                    {items.map((h, i) => { const past = h.d < today; const isNext = next && h.date === next.date; return (
                      <div key={i} className={`flex items-center gap-3 p-2 rounded-xl ${isNext ? 'bg-sky-500/10 ring-1 ring-sky-500/30' : past ? 'opacity-50' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                        <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 text-white" style={{ background: isNext ? '#0ea5e9' : past ? '#94a3b8' : '#6366f1' }}>
                          <span className="text-base font-bold leading-none">{h.day}</span>
                          <span className="text-[9px] uppercase">{MESES[month].slice(0, 3)}</span>
                        </div>
                        <div className="min-w-0 flex-1"><p className="text-sm font-medium leading-tight truncate">{h.name}</p><p className="text-[11px] text-muted">{h.weekday}</p></div>
                        {isNext && <Badge color="blue">proximo</Badge>}
                      </div>
                    ); })}
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>

          <p className="text-xs text-muted text-center pt-2">Fonte: BrasilAPI · feriados nacionais (nao inclui feriados estaduais/municipais).</p>
        </>
      )}
    </div>
  );
}
