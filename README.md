# sift

A CLI for the [Sift](https://getsift.ch) AI search and Q&A API.

Search your article corpus, ask questions answered from curated sources, and browse topics and feeds — all from the terminal.

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime

### Build from source

```bash
git clone https://github.com/your-username/sift
cd sift
bun install
bun run build
```

This compiles a self-contained binary to `~/bin/sift`. Make sure `~/bin` is in your `PATH`.

### Run without compiling

```bash
bun run src/main.ts <command>
```

## Configuration

Set credentials via environment variables (recommended):

```bash
export SIFT_CLIENT_ID=your_client_id
export SIFT_CLIENT_SECRET=your_client_secret
```

Or create `~/.config/sift/config.json`:

```json
{
  "clientId": "your_client_id",
  "clientSecret": "your_client_secret"
}
```

Tokens are automatically obtained via OAuth2 Client Credentials flow and cached at `~/.config/sift/token.json` (refreshed 60 seconds before expiry).

### Optional environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SIFT_CLIENT_ID` | — | Your API client ID (required) |
| `SIFT_CLIENT_SECRET` | — | Your API client secret (required) |
| `SIFT_TOKEN_URL` | `https://app.getsift.ch/v1/auth/token` | Token exchange endpoint |
| `SIFT_API_URL` | `https://app.getsift.ch/v1` | API base URL |

## Commands

### `sift search <query>`

Search articles matching a query.

```bash
sift search "machine learning trends"
sift search "Bun runtime" --limit 5
```

Options:
- `-n, --limit <n>` — Maximum results (default: 10)

### `sift ask <question>`

Ask a question answered from the article corpus using AI.

```bash
sift ask "What are the main differences between Bun and Node.js?"
sift ask "What happened with the Mars mission?" --mode deep
```

Options:
- `-m, --mode <mode>` — `quick` (default) or `deep`

### `sift topics`

List available topics.

```bash
sift topics
sift topics --scope system
```

Options:
- `--scope <scope>` — Filter: `system` or `tenant`
- `-n, --limit <n>` — Maximum results (default: 50)

### `sift sources`

List feed sources.

```bash
sift sources
sift sources --limit 100
```

Options:
- `-n, --limit <n>` — Maximum results (default: 25)

## Global flags

| Flag | Description |
|------|-------------|
| `--json` | Output results as JSON (for scripting) |
| `--version` | Show version |
| `--help` | Show help |

## Examples

```bash
# Search with JSON output for scripting
sift search "AI agents" --json | jq '.[0].url'

# Ask a question and get JSON back
sift ask "What is Hono?" --json | jq '.answer'

# List topics in JSON format
sift topics --json | jq '.[].name'
```

## License

MIT
