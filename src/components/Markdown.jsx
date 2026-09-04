// Renderizador de markdown leve (sem dependências) para respostas de IA.
// Suporta: **negrito**, *itálico*, `código`, listas (•, -, *, 1.), títulos (#),
// parágrafos e quebras de linha. Ignora HTML bruto (trata como texto).

function inline(text, keyBase) {
  const nodes = [];
  const re = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|`(.+?)`/g;
  let last = 0, m, k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyBase}-${k++}`;
    if (m[1] != null || m[2] != null) nodes.push(<strong key={key}>{m[1] ?? m[2]}</strong>);
    else if (m[3] != null || m[4] != null) nodes.push(<em key={key}>{m[3] ?? m[4]}</em>);
    else if (m[5] != null) nodes.push(<code key={key} className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/15 text-[0.85em]">{m[5]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const BULLET = /^\s*[•\-*]\s+(.*)$/;
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING = /^\s*(#{1,3})\s+(.*)$/;

export function Markdown({ text, className = '' }) {
  if (!text) return null;
  const lines = String(text).replace(/\r/g, '').split('\n');
  const blocks = [];
  let list = null; // { ordered, items: [] }

  const flush = () => { if (list) { blocks.push(list); list = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    const h = line.match(HEADING);
    if (h) { flush(); blocks.push({ type: 'h', level: h[1].length, text: h[2] }); continue; }
    const b = line.match(BULLET);
    const o = line.match(ORDERED);
    if (b || o) {
      const ordered = !!o;
      if (!list || list.ordered !== ordered) { flush(); list = { type: 'list', ordered, items: [] }; }
      list.items.push((b ? b[1] : o[2]));
      continue;
    }
    flush();
    blocks.push({ type: 'p', text: line });
  }
  flush();

  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((blk, i) => {
        if (blk.type === 'h') {
          const size = blk.level === 1 ? 'text-base' : 'text-sm';
          return <p key={i} className={`font-bold ${size}`}>{inline(blk.text, `h${i}`)}</p>;
        }
        if (blk.type === 'list') {
          const Tag = blk.ordered ? 'ol' : 'ul';
          return (
            <Tag key={i} className={`${blk.ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1 marker:text-emerald-500`}>
              {blk.items.map((it, j) => <li key={j} className="leading-snug">{inline(it, `l${i}-${j}`)}</li>)}
            </Tag>
          );
        }
        return <p key={i} className="leading-relaxed">{inline(blk.text, `p${i}`)}</p>;
      })}
    </div>
  );
}
