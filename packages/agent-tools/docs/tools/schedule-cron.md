# schedule_cron

Promemoria schedulati in `.agent/schedule` con sintassi cron 5 campi: `add/list/remove/due`. L'agente controlla `due` a ogni giro; niente esecuzione automatica (l'azione la fai tu o un tool gated). Dominio `schedule` dedicato in policy.
