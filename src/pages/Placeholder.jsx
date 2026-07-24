import { findNavItem } from '../lib/screens.js';
import { Construction, Lock } from 'lucide-react';
import { Card } from '../components/ui';

export function Placeholder({ title, screenKey, message }) {
  const item = findNavItem(screenKey);
  const Icon = item?.icon || Construction;
  const denied = title === 'Acesso negado';
  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">{title || item?.label}</h1>
      <p className="text-muted text-sm mb-6">Modulo do Monvy</p>
      <Card className="flex flex-col items-center justify-center text-center py-16">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${denied ? 'bg-rose-100 text-rose-500 dark:bg-rose-500/15' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15'}`}>
          {denied ? <Lock className="w-8 h-8" /> : <Icon className="w-8 h-8" />}
        </div>
        <h2 className="font-display font-bold text-lg">{denied ? 'Sem permissao' : 'Em desenvolvimento'}</h2>
        <p className="text-muted text-sm mt-2 max-w-md">
          {message || 'Esta tela faz parte do roadmap do Monvy e sera implementada em breve. A estrutura de dados e navegacao ja esta pronta.'}
        </p>
      </Card>
    </div>
  );
}
