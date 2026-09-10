// Gera um PDF fiel a tela (WYSIWYG) a partir de um elemento do DOM.
// Captura cada secao com html2canvas e pagina em A4, com cabecalho de marca.
// Ideal para o Relatorio: leva TUDO da tela para o PDF, bonito e multipagina.
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const A4 = { w: 210, h: 297 };
const MARGIN = 10;
const HEADER_H = 14;

function drawHeader(pdf, title, subtitle, page, total) {
  // faixa verde
  pdf.setFillColor(6, 78, 59); // #064e3b
  pdf.rect(0, 0, A4.w, HEADER_H, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
  pdf.text(title, MARGIN, 9);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
  pdf.setTextColor(209, 250, 229); // #d1fae5
  if (subtitle) pdf.text(subtitle, MARGIN, 12.6);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`${page}/${total}`, A4.w - MARGIN, 9, { align: 'right' });
}

async function shot(node) {
  return html2canvas(node, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: document.documentElement.clientWidth,
    onclone: (doc) => {
      // força tema claro no PDF, independentemente do tema do app
      doc.documentElement.classList.remove('dark');
      doc.body.style.background = '#ffffff';
    },
  });
}

// el: container do relatorio. Ignora filhos com a classe print:hidden e os ocultos.
export async function exportReportToPdf(el, { filename = 'relatorio.pdf', title = 'Monvy · Relatório Financeiro', subtitle = '' } = {}) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const contentW = A4.w - MARGIN * 2;
  const usableH = A4.h - MARGIN - HEADER_H - MARGIN; // area util por pagina (mm)

  // seleciona as secoes visiveis (pula toolbar/hero marcados como print:hidden)
  const children = Array.from(el.children).filter((c) => {
    if (c.classList.contains('print:hidden')) return false;
    const cs = window.getComputedStyle(c);
    if (cs.display === 'none' || c.offsetHeight === 0) return false;
    return true;
  });

  // pre-renderiza as secoes em canvases
  const shots = [];
  for (const c of children) {
    try { shots.push(await shot(c)); } catch { /* ignora secao problematica */ }
  }

  // primeira passada: quantas paginas serao (para numerar)
  const placements = [];
  let y = HEADER_H + MARGIN;
  let page = 1;
  for (const canvas of shots) {
    const hMm = (canvas.height * contentW) / canvas.width;
    if (hMm <= usableH) {
      if (y + hMm > A4.h - MARGIN) { page++; y = HEADER_H + MARGIN; }
      placements.push({ canvas, page, y, hMm, slice: null });
      y += hMm + 4;
    } else {
      // secao maior que a pagina -> fatiar
      const pxPerMm = canvas.width / contentW;
      let rendered = 0;
      // sempre comeca a secao grande no topo de uma pagina
      if (y > HEADER_H + MARGIN) { page++; y = HEADER_H + MARGIN; }
      while (rendered < canvas.height) {
        const sliceHpx = Math.min(usableH * pxPerMm, canvas.height - rendered);
        const hMmSlice = sliceHpx / pxPerMm;
        placements.push({ canvas, page, y: HEADER_H + MARGIN, hMm: hMmSlice, slice: { sy: rendered, sh: sliceHpx } });
        rendered += sliceHpx;
        if (rendered < canvas.height) { page++; }
      }
      page++; y = HEADER_H + MARGIN;
    }
  }
  const totalPages = Math.max(1, page);

  // segunda passada: desenha
  let curPage = 0;
  for (const p of placements) {
    while (curPage < p.page) { if (curPage > 0) pdf.addPage(); curPage++; drawHeader(pdf, title, subtitle, curPage, totalPages); }
    let dataUrl, drawW = contentW, drawH = p.hMm;
    if (p.slice) {
      const pc = document.createElement('canvas');
      pc.width = p.canvas.width; pc.height = p.slice.sh;
      pc.getContext('2d').drawImage(p.canvas, 0, p.slice.sy, p.canvas.width, p.slice.sh, 0, 0, p.canvas.width, p.slice.sh);
      dataUrl = pc.toDataURL('image/jpeg', 0.92);
    } else {
      dataUrl = p.canvas.toDataURL('image/jpeg', 0.92);
    }
    pdf.addImage(dataUrl, 'JPEG', MARGIN, p.y, drawW, drawH);
  }
  if (curPage === 0) drawHeader(pdf, title, subtitle, 1, 1);

  pdf.save(filename);
}
