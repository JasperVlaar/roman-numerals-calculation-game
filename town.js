/* ---------- De stad: straat met winkels, de arena in de verte ----------
   Tijdelijke schets in SVG, tot er een getekende achtergrond is. Je kijkt recht de straat in
   (één verdwijnpunt). Links en rechts staan de winkels, aan het eind ligt de arena.
   Klik op een winkel om naar binnen te gaan, of op de arena voor je volgende gevecht.
   Winkels en waren staan in fight.js (SHOPS, WEAPONS); dit bestand tekent en regelt de klikken. */

const TOWN = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const VB = { w: 960, h: 540 };
  const VP = { x: 480, y: 255 };          // verdwijnpunt
  const END = 400;                        // tot hier lopen de huizen; daarachter het plein en de arena
  // Plaats van de winkels op de muur (x op de linkermuur; rechts gespiegeld).
  const SPOTS = {
    smith:   { side: -1, x0: 22,  x1: 228 },
    armorer: { side: -1, x0: 258, x1: 372 },
    bowyer:  { side: 1,  x0: 22,  x1: 228 },
    stable:  { side: 1,  x0: 258, x1: 372 }
  };

  // Perspectief: een punt op de muur. x = afstand vanaf de rand (0..END), h = 0 (straat) .. 1 (dakrand).
  const floorY = x => VB.h - (VB.h - VP.y) * x / VP.x;
  const roofY = x => -80 + (VP.y + 80) * x / VP.x;
  const scaleAt = x => (floorY(x) - roofY(x)) / (VB.h + 80);
  const pt = (side, x, h) => [side < 0 ? x : VB.w - x, floorY(x) + (roofY(x) - floorY(x)) * h];
  // Iets dat recht uit de muur steekt (luifel, uithangbord): horizontaal de straat in.
  const out = (side, x, h, d) => { const [px, py] = pt(side, x, h); return [px - side * d * scaleAt(x), py]; };
  const poly = pts => pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
  const lerp = (a, b, t) => a + (b - a) * t;

  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ---------- Tekenen ---------- */
  function defs(svg) {
    const d = el('defs', {}, svg);
    d.innerHTML = `
      <linearGradient id="tSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#191117"/><stop offset=".55" stop-color="#4a1d3c"/><stop offset="1" stop-color="#8a3f52"/></linearGradient>
      <radialGradient id="tSun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f0a060" stop-opacity=".55"/><stop offset="1" stop-color="#f0a060" stop-opacity="0"/></radialGradient>
      <linearGradient id="tWallL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a3f2c"/><stop offset=".6" stop-color="#9a7550"/><stop offset="1" stop-color="#8a6a4a"/></linearGradient>
      <linearGradient id="tWallR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#523a2a"/><stop offset=".6" stop-color="#8e6c4a"/><stop offset="1" stop-color="#806246"/></linearGradient>
      <linearGradient id="tShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0f14" stop-opacity=".55"/><stop offset=".35" stop-color="#1a0f14" stop-opacity="0"/><stop offset=".8" stop-color="#1a0f14" stop-opacity="0"/><stop offset="1" stop-color="#1a0f14" stop-opacity=".35"/></linearGradient>
      <radialGradient id="tHaze" cx=".5" cy=".46" r=".5"><stop offset="0" stop-color="#f0a060" stop-opacity=".28"/><stop offset=".5" stop-color="#c06a4a" stop-opacity=".08"/><stop offset="1" stop-color="#c06a4a" stop-opacity="0"/></radialGradient>
      <linearGradient id="tAwnShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140a08" stop-opacity=".55"/><stop offset="1" stop-color="#140a08" stop-opacity="0"/></linearGradient>
      <linearGradient id="tAwnL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a0f0a" stop-opacity=".35"/><stop offset=".7" stop-color="#fff2d0" stop-opacity="0"/><stop offset="1" stop-color="#fff2d0" stop-opacity=".18"/></linearGradient>
      <linearGradient id="tAwnR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#1a0f0a" stop-opacity=".35"/><stop offset=".7" stop-color="#fff2d0" stop-opacity="0"/><stop offset="1" stop-color="#fff2d0" stop-opacity=".18"/></linearGradient>
      <radialGradient id="tLit"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#e08a3a"/></radialGradient>
      <linearGradient id="tStreet" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#8a7050"/><stop offset="1" stop-color="#c4a576"/></linearGradient>
      <linearGradient id="tArena" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6f5c46"/><stop offset=".5" stop-color="#d6c8aa"/><stop offset="1" stop-color="#6f5c46"/></linearGradient>
      <radialGradient id="tGlow"><stop offset="0" stop-color="#ffb060" stop-opacity=".7"/><stop offset=".4" stop-color="#ff8a3a" stop-opacity=".25"/><stop offset="1" stop-color="#ff7a30" stop-opacity="0"/></radialGradient>
      <radialGradient id="tForge"><stop offset="0" stop-color="#ffe0a0"/><stop offset=".35" stop-color="#f08a3a"/><stop offset="1" stop-color="#7e1f1b" stop-opacity="0"/></radialGradient>
      <radialGradient id="tVignette" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#0e090d" stop-opacity="0"/><stop offset="1" stop-color="#0e090d" stop-opacity=".7"/></radialGradient>`;
  }

  function sky(svg) {
    el('rect', { width: VB.w, height: VB.h, fill: 'url(#tSky)' }, svg);
    el('ellipse', { cx: VP.x, cy: VP.y + 10, rx: 320, ry: 150, fill: 'url(#tSun)' }, svg);
    for (let i = 0; i < 24; i++) {   // een paar sterren
      const x = (i * 397) % VB.w, y = (i * 131) % 150;
      el('circle', { cx: x, cy: y, r: i % 5 ? .8 : 1.3, fill: '#f5ead6', opacity: .25 + (i % 3) * .15 }, svg);
    }
  }

  function arena(g) {
    const x0 = 318, x1 = 642, top = 150, base = 302;
    el('path', { d: `M${x0} ${base} L${x0} ${top + 14} Q480 ${top - 10} ${x1} ${top + 14} L${x1} ${base} Z`, fill: 'url(#tArena)', stroke: '#3b2a22', 'stroke-width': 1.5 }, g);
    const tiers = [[top + 16, 206], [210, 252], [256, base - 2]];
    tiers.forEach(([y0, y1], t) => {
      el('line', { x1: x0, y1: y0 - 3, x2: x1, y2: y0 - 3, stroke: '#9c8a6c', 'stroke-width': 2 }, g);
      const n = 12, w = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        const ax = x0 + i * w + w * .22, aw = w * .56, ah = (y1 - y0) * .78, ay = y1 - ah;
        const lit = t === 2 && i % 3 === 1;
        el('path', { d: `M${ax} ${y1} V${ay + aw / 2} A${aw / 2} ${aw / 2} 0 0 1 ${ax + aw} ${ay + aw / 2} V${y1} Z`,
                     fill: lit ? '#c0603a' : '#3a1a2c', opacity: .9 }, g);
      }
    });
    for (let i = 0; i < 9; i++) {   // masten voor het zonnedoek
      const x = lerp(x0 + 12, x1 - 12, i / 8);
      el('line', { x1: x, y1: top + 6 - Math.sin(i / 8 * Math.PI) * 10, x2: x, y2: top - 12 - Math.sin(i / 8 * Math.PI) * 10, stroke: '#3b2a22', 'stroke-width': 2 }, g);
    }
    el('ellipse', { cx: 480, cy: base - 20, rx: 120, ry: 40, fill: 'url(#tGlow)' }, g);
  }

  // Vaste 'willekeur', zodat de straat er elke keer hetzelfde uitziet.
  let seed = 7; const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const yAt = t => VP.y + (VB.h - VP.y) * t;                     // t = 1 vooraan, kleiner naar achteren
  const halfW = y => VP.x * (y - VP.y) / (VB.h - VP.y);           // halve breedte van de straat op hoogte y
  function street(svg) {
    seed = 7;
    el('polygon', { points: poly([[0, VB.h], [END, floorY(END)], [VB.w - END, floorY(END)], [VB.w, VB.h]]), fill: '#7d6448' }, svg);
    // keien: rijen ronde stenen, kleiner naar achteren
    const g = el('g', {}, svg), stop = floorY(END);
    for (let t = 1; ; ) {
      const y = yAt(t); if (y < stop) break;
      const rowH = (VB.h - VP.y) * t * .055, hw = halfW(y), w = rowH * 1.5;
      for (let x = VP.x - hw - (rand() * w); x < VP.x + hw; x += w * (.9 + rand() * .3)) {
        const c = 150 + Math.floor(rand() * 45);
        el('ellipse', { cx: x + w / 2, cy: y - rowH / 2, rx: w * .46, ry: rowH * .42, fill: `rgb(${c},${Math.floor(c * .8)},${Math.floor(c * .58)})`, stroke: 'rgba(50,30,18,.55)', 'stroke-width': Math.max(.4, rowH * .06) }, g);
      }
      t -= .055 * t;
    }
    // uitgesleten spoor van de wagens in het midden en een goot
    for (const k of [-.18, .18]) el('path', { d: `M${VP.x + k * VB.w} ${VB.h} L${VP.x + k * (VB.w - 2 * END) / 2 * 1.2} ${stop}`, stroke: 'rgba(40,24,14,.35)', 'stroke-width': 7, fill: 'none' }, svg);
    // stoepen langs de huizen, met een stoeprand
    for (const side of [-1, 1]) {
      const d = 46, pts = [pt(side, 0, 0), pt(side, END, 0), out(side, END, 0, d), out(side, 0, 0, d)];
      el('polygon', { points: poly(pts), fill: '#a0835e' }, svg);
      const [a, b] = [out(side, 0, 0, d), out(side, END, 0, d)];
      el('polygon', { points: poly([a, b, [b[0], b[1] + 2], [a[0], a[1] + 14]]), fill: '#5e4836' }, svg);   // stoeprand
      for (let x = 0; x < END; x += 26) { const p1 = pt(side, x, 0), p2 = out(side, x, 0, d); el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: 'rgba(60,40,25,.3)', 'stroke-width': 1 }, svg); }
    }
    // stapstenen van stoep naar stoep, zoals in Pompeii
    for (const [t, n] of [[.8, 3]]) {
      const y = yAt(t), hw = halfW(y) * .5, rw = hw / n * .38;
      for (let k = 0; k < n; k++) {
        const x = VP.x - hw + (k + .5) * (2 * hw / n);
        el('ellipse', { cx: x, cy: y + rw * .25, rx: rw, ry: rw * .38, fill: '#4a3626' }, svg);
        el('ellipse', { cx: x, cy: y, rx: rw, ry: rw * .38, fill: '#b8a07a', stroke: '#5e4836', 'stroke-width': 1 }, svg);
      }
    }
  }

  function walls(svg) {
    seed = 21;
    const quad = (side, a, b, h0, h1) => poly([pt(side, a, h0), pt(side, b, h0), pt(side, b, h1), pt(side, a, h1)]);
    for (const side of [-1, 1]) {
      el('polygon', { points: poly([pt(side, 0, 0), pt(side, END, 0), pt(side, END, 1), pt(side, 0, 1)]), fill: side < 0 ? 'url(#tWallL)' : 'url(#tWallR)' }, svg);
      // waar de pleister eraf is: rode baksteen
      for (let k = 0; k < 7; k++) {
        const a = rand() * (END - 40), b = a + 18 + rand() * 30, h0 = .7 + rand() * .2, h1 = h0 + .04 + rand() * .05;
        el('polygon', { points: quad(side, a, b, h0, h1), fill: '#8e4a32', opacity: .55 }, svg);
        for (let r = 0; r < 3; r++) { const hh = lerp(h0, h1, (r + 1) / 4); const p1 = pt(side, a, hh), p2 = pt(side, b, hh); el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: '#5a2a1c', 'stroke-width': .8, opacity: .6 }, svg); }
      }
      // vlekken en verkleuring
      for (let k = 0; k < 10; k++) { const [x, y] = pt(side, rand() * END, .1 + rand() * .85), sc = scaleAt(Math.abs(x - (side < 0 ? 0 : VB.w))); el('ellipse', { cx: x, cy: y, rx: 18 * sc + 4, ry: 10 * sc + 3, fill: rand() < .5 ? '#3a2618' : '#d8b88a', opacity: .1 }, svg); }
      // lijst tussen de verdiepingen
      el('polygon', { points: quad(side, 0, END, .685, .705), fill: '#5e4430' }, svg);
      // ramen boven: kleine raamgaten zonder glas, met houten luiken (dicht of opengeklapt), soms een rooster, soms licht van binnen
      const wood = '#6e4a2c', woodLine = '#3e2818';
      const planks = (a, b, h0, h1) => { for (let k = 1; k < 3; k++) { const x = lerp(a, b, k / 3), p1 = pt(side, x, h0), p2 = pt(side, x, h1); el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: woodLine, 'stroke-width': .9, opacity: .8 }, svg); } };
      [[40, 85], [140, 180], [266, 292], [330, 352]].forEach(([a, b], n) => {
        const lit = (side < 0 && n === 2) || (side > 0 && n === 1), shut = (n + (side > 0)) % 3 === 0, grille = !lit && n % 2 === 1;
        const h0 = .77, h1 = .875;
        el('polygon', { points: quad(side, a - 3, b + 3, h0 - .01, h1 + .01), fill: '#b8a07a' }, svg);   // stenen omlijsting
        el('polygon', { points: quad(side, a, b, h0, h1), fill: lit ? 'url(#tLit)' : '#1e1216' }, svg);
        if (lit) el('polygon', { points: quad(side, a, b, h0, h1), fill: '#ffb050', opacity: .25, filter: 'blur(1px)' }, svg);
        if (grille) for (let k = 1; k < 4; k++) { const x = lerp(a, b, k / 4), p1 = pt(side, x, h0), p2 = pt(side, x, h1); el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: '#3a2a1e', 'stroke-width': 1.6 * scaleAt(x) + .4 }, svg); }
        const w = (b - a) / 2;
        if (shut) { el('polygon', { points: quad(side, a, b, h0, h1), fill: wood, stroke: woodLine, 'stroke-width': .8 }, svg); planks(a, b, h0, h1); }
        else for (const [p, q] of [[a - w, a - 2], [b + 2, b + w]]) { el('polygon', { points: quad(side, p, q, h0, h1), fill: wood, stroke: woodLine, 'stroke-width': .8 }, svg); planks(p, q, h0, h1); }
        el('polygon', { points: poly([pt(side, a - 4, h0 - .01), pt(side, b + 4, h0 - .01), out(side, b + 4, h0 - .01, 7), out(side, a - 4, h0 - .01, 7)]), fill: '#9a8262' }, svg);   // stenen vensterbank
        if (n % 2 === 0) { const [px, py] = out(side, (a + b) / 2, h0 - .01, 4), sc = scaleAt((a + b) / 2) * 1.6; el('rect', { x: px - 5 * sc, y: py - 7 * sc, width: 10 * sc, height: 7 * sc, fill: '#a8542e' }, svg); for (let f = 0; f < 4; f++) el('circle', { cx: px + (f - 1.5) * 3 * sc, cy: py - (8 + (f % 2) * 2) * sc, r: 2 * sc, fill: f % 2 ? '#c03a3a' : '#5f8a3a' }, svg); }
      });
      // houten balkon (maenianum) boven de voorste winkel
      const [b0, b1] = side < 0 ? [100, 210] : [70, 180];
      el('polygon', { points: poly([pt(side, b0, .69), pt(side, b1, .69), out(side, b1, .69, 34), out(side, b0, .69, 34)]), fill: '#5a3a26', stroke: '#2e1f19', 'stroke-width': 1 }, svg);
      for (let x = b0; x <= b1; x += 10) { const p1 = out(side, x, .69, 34), p2 = out(side, x, .745, 34); el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: '#3b2a1e', 'stroke-width': 1.4 * scaleAt(x) + .4 }, svg); }
      { const p1 = out(side, b0, .745, 34), p2 = out(side, b1, .745, 34); el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: '#3b2a1e', 'stroke-width': 2.5 }, svg); }
      // dakrand met pannen (imbrices)
      el('polygon', { points: poly([pt(side, 0, .965), pt(side, END, .965), out(side, END, 1, 16), out(side, 0, 1, 16)]), fill: '#a4523c', stroke: '#5a2418', 'stroke-width': 1 }, svg);
      for (let x = 4; x < END; x += 11) { const p1 = pt(side, x, .965), p2 = out(side, x, 1, 16); el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: '#6e2e1e', 'stroke-width': 1.6 * scaleAt(x) + .3 }, svg); }
      // schaduw boven en onder op de muur
      el('polygon', { points: poly([pt(side, 0, 0), pt(side, END, 0), pt(side, END, 1), pt(side, 0, 1)]), fill: 'url(#tShade)', 'pointer-events': 'none' }, svg);
      // de kopse kant aan het eind van de straat
      el('polygon', { points: poly([pt(side, END, 0), [side < 0 ? END + 10 : VB.w - END - 10, floorY(END)], [side < 0 ? END + 10 : VB.w - END - 10, roofY(END) + 6], pt(side, END, 1)]), fill: '#5a4232' }, svg);
      torch(svg, side, 243);
    }
    fountain(svg);
  }
  // Straatfontein met leeuwenkop, op de stoep tussen de wapensmid en de harnasmaker.
  function fountain(svg) {
    const x = 240, [px, py] = out(-1, x, 0, 22), s = scaleAt(x) * 3.4;
    el('rect', { x: px - 16 * s, y: py - 14 * s, width: 32 * s, height: 14 * s, rx: 2 * s, fill: '#a99474', stroke: '#4a3a2c', 'stroke-width': 1 }, svg);
    el('rect', { x: px - 14 * s, y: py - 13 * s, width: 28 * s, height: 3 * s, fill: '#5a8a9a' }, svg);
    el('rect', { x: px - 5 * s, y: py - 34 * s, width: 10 * s, height: 22 * s, fill: '#b8a07a', stroke: '#4a3a2c', 'stroke-width': 1 }, svg);
    el('circle', { cx: px, cy: py - 26 * s, r: 3.5 * s, fill: '#c9934a', stroke: '#4a3a2c', 'stroke-width': .8 }, svg);
    el('path', { d: `M${px + 2 * s} ${py - 24 * s} q${6 * s} ${2 * s} ${5 * s} ${11 * s}`, fill: 'none', stroke: '#9ad0e0', 'stroke-width': 1.6 * s, class: 'water' }, svg);
  }
  // Waslijn en vlaggetjes over de straat.
  function overhead(svg) {
    const line = (x, h, sag, items) => {
      const a = pt(-1, x, h), b = pt(1, x, h), mx = (a[0] + b[0]) / 2, my = a[1] + sag;
      el('path', { d: `M${a[0]} ${a[1]} Q${mx} ${my * 2 - a[1] - (a[1] - my) * 0} ${b[0]} ${b[1]}`, fill: 'none', stroke: '#3b2a1e', 'stroke-width': 1 }, svg);
      items.forEach(([t, w, hgt, c]) => {
        const x0 = lerp(a[0], b[0], t), y0 = lerp(a[1], b[1], t) + sag * 2 * 4 * t * (1 - t) / 2 * 1;
        el('path', { d: `M${x0} ${y0} h${w} l${-w * .1} ${hgt} h${-w * .8} Z`, fill: c, opacity: .92, class: 'cloth' }, svg);
      });
    };
    const sc = scaleAt(150);
    line(150, .9, 30 * sc, [[.22, 18 * sc * 2, 22 * sc * 2, '#ece3cf'], [.36, 14 * sc * 2, 16 * sc * 2, '#74305a'], [.6, 20 * sc * 2, 26 * sc * 2, '#d9cbb0'], [.75, 12 * sc * 2, 14 * sc * 2, '#5f6d45']]);
    const f = 330, a = pt(-1, f, .95), b = pt(1, f, .95), n = 16;   // vlaggetjes vlak voor de arena
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, sag = 14 * Math.sin(Math.PI * (t0 + .5 / n));
      const x0 = lerp(a[0], b[0], t0), x1 = lerp(a[0], b[0], t1), y = lerp(a[1], b[1], t0) + sag;
      el('path', { d: `M${x0} ${y} L${x1} ${y} L${(x0 + x1) / 2} ${y + 9}`, fill: ['#b8352c', '#d49a48', '#74305a'][k % 3] }, svg);
    }
  }

  function torch(svg, side, x) {
    const [fx, fy] = out(side, x, .55, 18), s = scaleAt(x);
    el('ellipse', { cx: fx, cy: fy, rx: 70 * s, ry: 90 * s, fill: 'url(#tGlow)' }, svg);
    const [lx, ly] = out(side, x, 0, 60);
    el('ellipse', { cx: lx, cy: ly, rx: 120 * s, ry: 30 * s, fill: 'url(#tGlow)', opacity: .7 }, svg);
    const [bx, by] = pt(side, x, .5);
    el('line', { x1: bx, y1: by, x2: fx, y2: fy + 6 * s, stroke: '#3b3034', 'stroke-width': 3 * s }, svg);
    el('path', { d: `M${fx} ${fy - 16 * s} C${fx + 7 * s} ${fy - 6 * s} ${fx + 6 * s} ${fy + 2 * s} ${fx} ${fy + 4 * s} C${fx - 6 * s} ${fy + 2 * s} ${fx - 7 * s} ${fy - 6 * s} ${fx} ${fy - 16 * s} Z`, fill: '#f08a3a', class: 'flame' }, svg);
  }

  // Spullen op straat voor de winkels: amforen, tonnen, hooi, een schietschijf. far = achter de voorste winkels.
  function props(svg, layer) {
    const g = el('g', { 'pointer-events': 'none' }, svg);
    const at = (side, x, d) => { const [px, py] = out(side, x, 0, d); return [px, py, scaleAt(x) * 2.2]; };
    const amphora = (side, x, d, c = '#b0643a') => { const [px, py, s] = at(side, x, d);
      el('path', { d: `M${px - 5 * s} ${py - 26 * s} h${10 * s} l${-1 * s} ${4 * s} q${9 * s} ${6 * s} ${4 * s} ${18 * s} l${-3 * s} ${4 * s} l${-3 * s} 0 l${-3 * s} ${-4 * s} q${-5 * s} ${-12 * s} ${4 * s} ${-18 * s} Z`, fill: c, stroke: '#2e1f19', 'stroke-width': 1 }, g); };
    const barrel = (side, x, d) => { const [px, py, s] = at(side, x, d), w = 16 * s, h = 22 * s;
      el('rect', { x: px - w / 2, y: py - h, width: w, height: h, rx: 4 * s, fill: '#7a5230', stroke: '#2e1f19', 'stroke-width': 1 }, g);
      for (const k of [.25, .75]) el('line', { x1: px - w / 2, y1: py - h * k, x2: px + w / 2, y2: py - h * k, stroke: '#3b3034', 'stroke-width': 1.6 * s }, g); };
    const hay = (side, x, d) => { const [px, py, s] = at(side, x, d);
      el('path', { d: `M${px - 20 * s} ${py} q${4 * s} ${-18 * s} ${20 * s} ${-18 * s} q${16 * s} 0 ${20 * s} ${18 * s} Z`, fill: '#d9b860', stroke: '#8a6a2e', 'stroke-width': 1 }, g); };
    const target = (side, x, d) => { const [px, py, s] = at(side, x, d), r = 11 * s;
      el('line', { x1: px, y1: py, x2: px, y2: py - 30 * s, stroke: '#5a3a26', 'stroke-width': 2 * s }, g);
      for (const [k, c] of [[1, '#ece3cf'], [.66, '#8e1f1a'], [.33, '#ece3cf']]) el('circle', { cx: px, cy: py - 30 * s, r: r * k, fill: c, stroke: '#2e1f19', 'stroke-width': .8 }, g); };
    if (layer === 'far') {
      barrel(-1, 380, 18); barrel(-1, 392, 30);          // harnasmaker
      hay(1, 385, 24);                                   // stallen
    } else {
      amphora(-1, 40, 30); amphora(-1, 62, 22, '#9a4a3a'); barrel(-1, 215, 26);   // wapensmid
      target(1, 60, 40); barrel(1, 215, 24);                                      // boogmaker
    }
  }
  // Een winkel: open voorkant (of luiken), luifel met strepen, uithangbord dat de straat in steekt.
  function shop(svg, id) {
    const def = SHOPS[id], sp = SPOTS[id], side = sp.side, open = shopOpen(id);
    const g = el('g', { class: 'hot' + (open ? '' : ' closed'), 'data-id': id }, svg);
    const xa = sp.x0 + 8, xb = sp.x1 - 8;
    const Q = (u, v) => pt(side, lerp(xa, xb, u), v * .5);   // punt in de winkelopening (v 0..1 = straat..luifel)
    // gevel om de opening
    el('polygon', { points: poly([pt(side, sp.x0, 0), pt(side, sp.x1, 0), pt(side, sp.x1, .66), pt(side, sp.x0, .66)]), fill: '#5a463a', stroke: '#2e1f19', 'stroke-width': 1.2 }, g);
    el('polygon', { points: poly([Q(0, 0), Q(1, 0), Q(1, 1), Q(0, 1)]), fill: '#22141a' }, g);
    if (open && contents[id]) contents[id](g, Q, side, scaleAt((xa + xb) / 2));
    else if (open) el('polygon', { points: poly([Q(0, 0), Q(1, 0), Q(1, 1), Q(0, 1)]), fill: '#3a2420' }, g);
    else shutters(g, Q);
    awning(g, id, sp, side);
    // uithangbord, haaks op de muur: recht naar je toe, dus goed leesbaar
    const xs = lerp(sp.x0, sp.x1, side < 0 ? .78 : .78), s = Math.max(.55, scaleAt(xs)), [ax, ay] = out(side, xs, .8, 46);
    const w = 168 * s, h = 54 * s, x = ax - w / 2, y = ay - h / 2;
    el('line', { x1: pt(side, xs, .8)[0], y1: ay - h / 2 - 4 * s, x2: ax, y2: ay - h / 2 - 4 * s, stroke: '#3b3034', 'stroke-width': 3 * s }, g);
    el('line', { x1: x + 12 * s, y1: y - 4 * s, x2: x + 12 * s, y2: y, stroke: '#3b3034', 'stroke-width': 1.5 }, g);
    el('line', { x1: x + w - 12 * s, y1: y - 4 * s, x2: x + w - 12 * s, y2: y, stroke: '#3b3034', 'stroke-width': 1.5 }, g);
    el('rect', { x, y, width: w, height: h, rx: 4 * s, fill: open ? '#3a2a1e' : '#2e2420', stroke: open ? '#d49a48' : '#6d6458', 'stroke-width': 2.2 * s, class: 'sign' }, g);
    const t1 = el('text', { x: ax, y: y + h * .45, 'text-anchor': 'middle', 'font-family': 'Cinzel, Georgia, serif', 'font-weight': 700, 'font-size': 19 * s, 'letter-spacing': 2 * s, fill: open ? '#e2b35e' : '#8d8172' }, g);
    t1.textContent = def.nl.toUpperCase();
    const t2 = el('text', { x: ax, y: y + h * .8, 'text-anchor': 'middle', 'font-family': 'Alegreya Sans, sans-serif', 'font-size': 13 * s, fill: open ? '#f5ead6' : '#8d8172' }, g);
    t2.textContent = open ? '' : def.after ? `na toernooi ${toRoman(def.after)}` : '';
    if (open) t1.setAttribute('y', y + h * .62);   // één regel: midden op het bord
    // klikvlak: gevel, luifel en bord samen
    const hit = el('polygon', { class: 'hl', points: poly([pt(side, sp.x0, 0), pt(side, sp.x1, 0), out(side, sp.x1, .54, 70), [side < 0 ? x + w : x, y], [side < 0 ? x : x + w, y], pt(side, sp.x0, .66)]) }, g);
    g.insertBefore(hit, g.firstChild);
    el('title', {}, g).textContent = open ? `${def.nl} (${def.la})` : `${def.nl}: nog dicht`;
    if (open) { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', `${def.nl} binnengaan`); }
    return g;
  }

  // Luifel (velum) van gestreept zeildoek: hangt iets door, met een geschulpte zoom,
  // een houten lat aan de voorkant, touwen naar de muur en schaduw op de gevel eronder.
  function awning(g, id, sp, side) {
    const [c1, c2] = { smith: ['#9a4a3a', '#e6d7b8'], armorer: ['#5f6d45', '#e6d7b8'], bowyer: ['#74305a', '#e6d7b8'], stable: ['#c08a3e', '#6a4630'] }[id];
    const n = 7, s = scaleAt((sp.x0 + sp.x1) / 2), D = 70, hb = .62, hf = .54, sag = 5 * s, flap = 11 * s;
    el('polygon', { points: poly([pt(side, sp.x0, hb), pt(side, sp.x1, hb), pt(side, sp.x1, hb - .14), pt(side, sp.x0, hb - .14)]), fill: 'url(#tAwnShade)' }, g);   // schaduw op de gevel
    // de voorrand: één doorlopende, licht doorhangende lijn over alle banen
    const F = t => { const [ax, ay] = out(side, lerp(sp.x0, sp.x1, t), hf, D); return [ax, ay + sag * Math.sin(Math.PI * ((t * n) % 1)) + sag * .6 * Math.sin(Math.PI * t)]; };
    const B = t => pt(side, lerp(sp.x0, sp.x1, t), hb);
    const edge = (t0, t1, k = 6) => Array.from({ length: k + 1 }, (_, m) => F(lerp(t0, t1, m / k)).map(v => v.toFixed(1)).join(',')).join(' L');
    const all = el('g', {}, g);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, col = i % 2 ? c2 : c1, [b0, b1] = [B(t0), B(t1)];
      el('path', { d: `M${b0} L${b1} L${edge(t1, t0)} Z`, fill: col, stroke: 'rgba(30,15,8,.35)', 'stroke-width': .6 }, all);
      // naad in het midden van de baan en een plooi
      const m = (t0 + t1) / 2, bm = B(m), fm = F(m);
      el('line', { x1: bm[0], y1: bm[1], x2: fm[0], y2: fm[1], stroke: 'rgba(30,15,8,.18)', 'stroke-width': .8 }, all);
      // geschulpte zoom die naar beneden hangt
      const [e0, e1] = [F(t0), F(t1)], mid = F(m);
      el('path', { d: `M${edge(t0, t1, 4)} L${e1[0]} ${e1[1] + flap * .55} Q${mid[0]} ${mid[1] + flap * 1.4} ${e0[0]} ${e0[1] + flap * .55} Z`, fill: col, stroke: 'rgba(30,15,8,.5)', 'stroke-width': .7 }, all);
      el('path', { d: `M${e1[0]} ${e1[1] + flap * .55} Q${mid[0]} ${mid[1] + flap * 1.4} ${e0[0]} ${e0[1] + flap * .55}`, fill: 'none', stroke: i % 2 ? c1 : c2, 'stroke-width': 1.6 * s + .3, opacity: .9 }, all);   // biesje
      el('circle', { cx: e0[0], cy: e0[1] + flap * .62, r: 1.6 * s + .4, fill: '#d49a48' }, all);   // kwastje op elke punt
    }
    el('polygon', { points: poly([B(0), B(1), F(1), F(0)]), fill: side < 0 ? 'url(#tAwnL)' : 'url(#tAwnR)', 'pointer-events': 'none' }, all);   // licht van voren
    el('path', { d: `M${B(0)} L${B(1)}`, stroke: '#3e2818', 'stroke-width': 3 * s + 1 }, all);   // houten lat tegen de muur
    el('path', { d: `M${edge(0, 1, 28)}`, fill: 'none', stroke: '#4a3020', 'stroke-width': 1.6 * s + .6, 'stroke-linejoin': 'round' }, all);   // voorkant
    for (const t of [0, 1]) { const w = pt(side, lerp(sp.x0, sp.x1, t), .7), f = F(t); el('line', { x1: w[0], y1: w[1], x2: f[0], y2: f[1], stroke: '#2e1f15', 'stroke-width': 1.1 }, all); el('circle', { cx: w[0], cy: w[1], r: 1.6 * s + .5, fill: '#3b3034' }, all); }   // touwen naar ijzeren ogen in de muur
  }

  function shutters(g, Q) {
    el('polygon', { points: poly([Q(0, 0), Q(1, 0), Q(1, .95), Q(0, .95)]), fill: '#5a3a26' }, g);
    for (let i = 1; i < 8; i++) el('line', { x1: Q(i / 8, 0)[0], y1: Q(i / 8, 0)[1], x2: Q(i / 8, .95)[0], y2: Q(i / 8, .95)[1], stroke: '#3a2416', 'stroke-width': 1.2 }, g);
    const a = Q(0, .45), b = Q(1, .45);
    el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#3b3034', 'stroke-width': 2.5 }, g);   // dwarsbalk
  }

  // Wat je in een open winkel ziet.
  const contents = {
    bowyer(g, Q, side, s) {
      // bogen aan de muur, een paar pijlkokers eronder
      for (let i = 0; i < 4; i++) {
        const [x, y] = Q(.15 + i * .2, .62), r = 20 * s;
        el('path', { d: `M${x} ${y - r} Q${x + r * .7 * side * -1} ${y} ${x} ${y + r}`, fill: 'none', stroke: i % 2 ? '#2a1a12' : '#6b4526', 'stroke-width': 2.4 * s }, g);
        el('line', { x1: x, y1: y - r, x2: x, y2: y + r, stroke: '#ece3cf', 'stroke-width': .8 }, g);
      }
      for (let i = 0; i < 3; i++) {
        const [x, y] = Q(.25 + i * .25, .12), w = 6 * s, h = 18 * s;
        el('rect', { x: x - w / 2, y: y - h, width: w, height: h, fill: '#5a3a26', stroke: '#2e1f19', 'stroke-width': 1 }, g);
        for (let k = -1; k <= 1; k++) el('line', { x1: x + k * w * .25, y1: y - h, x2: x + k * w * .3, y2: y - h - 6 * s, stroke: '#8e1f1a', 'stroke-width': 1.4 * s }, g);
      }
    },
    stable(g, Q, side, s) {
      // halfhoge staldeuren met twee paardenhoofden erboven
      el('polygon', { points: poly([Q(0, 0), Q(1, 0), Q(1, .45), Q(0, .45)]), fill: '#6b4526' }, g);
      for (let i = 1; i < 6; i++) el('line', { x1: Q(i / 6, 0)[0], y1: Q(i / 6, 0)[1], x2: Q(i / 6, .45)[0], y2: Q(i / 6, .45)[1], stroke: '#3a2416', 'stroke-width': 1 }, g);
      for (let i = 0; i < 2; i++) {
        const [x, y] = Q(.3 + i * .4, .62), r = 11 * s;
        el('ellipse', { cx: x, cy: y, rx: r * .7, ry: r, fill: i ? '#3a271c' : '#5a3a26', stroke: '#1e140f', 'stroke-width': 1 }, g);
        el('ellipse', { cx: x, cy: y + r * .8, rx: r * .45, ry: r * .4, fill: i ? '#2a1a12' : '#4a2e1e' }, g);
        el('path', { d: `M${x - r * .4} ${y - r * .8} l${-r * .15} ${-r * .5} l${r * .35} ${r * .25} Z M${x + r * .4} ${y - r * .8} l${r * .15} ${-r * .5} l${-r * .35} ${r * .25} Z`, fill: i ? '#3a271c' : '#5a3a26' }, g);
      }
    },
    armorer(g, Q, side, s) {
      // rij schilden aan de muur, twee harnassen op een standaard
      for (let i = 0; i < 3; i++) {
        const [x, y] = Q(.18 + i * .26, .68), r = 15 * s;
        el('ellipse', { cx: x, cy: y, rx: r * .75, ry: r, fill: i === 1 ? '#8e1f1a' : '#9a7a3a', stroke: '#2e1f19', 'stroke-width': 1 }, g);
        el('circle', { cx: x, cy: y, r: r * .22, fill: '#d49a48' }, g);
      }
      for (let i = 0; i < 2; i++) {
        const [x, y] = Q(.3 + i * .4, .25), w = 15 * s, h = 22 * s;
        el('line', { x1: x, y1: y + h * .5, x2: x, y2: Q(.3 + i * .4, 0)[1], stroke: '#3b2a1e', 'stroke-width': 2 * s }, g);
        el('path', { d: `M${x - w / 2} ${y - h / 2} Q${x} ${y - h * .7} ${x + w / 2} ${y - h / 2} L${x + w * .4} ${y + h / 2} L${x - w * .4} ${y + h / 2} Z`, fill: i ? '#8f8a80' : '#7a5230', stroke: '#2e1f19', 'stroke-width': 1 }, g);
        if (i) for (let k = 1; k < 4; k++) el('line', { x1: x - w * .45, y1: y - h / 2 + k * h / 4, x2: x + w * .45, y2: y - h / 2 + k * h / 4, stroke: '#5c5a62', 'stroke-width': 1.2 }, g);
      }
    },
    smith(g, Q, side, s) {
      const [fx, fy] = Q(.28, .22);
      el('ellipse', { cx: fx, cy: fy, rx: 70 * s, ry: 55 * s, fill: 'url(#tForge)', class: 'forge' }, g);
      el('polygon', { points: poly([Q(.12, .02), Q(.44, .02), Q(.4, .2), Q(.16, .2)]), fill: '#3b3034' }, g);   // haard
      // aambeeld
      el('polygon', { points: poly([Q(.5, 0), Q(.6, 0), Q(.58, .12), Q(.52, .12)]), fill: '#2a2226' }, g);
      el('polygon', { points: poly([Q(.46, .12), Q(.66, .12), Q(.64, .2), Q(.48, .2)]), fill: '#4a4044', stroke: '#1a1416', 'stroke-width': 1 }, g);
      // rek met zwaarden en speren
      for (let i = 0; i < 5; i++) {
        const u = .72 + i * .055, [x0, y0] = Q(u, .08), [x1, y1] = Q(u, .82 - (i % 2) * .12);
        el('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: i % 2 ? '#6b4526' : '#d6d1c4', 'stroke-width': (i % 2 ? 2.2 : 3) * s }, g);
        if (!(i % 2)) { const [gx, gy] = Q(u, .3); el('line', { x1: gx - 6 * s, y1: gy, x2: gx + 6 * s, y2: gy, stroke: '#d49a48', 'stroke-width': 2.4 * s }, g); }
      }
      const [r0x, r0y] = Q(.69, .55), [r1x, r1y] = Q(.98, .55);
      el('line', { x1: r0x, y1: r0y, x2: r1x, y2: r1y, stroke: '#5a3a26', 'stroke-width': 3 * s }, g);
    }
  };

  // De arena aan het eind van de straat: daar ga je heen voor het volgende gevecht.
  function arenaSpot(svg) {
    const g = el('g', { class: 'hot arena-hot', tabindex: 0, role: 'button', 'data-id': 'arena' }, svg);
    el('rect', { class: 'hl', x: 312, y: 88, width: 336, height: 220, rx: 10 }, g);
    arena(g);
    const due = !fightOpen();   // 5 gevechten gehad: nu moet het toernooi
    const w = 170, h = 50, x = 480 - w / 2, y = 92;
    el('rect', { x, y, width: w, height: h, rx: 6, fill: due ? '#4a1512' : '#3a2a1e', stroke: due ? '#d4463b' : '#d49a48', 'stroke-width': 2.2, class: 'sign' }, g);
    const t1 = el('text', { x: 480, y: y + 32, 'text-anchor': 'middle', 'font-family': 'Cinzel, Georgia, serif', 'font-weight': 700, 'font-size': 20, 'letter-spacing': 4, fill: '#e2b35e' }, g);
    t1.textContent = 'ARENA';
    const sub = due ? `Toernooi ${toRoman(S.stage + 1)}` : fightLabel();
    g.setAttribute('aria-label', `Naar de arena: ${sub}`);
    el('title', {}, g).textContent = sub;
  }
  // Het eerstvolgende gewone gevecht (of de herkansing).
  function fightLabel() {
    const retry = S.over === 'lost' && S.mode === 'fight';
    return `Gevecht ${toRoman(fightNumber())}${retry ? ' (opnieuw)' : S.finished ? ' (herhaling)' : ''}`;
  }
  // Voortgang in dit blok: één bolletje per gewonnen gevecht.
  function pips() {
    const n = stageOf().fights.length;
    return `<span class="pips">${Array.from({ length: n }, (_, i) => `<i class="${S.finished || i < S.inStage ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  /* ---------- De keuze in de arena ---------- */
  function openPick() {
    const box = $('choices'); box.innerHTML = '';
    const st = stageOf(), n = st.fights.length;
    // Gewoon gevecht
    if (fightOpen()) {
      const f = st.fights[fightIdx()], fine = Math.round(f.reward * MONEY.lossShare);
      box.appendChild(card({
        title: fightLabel(),
        lines: [listSummary(swarmOf(f.foes)), `${f.reward} d ${pips()}`],
        cls: f.kind === 'boss' ? 'boss' : '', go: () => go('fight')
      }));
    } else {
      box.appendChild(card({
        title: `Gevecht ${toRoman(fightNumber() + 1)}`,
        lines: [pips()],
        locked: true
      }));
    }
    // Toernooi
    if (S.finished) {
      box.appendChild(card({ title: 'Toernooi', lines: [], locked: true }));
    } else {
      const t = st.tourney, boss = roundsOf(t).at(-1);
      const retry = S.over === 'lost' && S.mode === 'tournament', early = S.inStage < n;
      box.appendChild(card({
        title: `Toernooi ${toRoman(S.stage + 1)}${retry ? ' (opnieuw)' : ''}`,
        lines: [`${toRoman(t.rounds.length)} rondes · ${listSummary(boss)}`, `${t.reward} d`],
        cls: 'deadly', go: () => go('tournament')
      }));
    }
    $('pick').hidden = false;
    const first = box.querySelector('button:not(:disabled)'); if (first) first.focus();
  }
  function card({ title, lines, cls = '', locked = false, go }) {
    const b = document.createElement('button');
    b.className = `choice ${cls}${locked ? ' locked' : ''}`; b.disabled = locked;
    b.innerHTML = `<b>${title}</b>${lines.map(l => `<span>${l}</span>`).join('')}`;
    if (go) b.onclick = go;
    return b;
  }
  $('pickBack').onclick = () => { $('pick').hidden = true; };
  function go(mode) {
    $('pick').hidden = true; $('town').hidden = true; $('shop').hidden = true;
    SFX.mood('calm'); SFX.town(null); cat.reset(); chooseArena(mode);
  }

  /* ---------- De kat ----------
     Zit op straat. Klik: hij rolt op zijn rug en spint. Een tijdje na de laatste aai komt hij weer overeind (en miauwt soms). */
  const cat = (() => {
    const CAT = { x: 610, y: 470, s: 1.15, purr: 6 };   // plek (rechts op straat) en hoe lang hij blijft liggen na een aai
    let g = null, back = false, timer = 0;
    function draw(svg) {
      g = el('g', { class: 'cat', tabindex: 0, role: 'button', 'aria-label': 'Aai de kat' }, svg);
      el('title', {}, g).textContent = 'Aai de kat';
      pose(); g.addEventListener('click', pet);
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pet(); } });
    }
    // Rode cyperse kat, getekend rond zijn voeten (0,0) en dan verplaatst en geschaald naar zijn plek.
    function pose() {
      [...g.querySelectorAll(':scope > :not(title)')].forEach(n => n.remove());
      const fur = '#c4733a', dark = '#7e3f1c', light = '#f2dfc2', pink = '#e39a92', eye = '#cfd650',
            line = { stroke: '#3a1f12', 'stroke-width': 1.1, 'stroke-linejoin': 'round' },
            c = el('g', { transform: `translate(${CAT.x} ${CAT.y}) scale(${CAT.s})` }, g),
            stripe = (d, w = 1.8) => el('path', { d, fill: 'none', stroke: dark, 'stroke-width': w, 'stroke-linecap': 'round' }, c),
            whiskers = (x, y, dir) => { for (const dy of [-2, 0, 2.2]) el('path', { d: `M${x} ${y} q${dir * 6} ${dy - 1} ${dir * 12} ${dy * 1.6}`, fill: 'none', stroke: '#fff6e6', 'stroke-width': .55, opacity: .85 }, c); };
      el('ellipse', { cx: 3, cy: 1.5, rx: back ? 34 : 26, ry: 5.5, fill: 'rgba(30,15,8,.32)' }, c);   // schaduw
      if (!back) {   // zittend, driekwart naar links
        // staart om de pootjes heen, het puntje zwiept
        el('path', { d: 'M15 -3 C30 -2 30 6 14 5 C4 4.5 -6 4 -12 2', fill: 'none', stroke: fur, 'stroke-width': 5.5, 'stroke-linecap': 'round' }, c);
        stripe('M22 3 l1 -4 M17 5 l0 -4.5 M10 4.6 l0 -4', 1.5);
        el('path', { d: 'M-12 2 q-5 -1 -7 -5', fill: 'none', stroke: dark, 'stroke-width': 5, 'stroke-linecap': 'round', class: 'cat-tail' }, c);
        // lijf: peervorm, achterpoot als bolling
        el('path', { d: 'M-8 -1 C-13 -14 -10 -29 1 -32 C13 -35 23 -22 21 -6 C20 0 12 2 3 1.5 C-2 1.3 -6 .5 -8 -1 Z', fill: fur, ...line }, c);
        el('path', { d: 'M6 -1 C4 -10 9 -16 15 -15 C21 -13 22 -5 18 0', fill: 'none', stroke: dark, 'stroke-width': 1, opacity: .6 }, c);
        stripe('M8 -29 q5 3 5 9 M14 -27 q4 4 4 10 M18 -19 q2 3 1 7');
        el('ellipse', { cx: -5, cy: -15, rx: 6.5, ry: 10, fill: light }, c);   // witte bef
        // voorpootjes met witte sokjes
        for (const x of [-9, -2]) { el('path', { d: `M${x} -15 L${x - .5} -1`, stroke: fur, 'stroke-width': 5, 'stroke-linecap': 'round' }, c); el('ellipse', { cx: x - .5, cy: -.6, rx: 3.4, ry: 2, fill: light, ...line, 'stroke-width': .7 }, c); }
        // kop
        el('path', { d: 'M-17 -44 L-15.5 -56 L-8 -48 Z M-4 -48.5 L2 -57 L4 -45 Z', fill: fur, ...line }, c);
        el('path', { d: 'M-15.3 -46 L-14.6 -53 L-10 -48.5 Z M-2.6 -48 L1.4 -53.5 L2.6 -46.5 Z', fill: pink }, c);
        el('path', { d: 'M-18 -40 C-18 -49 -11 -51 -6.5 -51 C-1 -51 5 -48 5 -40 C5 -34 0 -30.5 -6.5 -30.5 C-13 -30.5 -18 -34 -18 -40 Z', fill: fur, ...line }, c);
        stripe('M-9.5 -50 l.8 4 M-6.5 -50.5 l0 4.5 M-3.5 -50 l-.8 4', 1.3);
        stripe('M-18 -39 l3 .6 M4.8 -39 l-3 .6', 1.2);
        el('ellipse', { cx: -6.5, cy: -34.8, rx: 6, ry: 4, fill: light }, c);   // snoet
        const eyes = el('g', { class: 'cat-eyes' }, c);
        for (const x of [-11, -2]) { el('ellipse', { cx: x, cy: -41.5, rx: 2.5, ry: 2.8, fill: eye, stroke: '#3a1f12', 'stroke-width': .6 }, eyes); el('ellipse', { cx: x, cy: -41.5, rx: .75, ry: 2.2, fill: '#1a0f0a' }, eyes); el('circle', { cx: x + .8, cy: -42.6, r: .55, fill: '#fff' }, eyes); }
        el('path', { d: 'M-8 -37.6 h3 l-1.5 1.9 Z', fill: pink, stroke: '#7a3a30', 'stroke-width': .4 }, c);
        el('path', { d: 'M-6.5 -35.7 v1.2 q-1.2 1.2 -2.4 .3 M-6.5 -34.5 q1.2 1.2 2.4 .3', fill: 'none', stroke: '#5a2e1c', 'stroke-width': .6 }, c);
        whiskers(-10, -35, -1); whiskers(-3, -35, 1);
      } else {   // op zijn rug, pootjes in de lucht, buikje bloot
        el('path', { d: 'M20 -6 C32 -4 36 4 28 7 C24 8 21 6 22 3', fill: 'none', stroke: fur, 'stroke-width': 5, 'stroke-linecap': 'round', class: 'cat-tail' }, c);
        el('path', { d: 'M24 5.6 C21 6 21 4.5 22 3', fill: 'none', stroke: dark, 'stroke-width': 5, 'stroke-linecap': 'round' }, c);
        // pootjes omhoog, met roze kussentjes
        for (const [x, dx, h] of [[-12, -3, 14], [-5, -1, 16], [8, 2, 15], [15, 4, 12]]) {
          el('path', { d: `M${x} -12 q${dx} ${-h / 2} ${dx * 1.6} ${-h}`, fill: 'none', stroke: fur, 'stroke-width': 5, 'stroke-linecap': 'round' }, c);
          el('circle', { cx: x + dx * 1.6, cy: -12 - h, r: 2.9, fill: light, ...line, 'stroke-width': .6 }, c);
          el('circle', { cx: x + dx * 1.6, cy: -12 - h - .8, r: 1, fill: pink }, c);
        }
        el('ellipse', { cx: 0, cy: -8, rx: 22, ry: 10, fill: fur, ...line }, c);
        stripe('M-12 -1 q2 -3 0 -5 M-4 1 q2 -3 0 -5 M5 1 q2 -3 0 -5 M13 -1 q2 -3 0 -5');
        el('ellipse', { cx: 1, cy: -12, rx: 15, ry: 5.8, fill: light }, c);   // buik
        // kop, ondersteboven naar links
        el('path', { d: 'M-30 -2 L-40 0 L-34 -7 Z M-31 -13 L-40 -17 L-33 -19.5 Z', fill: fur, ...line }, c);
        el('path', { d: 'M-31.5 -3 L-37.5 -1.3 L-34 -5.6 Z M-32 -13.5 L-37.6 -16.3 L-33.5 -17.8 Z', fill: pink }, c);
        el('circle', { cx: -25, cy: -9, r: 9.5, fill: fur, ...line }, c);
        stripe('M-32 -11 l3 0 M-32 -8 l3.2 0 M-32 -5 l3 0', 1.2);
        el('ellipse', { cx: -20, cy: -9, rx: 4, ry: 5.5, fill: light }, c);
        el('path', { d: 'M-26 -13.5 q-1.5 1.8 0 3.6 M-26 -7.5 q-1.5 1.8 0 3.6', fill: 'none', stroke: '#3a1f12', 'stroke-width': .9, 'stroke-linecap': 'round' }, c);   // oogjes dicht
        el('path', { d: 'M-17.6 -10.4 v3 l1.8 -1.5 Z', fill: pink }, c);
        whiskers(-19, -12, 1); whiskers(-19, -6, 1);
      }
    }
    function pet() {
      if (!back) { back = true; pose(); SFX.purr(true); }
      g.classList.remove('petted'); void g.getBBox(); g.classList.add('petted');
      clearTimeout(timer);
      timer = setTimeout(() => { back = false; if (g && g.isConnected) pose(); SFX.purr(false); if (Math.random() < .5) SFX.meow(); }, CAT.purr * 1000);
    }
    // Op straat miauwt hij af en toe: de eerste keer na een paar seconden, daarna elke 15–35 s.
    let meowT = 0;
    function listen() {
      clearTimeout(meowT);
      const next = (wait) => { meowT = setTimeout(() => { if ($('town').hidden) return; if (!back) SFX.meow(); next(15 + Math.random() * 20); }, wait * 1000); };
      next(2 + Math.random() * 3);
    }
    function reset() { clearTimeout(timer); clearTimeout(meowT); if (back) SFX.purr(false); back = false; }
    return { draw, reset, listen };
  })();

  function render() {
    const host = $('townArt'); host.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${VB.w} ${VB.h}`, class: 'town-svg', role: 'group', 'aria-label': 'De straat naar de arena' }, host);
    defs(svg); sky(svg);
    arenaSpot(svg);
    street(svg); walls(svg);
    props(svg, 'far');
    for (const id of ['armorer', 'stable', 'smith', 'bowyer']) shop(svg, id);   // achterste eerst
    props(svg, 'near');
    overhead(svg);
    el('rect', { width: VB.w, height: VB.h, fill: 'url(#tHaze)', 'pointer-events': 'none' }, svg);
    cat.draw(svg);
    el('rect', { width: VB.w, height: VB.h, fill: 'url(#tVignette)', 'pointer-events': 'none' }, svg);
    svg.querySelectorAll('.hot:not(.closed)').forEach(g => {
      const go = () => g.dataset.id === 'arena' ? openPick() : openShop(g.dataset.id);
      g.addEventListener('click', go);
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
    });
    purse();
  }
  function purse() {
    $('townMoney').textContent = S.money;

    const b = $('townStats');
    b.textContent = S.points ? `Stats · ${toRoman(S.points)}` : 'Stats';
    b.classList.toggle('has-points', S.points > 0);
  }
  $('townStats').onclick = () => openStats('town');

  /* ---------- Winkel: de toonbank ---------- */
  let current = null;
  function openShop(id) {
    current = id; $('shopScene').innerHTML = SHOPART.scene(id); renderShop(); $('shop').hidden = false; $('shopBack').focus();
    SFX.town(id);
  }
  function renderShop() {
    const def = SHOPS[current];
    $('shopEyebrow').textContent = def.nl;
    $('shopMoney').textContent = `${S.money} d`;
    const list = $('wares'); list.innerHTML = '';
    for (const key of def.wares) {
      if (key === 'arrows') { list.appendChild(arrowRow()); continue; }
      const isGear = !!GEAR[key], it = isGear ? GEAR[key] : WEAPONS[key], owned = isGear && S.owned.includes(key);
      const worn = isGear && S.gear[it.slot] === key, rich = S.money >= it.price;
      const have = S.arms.filter(k => k === key).length, full = !isGear && S.arms.filter(k => k !== 'fists').length >= CHAOS.maxArms;
      let info, cmp;
      if (isGear) {
        const cur = S.gear[it.slot];
        info = it.short; cmp = '';
      } else if (it.kind === 'bow') {
        info = `${fmt(dmgOf(key))} schade · bereik ${it.range} · ${fmt(Math.round(cdOf(key) * 100) / 100)} s`; cmp = have ? `×${have}` : '';
      } else {
        info = `${fmt(dmgOf(key))} schade · bereik ${it.reach} · ${fmt(Math.round(cdOf(key) * 100) / 100)} s`; cmp = have ? `×${have}` : '';
      }
      // kan het samen met wat je nu hebt?
      const clash = isGear && it.needsBow && !S.arms.some(isBow) ? 'koop eerst een boog' : full ? 'vol' : '';
      const li = document.createElement('li');
      li.innerHTML = `${SHOPART.icon(key)}<div><b>${it.name}</b><span>${info}${cmp ? ` <i class="eff">${cmp}</i>` : ''}</span></div>`;
      if (worn) li.classList.add('worn');
      const b = document.createElement('button'); b.className = 'btn';
      if (worn && key === 'quiver') { b.textContent = '✓'; b.disabled = true; }   // afdoen zou pijlen kosten
      else if (worn && isGear) { b.textContent = 'Doe af'; b.onclick = () => { S.gear[it.slot] = null; changed(); }; }
      else if (worn) { b.textContent = '✓'; b.disabled = true; }
      else if (owned && clash) { b.textContent = 'Doe aan'; b.disabled = true; b.title = clash; }
      else if (owned) { b.textContent = isGear ? 'Doe aan' : 'Neem mee'; b.onclick = () => equip(key); }
      else { b.textContent = `${it.price} d`; b.disabled = !rich || !!clash; if (clash) b.title = clash; b.setAttribute('aria-label', `${it.name} kopen voor ${it.price} denarii`); b.onclick = () => buy(key); }
      li.appendChild(b); list.appendChild(li);
    }
    const priceOf = k => (GEAR[k] || WEAPONS[k]).price;
    const cheapest = def.wares.filter(k => k !== 'arrows' && !S.owned.includes(k)).map(priceOf).sort((a, b) => a - b)[0];
    void cheapest;
  }
  function buy(key) {
    const it = GEAR[key] || WEAPONS[key]; if (S.money < it.price || (GEAR[key] && S.owned.includes(key))) return;
    if (WEAPONS[key] && S.arms.filter(k => k !== 'fists').length >= CHAOS.maxArms) return;
    S.money -= it.price; if (!S.owned.includes(key)) S.owned.push(key); equip(key);
    SFX.hit();   // tik op het aambeeld (voorlopig het klapgeluid)
  }
  function equip(key) {
    const before = { ...S.gear }, msg = wear(key);
    changed();
    const off = Object.keys(before).filter(k => before[k] && !S.gear[k]).map(k => GEAR[before[k]].name.toLowerCase());
    void msg; void off;
  }
  function changed() { S.ammo = Math.min(S.ammo, me.ammoMax); updateUI(); purse(); renderShop(); }
  // Pijlen: aanvullen tot je koker vol is (of zoveel als je kunt betalen).
  function arrowRow() {
    const li = document.createElement('li'), room = me.ammoMax - S.ammo, n = Math.min(room, Math.floor(S.money / AMMO.price));
    li.innerHTML = `${SHOPART.icon('arrows')}<div><b>Pijlen</b><span>${S.ammo}/${me.ammoMax}</span></div>`;
    const b = document.createElement('button'); b.className = 'btn';
    if (!room) { b.textContent = 'Vol'; b.disabled = true; }
    else { b.textContent = n ? `+${n} · ${n * AMMO.price} d` : `${AMMO.price} d`; b.disabled = !n; b.onclick = () => { S.money -= n * AMMO.price; S.ammo += n; SFX.hit(); changed(); }; }
    li.appendChild(b); return li;
  }
  $('shopBack').onclick = () => { $('shop').hidden = true; current = null; purse(); SFX.town('street'); };

  /* ---------- In en uit ---------- */
  function open() {
    SFX.mood('town'); settle();
    render(); $('town').hidden = false; S.townSeen = true;
    SFX.town('street', Object.keys(SHOPS).filter(shopOpen));
    cat.listen();
  }
  return { open, render, purse };
})();
function openTown() { TOWN.open(); }
