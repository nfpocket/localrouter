# localrouter

A self-hosted LLM gateway. Configure all your providers once — OpenAI, Anthropic, Google, Mistral, LM Studio, Ollama — then access any of them through a single OpenAI-compatible endpoint with one API key.

```
your app  →  localrouter  →  OpenAI
                          →  Anthropic
                          →  Google Gemini
                          →  Mistral
                          →  LM Studio (local)
                          →  Ollama (local)
```

## Quickstart (60 seconds)

```bash
npm install -g localrouter-ai     # or use npx localrouter-ai <command>

localrouter init               # creates ~/.localrouter/{config.yaml,.env} + gateway key
localrouter config             # add your provider API keys in your editor
localrouter start              # gateway running on http://localhost:3000
```

`init` prints your **gateway API key** (`lr-...`) — that's the one key all your apps use.

Test it:

```bash
curl http://localhost:3000/v1/models -H "Authorization: Bearer lr-..."
```

## Commands

| Command | What it does |
|---|---|
| `localrouter init` | Scaffold `~/.localrouter/config.yaml` with a generated gateway key (`--force` to overwrite) |
| `localrouter start` | Run the gateway in the foreground. `-d` to daemonize, `-p <port>`, `-c <config>` |
| `localrouter stop` | Stop the background gateway (`--force` if it doesn't answer health checks) |
| `localrouter status` | Running state, pid, port, uptime — exit code 1 when stopped (scriptable) |
| `localrouter logs` | Show daemon logs. `-n <lines>`, `-f` to follow, `--clear` to truncate |
| `localrouter config` | Open the config in `$EDITOR` (`--path` prints the resolved path) |
| `localrouter models` | List all available models, including live-discovered local ones (`--json`) |

Daemon mode keeps its state in `~/.localrouter/` (`state.json`, `localrouter.pid`, `localrouter.log`). `stop`/`status`/`logs` manage daemon instances only — a foreground `start` is stopped with Ctrl+C.

## Configuration

### File resolution

First match wins:

1. `--config <path>` flag
2. `CONFIG_PATH` env var
3. `./config.yaml` in the current directory
4. `~/.localrouter/config.yaml`

### Format

```yaml
gateway:
  apiKey: lr-...          # clients authenticate with this (or GATEWAY_API_KEY env)
  # port: 3000

providers:
  openai:
    type: openai-compatible
    baseUrl: https://api.openai.com/v1
    apiKey: sk-proj-...   # inline (file is chmod 600) — or ${OPENAI_API_KEY}
    models:
      - gpt-4o
      - gpt-4o-mini

  anthropic:
    type: anthropic
    apiKey: ${ANTHROPIC_API_KEY}
    models:
      - claude-sonnet-4-6

  lmstudio:
    type: openai-compatible
    baseUrl: http://localhost:1234/v1
    discover: true        # models queried live from the provider

aliases:
  fast: openai/gpt-4o-mini
  smart: anthropic/claude-sonnet-4-6
```

- **Secrets** can be written inline (the file is created `chmod 600` — POSIX only, no protection on Windows) or referenced as `${VAR}` from the environment.
- **`.env` loading**: both `./.env` and `~/.localrouter/.env` are loaded automatically; the current directory wins, and real environment variables beat both.
- **Port precedence**: `--port` flag > `PORT` env > `gateway.port` in config > 3000.
- **Provider types**: `openai-compatible` (proxied directly — works for any service speaking the OpenAI API), `anthropic`, `google` (translated).
- **`discover: true`**: the provider's `/v1/models` is queried live (cached 30s) — whatever is loaded in LM Studio/Ollama shows up automatically.

## Using the gateway from your app

Any OpenAI-compatible client works. Model strings are `provider/model`, or an alias from your config:

```ts
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const localrouter = createOpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: process.env.LOCALROUTER_API_KEY,   // your lr-... key
});

const { text } = await generateText({
  model: localrouter('anthropic/claude-sonnet-4-6'),   // or 'smart', or 'lmstudio/...'
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

See [`examples/usage.ts`](examples/usage.ts) for streaming, embeddings, local models, and aliases.

Endpoints: `POST /v1/chat/completions` (incl. SSE streaming), `POST /v1/embeddings`, `GET /v1/models`, `GET /health` (unauthenticated).

## Docker

```bash
git clone <repo> && cd localrouter
cp config.example.yaml config.yaml    # edit providers
cp .env.example .env                  # set GATEWAY_API_KEY + provider keys
docker compose up --build -d
```

The compose file mounts `./config.yaml` and sets `CONFIG_PATH` explicitly. Local providers on the host are reachable via `host.docker.internal` (see `config.example.yaml`). To run Ollama alongside, uncomment the `ollama` service in `docker-compose.yaml`.

## Logs

One JSON line per request to stdout (foreground) or `~/.localrouter/localrouter.log` (daemon):

```json
{"ts":"2026-06-02T12:00:00.000Z","method":"POST","path":"/v1/chat/completions","provider":"anthropic","model":"claude-sonnet-4-6","alias":"smart","stream":true,"status":200,"latencyMs":843}
```

## Security notes

- Without a gateway key (no `gateway.apiKey` and no `GATEWAY_API_KEY`), **auth is disabled** — localrouter warns loudly at startup. Only do this behind a firewall.
- `~/.localrouter/config.yaml` is created `chmod 600`; treat it like a password store.
- The log file is not rotated — `localrouter logs --clear` truncates it.
