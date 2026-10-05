#!/usr/bin/env python3
"""prompt_run — lancia prompt su modello locale via API Ollama-compatible.

IT: legge prompt da argomento o stdin, chiama /api/generate, stampa risposta.
EN: reads prompt from arg or stdin, calls /api/generate, prints response.

Uso / Usage:
    python run.py "spiega cos'e' un RAG in 2 righe" --model llama3.1
    cat prompt.txt | python run.py --model llama3.1
    python tools/python/text_clean/clean.py examples/sample.txt | python tools/python/prompt_run/run.py "riassumi:" --model llama3.1
    python run.py --help

Richiede / Requires: Ollama attivo su OLLAMA_HOST (default http://localhost:11434).
Solo stdlib (urllib), zero dipendenze / stdlib only, zero dependencies.
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error


def normalize_host(host: str) -> str:
    host = host.strip().rstrip("/")
    if "://" not in host:
        host = "http://" + host
    return host


def run_prompt(host: str, model: str, prompt: str, system: str = "", timeout: int = 120) -> str:
    url = normalize_host(host) + "/api/generate"
    payload = {"model": model, "prompt": prompt, "stream": False}
    if system:
        payload["system"] = system
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8")[:300]
        except Exception:
            detail = str(e)
        raise RuntimeError(f"Ollama errore {e.code} su {host} / error: {detail}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Ollama non raggiungibile su {host} / not reachable: {e}")
    return body.get("response", "")


def main() -> int:
    p = argparse.ArgumentParser(description="Prompt su modello locale / Prompt local model (IT/EN).")
    p.add_argument("prompt", nargs="?", help="Prompt (default: stdin)")
    p.add_argument("--model", default=os.environ.get("OLLAMA_MODEL", "llama3.1"))
    p.add_argument("--host", default=os.environ.get("OLLAMA_HOST", "http://localhost:11434"))
    p.add_argument("--system", default="", help="System prompt opzionale / optional")
    p.add_argument("--timeout", type=int, default=120)
    args = p.parse_args()

    if args.prompt:
        prompt = args.prompt
        # se c'è anche stdin piped, accodalo / if piped stdin, append it
        if not sys.stdin.isatty():
            extra = sys.stdin.read().strip()
            if extra:
                prompt = prompt + "\n\n" + extra
    else:
        if sys.stdin.isatty():
            p.print_help()
            return 1
        prompt = sys.stdin.read()

    if not prompt.strip():
        print("Prompt vuoto / empty prompt", file=sys.stderr)
        return 1

    try:
        out = run_prompt(args.host, args.model, prompt, args.system, args.timeout)
    except RuntimeError as e:
        print(f"Errore / Error: {e}", file=sys.stderr)
        return 2
    sys.stdout.write(out if out.endswith("\n") else out + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
