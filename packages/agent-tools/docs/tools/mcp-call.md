# mcp_call

Chiama un tool di un server MCP via stdio con handshake vero: `initialize` + `tools/list` + `tools/call`.
Niente dipendenze extra, solo `node:child_process`. Il processo server viene sempre ucciso dopo la call.

## Config

File JSON nel tuo progetto (default `mcp-servers.json`, vedi `examples/mcp-servers.json`):

```json
{
  "mcp": {
    "servers": {
      "web": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-fetch"], "env": {} }
    }
  }
}
```

Uso:

```ts
registry.register(wrapDefinition(mcpCallDefinition, { policy: standardPolicy, audit }));
// poi il modello chiama mcp_call{server:"web", tool:"fetch", args:{url:"https://..."}, config:"mcp-servers.json"}
// serve sempre accept umano (permission terminal:execute)
```

## Errori

- `CONFIG_NOT_FOUND` se manca il file config
- `SERVER_NOT_FOUND` se il nome non è in `mcp.servers`
- `MCP_ERROR` se il tool non esiste sul server o il server risponde errore
- `MCP_TIMEOUT` oltre `timeoutMs` (5000..120000)
- `NEED_APPROVAL` se dici deny
- `POLICY_DENIED` per comandi server pericolosi
