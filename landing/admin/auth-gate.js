/**
 * DMS Security Auth Gate
 * Sistema di autenticazione JWT con whitelist
 * Versione: 2.0
 */

class DMSAuthGate {
    constructor(options = {}) {
        this.whitelistUrl = options.whitelistUrl || '../viewer/whitelist.json';
        this.redirectUrl = options.redirectUrl || '../make-token.html';
        this.sessionKey = 'DMS_SESSION';
        this.jwtSecret = 'dms_security_key_2024_v1';
        this.debugMode = options.debug || false;
        
        this.log('🔐 DMS Auth Gate inizializzato');
    }
    
    log(message, data = null) {
        if (this.debugMode) {
            console.log(`[DMS Auth] ${message}`, data || '');
        }
    }
    
    // Decodifica Base64URL
    base64UrlDecode(str) {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) {
            str += '=';
        }
        return atob(str);
    }
    
    // Verifica e decodifica JWT
    verifyJWT(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Token JWT malformato');
            }
            
            const [header, payload, signature] = parts;
            
            // Decodifica header e payload
            const decodedHeader = JSON.parse(this.base64UrlDecode(header));
            const decodedPayload = JSON.parse(this.base64UrlDecode(payload));
            
            this.log('Token decodificato:', { header: decodedHeader, payload: decodedPayload });
            
            // Verifica scadenza
            const now = Math.floor(Date.now() / 1000);
            if (decodedPayload.exp && decodedPayload.exp < now) {
                throw new Error('Token scaduto');
            }
            
            return decodedPayload;
        } catch (error) {
            this.log('❌ Errore verifica JWT:', error.message);
            return null;
        }
    }
    
    // Ottiene il token dall'URL o dal localStorage
    getToken() {
        // Prima controlla i parametri URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('t');
        
        if (urlToken) {
            this.log('🔑 Token trovato nell\'URL');
            return urlToken;
        }
        
        // Poi controlla il localStorage
        const session = this.getSession();
        if (session && session.token) {
            this.log('🔑 Token trovato nella sessione');
            return session.token;
        }
        
        this.log('❌ Nessun token trovato');
        return null;
    }
    
    // Salva la sessione nel localStorage
    saveSession(tokenData) {
        const session = {
            token: this.getToken(),
            payload: tokenData,
            timestamp: Date.now(),
            exp: tokenData.exp
        };
        
        localStorage.setItem(this.sessionKey, JSON.stringify(session));
        this.log('💾 Sessione salvata:', session);
    }
    
    // Recupera la sessione dal localStorage
    getSession() {
        try {
            const sessionStr = localStorage.getItem(this.sessionKey);
            if (!sessionStr) return null;
            
            const session = JSON.parse(sessionStr);
            
            // Verifica se la sessione è scaduta
            const now = Math.floor(Date.now() / 1000);
            if (session.exp && session.exp < now) {
                this.clearSession();
                return null;
            }
            
            return session;
        } catch (error) {
            this.log('❌ Errore lettura sessione:', error.message);
            this.clearSession();
            return null;
        }
    }
    
    // Cancella la sessione
    clearSession() {
        localStorage.removeItem(this.sessionKey);
        this.log('🗑️ Sessione cancellata');
    }
    
    // Carica la whitelist dal server
    async loadWhitelist() {
        try {
            this.log('📋 Caricamento whitelist...');
            const response = await fetch(this.whitelistUrl + '?t=' + Date.now());
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const whitelist = await response.json();
            this.log('✅ Whitelist caricata:', whitelist);
            return whitelist;
        } catch (error) {
            this.log('❌ Errore caricamento whitelist:', error.message);
            return { entries: [] };
        }
    }
    
    // Verifica se il token è nella whitelist
    async checkWhitelist(tokenPayload) {
        const whitelist = await this.loadWhitelist();
        
        if (!whitelist.entries || !Array.isArray(whitelist.entries)) {
            this.log('❌ Whitelist malformata');
            return false;
        }
        
        // Cerca l'entry corrispondente
        const entry = whitelist.entries.find(e => 
            e.jti === tokenPayload.jti || 
            e.email === tokenPayload.email
        );
        
        if (!entry) {
            this.log('❌ Token non trovato in whitelist');
            return false;
        }
        
        // Verifica se l'entry è ancora valida
        const now = Math.floor(Date.now() / 1000);
        if (entry.expires && entry.expires < now) {
            this.log('❌ Entry whitelist scaduta');
            return false;
        }
        
        this.log('✅ Token autorizzato dalla whitelist:', entry);
        return true;
    }
    
    // Funzione principale di verifica accesso
    async checkAccess() {
        this.log('🔍 Verifica accesso in corso...');
        
        // 1. Ottieni il token
        const token = this.getToken();
        if (!token) {
            this.log('❌ Nessun token fornito');
            return this.denyAccess('Token mancante');
        }
        
        // 2. Verifica il JWT
        const tokenPayload = this.verifyJWT(token);
        if (!tokenPayload) {
            this.log('❌ Token non valido');
            return this.denyAccess('Token non valido');
        }
        
        // 3. Verifica la whitelist
        const isWhitelisted = await this.checkWhitelist(tokenPayload);
        if (!isWhitelisted) {
            this.log('❌ Token non autorizzato');
            return this.denyAccess('Token non autorizzato');
        }
        
        // 4. Salva la sessione
        this.saveSession(tokenPayload);
        
        // 5. Pulisci l'URL dal token
        this.cleanUrl();
        
        this.log('✅ Accesso autorizzato per:', tokenPayload.email);
        return this.grantAccess(tokenPayload);
    }
    
    // Pulisce il token dall'URL
    cleanUrl() {
        const url = new URL(window.location);
        url.searchParams.delete('t');
        window.history.replaceState({}, document.title, url.toString());
        this.log('🧹 URL pulito dal token');
    }
    
    // Concede l'accesso
    grantAccess(tokenPayload) {
        this.log('🎉 Accesso concesso');
        
        // Mostra informazioni di debug se abilitato
        if (this.debugMode) {
            this.showDebugInfo(tokenPayload);
        }
        
        return {
            success: true,
            user: tokenPayload,
            message: 'Accesso autorizzato'
        };
    }
    
    // Nega l'accesso
    denyAccess(reason) {
        this.log('🚫 Accesso negato:', reason);
        
        // Cancella eventuali sessioni esistenti
        this.clearSession();
        
        // Mostra messaggio di errore
        this.showAccessDenied(reason);
        
        // Reindirizza dopo un breve delay
        setTimeout(() => {
            window.location.href = this.redirectUrl;
        }, 3000);
        
        return {
            success: false,
            reason: reason,
            message: 'Accesso negato'
        };
    }
    
    // Mostra messaggio di accesso negato
    showAccessDenied(reason) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
        `;
        
        overlay.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h1 style="color: #ff4757; margin-bottom: 20px;">🚫 Accesso Negato</h1>
                <p style="font-size: 18px; margin-bottom: 20px;">${reason}</p>
                <p style="color: #ccc;">Reindirizzamento in corso...</p>
                <div style="margin-top: 30px;">
                    <div style="border: 2px solid #ff4757; border-radius: 50%; width: 40px; height: 40px; margin: 0 auto; border-top: 2px solid transparent; animation: spin 1s linear infinite;"></div>
                </div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        document.body.appendChild(overlay);
    }
    
    // Mostra informazioni di debug
    showDebugInfo(tokenPayload) {
        const debugPanel = document.createElement('div');
        debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #00ff00;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            max-width: 300px;
            border: 1px solid #00ff00;
        `;
        
        const expiry = new Date(tokenPayload.exp * 1000).toLocaleString('it-IT');
        
        debugPanel.innerHTML = `
            <div style="color: #00ff00; font-weight: bold; margin-bottom: 10px;">🔐 DMS Debug Info</div>
            <div><strong>Email:</strong> ${tokenPayload.email}</div>
            <div><strong>Subject:</strong> ${tokenPayload.sub}</div>
            <div><strong>JTI:</strong> ${tokenPayload.jti}</div>
            <div><strong>Scadenza:</strong> ${expiry}</div>
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #333;">
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: #ff4757; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
                    Chiudi
                </button>
            </div>
        `;
        
        document.body.appendChild(debugPanel);
    }
    
    // Metodo pubblico per ottenere informazioni sulla sessione
    getSessionInfo() {
        const session = this.getSession();
        if (!session) return null;
        
        return {
            email: session.payload.email,
            subject: session.payload.sub,
            jti: session.payload.jti,
            expires: new Date(session.exp * 1000),
            isValid: session.exp > Math.floor(Date.now() / 1000)
        };
    }
    
    // Metodo pubblico per logout
    logout() {
        this.clearSession();
        window.location.href = this.redirectUrl;
    }
}

// Oggetto globale per accesso facile
window.DMS_SESSION = {
    authGate: null,
    
    init: function(options = {}) {
        this.authGate = new DMSAuthGate(options);
        return this.authGate.checkAccess();
    },
    
    get: function() {
        return this.authGate ? this.authGate.getSessionInfo() : null;
    },
    
    logout: function() {
        if (this.authGate) {
            this.authGate.logout();
        }
    }
};

// Auto-inizializzazione se il DOM è già caricato
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        window.DMS_SESSION.init({ debug: true });
    });
} else {
    window.DMS_SESSION.init({ debug: true });
}
