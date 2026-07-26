// Agente "post meteo": disegna il post feed (4:5) col meteo Puglia del giorno
// dopo e il riepilogo del mare provincia per provincia.
// componiMeteoPost() e' usato dall'orchestratore giornaliero.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 1080, H = 1350;

const SKY1 = '#AEE3F0', SKY2 = '#D6F2F8';
const SEA = '#38B9C7', SEA_D = '#2A9DAB';
const INK = '#243b44';
const VERDE = '#34C759', GIALLO = '#FFC53D', ROSSO = '#FF5B4C', SOLE = '#FFCB3B';
const COLORE = { calmo: VERDE, mosso: GIALLO, moltomosso: ROSSO };

export async function fontCssMeteo() {
  const f = [['Fredoka', 500, 'fredoka-500.woff2'], ['Fredoka', 700, 'fredoka-700.woff2']];
  const out = await Promise.all(f.map(async ([fam, peso, file]) => {
    const dati = await readFile(path.join(RADICE, 'assets', 'font', file));
    return `@font-face{font-family:'${fam}';font-weight:${peso};font-style:normal;src:url(data:font/woff2;base64,${dati.toString('base64')}) format('woff2')}`;
  }));
  return out.join('\n');
}

const dataEstesa = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  const s = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function sole(cx, cy, r) {
  const raggi = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30) * Math.PI / 180;
    return `<line x1="${cx + Math.cos(a) * (r + 7)}" y1="${cy + Math.sin(a) * (r + 7)}" x2="${cx + Math.cos(a) * (r + 24)}" y2="${cy + Math.sin(a) * (r + 24)}" stroke="${SOLE}" stroke-width="9" stroke-linecap="round"/>`;
  }).join('');
  return `${raggi}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${SOLE}" stroke="${INK}" stroke-width="5"/>
    <circle cx="${cx - r * 0.32}" cy="${cy - r * 0.12}" r="6" fill="${INK}"/>
    <circle cx="${cx + r * 0.32}" cy="${cy - r * 0.12}" r="6" fill="${INK}"/>
    <path d="M${cx - r * 0.34} ${cy + r * 0.2} Q ${cx} ${cy + r * 0.56} ${cx + r * 0.34} ${cy + r * 0.2}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
}

/**
 * @param righe  [{ nome, stato }]  stato = 'calmo' | 'mosso' | 'moltomosso'
 */
export async function componiMeteoPost({ data, tempMax, ventoNome, ventoNodi, ventoSigla, ventoGradi, righe, account }) {
  const font = await fontCssMeteo();
  const cx = W / 2;
  const onde = Array.from({ length: 4 }, (_, i) =>
    `<path d="M0 ${H - 210 + i * 60} q ${W / 4} -34 ${W / 2} 0 t ${W / 2} 0 V ${H} H0 Z" fill="${i % 2 ? SEA_D : SEA}" opacity="${0.55 + i * 0.12}"/>`).join('');

  const cardY = 620, rigaH = 92;
  const listaRighe = righe.map((r, i) => {
    const y = cardY + 70 + i * rigaH;
    return `
      <circle cx="${cx - 380}" cy="${y}" r="22" fill="${COLORE[r.stato] || GIALLO}" stroke="${INK}" stroke-width="4"/>
      <text x="${cx - 340}" y="${y + 12}" font-family="Fredoka" font-weight="700" font-size="40" fill="${INK}">${r.nome}</text>
      <text x="${cx + 380}" y="${y + 12}" text-anchor="end" font-family="Fredoka" font-weight="500" font-size="34" fill="${INK}" opacity=".8">${r.stato === 'calmo' ? 'calmo' : r.stato === 'mosso' ? 'mosso' : 'molto mosso'}</text>`;
  }).join('');

  const svg = `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY1}"/><stop offset="1" stop-color="${SKY2}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${onde}
    ${sole(W - 150, 150, 74)}
    <text x="60" y="130" font-family="Fredoka" font-weight="700" font-size="30" fill="${SEA_D}">MARE CALMO · PUGLIA</text>
    <text x="56" y="255" font-family="Fredoka" font-weight="700" font-size="120" fill="${INK}">Meteo Puglia</text>
    <text x="60" y="320" font-family="Fredoka" font-weight="500" font-size="38" fill="${INK}">${dataEstesa(data)}</text>

    <g transform="translate(60 380)">
      <rect x="0" y="0" width="440" height="180" rx="30" fill="#fff" stroke="${INK}" stroke-width="5"/>
      <text x="30" y="70" font-family="Fredoka" font-weight="500" font-size="34" fill="${INK}">Temperatura</text>
      <text x="30" y="150" font-family="Fredoka" font-weight="700" font-size="86" fill="${INK}">${Math.round(tempMax)}°</text>
    </g>
    <g transform="translate(520 380)">
      <rect x="0" y="0" width="500" height="180" rx="30" fill="#fff" stroke="${INK}" stroke-width="5"/>
      <text x="30" y="70" font-family="Fredoka" font-weight="500" font-size="34" fill="${INK}">Vento</text>
      <g transform="translate(58 130)"><g transform="rotate(${((ventoGradi + 180) % 360).toFixed(0)})">
        <line x1="0" y1="20" x2="0" y2="-20" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
        <path d="M-11 -8 L0 -24 L11 -8 Z" fill="${INK}"/></g></g>
      <text x="110" y="130" font-family="Fredoka" font-weight="700" font-size="44" fill="${INK}">${ventoNome}</text>
      <text x="110" y="165" font-family="Fredoka" font-weight="500" font-size="28" fill="${INK}" opacity=".8">${ventoNodi} nodi da ${ventoSigla}</text>
    </g>

    <text x="60" y="${cardY - 6}" font-family="Fredoka" font-weight="700" font-size="40" fill="${SEA_D}">Il mare, provincia per provincia</text>
    <rect x="40" y="${cardY + 20}" width="${W - 80}" height="${righe.length * rigaH + 40}" rx="34" fill="#fff" stroke="${INK}" stroke-width="5"/>
    ${listaRighe}

    <text x="${cx}" y="${H - 70}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="46" fill="#fff">@${account.replace('@', '')}</text>
  </svg>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>${font}*{margin:0;padding:0}</style></head><body style="margin:0">${svg}</body></html>`;
}
