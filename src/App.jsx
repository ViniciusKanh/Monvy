import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { Spinner } from './components/ui';
import { AppLayout } from './layout/AppLayout.jsx';
import { Splash } from './components/Splash.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Verify from './pages/Verify.jsx';
import Privacy from './pages/Privacy.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Accounts from './pages/Accounts.jsx';
import CreditCards from './pages/CreditCards.jsx';
import Transactions from './pages/Transactions.jsx';
import Categories from './pages/Categories.jsx';
import Goals from './pages/Goals.jsx';
import Budget from './pages/Budget.jsx';
import Payments from './pages/Payments.jsx';
import Subscriptions from './pages/Subscriptions.jsx';
import VirtualSafes from './pages/VirtualSafes.jsx';
import FinancialCalendar from './pages/FinancialCalendar.jsx';
import Reports from './pages/Reports.jsx';
import Intelligence from './pages/Intelligence.jsx';
import FinancialHealth from './pages/FinancialHealth.jsx';
import BehavioralAnalysis from './pages/BehavioralAnalysis.jsx';
import Simulator from './pages/Simulator.jsx';
import Market from './pages/Market.jsx';
import Converter from './pages/Converter.jsx';
import Holidays from './pages/Holidays.jsx';
import Cnpj from './pages/Cnpj.jsx';
import Help from './pages/Help.jsx';
import OnboardingConfig from './pages/OnboardingConfig.jsx';
import Agents from './pages/Agents.jsx';
import Chat from './pages/Chat.jsx';
import TicketsCenter from './pages/TicketsCenter.jsx';
import Investments from './pages/Investments.jsx';
import Debts from './pages/Debts.jsx';
import CashFlow from './pages/CashFlow.jsx';
import CategoryRules from './pages/CategoryRules.jsx';
import Fire from './pages/Fire.jsx';
import IncomeTax from './pages/IncomeTax.jsx';
import Notifications from './pages/Notifications.jsx';
import Reconciliation from './pages/Reconciliation.jsx';
import BankImport from './pages/BankImport.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import { Placeholder } from './pages/Placeholder.jsx';
import Enroll2FA from './pages/Enroll2FA.jsx';

function FullLoader() {
  return <Splash />;
}

function Protected({ screenKey, children }) {
  const { user, loading, canAccess } = useAuth();
  const location = useLocation();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.require_2fa && !user.totp_enabled) return <Enroll2FA />;
  if (screenKey && !canAccess(screenKey)) {
    return <Placeholder title="Acesso negado" screenKey={screenKey} message="Voce nao tem permissao para acessar esta tela. Fale com o administrador." />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Register />} />
      <Route path="/verificar" element={<Verify />} />
      <Route path="/privacidade" element={<Privacy />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route path="/recuperar" element={<ForgotPassword />} />
      <Route path="/redefinir" element={<ResetPassword />} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<Protected screenKey="dashboard"><Dashboard /></Protected>} />
        <Route path="/contas" element={<Protected screenKey="accounts"><Accounts /></Protected>} />
        <Route path="/cartoes" element={<Protected screenKey="cards"><CreditCards /></Protected>} />
        <Route path="/lancamentos" element={<Protected screenKey="transactions"><Transactions /></Protected>} />
        <Route path="/categorias" element={<Protected screenKey="categories"><Categories /></Protected>} />
        <Route path="/orcamento" element={<Protected screenKey="budget"><Budget /></Protected>} />
        <Route path="/pagamentos" element={<Protected screenKey="payments"><Payments /></Protected>} />
        <Route path="/metas" element={<Protected screenKey="goals"><Goals /></Protected>} />
        <Route path="/investimentos" element={<Protected screenKey="investments"><Investments /></Protected>} />
        <Route path="/dividas" element={<Protected screenKey="debts"><Debts /></Protected>} />
        <Route path="/fluxo" element={<Protected screenKey="cashflow"><CashFlow /></Protected>} />
        <Route path="/regras" element={<Protected screenKey="catrules"><CategoryRules /></Protected>} />
        <Route path="/fire" element={<Protected screenKey="fire"><Fire /></Protected>} />
        <Route path="/imposto-de-renda" element={<Protected screenKey="tax"><IncomeTax /></Protected>} />
        <Route path="/notificacoes" element={<Protected screenKey="notifications"><Notifications /></Protected>} />
        <Route path="/assinaturas" element={<Protected screenKey="subscriptions"><Subscriptions /></Protected>} />
        <Route path="/cofres" element={<Protected screenKey="safes"><VirtualSafes /></Protected>} />
        <Route path="/calendario" element={<Protected screenKey="calendar"><FinancialCalendar /></Protected>} />
        <Route path="/inteligencia" element={<Protected screenKey="intelligence"><Intelligence /></Protected>} />
        <Route path="/saude" element={<Protected screenKey="health"><FinancialHealth /></Protected>} />
        <Route path="/comportamental" element={<Protected screenKey="behavioral"><BehavioralAnalysis /></Protected>} />
        <Route path="/simulador" element={<Protected screenKey="simulator"><Simulator /></Protected>} />
        <Route path="/mercado" element={<Protected screenKey="market"><Market /></Protected>} />
        <Route path="/conversor" element={<Protected screenKey="converter"><Converter /></Protected>} />
        <Route path="/feriados" element={<Protected screenKey="holidays"><Holidays /></Protected>} />
        <Route path="/cnpj" element={<Protected screenKey="cnpj"><Cnpj /></Protected>} />
        <Route path="/ajuda" element={<Protected screenKey="help"><Help /></Protected>} />
        <Route path="/config-novos-usuarios" element={<Protected screenKey="newusers"><OnboardingConfig /></Protected>} />
        <Route path="/agentes" element={<Protected screenKey="triggers"><Agents /></Protected>} />
        <Route path="/chat" element={<Protected screenKey="chat"><Chat /></Protected>} />
        <Route path="/gatilhos" element={<Protected screenKey="triggers"><Agents /></Protected>} />
        <Route path="/chamados" element={<Protected screenKey="tickets"><TicketsCenter /></Protected>} />
        <Route path="/conciliacao" element={<Protected screenKey="reconciliation"><Reconciliation /></Protected>} />
        <Route path="/importar" element={<Protected screenKey="bankImport"><BankImport /></Protected>} />
        <Route path="/relatorios" element={<Protected screenKey="reports"><Reports /></Protected>} />
        <Route path="/configuracoes" element={<Protected screenKey="settings"><Settings /></Protected>} />
        <Route path="/usuarios" element={<Protected screenKey="users"><Users /></Protected>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
