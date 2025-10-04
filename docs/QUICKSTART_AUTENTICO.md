# QUICKSTART – Invio email autentico senza cambiare il pannello

## Cosa fai
1) Copia **.github/workflows/** nel repo di test
2) Aggiungi i secrets SMTP: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
3) Crea la **label** `dispatch-email` (Issues → Labels)
4) Metti `landing/admin/dms-issue-dispatch.js` accanto al tuo pannello (non cambiare il design)
5) (Facolt.) usa `landing/admin/prova-invio.html` per test

## Come lo usi nel pannello esistente (senza cambiare HTML)
Nel tuo JS, dove già generi `tokenLink`, chiama:
```js
openDispatchIssue('destinatario@example.com', tokenLink, 'DMS – Accesso', 'smtps');
```
Si apre GitHub con l'Issue già compilata → clic su **Submit new issue** → parte il workflow e invia la mail.

## Perché così funziona sempre
- Nessun PAT nel browser
- Niente CORS
- SMTP via Actions con i secrets del repo
