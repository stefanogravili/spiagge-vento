// Ricava i due valori da mettere nei secret di GitHub: il token a lunga durata
// e l'ID dell'account Instagram.
//
// Sostituisce tre chiamate da comporre a mano nel browser, dove basta un
// parametro sbagliato per ottenere un errore che non spiega la causa.
//
// Uso (PowerShell, dalla cartella del progetto):
//   $env:APP_ID="..."; $env:APP_SECRET="..."; $env:TOKEN_BREVE="..."
//   node scripts/configura.js
//
// I valori restano sul tuo computer: lo script non li invia da nessuna parte
// se non a Meta.

const BASE = 'https://graph.facebook.com/v21.0';

const { APP_ID, APP_SECRET, TOKEN_BREVE, REGIONE = 'PUGLIA' } = process.env;

if (!APP_ID || !APP_SECRET || !TOKEN_BREVE) {
  console.error(`
Mancano dei valori. Impostali cosi', poi rilancia:

  $env:APP_ID="1234567890"
  $env:APP_SECRET="abc123..."
  $env:TOKEN_BREVE="EAAG..."
  node scripts/configura.js

APP_ID e APP_SECRET stanno in developers.facebook.com -> la tua app ->
Impostazioni -> Di base. TOKEN_BREVE e' quello generato dal Graph API Explorer.
`);
  process.exit(1);
}

async function chiama(url, cosa) {
  const risposta = await fetch(url);
  const corpo = await risposta.json();
  if (corpo.error) {
    throw new Error(`${cosa} — Meta risponde: ${corpo.error.message}`);
  }
  return corpo;
}

const separatore = () => console.log('-'.repeat(64));

async function main() {
  console.log('\n1/3  Scambio il token breve con uno a lunga durata...');
  const scambio = await chiama(
    `${BASE}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${TOKEN_BREVE}`,
    'Scambio del token'
  );
  const tokenLungo = scambio.access_token;
  const giorni = scambio.expires_in ? Math.round(scambio.expires_in / 86400) : 60;
  console.log(`     Fatto. Valido ${giorni} giorni, poi si rinnova da solo.`);

  console.log('\n2/3  Cerco le Pagine Facebook collegate...');
  const pagine = await chiama(`${BASE}/me/accounts?access_token=${tokenLungo}`, 'Elenco Pagine');
  if (!pagine.data?.length) {
    throw new Error(
      'Nessuna Pagina Facebook trovata. Serve una Pagina collegata all\'account Instagram.'
    );
  }
  console.log(`     Trovate ${pagine.data.length}: ${pagine.data.map((p) => p.name).join(', ')}`);

  console.log('\n3/3  Cerco l\'account Instagram aziendale...');
  const trovati = [];
  for (const pagina of pagine.data) {
    const dettaglio = await chiama(
      `${BASE}/${pagina.id}?fields=instagram_business_account{id,username}&access_token=${tokenLungo}`,
      `Pagina ${pagina.name}`
    );
    const ig = dettaglio.instagram_business_account;
    if (ig) trovati.push({ pagina: pagina.name, id: ig.id, username: ig.username });
  }

  if (!trovati.length) {
    throw new Error(
      'Nessun account Instagram aziendale collegato alle Pagine.\n' +
        "Controlla che l'account Instagram sia di tipo Aziendale e collegato alla Pagina."
    );
  }

  for (const t of trovati) {
    console.log(`     @${t.username} (Pagina "${t.pagina}") -> ID ${t.id}`);
  }

  const scelto = trovati[0];
  if (trovati.length > 1) {
    console.log(`\n     Piu' di un account: uso @${scelto.username}. Se non e' quello giusto,`);
    console.log('     sostituisci l\'ID a mano nel comando qui sotto.');
  }

  separatore();
  console.log('PRONTO. Lancia questi due comandi per salvare i secret su GitHub:\n');
  console.log(`  gh secret set IG_USER_ID_${REGIONE} --body "${scelto.id}"`);
  console.log(`  gh secret set IG_TOKEN_${REGIONE} --body "${tokenLungo}"`);
  separatore();
  console.log(`\nRicorda di aggiornare "account" in data/${REGIONE.toLowerCase()}.json`);
  console.log(`con @${scelto.username}, cosi' compare in fondo alla carta.\n`);
}

main().catch((e) => {
  console.error(`\nErrore: ${e.message}\n`);
  process.exit(1);
});
