# run_subagent

Sub-agent vero con contesto isolato (non finto come `delegate_task`, che resta solo planning): gli dai `goal + paths`, lui vede solo quei file (max 8k chars) e ragiona sul modello — default Ollama locale (`OLLAMA_HOST`, `OLLAMA_MODEL`), `echo` per test. Se Ollama è spento torna `OLLAMA_MISSING`. Serve sempre accept umano.
