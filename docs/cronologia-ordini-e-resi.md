# Cronologia ordini e resi — progetto

> **Nota sul posizionamento.** Questo documento non riguarda `spiagge-vento`: riguarda il
> progetto "Brain" che legge le scansioni dalle cartelle del server Windows. E' parcheggiato
> qui, sul branch `claude/order-returns-history-4r4vay` e mai su `main`, solo perche' e' l'unico
> repository raggiungibile dalla sessione in cui e' stato scritto. Va spostato nel repo del Brain
> appena si lavora da li'.

---

## 0. Il problema in una riga

Oggi le scansioni dicono *cosa e' arrivato*. Non dicono *cosa manca*. Serve un registro che
tenga insieme **cio' che abbiamo confermato** e **cio' che e' stato scaricato**, e che faccia
emergere da solo la differenza.

Due cantieri distinti, con lo stesso schema mentale (documento -> riga -> stato):

- **A. Ordini** — conferma d'ordine contro scarichi (DDT), totali o parziali.
- **B. Resi** — richiesta inviata, autorizzazione, reso effettivamente partito. Qui manca la
  scansione dell'ultimo passaggio: e' il nodo da sciogliere, sezione B.3.

---

## A. Cronologia ordini

### A.1 Le due fonti

| Fonte | Cartella (proposta) | Dice |
|---|---|---|
| Conferma d'ordine fornitore | `.../Ordini/Conferme/<anno>/<fornitore>/` | cosa abbiamo impegnato, a che prezzo, per quando |
| DDT in ingresso | `.../Ordini/DDT/<anno>/<fornitore>/` | cosa e' effettivamente entrato |

Convenzione nome file, unica per tutto:

```
AAAA-MM-GG_FORNITORE_TIPO_NUMERO.pdf
2026-03-14_ROSSI-SPA_CONF_A1234.pdf
2026-04-02_ROSSI-SPA_DDT_5567.pdf
```

Il nome del file non e' burocrazia: e' l'unica cosa leggibile con certezza al 100% senza OCR.
Data, fornitore, tipo e numero cosi' sono gia' acquisiti prima ancora di aprire il PDF, e l'OCR
serve solo per le righe.

### A.2 Cosa estrarre da ogni documento

Dalla **conferma**: fornitore, numero, data, data consegna prevista, e per ogni riga
codice articolo, descrizione, quantita', prezzo unitario.

Dal **DDT**: fornitore, numero, data, riferimento ordine (se stampato), e per ogni riga
codice articolo, descrizione, quantita'.

Ogni estrazione porta con se' un livello di confidenza. Righe sotto soglia non vengono
scartate: finiscono in una coda `da-verificare`, che e' un report a parte. Un dato inventato
dall'OCR e' peggio di un dato mancante, perche' non lo cerchi piu'.

### A.3 Abbinamento conferma <-> scarico

In ordine di affidabilita':

1. **Riferimento ordine stampato sul DDT.** Quando c'e', e' la verita'. Fine.
2. **Fornitore + codice articolo**, consumando gli ordini aperti dal piu' vecchio (FIFO)
   e mai oltre il residuo della riga.
3. **Fornitore + descrizione simile**, solo come proposta da confermare a mano. Mai
   applicato in automatico.

Ogni abbinamento resta tracciato: quale DDT ha chiuso quale riga, e con che metodo dei tre.
Quando un mese dopo i conti non tornano, questa e' l'unica cosa che permette di capire perche'.

### A.4 Stati

Per **riga d'ordine**, dal confronto fra quantita' ordinata e somma delle quantita' scaricate:

| Stato | Condizione |
|---|---|
| `ATTESA` | nessuno scarico |
| `PARZIALE` | scaricato > 0 e < ordinato |
| `COMPLETO` | scaricato = ordinato |
| `ECCEDENZA` | scaricato > ordinato |
| `CHIUSO` | chiusura manuale (residuo non arrivera' mai) |

Per **ordine**: `ATTESA` se nessuna riga e' partita, `COMPLETO` se tutte le righe sono
complete o chiuse, altrimenti `PARZIALE`.

### A.5 Il registro

Un file di stato rigenerabile — `stato-ordini.json` piu' un `stato-ordini.csv` per aprirlo in
Excel — con una riga per riga d'ordine: fornitore, numero conferma, data, codice, descrizione,
qta ordinata, qta ricevuta, residuo, stato, elenco dei DDT che l'hanno alimentata, data ultimo
scarico, giorni di ritardo sulla consegna prevista.

Due accorgimenti che valgono piu' di tutto il resto:

- **Idempotenza.** Un indice `visti.json` con l'impronta (hash) di ogni file gia' letto. Rilanciare
  l'analisi due volte non deve mai raddoppiare uno scarico.
- **Correzioni umane sopra l'automatismo.** Un `chiusure-manuali.csv` (ordine, riga, motivo,
  data) che il programma legge e rispetta sempre. Serve per i casi reali: il fornitore non
  consegnera' mai il residuo, la riga e' stata annullata, l'articolo e' stato sostituito.
  Senza questa valvola il registro si riempie di residui fantasma e in tre mesi nessuno lo guarda piu'.

### A.6 Il report — cosa deve saltare all'occhio

1. **In attesa** — confermati, niente arrivato. Ordinati per giorni trascorsi.
2. **In ritardo** — data di consegna prevista superata. E' il primo elenco da leggere ogni mattina.
3. **Parziali** — con il residuo esatto per articolo.
4. **Anomalie**, che sono la vera ragione di tutto il lavoro:
   - scaricato piu' di quanto ordinato;
   - prezzo sul DDT diverso da quello confermato;
   - DDT che non si aggancia a nessun ordine (merce mai confermata);
   - conferma senza alcuno scarico oltre N giorni (soglia per fornitore);
   - stesso DDT scansionato due volte.
5. **Da verificare** — le righe con OCR incerto.

---

## B. Resi

### B.1 Le tre tappe

1. **Richiesta inviata** al fornitore.
2. **Autorizzazione** ricevuta (numero RMA / benestare al reso).
3. **Reso effettuato** — la merce e' materialmente ripartita.

Un quarto stato, che conviene tenere separato perche' arriva molto dopo:

4. **Accreditato** — nota di credito ricevuta. E' l'unico che chiude davvero la partita dal lato
   soldi. Un reso partito e mai accreditato e' esattamente il tipo di perdita che oggi non si vede.

### B.2 Perche' le tappe 1 e 2 sono gia' risolte

Sono documenti che arrivano o partono via mail o su carta: la richiesta l'abbiamo mandata noi
(la mail e' la prova), l'autorizzazione ce l'ha mandata il fornitore (mail o PDF). Basta salvarli
nella cartella del reso con lo stesso schema di nome:

```
.../Resi/<anno>/<fornitore>/RESO_<numero>/
    2026-03-10_ROSSI-SPA_RICHIESTA_R-0031.pdf
    2026-03-12_ROSSI-SPA_AUTORIZZAZIONE_RMA-8890.pdf
```

### B.3 Il nodo: come faccio a sapere che il reso e' stato effettuato

Non serve una scansione. Serve **una traccia qualsiasi che nasce da sola quando la merce parte**.
Cinque possibilita', dalla piu' solida alla piu' fragile.

**1 — Il DDT di reso in uscita (la migliore).**
Quando la merce riparte, qualcuno emette un DDT con causale "reso a fornitore". Quel documento
esiste gia' nel gestionale, con data e righe. Se il gestionale lo esporta (PDF, stampa su file,
o meglio ancora una query sulla tabella dei documenti in uscita), la prova e' automatica e
completa: non solo *che* il reso e' partito, ma *cosa* e' partito, riga per riga.
E' l'unica opzione che permette di confrontare quantita' autorizzata e quantita' resa.

**2 — La spedizione del corriere.**
Lettera di vettura, borderò, o semplicemente la mail di conferma ritiro con il numero di
tracking. Salvata nella cartella del reso, da' data certa e destinatario. Non dice cosa c'era
dentro, ma dice che e' partito. Ottima come conferma della 1, insufficiente da sola.

**3 — Il ritiro fatto dal fornitore.**
Se ritira lui, resta la sua bolla di ritiro firmata. E' carta, quindi torna una scansione — ma una
sola, e semplice.

**4 — La nota di credito.**
Prova incontestabile ma tardiva: arriva settimane dopo. Non serve a sapere se il reso e' partito,
serve a chiudere il ciclo. Va usata per lo stato 4, non per il 3.

**5 — Le cartelle come stato (il minimo indispensabile, da fare comunque).**
Dentro `Resi/<anno>/` quattro cartelle:

```
1-RICHIESTI/     2-AUTORIZZATI/     3-SPEDITI/     4-ACCREDITATI/
```

La cartella del singolo reso si sposta di cartella man mano che avanza. Chi spedisce la merce
trascina la cartella in `3-SPEDITI`: due secondi, nessuno strumento nuovo da imparare, e lo stato
diventa leggibile dal percorso del file senza aprire niente. Aggiungere dentro la cartella un
`spedito.txt` con data e corriere costa altri dieci secondi e rende la cosa verificabile.

**La raccomandazione.** Partire dalla 5 subito, perche' funziona da domani mattina e non
dipende da nessuno sviluppo. In parallelo verificare la 1: se il gestionale sa esportare i DDT
di reso, la 5 diventa un doppio controllo e non il meccanismo principale. La 2 si aggiunge da
sola, e' solo questione di salvare la mail del corriere nella cartella giusta.

Regola generale, valida oltre questo caso: **quando manca un documento, il posto dove cercarlo
non e' lo scanner, e' il punto in cui quel fatto e' gia' registrato per un altro motivo** — il
gestionale, il corriere, la contabilita'. Lo scanner e' l'ultima risorsa, non la prima.

### B.4 Registro e report resi

Un `stato-resi.csv` con: fornitore, numero reso, numero RMA, data richiesta, data autorizzazione,
data spedizione, data nota di credito, importo, stato, giorni fermi nello stato attuale.

Il report evidenzia:

- richieste inviate **senza risposta** da oltre N giorni;
- **autorizzati non spediti** — merce ferma in magazzino con un'autorizzazione che spesso scade;
- **spediti non accreditati** oltre N giorni — soldi da recuperare;
- **discordanze** fra quantita' autorizzata e quantita' resa (solo con l'opzione 1);
- resi **senza autorizzazione**, cioe' partiti prima del benestare.

---

## C. Ordine di realizzazione

1. **Convenzione nomi e cartelle**, ordini e resi. Nessun codice. E' il prerequisito di tutto:
   se questa parte non regge, ogni automatismo costruito sopra e' rumore.
2. **Estrazione + registro ordini**, in sola lettura, senza toccare i file esistenti.
3. **Report ordini**: attesa, ritardi, parziali, anomalie.
4. **Cartelle-stato per i resi** (opzione B.3.5) e registro resi.
5. **Verifica dell'export DDT di reso dal gestionale** e, se possibile, aggancio automatico.
6. **Nota di credito** e chiusura del ciclo economico.

Ogni fase e' utile da sola: se ci si ferma alla 3, si e' comunque risolta la meta' del problema.

---

## D. Domande aperte

1. Qual e' il percorso reale delle cartelle sul server, oggi, per conferme, DDT e resi?
2. Le conferme d'ordine sono scansioni o PDF nativi ricevuti via mail? (Cambia tutto: un PDF
   nativo si legge senza OCR ed e' affidabile al 100%.)
3. Il DDT del fornitore riporta il numero del nostro ordine?
4. Che gestionale si usa, e sa esportare ordini, scarichi e DDT di reso in CSV o via database?
   Se si', gran parte dell'OCR diventa superflua.
5. Il reso parte con un nostro DDT o solo con la bolla del corriere?
