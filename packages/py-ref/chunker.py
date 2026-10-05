#!/usr/bin/env python3
"""chunker — divide testo in chunk con overlap per RAG / AI locali.

IT: split semplice a caratteri, cerca di tagliare su \n o spazio.
EN: simple char-based split, prefers cutting on newline or space.

Uso / Usage:
    python chunker.py input.txt --max-chars 1000 --overlap 100
    cat clean.txt | python chunker.py --max-chars 500 > chunks.txt
    python chunker.py input.txt --out-dir ./out
"""

import argparse
import os
import sys


def chunk_text(text: str, max_chars: int = 1000, overlap: int = 100, separator: str = "\n---\n") -> list:
    text = text.strip()
    if not text or len(text) <= max_chars:
        return [text] if text else []
    if overlap >= max_chars:
        raise ValueError("overlap deve essere < max-chars / overlap must be < max-chars")

    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + max_chars, n)
        if end < n:
            # preferisci taglio su newline, poi spazio / prefer newline, then space
            cut_nl = text.rfind("\n", start, end)
            cut_sp = text.rfind(" ", start, end)
            cut = cut_nl if cut_nl > start + max_chars // 3 else (-1)
            if cut == -1 and cut_sp > start + max_chars // 3:
                cut = cut_sp
            if cut != -1:
                end = cut
        chunks.append(text[start:end].strip())
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return [c for c in chunks if c]


def main() -> int:
    p = argparse.ArgumentParser(description="Chunker per RAG / Chunker for RAG (IT/EN).")
    p.add_argument("input", nargs="?", help="File input (default: stdin)")
    p.add_argument("--max-chars", type=int, default=1000)
    p.add_argument("--overlap", type=int, default=100)
    p.add_argument("--separator", default="\n---\n", help="Separatore stdout")
    p.add_argument("--out-dir", help="Se dato, scrive chunk_001.txt... / writes chunk files")
    args = p.parse_args()

    if args.input:
        with open(args.input, encoding="utf-8") as f:
            raw = f.read()
    else:
        if sys.stdin.isatty():
            p.print_help()
            return 1
        raw = sys.stdin.read()

    try:
        chunks = chunk_text(raw, args.max_chars, args.overlap, args.separator)
    except ValueError as e:
        print(f"Errore / Error: {e}", file=sys.stderr)
        return 2

    if args.out_dir:
        os.makedirs(args.out_dir, exist_ok=True)
        for i, c in enumerate(chunks, 1):
            with open(os.path.join(args.out_dir, f"chunk_{i:03d}.txt"), "w", encoding="utf-8") as f:
                f.write(c + "\n")
        print(f"{len(chunks)} chunk scritti in {args.out_dir} / written", file=sys.stderr)
    else:
        sys.stdout.write(args.separator.join(chunks) + ("\n" if chunks else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
