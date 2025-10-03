# 🔐 DMS Security Mail Test

Sistema di sicurezza email con autenticazione JWT e whitelist per test e validazione.

## 📁 Struttura del Progetto

```
dms-sicurezza-mail-test/
├── landing/
│   └── admin/
│       ├── make-token.html          # Generatore token JWT
│       ├── auth-gate.js             # Script di protezione
│       └── viewer/
│           ├── index.html           # Pagina protetta
│           └── whitelist.json       # Whitelist utenti autorizzati
├── .github/workflows/
│   ├── send_access_email.yml        # Workflow invio email
│   └── poll_replies.yml             # Workflow polling risposte
└── README.md
```

## 🚀 Come Funziona

### 1. Generazione Token
- Apri `landing/admin/make-token.html`
- Inserisci email destinatario e parametri
- Genera token JWT e link di accesso

### 2. Invio Email
- Usa il workflow `send_access_email.yml`
- Invia email con link di accesso al destinatario
- Include istruzioni per l'attivazione

### 3. Attivazione Accesso
- L'utente riceve l'email e clicca sul link
- **Deve rispondere all'email** per attivare l'accesso
- Il workflow `poll_replies.yml` monitora le risposte

### 4. Accesso Protetto
- Una volta attivato, l'utente può accedere a `landing/admin/viewer/`
- Il sistema verifica token JWT + whitelist
- Sessione limitata nel tempo

## ⚙️ Configurazione

### Secrets GitHub da Configurare

Vai in **Settings → Secrets and variables → Actions** e aggiungi:

#### SMTP (Invio Email)
- `SMTP_HOST` - Server SMTP (es. `smtp.gmail.com`)
- `SMTP_PORT` - Porta SMTP (es. `587`)
- `SMTP_USER` - Username email
- `SMTP_PASS` - Password email
- `SMTP_FROM` - Email mittente

#### IMAP (Ricezione Risposte)
- `IMAP_HOST` - Server IMAP (es. `imap.gmail.com`)
- `IMAP_USER` - Username email (stesso di SMTP)
- `IMAP_PASS` - Password email (stesso di SMTP)

### Abilitazione GitHub Pages

1. Vai in **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / **root**
4. Salva

## 🧪 Come Testare

### 1. Genera Token
```
https://[username].github.io/dms-sicurezza-mail-test/landing/admin/make-token.html
```

### 2. Invia Email
- Vai in **Actions → Send Access Email**
- Clicca **Run workflow**
- Inserisci email e link generato

### 3. Simula Risposta Utente
- Controlla la casella email configurata
- Rispondi all'email di accesso con qualsiasi messaggio

### 4. Verifica Accesso
- Il workflow `poll_replies.yml` aggiornerà automaticamente la whitelist
- L'utente potrà accedere alla pagina protetta

### 5. Accedi all'Area Protetta
```
https://[username].github.io/dms-sicurezza-mail-test/landing/admin/viewer/?t=TOKEN
```

## 🔧 Debug e Monitoraggio

### Console Browser (F12)
```javascript
// Verifica sessione corrente
DMS_SESSION.get()

// Informazioni debug
console.log(window.DMS_SESSION)
```

### Logs GitHub Actions
- Vai in **Actions** per vedere i log dei workflow
- Controlla `send_access_email.yml` per l'invio
- Controlla `poll_replies.yml` per il polling

### Whitelist
- File: `landing/admin/viewer/whitelist.json`
- Aggiornato automaticamente dai workflow
- Contiene utenti autorizzati con scadenze

## 📧 Esempio Configurazione Email

### Gmail
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tuo-email@gmail.com
SMTP_PASS=password-app-specifica
SMTP_FROM=tuo-email@gmail.com

IMAP_HOST=imap.gmail.com
IMAP_USER=tuo-email@gmail.com
IMAP_PASS=password-app-specifica
```

### Outlook/Hotmail
```
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=tuo-email@outlook.com
SMTP_PASS=password
SMTP_FROM=tuo-email@outlook.com

IMAP_HOST=outlook.office365.com
IMAP_USER=tuo-email@outlook.com
IMAP_PASS=password
```

## 🔒 Sicurezza

- **Token JWT**: Firmati con chiave segreta
- **Scadenza**: Configurabile (1-24 ore)
- **Whitelist**: Controllo in tempo reale
- **Email Verification**: Richiesta risposta per attivazione
- **Session Management**: Gestione automatica scadenze

## 🚨 Limitazioni

- **GitHub Pages**: Solo contenuto statico
- **Polling**: Ogni 5 minuti (limite GitHub Actions)
- **Email**: Dipende dalla configurazione SMTP/IMAP
- **JWT**: Chiave hardcoded (per test)

## 📝 Note per Produzione

Per un ambiente di produzione, considera:

1. **Chiave JWT dinamica** e sicura
2. **Database** invece di file JSON
3. **Server dedicato** per real-time processing
4. **Rate limiting** e protezioni aggiuntive
5. **Logging** e monitoraggio avanzato

## 🆘 Troubleshooting

### Email non inviate
- Verifica secrets SMTP
- Controlla logs in Actions
- Testa credenziali email manualmente

### Risposte non processate
- Verifica secrets IMAP
- Controlla formato oggetto email
- Verifica timing del polling (5 min)

### Accesso negato
- Controlla whitelist.json
- Verifica scadenza token
- Controlla console browser (F12)

### Whitelist non aggiornata
- Verifica permessi GitHub Actions
- Controlla commit automatici
- Verifica formato email di risposta
