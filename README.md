# spiagge-vento

Ogni mattina calcola, per una regione, quali spiagge avranno il mare piu' calmo
in base al vento del giorno, e pubblica il risultato su Instagram.

Nessun intervento manuale: gira su GitHub Actions, i dati sono gratuiti e senza
chiave, il token Instagram si rinnova da solo.

## L'idea

Il vento che arriva **da terra** spiana il mare. Il vento che arriva **dal mare**
alza le onde. Con lo stesso identico Maestrale, la costa adriatica pugliese e
quella ionica danno mari opposti.

Per saperlo serve un dato che nessuna app meteo mostra: l'**orientamento della
costa**. In `data/<regione>.json` ogni spiaggia ha un campo `facing` — la
direzione, in gradi, verso cui guardi stando sulla battigia. Confrontandolo con
la direzione del vento si ottiene se la spiaggia e' sottovento o esposta.

## Come funziona

```
data/puglia.json      73 spiagge con coordinate e orientamento costa
data/coste.json       contorni geografici reali, semplificati
      |
      v
src/weather.js        Open-Meteo: vento, raffiche, onde (1 sola richiesta)
      |
      v
src/score.js          punteggio 0-100, con diversificazione per zona costiera
      |
      v
src/render.js         Chromium headless -> JPG 1080x1350 (post) e 1080x1920 (storia)
src/caption.js        didascalia con verdetto, dettaglio e hashtag
      |
      v
src/publish-cli.js    Instagram Graph API + rinnovo automatico del token
```

Il punteggio penalizza tre cose: la componente di vento che entra dal mare,
l'altezza dell'onda prevista e le raffiche sopra i 18 nodi. La fascia oraria
valutata e' 10:00-18:00.

## Il progetto grafico

Il post e' una **carta del vento**: un bollettino stampato, non una schermata.

- La costa e' geometria reale, estratta dai confini amministrativi ufficiali e
  semplificata con Douglas-Peucker (`npm run coste`).
- Le spiagge sono puntate alle loro coordinate vere. Quando due segnaposti si
  sovrappongono vengono allontanati con una linea di richiamo verso il punto
  esatto, come sulle carte stampate.
- Il vento e' disegnato con la **barbetta meteorologica**: asta verso la
  provenienza, una barba intera ogni 10 nodi, mezza barba ogni 5.
- Tinte piatte, filetti, reticolato ai gradi interi, grana di stampa. Nessun
  gradiente, nessuna ombra, nessun angolo arrotondato.
- Anton per le testate, IBM Plex Mono per ogni annotazione. I woff2 sono
  versionati in `assets/font/` e incorporati come data URI (`npm run font`):
  se dipendessero dalla rete, un ritardo produrrebbe un post col carattere
  sbagliato.

La riga "costa verso E" accanto alla direzione del vento e' deliberata: fa
capire al lettore il criterio, invece di limitarsi a comunicargli l'esito.

La classifica ammette al massimo 2 spiagge per zona costiera: senza questo
vincolo una giornata di Maestrale riempirebbe le prime cinque posizioni con
spiagge dello stesso tratto di costa, rendendo il post inutile per chi sta altrove.

## Uso locale

```bash
npm install
npm run preview     # genera immagine e didascalia in out/, senza pubblicare
```

Per un'altra regione: `node src/index.js --regione=sicilia --mostra-caption`

## Configurazione

Vedi [SETUP.md](SETUP.md). E' l'unica parte manuale, e si fa una volta sola.

## Fonte dati

[Open-Meteo](https://open-meteo.com) — modello ICON/GFS per il vento, modello
MFWAM per il moto ondoso. Gratuito, senza API key, senza limiti pratici per
questo volume di richieste.
