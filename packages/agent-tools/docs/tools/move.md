# move — `move_file` v1.0 (traslocare senza perdere scatole)

Sposta/copia/cancella file e cartelle dentro `cwd`.

- `move`: `from + to`, `copy`: duplica, `delete`: solo `from`.
- Blocca `../escape`, rifiuta `overwrite` senza flag, crea cartelle con `mkdirs`.
