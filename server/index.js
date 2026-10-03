import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { run } from './agents.js';
import { hasKey } from './llm.js';

const app = express();
app.use(cors());
app.get('/api/health', (_, res) => res.json({ ok: true, mode: hasKey() ? 'llm' : 'extractive' }));

// Server-Sent Events: streams each agent's progress, then the final report.
app.get('/api/research', async (req, res) => {
  const topic = String(req.query.topic || '').trim();
  if (topic.length < 3) return res.status(400).json({ error: 'Give a topic.' });
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    const result = await run(topic, (agent, message) => send('step', { agent, message }));
    send('done', { ...result, mode: hasKey() ? 'llm' : 'extractive' });
  } catch (e) { send('fail', { error: e.message }); }
  res.end();
});

const port = process.env.PORT || 3003;
if (process.argv[1].endsWith('index.js')) app.listen(port, () => console.log(`API on :${port}`));
export default app;
