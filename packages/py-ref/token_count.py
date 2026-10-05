#!/usr/bin/env python3
"""token_count — conta chars/parole/righe e stima token per AI locali.

IT: legge da file o stdin. Stima token come chars//4 (euristica, non tokenizer reale).
EN: reads from file or stdin. Token estimate as chars//4 (heuristic, not a real tokenizer).

Uso / Usage:
    python count.py input.txt
    cat input.txt | python count.py --json
    python count.py input.txt --tokens-only
    python count.py --help
"""

import argparse
import json
import sys


def count_stats(text: str) -> dict:
    chars = len(text)
    lines = len(text.splitlines()) if text else 0
    words = len(text.split()) if text.strip() else 0
    est_tokens = chars // 4
    return {"chars": chars, "words": words, "lines": lines, "est_tokens": est_tokens}


def main() -> int:
    p = argparse.ArgumentParser(description="Conta e stima token / Count and estimate tokens (IT/EN).")
    p.add_argument("input", nargs="?", help="File input (default: stdin)")
    p.add_argument("--json", action="store_true", help="Output JSON")
    p.add_argument("--tokens-only", action="store_true", help="Solo numero stima token / only token number")
    args = p.parse_args()

    if args.input:
        with open(args.input, encoding="utf-8") as f:
            raw = f.read()
    else:
        if sys.stdin.isatty():
            p.print_help()
            return 1
        raw = sys.stdin.read()

    stats = count_stats(raw)

    if args.tokens_only:
        sys.stdout.write(str(stats["est_tokens"]) + "\n")
    elif args.json:
        sys.stdout.write(json.dumps(stats) + "\n")
    else:
        sys.stdout.write(
            f"chars: {stats['chars']} | words: {stats['words']} | "
            f"lines: {stats['lines']} | est_tokens: {stats['est_tokens']} (~chars/4)\n"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
