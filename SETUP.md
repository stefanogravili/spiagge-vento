# Configurazione iniziale

Da fare **una sola volta per regione**. Dopo questo, il sistema pubblica da solo
ogni mattina e non richiede piu' nulla: anche il token si rinnova da se'.

Tempo richiesto: circa 30 minuti la prima volta, 10 minuti per le regioni successive.

---

## 1. L'account Instagram

1. Crea l'account Instagram. Per la Puglia e' `marecalmo.puglia`: la radice
   `marecalmo` si ripete per ogni regione (`marecalmo.sicilia` e cosi' via),
   cosi' il nome resta cercabile e riconoscibile man mano che si aggiungono.
2. Impostazioni -> **Tipo di account** -> passa a **Account aziendale**.
   La pubblicazione via API e' impossibile su un account personale: e' una
   restrizione di Meta, non aggirabile.
3. Crea una **Pagina Facebook** con lo stesso nome e collegala all'account
   Instagram (Impostazioni Instagram -> Centro gestione account -> Pagine).

## 2. L'app Meta

1. Vai su [developers.facebook.com/apps](https://developers.facebook.com/apps) ->
   **Crea un'app** -> tipo **Azienda**.
2. Nel pannello dell'app aggiungi il prodotto **Instagram Graph API**.
3. Apri il [Graph API Explorer](https://developers.facebook.com/tools/explorer/),
   seleziona la tua app e richiedi questi permessi:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`
4. Genera il token e **copialo**.

## 3. I due valori che servono

### Token a lunga durata

Il token dell'Explorer dura un'ora. Va scambiato con uno da 60 giorni:

```
https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id=<ID_APP>
  &client_secret=<SEGRETO_APP>
  &fb_exchange_token=<TOKEN_BREVE>
```

Il campo `access_token` della risposta e' il valore da salvare come `IG_TOKEN_PUGLIA`.
Da li' in poi il workflow lo rinnova da solo ogni giorno: non scadra' mai.

### ID dell'account Instagram

```
https://graph.facebook.com/v21.0/me/accounts?access_token=<TOKEN_LUNGO>
```

Prendi l'`id` della tua Pagina, poi:

```
https://graph.facebook.com/v21.0/<ID_PAGINA>?fields=instagram_business_account&access_token=<TOKEN_LUNGO>
```

Il valore `instagram_business_account.id` e' `IG_USER_ID_PUGLIA`.

## 4. Il repository GitHub

Il repo deve essere **pubblico**: le immagini vengono servite da
`raw.githubusercontent.com` e Instagram deve poterle scaricare.

```bash
gh repo create spiagge-vento --public --source=. --push
```

## 5. I secret

In `Settings -> Secrets and variables -> Actions` aggiungi:

| Nome | Valore |
|---|---|
| `IG_USER_ID_PUGLIA` | l'ID ottenuto al punto 3 |
| `IG_TOKEN_PUGLIA` | il token a lunga durata |
| `GH_PAT` | vedi sotto |

`GH_PAT` serve solo a permettere al workflow di riscrivere il token rinnovato.
Crealo in [Settings -> Developer settings -> Fine-grained tokens](https://github.com/settings/tokens?type=beta):
accesso al solo repository `spiagge-vento`, permesso **Secrets: Read and write**,
scadenza **No expiration**.

Senza `GH_PAT` tutto funziona lo stesso, ma dovrai rigenerare il token a mano
ogni 60 giorni.

## 6. Prova

Vai su **Actions -> Post giornaliero -> Run workflow**. Se il post compare sul
profilo, hai finito: da domani parte da solo alle 7:00.

---

## Aggiungere una regione

1. Copia `data/puglia.json` in `data/<regione>.json`, cambia spiagge, `account`
   e hashtag. Il campo importante e' `facing`: la direzione, in gradi, verso cui
   guarda il mare dalla battigia.
2. Ripeti i punti 1-3 per il nuovo account Instagram.
3. Aggiungi i secret `IG_USER_ID_<REGIONE>` e `IG_TOKEN_<REGIONE>`.
4. In `.github/workflows/post-giornaliero.yml` aggiungi due righe alla matrice:

```yaml
          - regione: sicilia
            secret: SICILIA
```
