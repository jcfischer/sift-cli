# sift-cli

A CLI for [Sift](https://getsift.ch) — AI-powered research intelligence.

Search your article corpus, ask questions answered from curated sources, and manage topics and feeds from the terminal or through an AI agent.

**Repository:** [github.com/jcfischer/sift-cli](https://github.com/jcfischer/sift-cli)

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime

### Install from source

```bash
git clone https://github.com/jcfischer/sift-cli.git
cd sift-cli
bun install
bun run build
```

This compiles a self-contained binary to `~/bin/sift`. Make sure `~/bin` is in your `PATH`.

### Run without compiling

```bash
bun run src/main.ts <command>
```

## Agent integration

Sift is designed to be used by AI coding agents (Claude Code, Cursor, etc.) as a research tool. To add Sift as a skill for your agent:

1. Copy `SKILL.md` from this repository into your agent's skill directory (e.g. `~/.claude/skills/sift/SKILL.md` for Claude Code)
2. Set the required environment variables (see Configuration below)
3. Your agent can now search articles, ask research questions, and manage topics via the `sift` CLI

See [SKILL.md](SKILL.md) for the full skill definition.

## Configuration

Set credentials via environment variables:

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

Tokens are obtained via OAuth2 Client Credentials flow and cached at `~/.config/sift/token.json` (refreshed 60 seconds before expiry).

### Environment variables

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

### `sift topic-create <name>` (super admin only)

Create a new topic.

```bash
sift topic-create "Kubernetes Security" --description "CVEs and hardening guides for k8s"
```

Options:
- `-d, --description <text>` — Topic description

### `sift sources`

List feed sources.

```bash
sift sources
sift sources --limit 100
```

Options:
- `-n, --limit <n>` — Maximum results (default: 25)

### `sift source-add <url>`

Add a new feed source.

```bash
sift source-add https://example.com/feed.xml
sift source-add https://example.com --type webpage --title "Example Blog"
```

Options:
- `-t, --type <type>` — Source type: `rss`, `webpage`, `newsletter`, `academic`, `social`, `video` (default: `rss`)
- `--title <title>` — Custom title
- `-p, --priority <n>` — Priority 1-5 (default: 3)

### `sift assign-topic`

Assign a feed source to a topic.

```bash
sift assign-topic --feed-id 42 --topic-id 7
```

Options:
- `--feed-id <id>` — Feed ID (required)
- `--topic-id <id>` — Topic ID (required)
- `-s, --source <source>` — Assignment source: `manual`, `system`, `inferred` (default: `manual`)

## Global flags

| Flag | Description |
|------|-------------|
| `--json` | Output results as JSON (for scripting and agents) |
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

# Add a source and assign it to a topic
sift source-add https://blog.example.com/feed.xml
sift assign-topic --feed-id 42 --topic-id 3
```

## License

MIT
