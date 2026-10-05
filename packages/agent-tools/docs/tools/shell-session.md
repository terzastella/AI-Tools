# shell_session

Processi lunghi in background: `bash_exec` è one-shot bloccante, questo tiene il processo acceso.
Azioni: `start` (senza shell: cmd + args[]) + `poll` (ultimi N chars) + `kill` + `list`. Max 20 sessioni, buffer 200k chars (tiene gli ultimi).

```ts
const s = await shell_session.execute({ args: { action: "start", cmd: "npm", args: ["run", "dev"] }, ctx });
await shell_session.execute({ args: { action: "poll", id: s.data.session.id }, ctx });
await shell_session.execute({ args: { action: "kill", id: s.data.session.id }, ctx });
```

Serve sempre accept umano. Comandi pericolosi bloccati anche con accept.
