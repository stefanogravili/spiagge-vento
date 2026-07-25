# Avvio — da profilo creato al primo post automatico

Guida unica, in ordine. Ogni riga di comando va lanciata nel terminale
(PowerShell) dentro la cartella del progetto. Per aprirlo li': tasto destro
sulla cartella `spiagge-vento` -> "Apri nel terminale".

Tempo totale: circa 45 minuti. Dopo, la pagina posta da sola ogni mattina.

Legenda: ✅ gia' fatto · ⬜ da fare

---

## Fase 0 — Profilo Instagram  ✅

- ✅ Account `marecalmo.puglia` creato
- ✅ Tipo di account: **Aziendale**
- ⬜ Carica l'avatar `out/avatar/marecalmo-avatar.png` (senza ritagliarlo)
- ⬜ Incolla la bio:

  ```
  Ogni mattina le spiagge col mare più calmo in Puglia 🌊
  Calcolata sul vento del giorno, non a caso.
  Nuovo bollettino alle 7:00 → salva il post
  ```

- ⬜ Nome visualizzato: **Mare Calmo Puglia** (con le maiuscole: e' quello che
  Instagram usa nella ricerca)

---

## Fase 1 — Pagina Facebook  ⬜

Serve solo come ponte: Meta autorizza la pubblicazione su Instagram passando
da una Pagina. Non la userai mai.

1. Dal tuo Facebook personale vai su **facebook.com/pages/create**
2. Nome Pagina: `Mare Calmo Puglia`
3. Categoria: `Servizio meteorologico` (o `Sito web di notizie e media`)
4. Crea. Salta foto, descrizione e inviti.

**Collega Instagram alla Pagina** (dal lato Facebook, e' piu' affidabile):

5. Apri la Pagina -> Impostazioni -> cerca **Instagram** -> **Collega account**
6. Accedi con `marecalmo.puglia` e conferma

**Verifica:** vai su **business.facebook.com**. Devi vedere sia la Pagina sia
l'account Instagram. Se ci sono entrambi, il ponte e' pronto.

---

## Fase 2 — App Meta  ⬜

E' la fase piu' noiosa, ma e' l'ultima con dei clic.

1. **developers.facebook.com/apps** -> **Crea un'app** -> tipo **Azienda**
2. Nel pannello dell'app aggiungi il prodotto **Instagram Graph API**
3. Vai su **developers.facebook.com/tools/explorer**
4. In alto a destra seleziona la tua app
5. Clicca **Aggiungi autorizzazioni** e spunta questi cinque:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`
6. Clicca **Genera token di accesso** e accetta le richieste
7. **Copia il token** (una stringa lunga che inizia per `EAA...`)

> Non serve la revisione di Meta. L'app resta in modalita' sviluppo e puo'
> pubblicare sui tuoi account perche' ne sei amministratore.

Servono anche due valori dell'app: da **developers.facebook.com/apps** ->
la tua app -> **Impostazioni -> Di base** trovi **ID app** e **Chiave segreta**
(clicca "Mostra").

---

## Fase 3 — Ricava i due valori  ⬜  (fa tutto lo script)

Nel terminale, dentro la cartella del progetto, incolla (sostituendo i valori):

```powershell
$env:APP_ID="qui-l-ID-app"
$env:APP_SECRET="qui-la-chiave-segreta"
$env:TOKEN_BREVE="qui-il-token-EAA..."
node scripts/configura.js
```

Lo script scambia il token con uno da 60 giorni, trova l'ID del tuo account
Instagram e ti stampa due comandi gia' pronti, tipo:

```
gh secret set IG_USER_ID_PUGLIA --body "17841400000000000"
gh secret set IG_TOKEN_PUGLIA --body "EAA..."
```

**Tienili da parte**, servono alla Fase 5. Se qualcosa non va, lo script dice
cosa manca.

---

## Fase 4 — Repository su GitHub  ⬜

Il repo dev'essere **pubblico**: le immagini vengono servite da GitHub e
Instagram deve poterle scaricare. (Il codice non contiene password: i token
stanno nei secret, non nel codice.)

```powershell
gh repo create spiagge-vento --public --source=. --push
```

---

## Fase 5 — I tre secret  ⬜

I primi due sono i comandi stampati dallo script alla Fase 3. Incollali:

```powershell
gh secret set IG_USER_ID_PUGLIA --body "..."
gh secret set IG_TOKEN_PUGLIA --body "..."
```

Il terzo, `GH_PAT`, permette al workflow di riscrivere il token rinnovato ogni
giorno (e' cio' che rende la pagina davvero autonoma):

1. Vai su **github.com/settings/tokens?type=beta** -> **Generate new token**
2. Repository access -> **Only select repositories** -> scegli `spiagge-vento`
3. Permissions -> Repository permissions -> **Secrets** -> **Read and write**
4. Scadenza: **No expiration**
5. Genera, copia il token e salvalo:

```powershell
gh secret set GH_PAT --body "github_pat_..."
```

Verifica che ci siano tutti e tre:

```powershell
gh secret list
```

---

## Fase 6 — Prova subito  ⬜

Non aspettare domani: lancia una prova manuale.

```powershell
gh workflow run "Post giornaliero"
```

Poi guarda come va:

```powershell
gh run watch
```

Se compare il post (e la storia) su `marecalmo.puglia`, **hai finito**.

Da domani parte da solo alle **07:00**, ogni giorno, senza che tu faccia nulla.

---

## Se qualcosa non va

- **Lo script di configurazione dice "Nessuna Pagina trovata"** → torna alla
  Fase 1: l'account Instagram non e' collegato alla Pagina Facebook.
- **"Nessun account Instagram aziendale"** → l'account non e' di tipo Aziendale
  (Fase 0), oppure il collegamento con la Pagina non e' completo.
- **Il workflow fallisce sul passo "Pubblica su Instagram"** → di solito e' un
  permesso mancante alla Fase 2. Rigenera il token con tutti e cinque i
  permessi spuntati e rifai la Fase 3.
- **Qualsiasi altro errore** → aprilo con `gh run view --log-failed` e incolla
  il messaggio: gli errori di Meta sono criptici ma si decifrano.
