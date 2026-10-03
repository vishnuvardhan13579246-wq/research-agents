# Multi-agent Research Bot

Give a topic. Four agents (Planner, Researcher, Summarizer, Writer) turn it into a sourced markdown report, and you watch each agent work live.

## Features
- Planner splits the topic into search queries
- Researcher pulls sources from the Wikipedia API
- Summarizer condenses each source set
- Writer assembles the report with links
- Live progress over Server-Sent Events

## Tech
React (Vite) + Node.js/Express. No API key needed: it runs in an offline mode by default. Add `OPENAI_API_KEY` to switch on LLM mode.

## Run it
Needs Node 18+.

```bash
# terminal 1 - API
cd server
npm install
cp .env.example .env     # optional: add OPENAI_API_KEY
npm start

# terminal 2 - web app
cd client
npm install
npm run dev              # open http://localhost:5173
```

## Test
```bash
cd server && npm test
```

## How it works
`agents.js` defines each agent as a small async function with an LLM path and an offline path (extractive summaries). `/api/research` streams each step as an SSE event and then sends the final report.

## Ideas to extend
- Add a web search source (Tavily, Brave)
- Let the writer ask the researcher for follow-ups
- Export to PDF
