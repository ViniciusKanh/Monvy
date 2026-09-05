// Exportação para Excel sem dependências, usando SpreadsheetML 2003 (XML).
// Abre no Excel/LibreOffice/Google Sheets como planilha real (abas, números,
// moeda e cabeçalhos formatados) — bem melhor que CSV.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const numCell = (v, style) => `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="Number">${Number(v) || 0}</Data></Cell>`;
const strCell = (v, style) => `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
const row = (cells) => `<Row>${cells.join('')}</Row>`;
const col = (w) => `<Column ss:Width="${w}"/>`;

function sheet(name, columnsXml, rowsXml) {
  return `<Worksheet ss:Name="${esc(name).slice(0, 31)}"><Table>${columnsXml}${rowsXml}</Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`;
}

function workbook(sheetsXml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">
 <Styles>
  <Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
  <Style ss:ID="hdr"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0B1330" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="title"><Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#0B1330"/></Style>
  <Style ss:ID="sub"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#64748B"/></Style>
  <Style ss:ID="money"><NumberFormat ss:Format="&quot;R$&quot;\\ #,##0.00"/></Style>
  <Style ss:ID="moneyBold"><NumberFormat ss:Format="&quot;R$&quot;\\ #,##0.00"/><Font ss:Bold="1"/></Style>
  <Style ss:ID="in"><NumberFormat ss:Format="&quot;R$&quot;\\ #,##0.00"/><Font ss:Color="#059669"/></Style>
  <Style ss:ID="out"><NumberFormat ss:Format="&quot;R$&quot;\\ #,##0.00"/><Font ss:Color="#E11D48"/></Style>
  <Style ss:ID="pct"><NumberFormat ss:Format="0.0%"/></Style>
  <Style ss:ID="bold"><Font ss:Bold="1"/></Style>
 </Styles>
 ${sheetsXml}
</Workbook>`;
}

// data: { periodLabel, generatedAt, totals:{inc,exp,bal,rate}, totalBalance,
//         monthly:[{name,Receita,Despesa,net}], byCategory:[{name,value}], statement:[{date,type,description,category,amount,status}] }
export function exportReportXlsx(data, filename = 'monvy-relatorio.xlsx') {
  const { periodLabel = '', totals = {}, totalBalance = 0, monthly = [], byCategory = [], statement = [] } = data;
  const totalExp = byCategory.reduce((s, c) => s + Number(c.value || 0), 0) || 1;
  const typeLabel = (t) => (t === 'income' ? 'Receita' : t === 'transfer' ? 'Transferência' : 'Despesa');

  // Aba Resumo
  const resumoRows = [
    row([strCell('Relatório financeiro Monvy', 'title')]),
    row([strCell(periodLabel, 'sub')]),
    row([strCell(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 'sub')]),
    row([strCell('')]),
    row([strCell('Indicador', 'hdr'), strCell('Valor', 'hdr')]),
    row([strCell('Saldo total em contas'), numCell(totalBalance, 'moneyBold')]),
    row([strCell('Receitas do período'), numCell(totals.inc, 'in')]),
    row([strCell('Despesas do período'), numCell(totals.exp, 'out')]),
    row([strCell('Saldo do período'), numCell(totals.bal, 'moneyBold')]),
    row([strCell('Taxa de poupança'), `<Cell ss:StyleID="pct"><Data ss:Type="Number">${(Number(totals.rate) || 0) / 100}</Data></Cell>`]),
    row([strCell('')]),
    row([strCell('Mês', 'hdr'), strCell('Receita', 'hdr'), strCell('Despesa', 'hdr'), strCell('Saldo', 'hdr')]),
    ...monthly.map((m) => row([strCell(m.name), numCell(m.Receita, 'in'), numCell(m.Despesa, 'out'), numCell(m.net, 'money')])),
  ].join('');
  const resumo = sheet('Resumo', col(230) + col(140) + col(140) + col(140), resumoRows);

  // Aba Entradas e Saídas (o que o usuário pediu)
  const esHdr = row([strCell('Data', 'hdr'), strCell('Tipo', 'hdr'), strCell('Descrição', 'hdr'), strCell('Categoria', 'hdr'), strCell('Entrada', 'hdr'), strCell('Saída', 'hdr'), strCell('Status', 'hdr')]);
  const esBody = statement.map((t) => {
    const isInc = t.type === 'income'; const isExp = t.type === 'expense';
    return row([
      strCell(String(t.date).slice(0, 10)),
      strCell(typeLabel(t.type)),
      strCell(t.description || ''),
      strCell(t.category || ''),
      isInc ? numCell(t.amount, 'in') : strCell(''),
      isExp ? numCell(t.amount, 'out') : strCell(''),
      strCell(t.status === 'completed' ? 'Concluído' : (t.type === 'transfer' ? '—' : 'Em aberto')),
    ]);
  }).join('');
  const totEnt = statement.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
  const totSai = statement.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
  const esTot = row([strCell('Totais', 'bold'), strCell(''), strCell(''), strCell(''), numCell(totEnt, 'in'), numCell(totSai, 'out'), strCell('')]);
  const entradasSaidas = sheet('Entradas e Saídas', col(90) + col(100) + col(280) + col(160) + col(120) + col(120) + col(110), esHdr + esBody + esTot);

  // Aba Categorias
  const catRows = [
    row([strCell('Categoria', 'hdr'), strCell('Valor', 'hdr'), strCell('% das despesas', 'hdr')]),
    ...byCategory.map((c) => row([strCell(c.name), numCell(c.value, 'out'), `<Cell ss:StyleID="pct"><Data ss:Type="Number">${(Number(c.value || 0) / totalExp)}</Data></Cell>`])),
    row([strCell('Total', 'bold'), numCell(totalExp, 'moneyBold'), `<Cell ss:StyleID="pct"><Data ss:Type="Number">1</Data></Cell>`]),
  ].join('');
  const categorias = sheet('Categorias', col(240) + col(140) + col(140), catRows);

  const xml = workbook(resumo + entradasSaidas + categorias);
  const blob = new Blob(['﻿', xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.endsWith('.xls') || filename.endsWith('.xlsx') ? filename.replace('.xlsx', '.xls') : `${filename}.xls`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
