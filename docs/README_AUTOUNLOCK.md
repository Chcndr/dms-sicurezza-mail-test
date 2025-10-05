# DMS – Auto Unlock alla risposta (tutto in GitHub)

## Requisiti
- Secrets: IMAP_HOST, IMAP_PORT=993, IMAP_USER, IMAP_PASS
- Actions: Settings → Actions → Workflow permissions → Read and write
- Pages: branch gh-pages (o cambia `ref:` nel workflow)
- Label: `pending-reply` (o `grant-access`)

## Flusso
1) Il pannello crea una **Issue** con label `pending-reply` (corpo JSON tra <!--DMS:START--> e <!--DMS:END--> con: sub, jti, exp, scope).
2) L’email inviata ha subject contenente **[jti=XYZ]** e Reply-To la casella IMAP.
3) Il workflow `DMS – Auto Unlock on Email Reply` (cron) legge la casella:
   - Matchea `From`/`jti` con l’Issue aperta
   - Scrive/aggiorna `landing/viewer/whitelist.json` su `gh-pages` (exp ≥ now+60')
   - Commenta, mette label `granted`, chiude l’Issue
4) `unlock.html` legge `whitelist.json` e sblocca su qualunque dispositivo.

## Dove incollare i file
- `.github/workflows/poll_replies.yml`
- `.github/scripts/poll_replies.py`

## Consigli
- Nel subject metti sempre `[jti=... ]`
- Se il provider sposta le risposte in cartelle diverse, modifica `IMAP_FOLDER_INBOX`
