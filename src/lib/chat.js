import { askAssistant, askFocus, buildAIContext, deliberate, planResponders, agentInfo } from './assistant.js';
import { Ai } from '../api/entities.js';

// Responde de forma hibrida: usa Gemini quando ha chave; senao cai no motor local.
export async function answerHybrid({ question, ctx, agent, apiKey, history = [] }) {
  if (apiKey) {
    try {
      const persona = agent ? { name: agent.name, focus: agent.focusLabel || agent.focus || '', personality: agent.personality || '' } : null;
      const { answer } = await Ai.ask(question, buildAIContext(ctx), apiKey, history.slice(-6).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text })), persona);
      if (answer) return { text: answer, via: 'gemini' };
    } catch { /* cai no motor local */ }
  }
  const r = await askAssistant(question, ctx, agent);
  return { text: r.text, via: 'local' };
}

// resposta de um robo restrita a sua especialidade (para painel combinado)
async function focusAnswer({ question, ctx, info, apiKey }) {
  if (apiKey) {
    try {
      const { answer } = await Ai.ask(`${question}\n\n(Responda SOMENTE sobre sua especialidade: ${info.focusLabel}. Seja breve, ate 3 linhas.)`, buildAIContext(ctx), apiKey, [], { name: info.name, focus: info.focusLabel, personality: info.personality });
      if (answer) return { text: answer, via: 'gemini' };
    } catch { /* local */ }
  }
  const r = await askFocus(info.focus, ctx, info, { bare: true });
  return { text: r.text, via: 'local' };
}

// Orquestra a conversa: 1 robo (single) ou 2 robos (painel combinado quando a pergunta e multi-tema).
// primary = robo do chat individual (sempre participa); null no chat universal.
export async function converse({ question, ctx, agents = [], primary = null, apiKey, history = [] }) {
  const council = deliberate(question, agents);
  const responders = planResponders(question, agents, primary);

  if (responders.length <= 1) {
    const chosen = responders[0] || primary || council[0]?.agent || null;
    const info = chosen ? agentInfo(chosen) : { name: 'Assistente', focus: 'geral', focusLabel: 'Assistente geral', emoji: '🤖', personality: '' };
    const { text, via } = await answerHybrid({ question, ctx, agent: info, apiKey, history });
    return { council, panel: false, parts: [{ robot: info, text, via }] };
  }

  const parts = [];
  for (const r of responders) {
    const info = agentInfo(r);
    const { text, via } = await focusAnswer({ question, ctx, info, apiKey });
    parts.push({ robot: info, text, via });
  }
  return { council, panel: true, parts };
}
