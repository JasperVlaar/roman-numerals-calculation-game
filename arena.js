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
  loge: { half: 50, depth: 40 },   // keizersloge (pulvinar)
  caesar: .8,          // schaal van Caesar: even groot als de pretorianen naast hem, iets groter dan het publiek
  darkNear: .4,        // hoe donker de tribune vlak bij de muur is (0 = vol licht)
  darkFar: .9,         // hoe donker de verste rijen zijn
  darkTo: 190,         // afstand waarop de tribune helemaal in de nacht verdwijnt
  restless: .06,       // deel van het publiek dat beweegt
  waveMs: 3600, waveLaps: 2
};
// Meander (Griekse sleutel) voor de mozaïekrand: één periode van 6 steentjes breed, 5 hoog.
const MEANDER = ['#####.', '#...#.', '#.###.', '#.....', '######'];

const AR = { bg: document.createElement('canvas'), dirty: true, people: [], torches: [], wave: -1, jeer: -1, judging: null, col: null, glow: null };
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

  // Publiek, ingedeeld zoals in Rome (lex Iulia theatralis): voorin senatoren in witte toga met brede purperen baan,
  // dan ridders (smalle baan), dan het volk in kleur, helemaal bovenin vooral vrouwen en armen.
  // Mensen zitten in groepjes: gezinnen, stelletjes, vrienden in dezelfde kleur (fans), en losse mensen.
  // Elke rij heeft een vaste toevalsgenerator, zodat het hetzelfde publiek blijft tussen gevechten en bij het draaien van het scherm.
  AR.people = [];
  const skins = [K.skin, K.skin, K['skin-2'], K['skin-2'], K['skin-3']], hairs = [K['hair-1'], K['hair-1'], K['hair-2'], K['hair-2'], K['hair-3']];
  const grey = '#b9b2a6', straw = '#c9a86a', wool = '#6b4a32', drab = ['#8a7a62', '#6f6252', '#9a8566', '#5e5446'];
  const fans = ['#9a3a7a', '#3f7fae', '#6f9a3a', '#c8402f'];   // kleuren van fanclubs (parmularii, scutarii, ...)
  const pallas = K.crowd.map(c => mix(c, '#ffffff', .18)).concat([K.toga, '#c97a5a', '#8c6aa0']);
  const visRows = rows.filter(r => dark(r.T + A.row / 2) <= A.darkFar - .1), lastJ = visRows.length ? visRows[visRows.length - 1].j : 0;
  for (const r of rows) {
    const Tc = r.T + A.row / 2, d = dark(Tc); if (d > A.darkFar - .1) continue;
    const rnd = seeded(7919 * (r.j + 1) + (r.podium ? 101 : 0)), pk = arr => arr[Math.floor(rnd() * arr.length)];
    const cls = r.podium ? 'senator' : r.j < 2 ? 'eques' : r.j >= lastJ - 1 ? 'top' : 'pleb';
    const a = rx + Tc, b = ry + Tc, tab = arcTable(a, b, 900), n = Math.floor(tab.len / A.seat), off = rnd() * A.seat;
    let group = [], gi = 0;
    const newGroup = () => {   // een groepje: lijst van rollen, plus een gedeelde kleur voor vrienden
      const t = rnd(); gi = 0;
      if (cls === 'senator') return group = t < .2 ? ['senator', 'senator'] : ['senator'];
      if (cls === 'eques') return group = t < .25 ? ['eques', 'woman'] : ['eques'];
      if (cls === 'top') return group = t < .45 ? ['woman', 'woman'] : t < .7 ? ['woman', 'kid'] : ['poor'];
      if (t < .22) return group = rnd() < .5 ? ['man', 'woman', 'kid'] : ['man', 'woman', 'kid', 'kid'];
      if (t < .42) { const c = pk(fans), m = 2 + Math.floor(rnd() * 3); group = Array(m).fill('fan'); group.color = c; return group; }
      if (t < .6) return group = ['man', 'woman'];
      if (t < .64) return group = ['soldier'];
      return group = [rnd() < .2 ? 'elder' : 'man'];
    };
    for (let i = 0; i < n; i++) {
      if (gi >= group.length) { newGroup(); if (rnd() < .5) continue; }   // soms een lege plek tussen groepjes
      const role = group[gi++];
      if (rnd() < A.empty * .5) continue;
      const th = thAt(tab, off + i * tab.len / n + (rnd() - .5) * 1.2), c = Math.cos(th), sn = Math.sin(th), x = a * c, y = b * sn;
      if (Math.abs(x) > X + 8 || Math.abs(y) > Y + 8 || inGate(x, y, 8) || inLoge(x, y, 8)) continue;
      const sp = Math.hypot(a * sn, b * c);
      if (aisles.some(t => Math.abs(wrapPi(th - t)) * sp < 5.5)) continue;
      let nx = b * c, ny = a * sn; const l = Math.hypot(nx, ny); nx /= l; ny /= l;
      // uiterlijk per rol
      let tunic, hair = pk(hairs), hat = null, cloak = null, stripe = null, sz = .92 + rnd() * .18, skin = pk(skins);
      if (role === 'senator') { tunic = K.toga; stripe = 'wide'; hair = rnd() < .45 ? grey : hair; if (rnd() < .2) hat = 'bald'; }
      else if (role === 'eques') { tunic = mix(K.toga, K.sand, .25); stripe = 'narrow'; if (rnd() < .3) cloak = pk(K.crowd); }
      else if (role === 'woman') { tunic = pk(K.crowd); if (rnd() < .75) { hat = 'veil'; cloak = pk(pallas); } sz *= .94; }
      else if (role === 'kid') { tunic = pk(K.crowd.concat(drab)); sz = .66 + rnd() * .1; }
      else if (role === 'fan') { tunic = group.color; if (rnd() < .3) cloak = mix(group.color, '#000000', .25); }
      else if (role === 'soldier') { tunic = K.blood; hat = 'helmet'; cloak = mix(K.blood, '#000000', .3); }
      else if (role === 'poor') { tunic = pk(drab); if (rnd() < .4) hat = 'hood'; }
      else if (role === 'elder') { tunic = pk(K.crowd.concat(drab)); hair = grey; if (rnd() < .4) hat = 'bald'; sz *= .96; }
      else { tunic = pk(K.crowd.concat(drab)); const h = rnd(); hat = h < .07 ? 'straw' : h < .15 ? 'hood' : h < .23 ? 'bald' : null; if (rnd() < .3) cloak = pk(K.crowd.concat(drab)); }
      const dk = col => col && mix(col, K.night, d * .78);   // mensen iets minder in het donker dan de stenen, zodat kleuren te zien blijven
      AR.people.push({ x, y, nx, ny, th, rot: Math.atan2(nx, -ny), sz, role,
        tunic: dk(tunic), cloak: dk(cloak), cside: rnd() < .5 ? -1 : 1, stripe, stripeCol: dk(K.porphyry), hat,
        hatCol: dk(hat === 'veil' ? cloak : hat === 'straw' ? straw : hat === 'hood' ? wool : hat === 'helmet' ? K.bronze : null),
        crest: dk(K.blood), head: dk(hat === 'bald' ? skin : hair), skin: dk(skin),
        restless: rnd() < A.restless, ph: rnd() * TAU, f: .6 + rnd() * .8, s: 0, b: 0 });
    }
  }
  // Een paar vaste figuren die je elk gevecht terugziet: twee mannen met een vlag, een kind op de schouders van zijn vader.
  {
    const rnd = seeded(4242), plebs = AR.people.filter(p => p.role === 'man' || p.role === 'fan');
    const pickP = side => { const c = plebs.filter(p => Math.sign(p.x) === side && p.y > -ry * .2); return c.length ? c[Math.floor(rnd() * c.length)] : null; };
    for (const [side, col] of [[-1, K.blood], [1, '#3f6e8c']]) { const p = pickP(side); if (p) { p.flag = col; p.restless = true; } }
    for (let k = 0; k < 3; k++) { const p = plebs[Math.floor(rnd() * plebs.length)]; if (p && !p.flag) { p.carry = mix(K['hair-2'], K.night, 0); p.carrySkin = p.skin; } }
  }
  // Verkoper die over het looppad tussen podium en tribune loopt, met een plank broden.
  AR.vendor = { T: upper0 - A.walk / 2, th: -Math.PI * .75, dir: 1, tunic: mix('#8a5a32', K.night, dark(upper0)), skin: mix(K.skin, K.night, dark(upper0)), tray: mix('#c99a5a', K.night, dark(upper0)) };
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

  // Purperen doek over de muur onder de loge, met gouden franje en een lauwerkrans.
  {
    const dw = L.half * .62, y0 = logeBot - 2, y1 = -(ry - 7);
    g.fillStyle = mix(K.porphyry, K.night, .1); g.beginPath(); g.moveTo(-dw, y0); g.lineTo(dw, y0); g.lineTo(dw - 4, y1); g.lineTo(-dw + 4, y1); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(30,15,8,.8)'; g.lineWidth = 1.3; g.stroke();
    g.fillStyle = K.bronze; g.fillRect(-dw + 3, y1 - 3.5, 2 * dw - 6, 1.6);
    for (let x = -dw + 6; x < dw - 4; x += 4) { g.beginPath(); g.arc(x, y1 + .4, 1.1, 0, TAU); g.fill(); }
    const wy = (y0 + y1) / 2 - 1;
    g.strokeStyle = K.laurel; g.lineWidth = 1.1; g.beginPath(); g.arc(0, wy, 3.4, Math.PI * .6, Math.PI * 2.4); g.stroke();
    g.fillStyle = K.laurel; for (let i = 0; i < 9; i++) { const a = Math.PI * .7 + i / 8 * Math.PI * 1.6; g.beginPath(); g.ellipse(Math.cos(a) * 3.4, wy + Math.sin(a) * 3.4, 1.1, .55, a + Math.PI / 2, 0, TAU); g.fill(); }
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
  // Vaste gloed van de fakkels zit in de achtergrond; live komt er alleen een kleine flakkering bij.
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = .27;
  for (const t of AR.torches) g.drawImage(AR.glow, t.x - 95, t.y - 95, 190, 190);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  for (const t of AR.torches) {
    g.fillStyle = K.iron; g.beginPath(); g.arc(t.x, t.y, 4.6, 0, TAU); g.fill();
    g.fillStyle = '#1c120c'; g.beginPath(); g.arc(t.x, t.y, 3.1, 0, TAU); g.fill();
  }
}

/* Toeschouwers, gebundeld per laag en kleur zodat er maar een paar fill-calls nodig zijn.
   s = hoe ver iemand staat (0 zit, 1 staat met armen omhoog), b = klein wiebelen.
   Lagen: lijf, mantel over één schouder, purperen baan (senator/ridder), hoofd of hoofddeksel, details (rand, kam), armen. */
function paintPeople(g, list) {
  const layers = [new Map(), new Map(), new Map(), new Map(), new Map(), new Map()], strokes = new Map();
  const P = (i, c) => { const m = layers[i]; let p = m.get(c); if (!p) m.set(c, p = new Path2D()); return p; };
  const S = (c, w) => { const k = c + '|' + w; let p = strokes.get(k); if (!p) strokes.set(k, p = new Path2D()); return p; };
  const circ = (p, x, y, r) => { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); };
  const oval = (p, x, y, rx, ry, rot) => { p.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot)); p.ellipse(x, y, rx, ry, rot, 0, TAU); };
  for (const p of list) {
    const s = p.s, k = p.sz * (1 + .32 * s), ex = 4.2 * k, ey = 2.6 * k, cr = Math.cos(p.rot), sr = Math.sin(p.rot);
    oval(P(0, p.tunic), p.x, p.y, ex, ey, p.rot);
    if (p.cloak && p.hat !== 'veil') oval(P(1, p.cloak), p.x + cr * p.cside * ex * .42 + p.nx * .5, p.y + sr * p.cside * ex * .42 + p.ny * .5, ex * .62, ey * .95, p.rot);
    if (p.stripe) {   // baan van schouder tot schouder door het midden
      const w = p.stripe === 'wide' ? 1.3 * k : .6 * k, L = S(p.stripeCol, w);
      for (const o of p.stripe === 'wide' ? [0] : [-1.4 * k, 1.4 * k]) { L.moveTo(p.x + cr * o - p.nx * ey * .9, p.y + sr * o - p.ny * ey * .9); L.lineTo(p.x + cr * o + p.nx * ey * .9, p.y + sr * o + p.ny * ey * .9); }
    }
    const o = .9 + 1.8 * s + p.b, hx = p.x - p.nx * o, hy = p.y - p.ny * o, hr = 2.5 * k;
    if (p.hat === 'veil') oval(P(3, p.hatCol), hx + p.nx * .9, hy + p.ny * .9, hr * 1.35, hr * 1.12, p.rot);   // sluier over hoofd en schouders
    else if (p.hat === 'hood') { const H = P(3, p.hatCol); circ(H, hx, hy, hr * 1.08); H.moveTo(hx + p.nx * hr * 1.9, hy + p.ny * hr * 1.9); H.lineTo(hx + cr * hr * .8, hy + sr * hr * .8); H.lineTo(hx - cr * hr * .8, hy - sr * hr * .8); }
    else if (p.hat === 'straw') { circ(P(3, p.hatCol), hx, hy, hr * 1.45); circ(P(4, mix(p.hatCol, '#000000', .2)), hx, hy, hr * .85); }   // brede strohoed (petasus)
    else if (p.hat === 'helmet') { circ(P(3, p.hatCol), hx, hy, hr * 1.05); const C = S(p.crest, 1.2 * k); C.moveTo(hx - p.nx * hr, hy - p.ny * hr); C.lineTo(hx + p.nx * hr, hy + p.ny * hr); }
    else { circ(P(3, p.head), hx, hy, hr); if (p.hat === 'bald') circ(P(4, mix(p.head, '#ffffff', .25)), hx - cr * .6 - p.nx * .5, hy - sr * .6 - p.ny * .5, hr * .35); }
    if (p.carry) {   // kind op de schouders: klein lijfje en hoofd op het hoofd van de vader, armen wijd
      oval(P(4, p.tunic), hx + p.nx * .4, hy + p.ny * .4, ex * .55, ey * .55, p.rot);
      circ(P(5, p.carry), hx - p.nx * 1.2, hy - p.ny * 1.2, hr * .72);
      for (const side of [-1, 1]) circ(P(5, p.carrySkin), hx + cr * side * 2.6 * k, hy + sr * side * 2.6 * k, .9 * k);
    }
    if (s > .25) for (const side of [-1, 1]) {
      const ax = hx - p.nx * 1.2 * s + cr * side * 3.7 * k, ay = hy - p.ny * 1.2 * s + sr * side * 3.7 * k;
      circ(P(5, p.skin), ax, ay, 1.3 * k);
    }
  }
  for (let i = 0; i < 3; i++) for (const [c, p] of layers[i]) { g.fillStyle = c; g.fill(p); }
  for (const [kw, p] of strokes) { const [c, w] = kw.split('|'); g.strokeStyle = c; g.lineWidth = +w; g.lineCap = 'round'; g.stroke(p); }
  g.lineCap = 'butt';
  for (let i = 3; i < 6; i++) for (const [c, p] of layers[i]) { g.fillStyle = c; g.fill(p); }
}
// Vaste toevalsgenerator (mulberry32): zelfde getal in, zelfde publiek uit.
function seeded(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// Vlaggen van de vaste figuren en de verkoper op het looppad (elk frame).
function drawCrowdExtras(g, now) {
  const K = AR.col;
  for (const p of AR.people) if (p.flag) {
    const hx = p.x - p.nx * (2 + p.s * 2), hy = p.y - p.ny * (2 + p.s * 2), cr = Math.cos(p.rot), sr = Math.sin(p.rot);
    const tx = hx - p.nx * 13 + cr * 4, ty = hy - p.ny * 13 + sr * 4, wv = Math.sin(now * .008 + p.ph) * 1.5;
    g.strokeStyle = '#3a2410'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.stroke();
    g.fillStyle = p.flag; g.beginPath(); g.moveTo(tx, ty);
    g.quadraticCurveTo(tx + cr * 8 + p.nx * wv * 2, ty + sr * 8 + p.ny * wv * 2, tx + cr * 15 + p.nx * wv * 1.5, ty + sr * 15 + p.ny * wv * 1.5);
    g.lineTo(tx + cr * 15 + p.nx * (6 + wv * 1.5), ty + sr * 15 + p.ny * (6 + wv * 1.5));
    g.quadraticCurveTo(tx + cr * 8 + p.nx * (6 + wv * 2), ty + sr * 8 + p.ny * (6 + wv * 2), tx + p.nx * 6, ty + p.ny * 6);
    g.closePath(); g.fill(); g.strokeStyle = 'rgba(30,15,8,.6)'; g.lineWidth = .6; g.stroke();
  }
  const v = AR.vendor; if (!v) return;
  // heen en weer over een stuk looppad aan de zuidkant, met af en toe een stop
  const t = now * .00004, span = .5, th = Math.PI * .5 + Math.sin(t * TAU) * span, stop = Math.abs(Math.cos(t * TAU)) < .15;
  const [x, y] = arenaPt(th, v.T), nx = Math.cos(th) / (W.rx + v.T), ny = Math.sin(th) / (W.ry + v.T), l = Math.hypot(nx, ny), ux = nx / l, uy = ny / l;
  const dir = Math.cos(t * TAU) >= 0 ? 1 : -1, tx = -uy * dir, ty = ux * dir, step = stop ? 0 : Math.sin(now * .012) * 1.2;
  g.fillStyle = v.tunic; g.beginPath(); g.ellipse(x, y, 4, 2.6, Math.atan2(ty, tx), 0, TAU); g.fill();
  g.fillStyle = v.skin; g.beginPath(); g.arc(x + tx * .6, y + ty * .6, 2.4, 0, TAU); g.fill();
  g.fillStyle = v.tray; g.fillRect(x - ux * 6 - 3 + tx * step, y - uy * 6 - 3 + ty * step, 6, 6);   // plank met broden, richting de rijen
  g.fillStyle = mix(v.tray, '#000000', .25); for (const [a, b] of [[-1.5, -1.5], [1.5, -1.5], [0, 1.5]]) { g.beginPath(); g.arc(x - ux * 6 + a + tx * step, y - uy * 6 + b + ty * step, 1.1, 0, TAU); g.fill(); }
}

/* ---------- levend deel ---------- */
function arenaCheer() { AR.wave = performance.now(); }
// Joelen: ongeveer de helft van het publiek springt op en neer met de armen omhoog.
function arenaJeer() { AR.jeer = performance.now(); }

function drawArenaLive(g, now) {
  const A = ARENA, K = AR.col;
  let wave = null;
  if (AR.wave >= 0) {
    const prog = (now - AR.wave) / A.waveMs;
    if (prog >= 1 || prog < 0) AR.wave = -1;
    else wave = { head: -Math.PI / 2 + prog * A.waveLaps * TAU, amp: Math.min(1, prog * 8, (1 - prog) * 8) };
  }
  let jeer = 0;
  if (AR.jeer >= 0) {
    const pj = (now - AR.jeer) / 2400;
    if (pj >= 1 || pj < 0) AR.jeer = -1; else jeer = Math.min(1, pj * 6, (1 - pj) * 3);
  }
  const live = [];
  for (const p of AR.people) {
    let s = 0;
    if (p.restless) { s = Math.max(0, Math.sin(now * .0011 * p.f + p.ph)) ** 12 * .75; p.b = Math.sin(now * .005 * p.f + p.ph) * .45; }
    if (wave) s = Math.max(s, wave.amp * Math.exp(-((wrapPi(p.th - wave.head) / .32) ** 2)));
    if (jeer && (p.ph * 997) % 1 < .5) s = Math.max(s, jeer * (.3 + .45 * (Math.sin(now * .02 + p.ph * 7) * .5 + .5)));
    if (p.restless || s > .04) { p.s = s; live.push(p); }
  }
  paintPeople(g, live);
  for (const p of live) if (!p.restless) p.b = 0;
  drawCrowdExtras(g, now);

  // Warme gloed over de keizersloge, zodat je oog er vanzelf heen gaat.
  { const L = ARENA.loge, cy = -(W.ry + 4 + L.depth * .55), R = L.half * 1.5 * (1 + .03 * Math.sin(now * .004));
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = .2; g.drawImage(AR.glow, -R, cy - R * .8, 2 * R, 1.6 * R); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  drawCaesar(g, now);

  g.globalCompositeOperation = 'lighter';
  for (const t of AR.torches) {
    const f = Math.sin(now * .011 + t.ph) * .5 + Math.sin(now * .027 + t.ph * 1.7) * .3 + Math.sin(now * .053 + t.ph * 2.3) * .2;
    t.f = f; const R = 34 + 4 * f;
    g.globalAlpha = .16 + .08 * f; g.drawImage(AR.glow, t.x - R, t.y - R, 2 * R, 2 * R);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  for (const t of AR.torches) {
    const fx = t.x + Math.sin(now * .02 + t.ph) * .5, fy = t.y - .5;
    g.fillStyle = K.flame; g.beginPath(); g.arc(fx, fy, 3.1 + .6 * t.f, 0, TAU); g.fill();
    g.fillStyle = K['flame-core']; g.beginPath(); g.arc(fx + .3, fy - .3, 1.6 + .3 * t.f, 0, TAU); g.fill();
  }
}

function drawCaesar(g, now) {
  const K = AR.col, L = ARENA.loge, top = -(W.ry + 4 + L.depth), cy = top + L.depth * .5, E = 'rgba(30,15,8,.85)';
  const rr = (x, y, w, h, r, fill, edge = true, lw = .6) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (edge) { g.strokeStyle = E; g.lineWidth = lw; g.stroke(); } };
  const dot = (x, y, r, fill, edge = true, lw = .6) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = fill; g.fill(); if (edge) { g.strokeStyle = E; g.lineWidth = lw; g.stroke(); } };
  // Twee pretorianen, van bovenaf: mantel, harnas, helm met kam, rood schild (scutum) naar de arena, speer.
  for (const sx of [-1, 1]) {
    g.save(); g.translate(sx * (L.half - 13), top + L.depth * .55);
    rr(-6.5, -5, 13, 6.5, 3, mix(K.blood, K.night, .4));
    rr(-5.5, -3, 11, 5, 2.5, mix(K.iron, K.marble, .35));
    dot(0, -.6, 2.7, K.bronze);
    g.fillStyle = K.blood; g.fillRect(-.7, -3.3, 1.4, 5.4);
    rr(-5.5, 3, 11, 3.6, 1, K.blood);
    dot(0, 4.8, 1.1, K.bronze, false);
    g.strokeStyle = K.iron; g.lineWidth = 1.1; g.beginPath(); g.moveTo(sx * 7.5, -9); g.lineTo(sx * 7.5, 8); g.stroke();
    g.fillStyle = mix(K.marble, K.iron, .3); g.beginPath(); g.moveTo(sx * 7.5, 11.5); g.lineTo(sx * 7.5 - 1.5, 7.5); g.lineTo(sx * 7.5 + 1.5, 7.5); g.fill();
    g.restore();
  }
  // Caesar, van bovenaf, op mensenschaal (ARENA.caesar): troon met leuningen, purperen toga met gouden rand
  // (toga picta), armen op de leuningen, hoofd met lauwerkrans. Hij kijkt naar de speler ('car', zie fight.js).
  let dx = car.x, dy = car.y - cy; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const face = Math.atan2(dy, dx);
  const standing = !!AR.judging;   // tijdens het oordeel staat Caesar op en steekt zijn arm uit over de arena
  const purple = '#5e2148', gold = K.bronze;
  g.save(); g.translate(0, cy); const S = ARENA.caesar * (standing ? 1.1 : 1); g.scale(S, S);
  g.fillStyle = 'rgba(20,10,6,.3)'; g.beginPath(); g.ellipse(1, 2, 15, 10, 0, 0, TAU); g.fill();   // schaduw
  // troon: rugleuning van ivoor met goud, kussen, twee leuningen
  rr(-13, -11, 26, 5.5, 2.5, K.toga); g.fillStyle = gold; g.fillRect(-11, -9, 22, 1.2);
  rr(-12, -7, 24, 12, 4, mix(K.blood, K.night, .2));
  for (const sx of [-1, 1]) rr(sx * 12.5 - 2, -6, 4, 11, 1.8, K.toga);
  if (!standing) for (const sx of [-1, 1]) { dot(sx * 12.5, 3.2, 1.4, gold, false); }   // gouden knoppen op de leuningen
  // lijf in purper met gouden rand
  rr(-9, -4.8, 18, 9.5, 4.5, purple);
  g.strokeStyle = gold; g.lineWidth = .9; g.beginPath(); g.roundRect(-8, -3.8, 16, 7.5, 3.6); g.stroke();
  g.strokeStyle = K.toga; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-7, -3.5); g.lineTo(3, 4); g.stroke();   // witte plooi over de schouder
  // armen: op de leuningen, of bij het oordeel één arm ver naar voren
  for (const sx of [-1, 1]) {
    if (standing && sx > 0) continue;
    g.strokeStyle = purple; g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(sx * 8, -1); g.lineTo(sx * 11.5, 2.5); g.stroke(); g.lineCap = 'butt';
    dot(sx * 12, 3.6, 1.7, K.skin);
  }
  if (standing) {
    const reach = 13 + Math.sin(now * .012) * (AR.judging === 'thinking' ? .8 : 0);
    g.lineCap = 'round';
    g.strokeStyle = E; g.lineWidth = 4.2; g.beginPath(); g.moveTo(8, 0); g.lineTo(10, reach); g.stroke();
    g.strokeStyle = purple; g.lineWidth = 3; g.stroke();
    dot(10.2, reach + 1.6, 2.3, K.skin);
    if (AR.judging !== 'thinking') {   // de duim, naar buiten (omhoog) of naar binnen (omlaag)
      const dir = AR.judging === 'up' ? -1 : 1;
      g.strokeStyle = E; g.lineWidth = 2.2; g.beginPath(); g.moveTo(10.2, reach + 1.6); g.lineTo(13.8, reach + 1.6 + dir * 2); g.stroke();
      g.strokeStyle = K.skin; g.lineWidth = 1.3; g.stroke();
    }
    g.lineCap = 'butt';
  }
  // hoofd: draait naar de speler; neus en krans laten zien welke kant hij op kijkt
  const hx = dx * 1.2, hy = 1 + dy * .4, fx = Math.cos(face), fy = Math.sin(face);
  dot(hx - fx * .6, hy - fy * .6, 3.6, K['hair-1']);
  dot(hx + fx * .7, hy + fy * .7, 3.1, K.skin);
  dot(hx + fx * 3.3, hy + fy * 3.3, .9, mix(K.skin, '#000000', .15), false);   // neus
  g.fillStyle = K.laurel; g.strokeStyle = E; g.lineWidth = .3;
  for (let i = 0; i < 11; i++) {
    const a = face + Math.PI * .4 + i / 10 * Math.PI * 1.2;
    g.beginPath(); g.ellipse(hx + Math.cos(a) * 3.6, hy + Math.sin(a) * 3.6, 1.8, .85, a + Math.PI / 2, 0, TAU); g.fill(); g.stroke();
  }
  g.restore();
}
