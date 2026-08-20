import { askAssistant, buildAIContext } from './assistant.js';
import { Ai } from '../api/entities.js';

// Responde de forma hibrida: usa Gemini quando ha chave; senao cai no motor local.
export async function answerHybrid({ question, ctx, agent, apiKey, history = [] }) {
  if (apiKey) {
    try {
      const persona = agent ? { name: agent.name, focus: agent.focusLabel || agent.focus || '' } : null;
      const { answer } = await Ai.ask(question, buildAIContext(ctx), apiKey, history.slice(-6).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text })), persona);
      if (answer) return { text: answer, via: 'gemini' };
    } catch { /* cai no motor local */ }
  }
  const r = await askAssistant(question, ctx, agent);
  return { text: r.text, via: 'local' };
}
