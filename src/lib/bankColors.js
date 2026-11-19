// Gradientes de marca para os bancos mais comuns no Brasil. Quando o banco
// cadastrado na conta não é reconhecido, cai para a cor que o usuário
// escolheu ao criar a conta (a.color) — nunca inventa uma cor de marca.
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const BRAND_GRADIENTS = [
  { match: ['nubank', 'nu pagamentos'], gradient: 'linear-gradient(135deg,#820ad1,#2b0b4a 130%)' },
  { match: ['mercado pago', 'mercadopago'], gradient: 'linear-gradient(135deg,#ffde59,#009ee3 130%)' },
  { match: ['santander'], gradient: 'linear-gradient(135deg,#ec0000,#5c0a0a 130%)' },
  { match: ['itau', 'itaú'], gradient: 'linear-gradient(135deg,#ec7000,#1c1c1c 130%)' },
  { match: ['bradesco'], gradient: 'linear-gradient(135deg,#cc092f,#1a1a1a 130%)' },
  { match: ['banco do brasil', 'bb '], gradient: 'linear-gradient(135deg,#fcea10,#003da5 130%)' },
  { match: ['caixa economica', 'caixa'], gradient: 'linear-gradient(135deg,#0050a0,#f5821f 130%)' },
  { match: ['inter'], gradient: 'linear-gradient(135deg,#ff7a00,#1a1a1a 130%)' },
  { match: ['c6 bank', 'c6'], gradient: 'linear-gradient(135deg,#1a1a1a,#3a3a3a 130%)' },
  { match: ['picpay'], gradient: 'linear-gradient(135deg,#21c25e,#0c3d22 130%)' },
  { match: ['btg'], gradient: 'linear-gradient(135deg,#0a2e5c,#000 130%)' },
  { match: ['xp investimentos', 'xp '], gradient: 'linear-gradient(135deg,#1a1a1a,#3a3a3a 130%)' },
  { match: ['will bank', 'willbank'], gradient: 'linear-gradient(135deg,#ff5a00,#1a1a1a 130%)' },
  { match: ['next'], gradient: 'linear-gradient(135deg,#00e291,#004d36 130%)' },
];

export function bankGradient(account) {
  const n = norm(account?.bank);
  if (n) {
    const found = BRAND_GRADIENTS.find((b) => b.match.some((m) => n.includes(m)));
    if (found) return found.gradient;
  }
  const c = account?.color || '#10b981';
  return `linear-gradient(135deg, ${c}, #0d1433 130%)`;
}
