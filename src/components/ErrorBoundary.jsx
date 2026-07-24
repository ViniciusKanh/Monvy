import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Monvy erro de tela:', error, info); }
  componentDidUpdate(prev) { if (prev.routeKey !== this.props.routeKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (this.state.error) {
      return (
        <div className="max-w-lg mx-auto card p-8 text-center mt-10">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center mb-4"><AlertTriangle className="w-8 h-8 text-rose-500" /></div>
          <h2 className="font-display font-bold text-lg">Algo deu errado nesta tela</h2>
          <p className="text-sm text-muted mt-2">Anote a mensagem abaixo e recarregue. Se persistir, me envie este texto.</p>
          <pre className="text-xs text-left bg-black/5 dark:bg-white/5 rounded-lg p-3 mt-3 overflow-auto max-h-40 text-rose-600 dark:text-rose-400">{String(this.state.error?.message || this.state.error)}</pre>
          <button onClick={() => { this.setState({ error: null }); location.reload(); }} className="mt-5 inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-2 rounded-lg"><RefreshCw className="w-4 h-4" /> Recarregar</button>
        </div>
      );
    }
    return this.props.children;
  }
}
