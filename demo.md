# localrouter — Demo / Test Walkthrough

Hands-on test path, from "fresh terminal" to "real LLM response".

## 1. Simulate the real install

```bash
cd ~/Documents/Projects/localrouter
npm run build
npm link          # makes `localrouter` available globally, like npm i -g
```

Now `localrouter` works from any directory. (`npm unlink -g localrouter` later to remove.)

## 2. First-run experience

```bash
cd ~          # away from the repo, so you get the real ~/.localrouter path
localrouter init
```

It prints your `lr-...` gateway key — copy it. Then:

```bash
localrouter config        # opens ~/.localrouter/config.yaml in your editor
```

Paste at least one real provider key inline (e.g. your Anthropic key under `anthropic.apiKey`, replacing `${ANTHROPIC_API_KEY}`), save, quit.

## 3. Start and poke it

```bash
localrouter start -d
localrouter status
localrouter models        # should list cloud models; LM Studio models appear if it's running
```

Real end-to-end request:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer lr-YOUR-KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"anthropic/claude-haiku-4-5","messages":[{"role":"user","content":"Say hi in 3 words"}]}'
```

Streaming (you should see SSE chunks arrive incrementally):

```bash
curl -N http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer lr-YOUR-KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"anthropic/claude-haiku-4-5","messages":[{"role":"user","content":"Count to 10"}],"stream":true}'
```

## 4. Local model test

Start LM Studio's server (or Ollama), then:

```bash
localrouter models                    # lmstudio/... entries appear automatically
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer lr-YOUR-KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"lmstudio/<id-from-models-list>","messages":[{"role":"user","content":"hi"}]}'
```

## 5. The client-side view

```bash
cd ~/Documents/Projects/localrouter
LOCALROUTER_API_KEY=lr-YOUR-KEY npx tsx examples/usage.ts
```

(You may want to edit which examples run at the bottom of the file to match the providers you've configured.)

## 6. Daemon lifecycle

```bash
localrouter logs -f       # watch requests come in live, Ctrl+C to detach
localrouter stop
localrouter status        # "Stopped.", exit code 1
```

## Tip: throwaway sandbox

To test destructive things (`init --force`, broken configs, etc.) without touching your real setup:

```bash
LOCALROUTER_HOME=/tmp/lr-sandbox localrouter init
LOCALROUTER_HOME=/tmp/lr-sandbox localrouter start -d -p 3999
```

Everything (config, state, logs) lands in `/tmp/lr-sandbox` — delete the dir when done.
