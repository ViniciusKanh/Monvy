import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';

export default function Privacy() {
  const S = ({ title, children }) => (
    <section className="mt-6"><h2 className="font-display font-bold text-lg mb-1">{title}</h2><div className="text-sm text-muted leading-relaxed space-y-2">{children}</div></section>
  );
  return (
    <div className="min-h-screen bg-[hsl(var(--bg))]">
      <div className="bg-gradient-to-br from-[#080d1f] to-[#0d1433] text-white px-6 py-6"><Logo size="md" /></div>
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="font-display text-2xl font-bold">Política de Privacidade</h1>
        <p className="text-xs text-muted mt-1">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <S title="1. Quais dados coletamos">
          <p>Coletamos apenas o necessário para o funcionamento do app: seu <b>e-mail</b> e <b>senha</b> (a senha é armazenada de forma criptografada), seu <b>nome, telefone, profissão e foto</b> (opcionais) e os <b>dados financeiros que você mesmo cadastra</b> (contas, cartões, lançamentos, metas, categorias e comprovantes que você anexar).</p>
        </S>
        <S title="2. Como usamos os dados">
          <p>Seus dados são usados exclusivamente para prestar o serviço do Monvy: exibir seus saldos, relatórios, alertas e previsões. Não vendemos nem compartilhamos seus dados com terceiros para fins de marketing.</p>
        </S>
        <S title="3. Onde os dados ficam">
          <p>Os dados ficam armazenados em banco de dados seguro (Turso/LibSQL) e a aplicação é hospedada na Vercel, ambos com conexão criptografada (HTTPS). Leituras de PDF de fatura e OCR são processadas <b>localmente no seu dispositivo</b> — o arquivo não é enviado a servidores externos.</p>
        </S>
        <S title="4. E-mails">
          <p>Podemos enviar e-mails de confirmação de cadastro, alteração de senha e alertas de vencimento. Você pode desativar notificações nas configurações.</p>
        </S>
        <S title="5. Seus direitos (LGPD)">
          <p>Você pode acessar, corrigir e excluir seus dados a qualquer momento dentro do app, ou solicitar a exclusão completa da conta. Para isso, entre em contato pelo e-mail abaixo.</p>
        </S>
        <S title="6. Contato">
          <p>Dúvidas sobre privacidade: <b>viniciussouza742@gmail.com</b> — Vinicius Santos, desenvolvedor do Monvy.</p>
        </S>

        <div className="mt-8 pt-4 border-t border-[hsl(var(--border))]">
          <Link to="/login" className="text-emerald-600 font-semibold text-sm">← Voltar ao Monvy</Link>
        </div>
      </div>
    </div>
  );
}
