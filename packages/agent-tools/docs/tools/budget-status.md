# budget_status

Contatore token globale: ogni tool avvolto accumula stima args+result in `.agent/budget.jsonl`.
`status` mostra usati/chiamate/tetto, `reset` azzera (con accept). Il tetto si imposta con `ctx.budgetLimit`: oltre scatta `BUDGET_EXCEEDED` prima di eseguire. Stima euristica chars/4.
