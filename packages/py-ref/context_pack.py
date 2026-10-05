#!/usr/bin/env python3
"""context_pack — concatena file con header + budget token.

IT: utile prima di promptare un modello locale.
EN: useful before prompting a local model.

Uso / Usage:
    python pack.py file1.txt file2.md --max-chars 8000
    python pack.py "docs/*.md" --header-style md
"""
import argparse, glob, os, sys

def main() -> int:
    p = argparse.ArgumentParser(description="Pack file in contesto / Pack files into context (IT/EN).")
    p.add_argument("patterns", nargs="+", help="File o glob")
    p.add_argument("--max-chars", type=int, default=12000)
    p.add_argument("--ext-skip", default=".pyc,.png,.jpg,.zip", help="Estensioni da saltare")
    args = p.parse_args()
    skip = set(s.strip() for s in args.ext_skip.split(","))
    files = []
    for pat in args.patterns:
        files.extend(glob.glob(pat, recursive=True))
    files = sorted(set(f for f in files if os.path.isfile(f) and os.path.splitext(f)[1] not in skip))
    if not files:
        print("Nessun file / no files", file=sys.stderr); return 1
    total = 0
    for f in files:
        try:
            with open(f, encoding="utf-8", errors="replace") as fh: content = fh.read()
        except OSError as e:
            print(f"skip {f}: {e}", file=sys.stderr); continue
        block = f"=== {f} ===\n{content}\n"
        if total + len(block) > args.max_chars:
            print(f"stop budget {args.max_chars} a {f} / budget hit", file=sys.stderr); break
        sys.stdout.write(block); total += len(block)
    print(f"[pack: {len(files)} file, {total} chars, ~{total//4} tok]", file=sys.stderr)
    return 0

if __name__ == "__main__": raise SystemExit(main())
