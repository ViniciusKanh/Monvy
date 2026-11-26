import { getAuth, sendJson, readBody } from '../_lib/auth.js';
import { geminiJson } from '../_lib/gemini.js';

// POST /api/ai/parse-payslip
// body: { fileBase64, apiKey, mimeType }  (PDF ou foto do holerite/contracheque)
// Lê o holerite com o Gemini e devolve os metadados para pré-preencher o cadastro.
// Nada é inventado: campo ausente no documento volta 0/vazio.

const num = (v) => {
  if (typeof v === 'number') return Math.abs(v);
  const s = String(v ?? '').replace(/[^\d.,-]/g, '');
  const x = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return isNaN(x) ? 0 : Math.abs(x);
};
const r2 = (v) => Math.round(num(v) * 100) / 100;
const KINDS = ['mensal', 'adiantamento', 'decimo_terceiro', 'ferias', 'plr', 'rescisao', 'outro'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  const auth = getAuth(req);
  if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
  try {
    const { fileBase64, apiKey, mimeType } = await readBody(req);
    if (!apiKey) return sendJson(res, 400, { error: 'Chave da API Gemini nao configurada. Adicione em Configuracoes.' });
    if (!fileBase64) return sendJson(res, 400, { error: 'Envie o PDF ou a foto do holerite.' });
    const mime = /^image\/(jpeg|png|webp)$/.test(String(mimeType || '')) ? mimeType : 'application/pdf';

    const prompt = `Voce le HOLERITES / CONTRACHEQUES / RECIBOS DE PAGAMENTO DE SALARIO brasileiros (CLT), em PDF ou foto, de qualquer empresa ou sistema de folha (TOTVS, Senior, ADP, Sankhya, Dominio, Metadados, etc.).

Extraia:
- company: razao social/nome do EMPREGADOR (nao o funcionario)
- company_cnpj: CNPJ do empregador (so se aparecer)
- role: cargo/funcao do funcionario (se aparecer)
- competence: mes de referencia/competencia no formato YYYY-MM (ex.: "Outubro/2026" => "2026-10"; "10/2026" => "2026-10")
- kind: um de ${KINDS.join(', ')} ("Folha mensal"/"Mensal" => mensal; "Adiantamento"/"Vale" => adiantamento; "13o"/"Decimo terceiro" => decimo_terceiro; "Ferias" => ferias; "PLR"/"Participacao nos lucros" => plr; "Rescisao" => rescisao)
- pay_date: data de pagamento/credito YYYY-MM-DD (se aparecer)
- gross: TOTAL DE VENCIMENTOS / PROVENTOS (bruto)
- inss: desconto de INSS do mes (codigos "INSS", "INSS s/ salario", "Contribuicao previdenciaria"); se houver INSS de 13o/ferias separado no mesmo holerite, SOME
- irrf: desconto de IRRF/IR fonte do mes (some IRRF de ferias/13o se estiver no mesmo holerite)
- fgts: FGTS do mes (valor depositado pela empresa, geralmente no rodape "FGTS do mes")
- net: VALOR LIQUIDO a receber
- other_deductions: TOTAL DE DESCONTOS menos INSS menos IRRF (vale-transporte, plano de saude, VR/VA, pensao, adiantamento, emprestimo consignado, etc.)
- base_inss: "Salario contribuicao INSS"/"Base INSS"; base_irrf: "Base calc. IRRF"; base_fgts: "Base calc. FGTS"
- dependents: numero de dependentes para IR (se aparecer; senao 0)
- items: TODAS as rubricas, cada uma {"code":"","description":"","reference":"","type":"provento"|"desconto","amount":0}

Regras:
- Valores em reais, numero com ponto decimal, sempre positivo.
- NAO invente: se um campo nao estiver no documento, use 0 ou "".
- Se o documento NAO for um holerite/contracheque, devolva {"is_payslip":false}.

Responda SO JSON: {"is_payslip":true,"company":"","company_cnpj":"","role":"","competence":"YYYY-MM","kind":"mensal","pay_date":"","gross":0,"inss":0,"irrf":0,"fgts":0,"other_deductions":0,"net":0,"base_inss":0,"base_irrf":0,"base_fgts":0,"dependents":0,"items":[]}`;

    const { data: p, model } = await geminiJson(apiKey, [{ text: prompt }, { inline_data: { mime_type: mime, data: fileBase64 } }], { timeoutMs: 40000 });
    if (!p || p.is_payslip === false) return sendJson(res, 422, { error: 'Este arquivo não parece um holerite/contracheque.' });

    const items = (Array.isArray(p.items) ? p.items : []).map((it) => ({
      code: String(it.code || '').trim(),
      description: String(it.description || '').trim(),
      reference: String(it.reference || '').trim(),
      type: /desc/i.test(it.type) ? 'desconto' : 'provento',
      amount: r2(it.amount),
    })).filter((it) => it.description && it.amount > 0);

    let gross = r2(p.gross); let inss = r2(p.inss); let irrf = r2(p.irrf); let net = r2(p.net);
    const prov = r2(items.filter((i) => i.type === 'provento').reduce((s, i) => s + i.amount, 0));
    const desc = r2(items.filter((i) => i.type === 'desconto').reduce((s, i) => s + i.amount, 0));
    // completa pelos itens quando o total não veio
    if (!gross && prov) gross = prov;
    if (!inss) inss = r2(items.filter((i) => i.type === 'desconto' && /\binss\b|previd/i.test(i.description)).reduce((s, i) => s + i.amount, 0));
    if (!irrf) irrf = r2(items.filter((i) => i.type === 'desconto' && /\bir(rf)?\b|imposto de renda|i\.?r\.?\s*fonte/i.test(i.description)).reduce((s, i) => s + i.amount, 0));
    const totalDesc = desc || r2(gross - net);
    let other = r2(p.other_deductions);
    if (!other && totalDesc) other = Math.max(0, r2(totalDesc - inss - irrf));
    if (!net && gross) net = r2(gross - inss - irrf - other);

    const comp = /^\d{4}-\d{2}$/.test(String(p.competence || '')) ? p.competence : '';
    const kind = KINDS.includes(p.kind) ? p.kind : 'mensal';
    // conferência: bruto − descontos deve fechar com o líquido
    const check = gross ? r2(gross - inss - irrf - other - net) : 0;

    return sendJson(res, 200, {
      company: String(p.company || '').trim(), company_cnpj: String(p.company_cnpj || '').trim(), role: String(p.role || '').trim(),
      competence: comp, kind, pay_date: /^\d{4}-\d{2}-\d{2}$/.test(String(p.pay_date || '')) ? p.pay_date : '',
      gross, inss, irrf, fgts: r2(p.fgts), other_deductions: other, net,
      base_inss: r2(p.base_inss), base_irrf: r2(p.base_irrf), base_fgts: r2(p.base_fgts), dependents: Math.round(num(p.dependents)),
      items, diff: check, model,
    });
  } catch (e) {
    return sendJson(res, 502, { error: 'Não consegui ler o holerite com a IA: ' + e.message });
  }
}
