# ai-tools-mcp — server MCP stdio

Espone le 53 `ToolDefinition` a opencode e agenti MCP-compatibili.

## Requisiti

1. `pnpm build` in `packages/agent-tools` (serve `dist/`, ignorato da git).
2. Node 20+.

## Prova a mano

```sh
cd /path/to/AI-Tools
AI_TOOLS_CWD=/tmp/prova node servers/ai-tools-mcp/server.mjs
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"src/a.txt"}}}
```

## Sicurezza

Policy-only (`standardPolicy` + audit in `.agent/audit/` dentro `AI_TOOLS_CWD`): niente approver nostro.
In opencode imposta `"ai-tools_*": "ask"` così chiede lui. Comandi pericolosi bloccati comunque.
