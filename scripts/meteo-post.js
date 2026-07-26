// Agente "post meteo" — versione premium (feed 1080x1350).
// Meteo Puglia del giorno + riepilogo del mare provincia per provincia,
// in stile Linear/Stripe: lista pulita e allineata.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fontCssInter, logoMark } from './premium.js';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 1080, H = 1350, M = 80;

const BG = '#F7F3EC', INK = '#1F2E3A', MUTED = '#6A7782', HAIR = '#E4DCCB';
const VERDE = '#3BB273', GIALLO = '#E8B23E', ROSSO = '#E1614A';
const COL = { calmo: VERDE, mosso: GIALLO, moltomosso: ROSSO };
const ETICHETTA = { calmo: 'Calmo', mosso: 'Poco mosso', moltomosso: 'Mosso' };

const dataEstesa = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  const s = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export async function componiMeteoPost({ data, tempMax, ventoNome, ventoNodi, ventoSigla, ventoGradi, righe, account }) {
  const font = await fontCssInter();
  const cardY = 520, rigaH = 96;

  const lista = righe.map((r, i) => {
    const y = cardY + 64 + i * rigaH;
    const sep = i > 0 ? `<line x1="${M + 30}" y1="${y - rigaH / 2 - 16}" x2="${W - M - 30}" y2="${y - rigaH / 2 - 16}" stroke="${HAIR}" stroke-width="1.5"/>` : '';
    return `${sep}
      <circle cx="${M + 52}" cy="${y}" r="11" fill="${COL[r.stato] || GIALLO}"/>
      <text x="${M + 84}" y="${y + 11}" font-family="Inter" font-weight="600" font-size="34" fill="${INK}">${r.nome}</text>
      <text x="${W - M - 30}" y="${y + 11}" text-anchor="end" font-family="Inter" font-weight="500" font-size="28" fill="${MUTED}">${ETICHETTA[r.stato] || ''}</text>`;
  }).join('');

  const svg = `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#49B8C7"/><stop offset="1" stop-color="#177A8A"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="${BG}"/>

    ${logoMark(M, 74, 46)}
    <text x="${M + 62}" y="94" font-family="Inter" font-weight="700" font-size="20" letter-spacing="1.5" fill="${INK}">MARE CALMO</text>
    <text x="${M + 62}" y="116" font-family="Inter" font-weight="500" font-size="16" letter-spacing="3" fill="${MUTED}">PUGLIA</text>

    <text x="${M}" y="248" font-family="Inter" font-weight="800" font-size="92" letter-spacing="-3" fill="${INK}">Meteo Puglia</text>
    <text x="${M}" y="296" font-family="Inter" font-weight="500" font-size="27" fill="${MUTED}">${dataEstesa(data)}</text>

    <g transform="translate(${M} 336)">
      <rect x="0" y="0" width="${W - M * 2}" height="118" rx="20" fill="#FFFFFF" stroke="${HAIR}" stroke-width="1.5"/>
      <text x="30" y="44" font-family="Inter" font-weight="600" font-size="15" letter-spacing="1.2" fill="${MUTED}">TEMPERATURA</text>
      <text x="30" y="94" font-family="Inter" font-weight="700" font-size="46" fill="${INK}">${Math.round(tempMax)}°</text>
      <line x1="230" y1="26" x2="230" y2="92" stroke="${HAIR}" stroke-width="1.5"/>
      <text x="262" y="44" font-family="Inter" font-weight="600" font-size="15" letter-spacing="1.2" fill="${MUTED}">VENTO</text>
      <g transform="translate(276 76)"><g transform="rotate(${((ventoGradi + 180) % 360).toFixed(0)})">
        <line x1="0" y1="10" x2="0" y2="-10" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M-6 -3 L0 -12 L6 -3" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g></g>
      <text x="300" y="84" font-family="Inter" font-weight="600" font-size="28" fill="${INK}">${ventoNome} · ${ventoNodi} nodi da ${ventoSigla}</text>
    </g>

    <text x="${M}" y="${cardY - 14}" font-family="Inter" font-weight="600" font-size="18" letter-spacing="1.2" fill="${MUTED}">IL MARE, PROVINCIA PER PROVINCIA</text>
    <rect x="${M}" y="${cardY}" width="${W - M * 2}" height="${righe.length * rigaH + 44}" rx="22" fill="#FFFFFF" stroke="${HAIR}" stroke-width="1.5"/>
    ${lista}

    <g transform="translate(${M} ${H - 70})" font-family="Inter" font-weight="500" font-size="20" fill="${MUTED}">
      ${[['Calmo', VERDE], ['Poco mosso', GIALLO], ['Mosso', ROSSO]].map(([t, c], i) => { const x = i * 200; return `<circle cx="${x + 6}" cy="-6" r="7" fill="${c}"/><text x="${x + 22}" y="0">${t}</text>`; }).join('')}
    </g>
    <text x="${W - M}" y="${H - 64}" text-anchor="end" font-family="Inter" font-weight="600" font-size="20" fill="${INK}">@${account.replace('@', '')}</text>
  </svg>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>${font}*{margin:0;padding:0}</style></head><body style="margin:0">${svg}</body></html>`;
}
