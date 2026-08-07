import {
  LayoutDashboard, Wallet, CreditCard, ArrowLeftRight, Tags, PiggyBank,
  Target, RefreshCw, Vault, Calendar, Brain, HeartPulse, GraduationCap,
  Bot, BarChart3, Calculator, Landmark, TrendingUp, Sparkles, GitCompare,
  Activity, Upload, FileText, Settings, Users, CircleDollarSign,
  ArrowRightLeft, CalendarDays, Building2, LifeBuoy, UserPlus, Zap, Ticket,
} from 'lucide-react';

// key deve bater com allowed_screens no banco
export const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { key: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
      { key: 'accounts', label: 'Contas', path: '/contas', icon: Wallet },
      { key: 'cards', label: 'Cartoes', path: '/cartoes', icon: CreditCard },
      { key: 'transactions', label: 'Lancamentos', path: '/lancamentos', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Planejamento',
    items: [
      { key: 'categories', label: 'Categorias', path: '/categorias', icon: Tags },
      { key: 'budget', label: 'Orçamento', path: '/orcamento', icon: PiggyBank },
      { key: 'goals', label: 'Metas', path: '/metas', icon: Target },
      { key: 'payments', label: 'Pagar & Receber', path: '/pagamentos', icon: CircleDollarSign },
      { key: 'subscriptions', label: 'Assinaturas', path: '/assinaturas', icon: RefreshCw },
      { key: 'safes', label: 'Cofres Virtuais', path: '/cofres', icon: Vault },
      { key: 'calendar', label: 'Calendario', path: '/calendario', icon: Calendar },
    ],
  },
  {
    label: 'Inteligencia IA',
    items: [
      { key: 'intelligence', label: 'Inteligencia', path: '/inteligencia', icon: Brain },
      { key: 'health', label: 'Saude Financeira', path: '/saude', icon: HeartPulse },
      { key: 'behavioral', label: 'Analise Comportamental', path: '/comportamental', icon: BarChart3 },
    ],
  },
  {
    label: 'Ferramentas',
    items: [
      { key: 'simulator', label: 'Simulador', path: '/simulador', icon: Calculator },
      { key: 'market', label: 'Mercado & Indicadores', path: '/mercado', icon: TrendingUp },
      { key: 'reconciliation', label: 'Conciliacao', path: '/conciliacao', icon: GitCompare },
      { key: 'bankImport', label: 'Importar Extrato', path: '/importar', icon: Upload },
    ],
  },
  {
    label: 'Consultas',
    items: [
      { key: 'converter', label: 'Conversor de Moedas', path: '/conversor', icon: ArrowRightLeft },
      { key: 'holidays', label: 'Feriados Nacionais', path: '/feriados', icon: CalendarDays },
      { key: 'cnpj', label: 'Consulta CNPJ', path: '/cnpj', icon: Building2 },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { key: 'reports', label: 'Relatorios', path: '/relatorios', icon: FileText },
      { key: 'triggers', label: 'Gatilhos & Automacoes', path: '/gatilhos', icon: Zap },
      { key: 'help', label: 'Ajuda & Suporte', path: '/ajuda', icon: LifeBuoy },
      { key: 'tickets', label: 'Central de Tickets', path: '/chamados', icon: Ticket },
      { key: 'settings', label: 'Configuracoes', path: '/configuracoes', icon: Settings },
      { key: 'users', label: 'Usuarios & Acessos', path: '/usuarios', icon: Users, adminOnly: true },
      { key: 'newusers', label: 'Onboarding (novos users)', path: '/config-novos-usuarios', icon: UserPlus, adminOnly: true },
    ],
  },
];

export const ALL_SCREEN_KEYS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export function findNavItem(key) {
  for (const g of NAV_GROUPS) {
    const it = g.items.find((i) => i.key === key);
    if (it) return it;
  }
  return null;
}
