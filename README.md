# 🦀 Smartclaw — The Intelligent Personal AI Assistant

> Combining the best of OpenClaw, Zeroclaw, Nanoclaw, Trustclaw, and ClawdMatrix into one smart package.

Smartclaw is a modular, secure, and lightweight personal AI assistant built in TypeScript. It cherry-picks the strongest ideas from five community forks and unifies them into a single, cohesive architecture.

## Key Features

| Origin | What Smartclaw Takes |
|---|---|
| **OpenClaw** (209k ★) | Multi-channel support (WhatsApp, Telegram, Slack, Discord), Gateway WebSocket control plane, multi-agent routing |
| **Zeroclaw** (14k ★) | Lean dependency philosophy, modular architecture, performance-first mindset |
| **Nanoclaw** (9.3k ★) | Skills-based customization ("Don't add features. Add skills."), container isolation, agent swarms |
| **Trustclaw** (41 ★) | Security gateway with audit logging, tool execution confirmation, network isolation, file system restrictions, rate limiting |
| **ClawdMatrix** (5 ★) | Five-stage cognitive prompt pipeline — Intent Triage, Dynamic Skill Injection, Quality Gates, token optimization |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/smartclaw.git
cd smartclaw

# Install dependencies
npm install

# Copy the example environment file
cp .env.example .env
# Edit .env with your API keys

# Build the project
npm run build

# Run the assistant
npm start
```

## Architecture

```
smartclaw/
├── src/
│   ├── index.ts            # Entry point — Smartclaw class
│   ├── types.ts             # Shared TypeScript types
│   ├── config/
│   │   └── config.ts        # Zod-validated configuration
│   ├── gateway/
│   │   ├── gateway.ts       # WebSocket control plane
│   │   └── session.ts       # Session lifecycle management
│   ├── channels/
│   │   ├── channel.ts       # Abstract channel interface
│   │   └── router.ts        # Message routing engine
│   ├── security/
│   │   ├── audit.ts         # Structured audit logger
│   │   ├── sandbox.ts       # Container sandbox abstraction
│   │   └── policy.ts        # Security policy engine
│   ├── prompt/
│   │   ├── engine.ts        # Five-stage cognitive pipeline
│   │   └── triangulator.ts  # Intent triangulation
│   └── skills/
│       ├── registry.ts      # Skill registration & discovery
│       └── loader.ts        # Dynamic skill loading
└── tests/
```

Each module is focused and small — you can understand any single file in under 8 minutes.

## Configuration

Smartclaw uses [Zod](https://zod.dev) to validate all configuration at startup. Configuration is loaded from environment variables.

```typescript
import { loadConfig } from "smartclaw";

const config = loadConfig(); // Throws if env vars are invalid
```

See [`.env.example`](.env.example) for all available settings.

## Security

Inherited from **Trustclaw**, every action flows through the security policy engine:

- **Tool Execution Confirmation** — optional approval before running tools
- **Network Isolation Mode** — restrict outbound network access
- **File System Restrictions** — allowlist-based path access
- **Rate Limiting** — configurable requests-per-minute cap
- **Audit Logging** — structured JSON logs of every tool call and security event

```typescript
import { AuditLogger, SecurityPolicy } from "smartclaw";

const audit = new AuditLogger();
const policy = SecurityPolicy.fromConfig(config.security);
```

## Skills System

Following **Nanoclaw's** philosophy: _"Don't add features. Add skills."_

Skills are modular, composable units of functionality:

```typescript
import { SkillsRegistry } from "smartclaw";

const registry = new SkillsRegistry();

registry.register({
  name: "web-search",
  domain: "research",
  description: "Search the web for information",
  execute: async (input) => {
    // skill logic
    return { result: "..." };
  },
});
```

The **ClawdMatrix** prompt engine automatically detects which skills are relevant and injects only those into the prompt — saving tokens and improving response quality.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-skill`)
3. Commit your changes (`git commit -m 'Add amazing skill'`)
4. Push to the branch (`git push origin feature/amazing-skill`)
5. Open a Pull Request

Please keep modules small and focused. Add tests for new functionality.

## License

[MIT](LICENSE)