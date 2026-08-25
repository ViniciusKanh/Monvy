import {
  LayoutDashboard, Wallet, CreditCard, ArrowLeftRight, Tags, PiggyBank,
  Target, RefreshCw, Vault, Calendar, Brain, HeartPulse, GraduationCap,
  Bot, BarChart3, Calculator, Landmark, TrendingUp, Sparkles, GitCompare,
  Activity, Upload, FileText, Settings, Users, CircleDollarSign,
  ArrowRightLeft, CalendarDays, Building2, LifeBuoy, UserPlus, Zap, Ticket, LineChart, Wand2, Flame, Bell, MessagesSquare, Repeat, MapPin,
} from 'lucide-react';

// key deve bater com allowed_screens no banco
export const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { key: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
      { key: 'accounts', label: 'Contas', path: '/contas', icon: Wallet },
      { key: 'cards', label: 'Cartões', path: '/cartoes', icon: CreditCard },
      { key: 'transactions', label: 'Lançamentos', path: '/lancamentos', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Planejamento',
    items: [
      { key: 'categories', label: 'Categorias', path: '/categorias', icon: Tags },
      { key: 'catrules', label: 'Regras de Categoria', path: '/regras', icon: Wand2 },
      { key: 'budget', label: 'Orçamento', path: '/orcamento', icon: PiggyBank },
      { key: 'goals', label: 'Metas', path: '/metas', icon: Target },
      { key: 'payments', label: 'Pagar & Receber', path: '/pagamentos', icon: CircleDollarSign },
      { key: 'investments', label: 'Investimentos', path: '/investimentos', icon: LineChart },
      { key: 'debts', label: 'Dívidas', path: '/dividas', icon: Landmark },
      { key: 'cashflow', label: 'Fluxo Projetado', path: '/fluxo', icon: Activity },
      { key: 'subscriptions', label: 'Assinaturas', path: '/assinaturas', icon: RefreshCw },
      { key: 'safes', label: 'Cofres Virtuais', path: '/cofres', icon: Vault },
      { key: 'calendar', label: 'Calendário', path: '/calendario', icon: Calendar },
    ],
  },
  {
    label: 'Inteligência IA',
    items: [
      { key: 'intelligence', label: 'Inteligência', path: '/inteligencia', icon: Brain },
      { key: 'health', label: 'Saúde Financeira', path: '/saude', icon: HeartPulse },
      { key: 'behavioral', label: 'Análise Comportamental', path: '/comportamental', icon: BarChart3 },
      { key: 'recurrences', label: 'Radar de Recorrências', path: '/recorrencias', icon: Repeat },
    ],
  },
  {
    label: 'Ferramentas',
    items: [
      { key: 'simulator', label: 'Simulador', path: '/simulador', icon: Calculator },
      { key: 'compound', label: 'Juros Compostos', path: '/juros-compostos', icon: Calculator },
      { key: 'fire', label: 'Independência (FIRE)', path: '/fire', icon: Flame },
      { key: 'tax', label: 'Imposto de Renda', path: '/imposto-de-renda', icon: Landmark },
      { key: 'market', label: 'Mercado & Indicadores', path: '/mercado', icon: TrendingUp },
      { key: 'reconciliation', label: 'Conciliação', path: '/conciliacao', icon: GitCompare },
      { key: 'bankImport', label: 'Importar Extrato', path: '/importar', icon: Upload },
    ],
  },
  {
    label: 'Consultas',
    items: [
      { key: 'converter', label: 'Conversor de Moedas', path: '/conversor', icon: ArrowRightLeft },
      { key: 'holidays', label: 'Feriados Nacionais', path: '/feriados', icon: CalendarDays },
      { key: 'cnpj', label: 'Consulta CNPJ', path: '/cnpj', icon: Building2 },
      { key: 'cep', label: 'Consulta de CEP', path: '/cep', icon: MapPin },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { key: 'reports', label: 'Relatórios', path: '/relatorios', icon: FileText },
      { key: 'notifications', label: 'Notificações', path: '/notificacoes', icon: Bell },
      { key: 'triggers', label: 'Agentes & Robôs', path: '/agentes', icon: Bot },
      { key: 'chat', label: 'Chat dos Robôs', path: '/chat', icon: MessagesSquare },
      { key: 'help', label: 'Ajuda & Suporte', path: '/ajuda', icon: LifeBuoy },
      { key: 'tickets', label: 'Central de Tickets', path: '/chamados', icon: Ticket },
      { key: 'settings', label: 'Configurações', path: '/configuracoes', icon: Settings },
      { key: 'users', label: 'Usuários & Acessos', path: '/usuarios', icon: Users, adminOnly: true },
      { key: 'newusers', label: 'Onboarding (novos usuários)', path: '/config-novos-usuarios', icon: UserPlus, adminOnly: true },
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
