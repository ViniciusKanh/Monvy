import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, CreditCard, ArrowLeftRight, Tags } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { cn } from '../lib/utils.js';

// Itens principais da barra inferior (mobile). Menu completo fica no drawer (☰).
const ITEMS = [
  { key: 'dashboard', label: 'Início', path: '/', icon: LayoutDashboard },
  { key: 'accounts', label: 'Contas', path: '/contas', icon: Wallet },
  { key: 'cards', label: 'Cartões', path: '/cartoes', icon: CreditCard },
  { key: 'transactions', label: 'Lançam.', path: '/lancamentos', icon: ArrowLeftRight },
  { key: 'categories', label: 'Categ.', path: '/categorias', icon: Tags },
];

// Barra inferior estilo "indicador mágico": o item ativo sobe para um círculo
// esmeralda que desliza. Só aparece no mobile (lg:hidden).
export function MobileBottomNav() {
  const { canAccess } = useAuth();
  const { t } = useLang();
  const loc = useLocation();
  const items = ITEMS.filter((i) => canAccess(i.key));
  if (!items.length) return null;

  const isActive = (p) => (p === '/' ? loc.pathname === '/' : loc.pathname === p || loc.pathname.startsWith(p + '/'));
  const activeIdx = items.findIndex((i) => isActive(i.path));
  const left = ((Math.max(0, activeIdx) + 0.5) / items.length) * 100;

  return (
    <nav className="mnav lg:hidden" aria-label="Navegação principal">
      <ul className="mnav-list">
        {items.map((it, i) => (
          <li key={it.key} className={cn('mnav-item', i === activeIdx && 'active')}>
            <NavLink to={it.path} end={it.path === '/'} aria-label={t('nav.' + it.key, it.label)}>
              <span className="mnav-icon"><it.icon className="w-6 h-6" /></span>
              <span className="mnav-text">{t('nav.' + it.key, it.label)}</span>
            </NavLink>
          </li>
        ))}
        {activeIdx >= 0 && <span className="mnav-ind" style={{ left: `${left}%` }} />}
      </ul>
    </nav>
  );
}
