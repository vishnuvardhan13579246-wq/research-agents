import { useRef, useState } from 'react';

const ICON = { planner: 'Planner', researcher: 'Researcher', summarizer: 'Summarizer', writer: 'Writer' };

// Tiny markdown renderer: headings, links, lists, paragraphs. Keeps the app dependency-free.
function Markdown({ text }) {
  const inline = (s) => s.split(/(\[[^\]]+\]\([^)]+\))/g).map((p, i) => {
    const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    return m ? <a key={i} href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a> : p;
  });
  return text.split('\n').map((l, i) => {
    if (l.startsWith('## ')) return <h2 key={i}>{inline(l.slice(3))}</h2>;
    if (l.startsWith('# ')) return <h1 key={i}>{inline(l.slice(2))}</h1>;
    if (!l.trim()) return null;
    return <p key={i}>{inline(l)}</p>;
  });
}

export default function App() {
  const [topic, setTopic] = useState('');
  const [steps, setSteps] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const es = useRef(null);

  function start(e) {
    e.preventDefault();
    if (topic.trim().length < 3) return;
    setSteps([]); setResult(null); setError(''); setBusy(true);
    es.current?.close();
    const src = new EventSource(`/api/research?topic=${encodeURIComponent(topic)}`);
    es.current = src;
    src.addEventListener('step', (ev) => setSteps((s) => [...s, JSON.parse(ev.data)]));
    src.addEventListener('done', (ev) => { setResult(JSON.parse(ev.data)); setBusy(false); src.close(); });
    src.addEventListener('fail', (ev) => { setError(JSON.parse(ev.data).error); setBusy(false); src.close(); });
    src.onerror = () => { setBusy(false); src.close(); };
  }

  return (
    <div className="wrap">
      <h1>Multi-agent Research Bot</h1>
      <p className="sub">Planner, Researcher, Summarizer and Writer agents turn a topic into a sourced report.</p>
      <form className="card row" onSubmit={start}>
        <input style={{ flex: 3 }} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Retrieval augmented generation" />
        <button style={{ flex: 1 }} disabled={busy}>{busy ? 'Working...' : 'Research'}</button>
      </form>
      {error && <p className="err">{error}</p>}
      {steps.length > 0 && (
        <div className="card">
          <h2>Agent activity</h2>
          {steps.map((s, i) => <div key={i}><span className="badge">{ICON[s.agent]}</span> {s.message}</div>)}
        </div>
      )}
      {result && <div className="card"><span className="badge">{result.mode} mode</span><Markdown text={result.report} /></div>}
    </div>
  );
}
