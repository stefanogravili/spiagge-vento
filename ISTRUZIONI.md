# Mare Calmo Puglia — Istruzioni complete

Sistema autonomo che ogni sera calcola le condizioni del mare del giorno dopo,
disegna le grafiche e le pubblica su Instagram (`@marecalmo.puglia`), senza
intervento manuale.

---

## 1. Cosa pubblica, ogni giorno

Alle **18:00** (ora italiana) il sistema pubblica in automatico:

- **6 Storie** — una per zona/provincia (Foggia, Bari, Brindisi, Taranto,
  Lecce Adriatica, Lecce Ionica), con ogni spiaggia segnata da un bollino
  🟢 calmo · 🟡 mosso · 🔴 molto mosso.
- **1 Post nel feed** — "Meteo Puglia": temperatura, vento e il riepilogo del
  mare provincia per provincia.

Tutto riferito al **giorno dopo**.

---

## 2. Come funziona (il flusso)

```
 GitHub Actions (ore 18:00)
        │
        ▼
 genera-giornaliero.js ──▶ scarica meteo → calcola mare → disegna 7 immagini in media/
        │
        ▼
 git commit + push       ──▶ le immagini diventano raggiungibili via URL pubblico
        │
        ▼
 pubblica-giornaliero.js ──▶ pubblica su Instagram (6 storie + 1 post) → rinnova il token
        │
        ▼
 gh secret set           ──▶ salva il token rinnovato (la pagina non scade mai)
```

L'API di Instagram non accetta file caricati direttamente: pretende un **URL
pubblico**. Per questo le immagini vengono prima committate nel repo (che è
pubblico) e poi pubblicate dal loro indirizzo `raw.githubusercontent.com`.

---

## 3. Gli agenti (un modulo per funzione)

| Agente | File | Funzione |
|---|---|---|
| **Dati meteo** | `src/weather.js` | Scarica vento, raffiche, onde e temperatura da Open-Meteo (modelli ECMWF/ICON + onda MFWAM). Sa prendere oggi o il giorno dopo. |
| **Stato del mare** | `src/score.js` | Da vento e onda calcola l'onda efficace e lo stato del mare (scala Douglas): calmo / mosso / molto mosso. |
| **Geografia** | `src/province.js` | Assegna ogni spiaggia alla sua provincia. |
| **Tavola provincia** | `scripts/cartone.js` | Disegna la storia cartoon di una zona (mappa reale + bollini agganciati alla costa). |
| **Post meteo** | `scripts/meteo-post.js` | Disegna il post feed col meteo e il riepilogo province. |
| **Presentazione** | `scripts/presentazione.js` | Disegna il post/storia di presentazione della pagina. |
| **Orchestratore** | `scripts/genera-giornaliero.js` | Genera tutte le immagini del giorno dopo e scrive `out/manifest.json`. |
| **Pubblicatore** | `scripts/pubblica-giornaliero.js` | Pubblica quanto elencato nel manifest e rinnova il token. |
| **Automa** | `.github/workflows/giornaliero.yml` | Fa partire tutto alle 18:00. |

Dati e risorse: `data/puglia.json` (le spiagge con coordinate ed esposizione),
`data/coste.json` (i contorni reali della costa), `assets/font/` (i font
incorporati).

---

## 4. Comandi utili (prova in locale)

```bash
npm install                              # una volta

node scripts/genera-giornaliero.js       # genera le immagini in media/ (non pubblica)
node scripts/cartone.js Brindisi         # prova una singola provincia
node scripts/presentazione.js            # rigenera la presentazione

# rigenerare i dati di base (raramente):
npm run coste                            # ricava i contorni della costa
npm run font                             # riscarica i font
```

Per pubblicare a mano servono le variabili d'ambiente `IG_TOKEN` e `IG_USER_ID`.

---

## 5. Configurazione e secret (GitHub)

Nei **Settings → Secrets → Actions** del repo devono esserci:

| Secret | Cos'è |
|---|---|
| `IG_USER_ID_PUGLIA` | ID dell'account Instagram (`17841444568256419`) |
| `IG_TOKEN_PUGLIA` | Token di accesso Instagram (si rinnova da solo) |
| `GH_PAT` | Token GitHub che permette di riscrivere `IG_TOKEN_PUGLIA` |

La prima configurazione (creazione app Meta, token) è descritta in
[AVVIO.md](AVVIO.md). Una volta fatta, non va più toccata.

---

## 6. Sicurezza — rigenerare il token

Se il token è stato esposto (per esempio incollato in una chat), va rigenerato:

1. developers.facebook.com → app → **Instagram → Genera token** → **Aggiungi
   account** → si copia il nuovo token (inizia con `IGAA`).
2. Aggiornarlo nel secret:
   ```bash
   gh secret set IG_TOKEN_PUGLIA --body "IGAA...nuovo..."
   ```

Il token vecchio si può revocare da Instagram → Impostazioni → App e siti web.

---

## 7. Aggiungere contenuti (roadmap)

| Binario | Stato | Come |
|---|---|---|
| Storie mare per provincia | ✅ attivo | 100% automatico |
| Post meteo Puglia | ✅ attivo | 100% automatico |
| Approfondimenti natura & meteo | 🔜 | libreria di post pronti, pubblicati a rotazione |
| Fatti pugliesi + lettura meteo | 🔜 | RSS delle testate → l'AI (Claude) scrive un post **originale** (non copia) collegando l'evento al meteo → **bozza inviata per l'ok**, poi si pubblica. Richiede una chiave API di Claude. |

Il binario "notizie" è legalmente pulito perché non ricopia: legge il fatto e
produce un'analisi originale, citando la fonte. Si consiglia sempre un passaggio
di revisione umana prima della pubblicazione.

---

## 8. Cosa resta manuale (poco)

- Cambiare la foto profilo o la bio.
- Rispondere ai messaggi/commenti.
- Approvare i post del binario "notizie" (quando sarà attivo).

Tutto il resto — calcolo, grafica, pubblicazione, rinnovo del token — è automatico.

---

## 9. Se qualcosa non va

- **Un giorno non ha pubblicato** → GitHub → Actions → "Pubblicazione giornaliera":
  apri l'ultima esecuzione e guarda quale passo è rosso.
- **Errore "immagine non raggiungibile"** → il push delle immagini non è andato;
  ricontrolla i permessi del workflow (`contents: write`).
- **Errore di pubblicazione Instagram** → di solito è il token scaduto o
  revocato: rigeneralo (sezione 6).
- **Vuoi rilanciare a mano** → Actions → "Pubblicazione giornaliera" → Run workflow.

La vecchia automazione "carta del vento" (`post-giornaliero.yml`) è disattivata:
resta solo per lo storico, non pubblica più da sola.
