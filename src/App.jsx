import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { Spinner } from './components/ui';
import { AppLayout } from './layout/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Verify from './pages/Verify.jsx';
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
import Reconciliation from './pages/Reconciliation.jsx';
import BankImport from './pages/BankImport.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import { Placeholder } from './pages/Placeholder.jsx';

function FullLoader() {
  return <div className="h-screen flex items-center justify-center"><Spinner className="w-8 h-8 text-emerald-500" /></div>;
}

function Protected({ screenKey, children }) {
  const { user, loading, canAccess } = useAuth();
  const location = useLocation();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
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
        <Route path="/assinaturas" element={<Protected screenKey="subscriptions"><Subscriptions /></Protected>} />
        <Route path="/cofres" element={<Protected screenKey="safes"><VirtualSafes /></Protected>} />
        <Route path="/calendario" element={<Protected screenKey="calendar"><FinancialCalendar /></Protected>} />
        <Route path="/inteligencia" element={<Protected screenKey="intelligence"><Intelligence /></Protected>} />
        <Route path="/saude" element={<Protected screenKey="health"><FinancialHealth /></Protected>} />
        <Route path="/comportamental" element={<Protected screenKey="behavioral"><BehavioralAnalysis /></Protected>} />
        <Route path="/simulador" element={<Protected screenKey="simulator"><Simulator /></Protected>} />
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
