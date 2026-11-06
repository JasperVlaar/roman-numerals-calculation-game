/* ---------- Arena: het Colosseum bij nacht ----------
   Statisch (tribunes, zittend publiek, muur, poorten, keizersloge, zandvloer, mozaïekrand)
   wordt naar een offscreen canvas getekend zodra de wereld van grootte verandert.
   Levend (onrustig publiek, de wave, Caesar, fakkels) wordt elk frame getekend.
   Maten zijn wereld-eenheden. W.rx / W.ry is de rand van de zandvloer; T is de afstand naar buiten
   vanaf die rand (T = 0 is de binnenkant van de muur). Kleuren staan in style.css. */

const ARENA = {
  wall: 14,            // dikte van de podiummuur
  row: 9,              // diepte van één zitrij
  seat: 8.5,           // afstand tussen toeschouwers in een rij
  empty: .12,          // deel van de stoelen dat leeg is
  podiumRows: 3,       // senatorenrijen direct achter de muur (witte toga's)
  walk: 8,             // looppad tussen podium en hogere tribune
  aisleEvery: 150,     // afstand tussen trappen in de tribune
  torchEvery: 200,     // afstand tussen fakkels op de muur
  tessera: 3.3,        // grootte van één mozaïeksteentje
  gateHalf: 22,        // halve breedte van de twee poorten
  gateDepth: 80,       // hoe ver de poorttunnel de tribune in loopt
  loge: { half: 50, depth: 40 },
  darkNear: .4,        // hoe donker de tribune vlak bij de muur is (0 = vol licht)
  darkFar: .9,         // hoe donker de verste rijen zijn
  darkTo: 190,         // afstand waarop de tribune helemaal in de nacht verdwijnt
  restless: .06,       // deel van het publiek dat beweegt
  waveMs: 3600, waveLaps: 2
};
// Meander (Griekse sleutel) voor de mozaïekrand: één periode van 6 steentjes breed, 5 hoog.
const MEANDER = ['#####.', '#...#.', '#.###.', '#.....', '######'];

const AR = { bg: document.createElement('canvas'), dirty: true, people: [], torches: [], wave: -1, col: null, glow: null };
const TAU = Math.PI * 2;
const wrapPi = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const smooth01 = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const hexRgb = h => { const n = parseInt(h.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

function arenaColors() {
  const s = getComputedStyle(document.documentElement), v = k => s.getPropertyValue('--' + k).trim();
  const c = {};
  ['night','sand','sand-2','porphyry','bronze','blood','laurel','skin','skin-2','skin-3','toga','marble','marble-shade',
   'travertine','travertine-2','tess-light','tess-dark','tess-line','grout','iron','flame','flame-core','glow','hair-1','hair-2','hair-3'].forEach(k => c[k] = v(k));
  c.crowd = [1, 2, 3, 4, 5, 6, 7].map(i => v('crowd-' + i)).filter(Boolean);
  return c;
}

// Booglengte-tabel van een ellips, zodat we dingen op gelijke afstand langs de rand kunnen zetten.
function arcTable(a, b, n = 720) {
  const cum = new Float64Array(n + 1); let px = a, py = 0;
  for (let i = 1; i <= n; i++) { const t = i / n * TAU, x = a * Math.cos(t), y = b * Math.sin(t); cum[i] = cum[i - 1] + Math.hypot(x - px, y - py); px = x; py = y; }
  return { n, cum, len: cum[n] };
}
function thAt(tab, s) {
  s = ((s % tab.len) + tab.len) % tab.len;
  let lo = 0, hi = tab.n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tab.cum[m] <= s) lo = m; else hi = m; }
  return (lo + (s - tab.cum[lo]) / (tab.cum[hi] - tab.cum[lo])) / tab.n * TAU;
}
const arenaPt = (th, T) => [(W.rx + T) * Math.cos(th), (W.ry + T) * Math.sin(th)];

function glowSprite(hex) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), [r, gg, b] = hexRgb(hex), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${r},${gg},${b},1)`); gr.addColorStop(.3, `rgba(${r},${gg},${b},.42)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
}

/* ---------- statisch deel ---------- */
function buildArena() {
  AR.dirty = false;
  const K = AR.col = arenaColors(), A = ARENA, L = A.loge;
  if (!AR.glow) AR.glow = glowSprite(K.glow);
  const { cw, ch, dpr, scale } = view, rx = W.rx, ry = W.ry;
  const bg = AR.bg; bg.width = cvs.width; bg.height = cvs.height;
  const g = bg.getContext('2d');
  g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * cw / 2, dpr * ch / 2);
  const X = cw / 2 / scale + 12, Y = ch / 2 / scale + 12;
  let Tmax = A.wall; while ((X / (rx + Tmax)) ** 2 + (Y / (ry + Tmax)) ** 2 > 1) Tmax += A.row;

  const dark = T => A.darkNear + (A.darkFar - A.darkNear) * smooth01((T - A.wall) / (A.darkTo - A.wall));
  const ell = T => { g.beginPath(); g.ellipse(0, 0, rx + T, ry + T, 0, 0, TAU); };
  const ring = (T0, T1) => { g.beginPath(); g.ellipse(0, 0, rx + T1, ry + T1, 0, 0, TAU); g.ellipse(0, 0, rx + T0, ry + T0, 0, 0, TAU); };
  const logeTop = -(ry + 4 + L.depth), logeBot = -(ry + 4);
  const inLoge = (x, y, pad) => Math.abs(x) < L.half + pad && y < logeBot + pad && y > logeTop - 10 - pad;
  const inGate = (x, y, pad) => Math.abs(y) < A.gateHalf + pad && Math.abs(x) > rx - pad && Math.abs(x) < rx + A.gateDepth + pad;

  g.fillStyle = K.night; g.fillRect(-X, -Y, 2 * X, 2 * Y);

  // Tribune: rijen van buiten naar binnen, afwisselend van tint, steeds donkerder naar buiten.
  const rows = [];
  for (let j = 0; j < A.podiumRows; j++) rows.push({ T: A.wall + j * A.row, podium: true, j });
  const upper0 = A.wall + A.podiumRows * A.row + A.walk;
  for (let T = upper0, j = 0; T < Tmax + A.row; T += A.row, j++) rows.push({ T, podium: false, j });
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]; ell(r.T + A.row);
    g.fillStyle = mix(r.j % 2 ? K.travertine : K['travertine-2'], K.night, dark(r.T)); g.fill();
  }

  // Trappen: rechte lijnen vanuit het midden.
  const aTab = arcTable(rx + 60, ry + 60), nA = Math.max(8, Math.round(aTab.len / A.aisleEvery)), aisles = [];
  for (let i = 0; i < nA; i++) {
    const th = thAt(aTab, (i + .5) * aTab.len / nA), [x, y] = arenaPt(th, 60);
    if (inGate(x, y, 30) || (Math.abs(x) < L.half + 30 && y < 0)) continue;
    aisles.push(th);
  }
  g.lineCap = 'butt';
  for (const th of aisles) for (const r of rows) {
    const [x0, y0] = arenaPt(th, r.T), [x1, y1] = arenaPt(th, r.T + A.row);
    g.strokeStyle = mix(K['marble-shade'], K.night, dark(r.T)); g.lineWidth = 6;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  // Treden: schaduwlijn aan de binnenkant van elke rij.
  g.strokeStyle = 'rgba(8,4,6,.42)'; g.lineWidth = 1.4;
  for (const r of rows) { ell(r.T); g.stroke(); }
  // Looppad met lage muur (balteus) tussen podium en hogere tribune.
  ring(upper0 - A.walk, upper0); g.fillStyle = mix(K['marble-shade'], K.night, dark(upper0) + .05); g.fill('evenodd');
  ell(upper0); g.strokeStyle = mix(K.marble, K.night, dark(upper0)); g.lineWidth = 2.2; g.stroke();

  // Publiek. Senatoren vooraan in witte toga's, daarachter het volk in alle kleuren.
  AR.people = [];
  const skins = [K.skin, K['skin-2'], K['skin-3']], heads = [K['hair-1'], K['hair-1'], K['hair-2'], K['hair-3'], K.skin, K['skin-2']];
  for (const r of rows) {
    const Tc = r.T + A.row / 2, d = dark(Tc); if (d > A.darkFar - .1) continue;
    const a = rx + Tc, b = ry + Tc, tab = arcTable(a, b, 900), n = Math.floor(tab.len / A.seat), off = Math.random() * A.seat;
    const tunics = r.podium ? [K.toga, K.toga, K.toga, K.marble, K.porphyry] : K.crowd;
    for (let i = 0; i < n; i++) {
      if (Math.random() < A.empty) continue;
      const th = thAt(tab, off + i * tab.len / n + (Math.random() - .5) * 1.6), c = Math.cos(th), s = Math.sin(th), x = a * c, y = b * s;
      if (Math.abs(x) > X + 8 || Math.abs(y) > Y + 8 || inGate(x, y, 8) || inLoge(x, y, 8)) continue;
      const sp = Math.hypot(a * s, b * c);
      if (aisles.some(t => Math.abs(wrapPi(th - t)) * sp < 5.5)) continue;
      let nx = b * c, ny = a * s; const l = Math.hypot(nx, ny); nx /= l; ny /= l;
      AR.people.push({ x, y, nx, ny, th, rot: Math.atan2(nx, -ny), sz: .9 + Math.random() * .22,
        tunic: mix(pick(tunics), K.night, d), head: mix(pick(heads), K.night, d), skin: mix(pick(skins), K.night, d),
        restless: Math.random() < A.restless, ph: Math.random() * TAU, f: .6 + Math.random() * .8, s: 0, b: 0 });
    }
  }
  paintPeople(g, AR.people.filter(p => !p.restless));

  // Poorten links en rechts: donkere tunnel, zijmuren, pilaren en een valhek.
  for (const sx of [-1, 1]) {
    const h = A.gateHalf, xIn = sx * (rx - 2), xOut = sx * (rx + A.gateDepth);
    const gr = g.createLinearGradient(xIn, 0, xOut, 0);
    gr.addColorStop(0, mix(K.night, K.travertine, .22)); gr.addColorStop(1, K.night);
    g.fillStyle = gr; g.fillRect(Math.min(xIn, xOut), -h, Math.abs(xOut - xIn), 2 * h);
    g.strokeStyle = mix(K['marble-shade'], K.night, .45); g.lineWidth = 3;
    for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(xIn, sy * h); g.lineTo(xOut, sy * h); g.stroke(); }
  }

  // Podiummuur met stenen blokken.
  ring(0, A.wall); g.fillStyle = mix(K.marble, K.night, .34); g.fill('evenodd');
  const wTab = arcTable(rx + A.wall / 2, ry + A.wall / 2), nB = Math.round(wTab.len / 26);
  g.strokeStyle = mix(K['marble-shade'], K.night, .3); g.lineWidth = 1;
  for (let i = 0; i < nB; i++) {
    const th = thAt(wTab, i * wTab.len / nB), [x0, y0] = arenaPt(th, 1.5), [x1, y1] = arenaPt(th, A.wall - 1.5);
    if (inGate(x0, y0, 2)) continue;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  ell(2.5); g.strokeStyle = K.marble; g.globalAlpha = .35; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1;
  ell(A.wall); g.strokeStyle = 'rgba(8,4,6,.5)'; g.lineWidth = 1.6; g.stroke();
  for (const sx of [-1, 1]) {   // gat in de muur voor de poort, plus pilaren
    const h = A.gateHalf;
    g.fillStyle = mix(K.night, K.travertine, .22); g.fillRect(sx > 0 ? rx - 4 : -(rx + A.wall + 1), -h, A.wall + 5, 2 * h);
    for (const sy of [-1, 1]) {
      const th = Math.asin(sy * (h + 5) / (ry + A.wall / 2)), px = sx * (rx + A.wall / 2) * Math.cos(th), py = sy * (h + 5);
      g.fillStyle = mix(K.marble, K.night, .3); g.fillRect(px - 9, py - 5.5, 18, 11);
      g.strokeStyle = mix(K['marble-shade'], K.night, .3); g.lineWidth = 1.2; g.strokeRect(px - 9, py - 5.5, 18, 11);
    }
  }

  // Zandvloer.
  g.save();
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.clip();
  g.save(); g.scale(1, ry / rx);
  const fg = g.createRadialGradient(0, 0, 10, 0, 0, rx); fg.addColorStop(0, K.sand); fg.addColorStop(1, K['sand-2']);
  g.fillStyle = fg; g.fillRect(-rx, -rx, 2 * rx, 2 * rx); g.restore();
  g.strokeStyle = K['sand-2']; g.globalAlpha = .28; g.lineWidth = 46; g.beginPath(); g.ellipse(0, 0, rx * .6, ry * .6, 0, 0, TAU); g.stroke();
  g.globalAlpha = .18; g.lineWidth = 2; for (const f of [.56, .64]) { g.beginPath(); g.ellipse(0, 0, rx * f, ry * f, 0, 0, TAU); g.stroke(); }
  g.globalAlpha = 1;
  const specks = [new Path2D(), new Path2D()], nS = Math.round(Math.PI * rx * ry / 50);
  for (let i = 0; i < nS; i++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()), z = .6 + Math.random() * .8;
    specks[i & 1].rect(rx * r * Math.cos(a), ry * r * Math.sin(a), z, z);
  }
  g.globalAlpha = .35; g.fillStyle = mix(K['sand-2'], K.night, .3); g.fill(specks[0]);
  g.globalAlpha = .45; g.fillStyle = mix(K.sand, '#ffffff', .35); g.fill(specks[1]); g.globalAlpha = 1;

  // Mozaïekrand: lijn, lichte rij, meander, lichte rij, lijn.
  const ts = A.tessera, nRows = 9, inset = 4, mid = inset + nRows * ts / 2;
  ring(-(inset + nRows * ts + 1), -inset + 1); g.fillStyle = K.grout; g.fill('evenodd');
  const ma = rx - mid, mb = ry - mid, mTab = arcTable(ma, mb, 1440);
  const cols = Math.round(mTab.len / (ts * 6)) * 6, step = mTab.len / cols, tiles = new Map();
  const tile = (base, x, y, ux, uy, h) => {
    const k = Math.random(), col = k < .33 ? base : k < .66 ? mix(base, '#000000', .08) : mix(base, '#ffffff', .07);
    let p = tiles.get(col); if (!p) tiles.set(col, p = new Path2D());
    p.moveTo(x + (ux - uy) * h, y + (uy + ux) * h); p.lineTo(x + (-ux - uy) * h, y + (-uy + ux) * h);
    p.lineTo(x + (-ux + uy) * h, y + (-uy - ux) * h); p.lineTo(x + (ux + uy) * h, y + (uy - ux) * h); p.closePath();
  };
  for (let i = 0; i < cols; i++) {
    const th = thAt(mTab, (i + .5) * step), c = Math.cos(th), s = Math.sin(th);
    let nx = mb * c, ny = ma * s; const l = Math.hypot(nx, ny); nx /= l; ny /= l;
    for (let j = 0; j < nRows; j++) {
      const v = (nRows / 2 - j - .5) * ts, x = ma * c + nx * v, y = mb * s + ny * v;
      const base = j === 0 || j === nRows - 1 ? K['tess-line'] : j === 1 || j === nRows - 2 ? K['tess-light']
        : MEANDER[j - 2][i % 6] === '#' ? K['tess-dark'] : K['tess-light'];
      tile(base, x, y, -ny, nx, ts * .42);
    }
  }
  g.globalAlpha = .88; for (const [col, p] of tiles) { g.fillStyle = col; g.fill(p); } g.globalAlpha = 1;

  // Schaduw van de muur op het zand.
  g.save();
  g.shadowColor = 'rgba(10,5,8,.62)'; g.shadowBlur = 22 * scale * dpr; g.shadowOffsetY = 5 * scale * dpr;
  g.beginPath(); g.rect(-2 * X, -2 * Y, 4 * X, 4 * Y); g.ellipse(0, 0, rx, ry, 0, 0, TAU);
  g.fillStyle = '#000'; g.fill('evenodd'); g.restore();
  g.restore();

  // Valhekken bij de poorten, over de rand van het zand.
  for (const sx of [-1, 1]) {
    const x = sx * (rx + 2), h = A.gateHalf;
    g.strokeStyle = K.iron; g.lineWidth = 3; g.beginPath(); g.moveTo(x, -h); g.lineTo(x, h); g.stroke();
    g.fillStyle = mix(K.iron, '#000000', .3);
    for (let k = -h + 3; k <= h - 3; k += 5.5) g.fillRect(x - 2.2, k - 1.2, 4.4, 2.4);
  }

  // Vaandels over de muur naast de loge.
  for (const sx of [-1, 1]) {
    const x = sx * (L.half + 16), y0 = -(ry + A.wall + 3), y1 = -(ry - 4);
    g.fillStyle = mix(K.blood, K.night, .15); g.fillRect(x - 7, y0, 14, y1 - y0);
    g.strokeStyle = K.bronze; g.lineWidth = 1.2; g.strokeRect(x - 5, y0 + 2, 10, y1 - y0 - 4);
    g.fillStyle = K.bronze; for (let k = -6; k <= 6; k += 3) { g.beginPath(); g.arc(x + k, y1, 1.2, 0, TAU); g.fill(); }
    g.strokeStyle = K.laurel; g.lineWidth = 1.4; g.beginPath(); g.arc(x, (y0 + y1) / 2, 3.2, 0, TAU); g.stroke();
  }

  // Keizersloge (pulvinar).
  g.fillStyle = mix(K.travertine, K.night, .3); g.fillRect(-L.half - 6, logeTop - 12, 2 * L.half + 12, L.depth + 12);
  g.fillStyle = mix(K.porphyry, K.night, .2); g.fillRect(-L.half, logeTop, 2 * L.half, L.depth);
  g.fillStyle = mix(K.blood, K.night, .35); g.fillRect(-L.half + 12, logeTop + 8, 2 * L.half - 24, L.depth - 12);
  g.strokeStyle = K.bronze; g.lineWidth = 1.3; g.strokeRect(-L.half + 3, logeTop + 3, 2 * L.half - 6, L.depth - 6);
  g.fillStyle = K.porphyry; g.fillRect(-L.half - 5, logeTop - 10, 2 * L.half + 10, 9);
  g.fillStyle = K.bronze; g.fillRect(-L.half - 5, logeTop - 2, 2 * L.half + 10, 1.4);
  for (let x = -L.half - 5; x < L.half + 5; x += 6) { g.beginPath(); g.arc(x + 3, logeTop - .6, 2.6, 0, Math.PI); g.fill(); }
  const cy = logeTop + L.depth * .45;
  g.fillStyle = K.marble; g.fillRect(-L.half, logeBot - 5, 2 * L.half, 5);
  g.fillStyle = K['marble-shade']; for (let x = -L.half + 6; x < L.half; x += 9) g.fillRect(x - 1, logeBot - 4.2, 2, 3.4);
  for (const px of [-L.half + 1, L.half - 1]) for (const py of [logeTop + 1, logeBot - 3]) {
    g.fillStyle = mix(K.marble, K.night, .15); g.beginPath(); g.arc(px, py, 4.2, 0, TAU); g.fill();
    g.strokeStyle = mix(K['marble-shade'], K.night, .2); g.lineWidth = 1.2; g.stroke();
    g.fillStyle = K.marble; g.beginPath(); g.arc(px - 1, py - 1, 1.5, 0, TAU); g.fill();
  }

  // Fakkels: verdeeld over de muur, plus bij loge en poorten.
  AR.torches = [];
  const tTab = arcTable(rx + A.wall / 2, ry + A.wall / 2), nT = Math.max(6, Math.round(tTab.len / A.torchEvery));
  for (let i = 0; i < nT; i++) {
    const th = thAt(tTab, (i + .5) * tTab.len / nT), [x, y] = arenaPt(th, A.wall / 2);
    if (inGate(x, y, 34) || (Math.abs(x) < L.half + 50 && y < 0)) continue;
    AR.torches.push({ x, y, ph: Math.random() * 100 });
  }
  for (const sx of [-1, 1]) {
    AR.torches.push({ x: sx * (L.half + 34), y: -Math.sqrt(1 - ((L.half + 34) / (rx + A.wall / 2)) ** 2) * (ry + A.wall / 2), ph: Math.random() * 100 });
    for (const sy of [-1, 1]) {
      const th = Math.asin(sy * (A.gateHalf + 16) / (ry + A.wall / 2));
      AR.torches.push({ x: sx * (rx + A.wall / 2) * Math.cos(th), y: sy * (A.gateHalf + 16), ph: Math.random() * 100 });
    }
  }
  for (const t of AR.torches) {
    g.fillStyle = K.iron; g.beginPath(); g.arc(t.x, t.y, 4.6, 0, TAU); g.fill();
    g.fillStyle = '#1c120c'; g.beginPath(); g.arc(t.x, t.y, 3.1, 0, TAU); g.fill();
  }
}

/* Toeschouwers, gebundeld per kleur zodat er maar een paar fill-calls nodig zijn.
   s = hoe ver iemand staat (0 zit, 1 staat met armen omhoog), b = klein wiebelen. */
function paintPeople(g, list) {
  const body = new Map(), head = new Map();
  const path = (m, k) => { let p = m.get(k); if (!p) m.set(k, p = new Path2D()); return p; };
  for (const p of list) {
    const s = p.s, k = p.sz * (1 + .32 * s), ex = 4.2 * k, ey = 2.6 * k, cr = Math.cos(p.rot), sr = Math.sin(p.rot);
    const P = path(body, p.tunic); P.moveTo(p.x + ex * cr, p.y + ex * sr); P.ellipse(p.x, p.y, ex, ey, p.rot, 0, TAU);
    const o = .9 + 1.8 * s + p.b, hx = p.x - p.nx * o, hy = p.y - p.ny * o, hr = 2.5 * k, H = path(head, p.head);
    H.moveTo(hx + hr, hy); H.arc(hx, hy, hr, 0, TAU);
    const M = path(head, p.skin);
    if (s > .25) for (const side of [-1, 1]) {
      const ax = hx - p.nx * 1.2 * s + cr * side * 3.7 * k, ay = hy - p.ny * 1.2 * s + sr * side * 3.7 * k, ar = 1.3 * k;
      M.moveTo(ax + ar, ay); M.arc(ax, ay, ar, 0, TAU);
    }
  }
  for (const [c, P] of body) { g.fillStyle = c; g.fill(P); }
  for (const [c, P] of head) { g.fillStyle = c; g.fill(P); }
}

/* ---------- levend deel ---------- */
function arenaCheer() { AR.wave = performance.now(); }

function drawArenaLive(g, now) {
  const A = ARENA, K = AR.col;
  let wave = null;
  if (AR.wave >= 0) {
    const prog = (now - AR.wave) / A.waveMs;
    if (prog >= 1 || prog < 0) AR.wave = -1;
    else wave = { head: -Math.PI / 2 + prog * A.waveLaps * TAU, amp: Math.min(1, prog * 8, (1 - prog) * 8) };
  }
  const live = [];
  for (const p of AR.people) {
    let s = 0;
    if (p.restless) { s = Math.max(0, Math.sin(now * .0011 * p.f + p.ph)) ** 12 * .75; p.b = Math.sin(now * .005 * p.f + p.ph) * .45; }
    if (wave) s = Math.max(s, wave.amp * Math.exp(-((wrapPi(p.th - wave.head) / .32) ** 2)));
    if (p.restless || s > .04) { p.s = s; live.push(p); }
  }
  paintPeople(g, live);
  for (const p of live) if (!p.restless) p.b = 0;

  drawCaesar(g, now);

  g.globalCompositeOperation = 'lighter';
  for (const t of AR.torches) {
    const f = Math.sin(now * .011 + t.ph) * .5 + Math.sin(now * .027 + t.ph * 1.7) * .3 + Math.sin(now * .053 + t.ph * 2.3) * .2;
    t.f = f; const R = 95 * (1 + .05 * f);
    g.globalAlpha = .27 + .06 * f; g.drawImage(AR.glow, t.x - R, t.y - R, 2 * R, 2 * R);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  for (const t of AR.torches) {
    const fx = t.x + Math.sin(now * .02 + t.ph) * .5, fy = t.y - .5;
    g.fillStyle = K.flame; g.beginPath(); g.arc(fx, fy, 3.1 + .6 * t.f, 0, TAU); g.fill();
    g.fillStyle = K['flame-core']; g.beginPath(); g.arc(fx + .3, fy - .3, 1.6 + .3 * t.f, 0, TAU); g.fill();
  }
}

function drawCaesar(g, now) {
  const K = AR.col, L = ARENA.loge, top = -(W.ry + 4 + L.depth), cy = top + L.depth * .45;
  // Twee pretorianen, van bovenaf: mantel, harnas, helm met kam, rood schild (scutum) naar de arena, speer.
  for (const sx of [-1, 1]) {
    const gx = sx * (L.half - 12), gy = top + L.depth * .52;
    g.save(); g.translate(gx, gy);
    g.fillStyle = mix(K.blood, K.night, .4); g.beginPath(); g.roundRect(-6.5, -5, 13, 6.5, 3); g.fill();
    g.fillStyle = mix(K.iron, K.marble, .35); g.beginPath(); g.roundRect(-5.5, -3, 11, 5, 2.5); g.fill();
    g.fillStyle = K.bronze; g.beginPath(); g.arc(0, -.6, 2.7, 0, TAU); g.fill();
    g.fillStyle = K.blood; g.fillRect(-.7, -3.3, 1.4, 5.4);
    g.fillStyle = K.blood; g.beginPath(); g.roundRect(-5.5, 3, 11, 3.6, 1); g.fill();
    g.strokeStyle = K.bronze; g.lineWidth = .8; g.stroke();
    g.fillStyle = K.bronze; g.beginPath(); g.arc(0, 4.8, 1.1, 0, TAU); g.fill();
    g.strokeStyle = K.iron; g.lineWidth = 1.1; g.beginPath(); g.moveTo(sx * 7.5, -9); g.lineTo(sx * 7.5, 8); g.stroke();
    g.fillStyle = mix(K.marble, K.iron, .3); g.beginPath(); g.moveTo(sx * 7.5, 11.5); g.lineTo(sx * 7.5 - 1.5, 7.5); g.lineTo(sx * 7.5 + 1.5, 7.5); g.fill();
    g.restore();
  }
  // Caesar, van bovenaf: troon, purperen mantel, toga met armen naar voren, hoofd met lauwerkrans.
  // Zijn hoofd draait mee met de wagen.
  let dx = car.x, dy = car.y - cy; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const face = Math.atan2(dy, dx);
  g.save(); g.translate(0, cy); g.scale(1.2, 1.2);
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  g.fillStyle = K.bronze; rr(-12, -9, 24, 4.5, 2);
  g.fillStyle = K.porphyry; rr(-11, -6, 22, 9, 4);
  g.fillStyle = K.skin; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 6.3, 3.6, 1.6, 2.6, 0, 0, TAU); g.fill(); }
  g.fillStyle = K.toga; rr(-9, -3.4, 18, 7, 3.5);
  g.strokeStyle = K.porphyry; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-6.5, -3.2); g.lineTo(3, 3.4); g.stroke();
  const hx = dx * 1, hy = 1.6 + dy * .3;
  g.fillStyle = K.skin; g.beginPath(); g.arc(hx + Math.cos(face) * 1.2, hy + Math.sin(face) * 1.2, 3.1, 0, TAU); g.fill();
  g.fillStyle = K['hair-1']; g.beginPath(); g.arc(hx - Math.cos(face) * .5, hy - Math.sin(face) * .5, 3.5, 0, TAU); g.fill();
  g.fillStyle = K.laurel;
  for (let i = 0; i < 9; i++) {
    const a = face + Math.PI * .45 + i / 8 * Math.PI * 1.1;
    g.beginPath(); g.ellipse(hx + Math.cos(a) * 3.4, hy + Math.sin(a) * 3.4, 1.7, .8, a + Math.PI / 2, 0, TAU); g.fill();
  }
  g.restore();
}
