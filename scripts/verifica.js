// Verifica che il token Instagram funzioni e che l'ID account combaci.
// Non pubblica nulla: chiede solo a Instagram "chi sono?" con questo token.
//
// Uso (PowerShell, dentro la cartella del progetto):
//   $env:IG_TOKEN="IGAA...il-token..."
//   $env:IG_USER_ID="17841444568256419"
//   node scripts/verifica.js

const HOST = 'https://graph.instagram.com';
const { IG_TOKEN, IG_USER_ID } = process.env;

if (!IG_TOKEN) {
  console.error(`
Manca il token. Impostalo cosi', poi rilancia:

  $env:IG_TOKEN="IGAA...il-token..."
  $env:IG_USER_ID="17841444568256419"
  node scripts/verifica.js
`);
  process.exit(1);
}

async function main() {
  const res = await fetch(
    `${HOST}/v21.0/me?fields=user_id,username&access_token=${IG_TOKEN}`
  );
  const dati = await res.json();

  if (dati.error) {
    console.error(`\n❌ Il token NON funziona: ${dati.error.message}\n`);
    console.error('Va rigenerato dalla pagina "Aggiungi account" su Meta.');
    process.exit(1);
  }

  console.log(`\n✅ Token valido.`);
  console.log(`   Account:  @${dati.username}`);
  console.log(`   ID:       ${dati.user_id}`);

  if (IG_USER_ID && String(IG_USER_ID) !== String(dati.user_id)) {
    console.warn(
      `\n⚠️  Attenzione: l'ID che hai messo (${IG_USER_ID}) e' diverso da quello reale (${dati.user_id}).`
    );
    console.warn('   Usa quello reale qui sopra nei secret di GitHub.');
  } else if (IG_USER_ID) {
    console.log(`   ID confermato, combacia. Tutto pronto.`);
  }
  console.log('');
}

main().catch((e) => {
  console.error(`\nErrore di rete: ${e.message}\n`);
  process.exit(1);
});
