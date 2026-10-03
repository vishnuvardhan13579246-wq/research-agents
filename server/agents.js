// Four cooperating agents: Planner -> Researcher -> Summarizer -> Writer.
// Each has an LLM path (if OPENAI_API_KEY is set) and an offline path, so the pipeline always runs.
import { chat, hasKey } from './llm.js';

const STOP = new Set('the a an and or of to in for with on at by is are was were be as from that this it its how what why when who which about into than then also more most such other any all'.split(' '));
const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));

export async function planner(topic) {
  if (hasKey()) {
    try {
      const out = await chat([{ role: 'system', content: 'Split the research topic into 3-4 specific search queries. Reply as JSON {"queries":[string]}.' }, { role: 'user', content: topic }], { json: true });
      const q = JSON.parse(out).queries;
      if (Array.isArray(q) && q.length) return q.slice(0, 4);
    } catch { /* fall through */ }
  }
  return [topic, `${topic} history`, `${topic} applications`, `${topic} challenges`];
}

export async function researcher(query, seen = new Set()) {
  const url = 'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: query, gsrlimit: '4', prop: 'extracts|info', exintro: '1', explaintext: '1',
    exlimit: 'max', inprop: 'url', format: 'json', origin: '*',
  });
  const res = await fetch(url, { headers: { 'User-Agent': 'research-agents-demo/1.0' } });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const pages = Object.values((await res.json()).query?.pages || {});
  return pages.filter((p) => p.extract && p.extract.length > 200 && !seen.has(p.fullurl)).sort((a, b) => a.index - b.index).slice(0, 2).map((p) => ({ title: p.title, url: p.fullurl, text: p.extract.slice(0, 3000) }));
}

export function extractive(text, query, n = 2) {
  const q = new Set(words(query));
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.map((s, i) => ({ s: s.trim(), i, score: words(s).filter((w) => q.has(w)).length - i * 0.05 }))
    .sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s).join(' ');
}

export async function summarizer(query, sources) {
  if (hasKey() && sources.length) {
    try {
      const body = sources.map((s, i) => `[${i + 1}] ${s.title}: ${s.text}`).join('\n\n');
      return await chat([{ role: 'system', content: 'Summarize what the sources say about the query in 3-5 sentences. Cite sources as [n]. Use only the sources.' }, { role: 'user', content: `Query: ${query}\n\n${body}` }]);
    } catch { /* fall through */ }
  }
  return sources.map((s) => `${extractive(s.text, query)} (${s.title})`).filter(Boolean).join('\n\n') || 'No new sources found for this angle.';
}

export async function writer(topic, sections) {
  if (hasKey()) {
    try {
      const body = sections.map((s) => `## ${s.query}\n${s.summary}`).join('\n\n');
      return await chat([{ role: 'system', content: 'Write a clear markdown report with a title, short intro, one section per research note, and a conclusion. Use only the notes.' }, { role: 'user', content: `Topic: ${topic}\n\n${body}` }]);
    } catch { /* fall through */ }
  }
  const refs = [...new Map(sections.flatMap((s) => s.sources).map((s) => [s.url, s])).values()];
  return [`# ${topic}`, '', ...sections.flatMap((s) => [`## ${s.query}`, s.summary, '']), '## Sources', ...refs.map((r, i) => `${i + 1}. [${r.title}](${r.url})`)].join('\n');
}

export async function run(topic, emit) {
  emit('planner', 'Planning research queries...');
  const queries = await planner(topic);
  emit('planner', `Queries: ${queries.join(' | ')}`);
  const sections = [];
  const seen = new Set();
  for (const query of queries) {
    emit('researcher', `Searching: ${query}`);
    let sources = [];
    try { sources = await researcher(query, seen); sources.forEach((x) => seen.add(x.url)); } catch (e) { emit('researcher', `Search failed: ${e.message}`); }
    emit('researcher', `Found ${sources.length} source(s)`);
    emit('summarizer', `Summarizing: ${query}`);
    sections.push({ query, sources, summary: await summarizer(query, sources) });
  }
  emit('writer', 'Writing final report...');
  const report = await writer(topic, sections);
  return { report, sources: [...new Map(sections.flatMap((s) => s.sources).map((s) => [s.url, s])).values()] };
}
