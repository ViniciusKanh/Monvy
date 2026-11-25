import {
  LayoutDashboard, Wallet, CreditCard, ArrowLeftRight, Tags, PiggyBank,
  Target, RefreshCw, Vault, Calendar, Brain, HeartPulse, GraduationCap,
  BarChart3, Calculator, Landmark, TrendingUp, Sparkles, GitCompare,
  Activity, Upload, FileText, Settings, Users, UserSearch, CircleDollarSign,
  ArrowRightLeft, CalendarDays, Building2, LifeBuoy, UserPlus, Zap, Ticket, LineChart, Wand2, Flame, Bell, Repeat, MapPin, ShieldCheck, Car,
  PieChart, Gauge, Bug, Mail, Megaphone,
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
      { key: 'taxburden', label: 'Minha Carga Tributária', path: '/carga-tributaria', icon: Landmark },
      { key: 'taxes', label: 'Impostos', path: '/impostos', icon: Landmark, adminOnly: true },
      { key: 'fiscalnotes', label: 'Notas Fiscais', path: '/notas-fiscais', icon: FileText, adminOnly: true },
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
      { key: 'payoff', label: 'Quitação de Dívidas', path: '/quitacao', icon: TrendingUp },
      { key: 'goalplan', label: 'Planejador de Objetivo', path: '/objetivo', icon: Target },
      { key: 'household', label: 'Rateio da Casa', path: '/rateio', icon: Users },
      { key: 'envelopes', label: 'Envelopes de Orçamento', path: '/envelopes', icon: Mail },
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
      { key: 'compare', label: 'Comparador de Períodos', path: '/comparador', icon: GitCompare },
      { key: 'moneymap', label: 'Para Onde Vai o Dinheiro', path: '/para-onde-vai', icon: PieChart },
      { key: 'heatmap', label: 'Calendário de Calor', path: '/mapa-de-calor', icon: CalendarDays },
      { key: 'antspend', label: 'Gastos-Formiga', path: '/gastos-formiga', icon: Bug },
      { key: 'creditscore', label: 'Score de Crédito', path: '/score', icon: Gauge },
    ],
  },
  {
    label: 'Ferramentas',
    items: [
      { key: 'simulator', label: 'Simulador', path: '/simulador', icon: Calculator },
      { key: 'compound', label: 'Juros Compostos', path: '/juros-compostos', icon: Calculator },
      { key: 'pricesac', label: 'Financiamento Price × SAC', path: '/price-sac', icon: GitCompare },
      { key: 'salary', label: 'Salário Líquido (CLT)', path: '/salario-liquido', icon: Wallet },
      { key: 'tax', label: 'Imposto de Renda', path: '/imposto-de-renda', icon: Landmark },
      { key: 'market', label: 'Mercado & Indicadores', path: '/mercado', icon: TrendingUp },
      { key: 'reconciliation', label: 'Conciliação', path: '/conciliacao', icon: GitCompare },
    ],
  },
  {
    label: 'Consultas',
    items: [
      { key: 'converter', label: 'Conversor de Moedas', path: '/conversor', icon: ArrowRightLeft },
      { key: 'indicators', label: 'Indicadores Econômicos', path: '/indicadores', icon: Landmark },
      { key: 'stocks', label: 'Ações & FIIs', path: '/acoes', icon: LineChart },
      { key: 'savingscdb', label: 'Poupança × CDB', path: '/poupanca-cdb', icon: PiggyBank },
      { key: 'fipe', label: 'Tabela FIPE', path: '/fipe', icon: Car },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { key: 'reports', label: 'Relatórios', path: '/relatorios', icon: FileText },
      { key: 'notifications', label: 'Notificações', path: '/notificacoes', icon: Bell },
      { key: 'help', label: 'Ajuda & Suporte', path: '/ajuda', icon: LifeBuoy },
      { key: 'tickets', label: 'Central de Tickets', path: '/chamados', icon: Ticket },
      { key: 'settings', label: 'Configurações', path: '/configuracoes', icon: Settings },
      { key: 'adminanalytics', label: 'Analytics de Uso', path: '/analytics', icon: BarChart3, adminOnly: true },
      { key: 'adminuseranalytics', label: 'Analytics por Usuário', path: '/analytics/usuarios', icon: UserSearch, adminOnly: true },
      { key: 'admincampaign', label: 'Campanhas', path: '/campanhas', icon: Megaphone, adminOnly: true },
      { key: 'users', label: 'Usuários & Acessos', path: '/usuarios', icon: Users, adminOnly: true },
      { key: 'adminmail', label: 'Envio de E-mail', path: '/configuracoes/email', icon: Mail, adminOnly: true },
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
