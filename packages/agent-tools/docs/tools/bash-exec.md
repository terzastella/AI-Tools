# bash_exec

Esegue un binario **senza shell** (`execFile`): `cmd` singolo + `args[]`, workdir dentro cwd, timeout 5..120s, output troncato a 20k. Niente `; & |` (rifiutati), comandi pericolosi bloccati anche con accept. Serve sempre accept umano. Per processi lunghi usa `shell_session`.
