// Genera i file del logo: avatar Instagram (PNG 1080) e logo vettoriale (SVG).
// Marchio: onda geometrica su tessera teal. Niente sole, niente cartoon.
//
// Uso: node scripts/logo.js

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RADICE, 'out', 'logo');
const SEA1 = '#49B8C7', SEA2 = '#177A8A', BG = '#F7F3EC';

// Tre onde geometriche bianche, centrate in un box quadrato di lato `s` a (cx,cy).
function onde(cx, cy, s, stroke) {
  const w = s * 0.66, sw = s * 0.075;
  const onda = (dy, op) => {
    const x0 = cx - w / 2, y = cy + dy;
    return `<path d="M${x0} ${y} q ${w / 4} -${s * 0.15} ${w / 2} 0 t ${w / 2} 0"
      fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" opacity="${op}"/>`;
  };
  return onda(-s * 0.16, .55) + onda(s * 0.02, .8) + onda(s * 0.2, 1);
}

function svgAvatar() {
  return `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${SEA1}"/><stop offset="1" stop-color="${SEA2}"/></linearGradient></defs>
    <rect width="1080" height="1080" fill="url(#g)"/>
    ${onde(540, 560, 620)}
  </svg>`;
}

// Logo con tessera + wordmark (per copertine / intestazioni).
function svgLogo() {
  const s = 120, x = 40, y = 40;
  return `<svg width="520" height="200" viewBox="0 0 520 200" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${SEA1}"/><stop offset="1" stop-color="${SEA2}"/></linearGradient></defs>
    <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.3}" fill="url(#g2)"/>
    ${onde(x + s / 2, y + s / 2, s)}
    <text x="${x + s + 28}" y="${y + 52}" font-family="Inter, sans-serif" font-weight="800" font-size="42" letter-spacing="-1" fill="#1F2E3A">Mare Calmo</text>
    <text x="${x + s + 30}" y="${y + 92}" font-family="Inter, sans-serif" font-weight="600" font-size="24" letter-spacing="8" fill="#6A7782">PUGLIA</text>
  </svg>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'avatar.svg'), svgAvatar(), 'utf8');
  await writeFile(path.join(OUT, 'logo.svg'), svgLogo(), 'utf8');

  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
    await p.setContent(`<body style="margin:0">${svgAvatar()}</body>`, { waitUntil: 'load' });
    await p.screenshot({ path: path.join(OUT, 'avatar.png'), type: 'png' });
    console.log('avatar.png, avatar.svg, logo.svg');
  } finally { await browser.close(); }
}

main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });
