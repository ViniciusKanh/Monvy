// Exportacao para Excel sem dependencias, usando SpreadsheetML 2003 (XML).
// Abre no Excel/LibreOffice/Google Sheets como planilha real (abas, numeros,
// moeda, bordas, zebra e cabecalhos formatados) — bem melhor que CSV.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const numCell = (v, style) => `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="Number">${Number(v) || 0}</Data></Cell>`;
const strCell = (v, style) => `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
const pctCell = (frac, style = 'pct') => `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${Number(frac) || 0}</Data></Cell>`;
const mergeCell = (v, across, style) => `<Cell${style ? ` ss:StyleID="${style}"` : ''} ss:MergeAcross="${across}"><Data ss:Type="String">${esc(v)}</Data></Cell>`;
const row = (cells, h) => `<Row${h ? ` ss:Height="${h}"` : ''}>${cells.join('')}</Row>`;
const spacer = () => row([strCell('')]);
const col = (w) => `<Column ss:Width="${w}"/>`;

function sheet(name, columnsXml, rowsXml) {
  return `<Worksheet ss:Name="${esc(name).slice(0, 31)}"><Table ss:DefaultRowHeight="16">${columnsXml}${rowsXml}</Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><PageSetup><Layout x:Orientation="Landscape"/></PageSetup><FitToPage/><Print><FitWidth>1</FitWidth><FitHeight>0</FitHeight></Print><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`;
}

// Bordas finas cinza em todos os lados (reutilizado nos estilos de dados)
const BORDERS = `<Borders>
  <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
  <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
  <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
  <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
</Borders>`;
const MONEYFMT = `<NumberFormat ss:Format="&quot;R$&quot;\\ #,##0.00"/>`;

function workbook(sheetsXml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">
 <Styles>
  <Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/></Style>
  <Style ss:ID="title"><Font ss:FontName="Calibri" ss:Size="20" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#065F46" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:Horizontal="Left"/></Style>
  <Style ss:ID="titlesub"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#D1FAE5"/><Interior ss:Color="#065F46" ss:Pattern="Solid"/></Style>
  <Style ss:ID="sub"><Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#64748B"/></Style>
  <Style ss:ID="section"><Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#0B1330"/></Style>
  <Style ss:ID="hdr"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0B1330" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/>${BORDERS}</Style>
  <Style ss:ID="cell"><Alignment ss:Vertical="Center"/>${BORDERS}</Style>
  <Style ss:ID="cellZ"><Alignment ss:Vertical="Center"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>${BORDERS}</Style>
  <Style ss:ID="money">${MONEYFMT}${BORDERS}</Style>
  <Style ss:ID="moneyZ">${MONEYFMT}<Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>${BORDERS}</Style>
  <Style ss:ID="moneyBold">${MONEYFMT}<Font ss:Bold="1"/>${BORDERS}</Style>
  <Style ss:ID="in">${MONEYFMT}<Font ss:Color="#059669"/>${BORDERS}</Style>
  <Style ss:ID="inZ">${MONEYFMT}<Font ss:Color="#059669"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>${BORDERS}</Style>
  <Style ss:ID="out">${MONEYFMT}<Font ss:Color="#E11D48"/>${BORDERS}</Style>
  <Style ss:ID="outZ">${MONEYFMT}<Font ss:Color="#E11D48"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>${BORDERS}</Style>
  <Style ss:ID="pct"><NumberFormat ss:Format="0.0%"/>${BORDERS}</Style>
  <Style ss:ID="tot"><Font ss:Bold="1" ss:Color="#0B1330"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>${BORDERS}</Style>
  <Style ss:ID="totMoney">${MONEYFMT}<Font ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>${BORDERS}</Style>
  <Style ss:ID="totPct"><NumberFormat ss:Format="0.0%"/><Font ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>${BORDERS}</Style>
  <Style ss:ID="badgeConf"><Font ss:Bold="1" ss:Color="#065F46"/><Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>${BORDERS}</Style>
  <Style ss:ID="badgeEst"><Font ss:Bold="1" ss:Color="#92400E"/><Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>${BORDERS}</Style>
 </Styles>
 ${sheetsXml}
</Workbook>`;
}

// Cabecalho de marca reutilizado por aba (titulo + subtitulo em faixa verde)
function brandHeader(colsCount, subtitle) {
  return [
    row([mergeCell('Monvy · Relatório Financeiro', colsCount - 1, 'title')], 26),
    row([mergeCell(subtitle || '', colsCount - 1, 'titlesub')]),
    row([strCell(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 'sub')]),
    spacer(),
  ].join('');
}

// data: { periodLabel, totals:{inc,exp,bal,rate}, totalBalance, monthly:[...],
//         byCategory:[...], statement:[...], tax:{...} }
export function exportReportXlsx(data, filename = 'monvy-relatorio.xlsx') {
  const { periodLabel = '', totals = {}, totalBalance = 0, monthly = [], byCategory = [], statement = [], tax = null } = data;
  const totalExp = byCategory.reduce((s, c) => s + Number(c.value || 0), 0) || 1;
  const typeLabel = (t) => (t === 'income' ? 'Receita' : t === 'transfer' ? 'Transferência' : 'Despesa');
  const Z = (i) => (i % 2 === 1); // zebra em linhas impares

  // ---- Aba Resumo ----
  const resumoRows = [
    brandHeader(4, periodLabel),
    row([strCell('Visão geral', 'section')]),
    row([strCell('Indicador', 'hdr'), strCell('Valor', 'hdr'), strCell('', 'hdr'), strCell('', 'hdr')]),
    row([strCell('Saldo total em contas', 'cell'), numCell(totalBalance, 'moneyBold'), strCell('', 'cell'), strCell('', 'cell')]),
    row([strCell('Receitas do período', 'cellZ'), numCell(totals.inc, 'inZ'), strCell('', 'cellZ'), strCell('', 'cellZ')]),
    row([strCell('Despesas do período', 'cell'), numCell(totals.exp, 'out'), strCell('', 'cell'), strCell('', 'cell')]),
    row([strCell('Saldo do período', 'cellZ'), numCell(totals.bal, 'moneyZ'), strCell('', 'cellZ'), strCell('', 'cellZ')]),
    row([strCell('Taxa de poupança', 'cell'), pctCell((Number(totals.rate) || 0) / 100), strCell('', 'cell'), strCell('', 'cell')]),
    spacer(),
    row([strCell('Mês a mês', 'section')]),
    row([strCell('Mês', 'hdr'), strCell('Receita', 'hdr'), strCell('Despesa', 'hdr'), strCell('Saldo', 'hdr')]),
    ...monthly.map((m, i) => row([strCell(m.name, Z(i) ? 'cellZ' : 'cell'), numCell(m.Receita, Z(i) ? 'inZ' : 'in'), numCell(m.Despesa, Z(i) ? 'outZ' : 'out'), numCell(m.net, Z(i) ? 'moneyZ' : 'money')])),
  ].join('');
  const resumo = sheet('Resumo', col(240) + col(150) + col(150) + col(150), resumoRows);

  // ---- Aba Entradas e Saídas ----
  const esHdr = row([strCell('Data', 'hdr'), strCell('Tipo', 'hdr'), strCell('Descrição', 'hdr'), strCell('Categoria', 'hdr'), strCell('Entrada', 'hdr'), strCell('Saída', 'hdr'), strCell('Status', 'hdr')]);
  const esBody = statement.map((t, i) => {
    const z = Z(i); const cs = z ? 'cellZ' : 'cell';
    const isInc = t.type === 'income'; const isExp = t.type === 'expense';
    return row([
      strCell(String(t.date).slice(0, 10), cs),
      strCell(typeLabel(t.type), cs),
      strCell(t.description || '', cs),
      strCell(t.category || '', cs),
      isInc ? numCell(t.amount, z ? 'inZ' : 'in') : strCell('', cs),
      isExp ? numCell(t.amount, z ? 'outZ' : 'out') : strCell('', cs),
      strCell(t.status === 'completed' ? 'Concluído' : (t.type === 'transfer' ? '—' : 'Em aberto'), cs),
    ]);
  }).join('');
  const totEnt = statement.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
  const totSai = statement.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
  const esTot = row([strCell('Totais', 'tot'), strCell('', 'tot'), strCell('', 'tot'), strCell('', 'tot'), numCell(totEnt, 'totMoney'), numCell(totSai, 'totMoney'), strCell('', 'tot')]);
  const entradasSaidas = sheet('Entradas e Saídas', col(90) + col(100) + col(300) + col(170) + col(120) + col(120) + col(110),
    brandHeader(7, `Lançamentos — ${periodLabel}`) + esHdr + esBody + esTot);

  // ---- Aba Categorias ----
  const catRows = [
    brandHeader(3, `Despesas por categoria — ${periodLabel}`),
    row([strCell('Categoria', 'hdr'), strCell('Valor', 'hdr'), strCell('% das despesas', 'hdr')]),
    ...byCategory.map((c, i) => row([strCell(c.name, Z(i) ? 'cellZ' : 'cell'), numCell(c.value, Z(i) ? 'outZ' : 'out'), pctCell(Number(c.value || 0) / totalExp)])),
    row([strCell('Total', 'tot'), numCell(totalExp, 'totMoney'), pctCell(1, 'totPct')]),
  ].join('');
  const categorias = sheet('Categorias', col(260) + col(150) + col(150), catRows);

  // ---- Aba Carga Tributária ----
  let cargaSheet = '';
  if (tax && Number(tax.total) > 0) {
    const kpis = [
      row([strCell('Imposto total no período', 'cell'), numCell(tax.total, 'moneyBold'), pctCell((Number(tax.avgPct) || 0) / 100)]),
      row([strCell('Sobre o salário (INSS + IRRF)', 'cellZ'), numCell(tax.salario, 'moneyZ'), strCell('confirmado', 'badgeConf')]),
      row([strCell('No consumo (tributo embutido)', 'cell'), numCell(tax.consumo, 'money'), strCell('estimado', 'badgeEst')]),
      row([strCell('IPVA / IPTU / IOF', 'cellZ'), numCell(tax.outros, 'moneyZ'), strCell('', 'cellZ')]),
    ].join('');
    const byMonth = (tax.byMonth || []).map((m, i) => row([strCell(m.name, Z(i) ? 'cellZ' : 'cell'), numCell(m.confirmado, Z(i) ? 'inZ' : 'in'), numCell(m.estimado, Z(i) ? 'outZ' : 'out'), numCell(m.total, Z(i) ? 'moneyZ' : 'money'), pctCell((Number(m.pct) || 0) / 100)])).join('');
    const dist = (tax.dist || []).map((d, i) => row([strCell(d.name, Z(i) ? 'cellZ' : 'cell'), numCell(d.value, Z(i) ? 'moneyZ' : 'money'), pctCell(tax.total > 0 ? (Number(d.value || 0) / tax.total) : 0)])).join('');
    const narr = tax.narrativa ? [row([strCell('Análise', 'section')]), row([mergeCell(tax.narrativa, 4, 'sub')]), spacer()] : [];
    const cargaRows = [
      brandHeader(5, `Carga Tributária — ${periodLabel}`),
      ...narr,
      row([strCell('Resumo', 'section')]),
      row([strCell('Item', 'hdr'), strCell('Valor', 'hdr'), strCell('Detalhe', 'hdr')]),
      kpis,
      spacer(),
      row([strCell('Mês a mês', 'section')]),
      row([strCell('Mês', 'hdr'), strCell('Confirmado', 'hdr'), strCell('Estimado', 'hdr'), strCell('Total', 'hdr'), strCell('% renda', 'hdr')]),
      byMonth,
      spacer(),
      row([strCell('Distribuição por tributo', 'section')]),
      row([strCell('Tributo', 'hdr'), strCell('Valor', 'hdr'), strCell('% do total', 'hdr')]),
      dist,
    ].join('');
    cargaSheet = sheet('Carga Tributária', col(280) + col(150) + col(140) + col(140) + col(110), cargaRows);
  }

  const xml = workbook(resumo + entradasSaidas + categorias + cargaSheet);
  const blob = new Blob(['﻿', xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.endsWith('.xls') || filename.endsWith('.xlsx') ? filename.replace('.xlsx', '.xls') : `${filename}.xls`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
