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
      <linearGradient id="tWallL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3e2f28"/><stop offset="1" stop-color="#7b674e"/></linearGradient>
      <linearGradient id="tWallR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#3a2b25"/><stop offset="1" stop-color="#6f5c46"/></linearGradient>
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

  function street(svg) {
    el('polygon', { points: poly([[0, VB.h], [END, floorY(END)], [VB.w - END, floorY(END)], [VB.w, VB.h]]), fill: 'url(#tStreet)' }, svg);
    const g = el('g', { stroke: 'rgba(60,35,20,.28)', 'stroke-width': 1, fill: 'none' }, svg);
    for (let i = 1; i < 18; i++) {   // voegen dwars op de straat, dichter naar achteren
      const y = VP.y + (VB.h - VP.y) / (1 + i * .22);
      if (y < floorY(END)) break;
      const xl = VP.x - (VP.x) * (y - VP.y) / (VB.h - VP.y), xr = VB.w - xl;
      el('line', { x1: xl, y1: y, x2: xr, y2: y }, g);
    }
    for (let i = -6; i <= 6; i++) {   // voegen in de lengte, naar het verdwijnpunt
      const bx = VP.x + i * 90, t = (floorY(END) - VP.y) / (VB.h - VP.y);
      el('line', { x1: bx, y1: VB.h, x2: lerp(VP.x, bx, t), y2: floorY(END) }, g);
    }
    el('line', { x1: VP.x, y1: VB.h, x2: VP.x, y2: floorY(END), stroke: 'rgba(60,35,20,.4)', 'stroke-width': 2.5 }, svg);   // goot
  }

  function walls(svg) {
    for (const side of [-1, 1]) {
      el('polygon', { points: poly([pt(side, 0, 0), pt(side, END, 0), pt(side, END, 1), pt(side, 0, 1)]), fill: side < 0 ? 'url(#tWallL)' : 'url(#tWallR)' }, svg);
      // dakrand met pannen
      el('polygon', { points: poly([pt(side, 0, .975), pt(side, END, .975), out(side, END, 1, 14), out(side, 0, 1, 14)]), fill: '#9a4a3a', stroke: '#5a2418', 'stroke-width': 1 }, svg);
      // ramen van de bovenverdieping
      for (const [a, b] of [[40, 110], [140, 200], [262, 300], [330, 362]]) {
        el('polygon', { points: poly([pt(side, a, .74), pt(side, b, .74), pt(side, b, .88), pt(side, a, .88)]), fill: '#24161a', stroke: '#3b2a22', 'stroke-width': 1 }, svg);
      }
      // de kopse kant aan het eind van de straat
      el('polygon', { points: poly([pt(side, END, 0), [side < 0 ? END + 10 : VB.w - END - 10, floorY(END)], [side < 0 ? END + 10 : VB.w - END - 10, roofY(END) + 6], pt(side, END, 1)]), fill: '#4a3a30' }, svg);
      torch(svg, side, 243);
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

  // Een winkel: open voorkant (of luiken), luifel met strepen, uithangbord dat de straat in steekt.
  function shop(svg, id) {
    const def = SHOPS[id], sp = SPOTS[id], side = sp.side, open = def.open;
    const g = el('g', { class: 'hot' + (open ? '' : ' closed'), 'data-id': id }, svg);
    const xa = sp.x0 + 8, xb = sp.x1 - 8;
    const Q = (u, v) => pt(side, lerp(xa, xb, u), v * .5);   // punt in de winkelopening (v 0..1 = straat..luifel)
    // gevel om de opening
    el('polygon', { points: poly([pt(side, sp.x0, 0), pt(side, sp.x1, 0), pt(side, sp.x1, .66), pt(side, sp.x0, .66)]), fill: '#5a463a', stroke: '#2e1f19', 'stroke-width': 1.2 }, g);
    el('polygon', { points: poly([Q(0, 0), Q(1, 0), Q(1, 1), Q(0, 1)]), fill: '#22141a' }, g);
    if (open) contents[id](g, Q, side, scaleAt((xa + xb) / 2));
    else shutters(g, Q);
    // luifel
    const colors = { smith: ['#9a4a3a', '#d9cbb0'], armorer: ['#5f6d45', '#d9cbb0'], bowyer: ['#74305a', '#d9cbb0'], stable: ['#c08a3e', '#5a3a26'] }[id];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = lerp(sp.x0, sp.x1, i / n), b = lerp(sp.x0, sp.x1, (i + 1) / n);
      el('polygon', { points: poly([pt(side, a, .62), pt(side, b, .62), out(side, b, .54, 70), out(side, a, .54, 70)]), fill: colors[i % 2], stroke: 'rgba(30,15,8,.45)', 'stroke-width': .8 }, g);
    }
    // uithangbord, haaks op de muur: recht naar je toe, dus goed leesbaar
    const xs = lerp(sp.x0, sp.x1, side < 0 ? .78 : .78), s = Math.max(.55, scaleAt(xs)), [ax, ay] = out(side, xs, .8, 46);
    const w = 168 * s, h = 54 * s, x = ax - w / 2, y = ay - h / 2;
    el('line', { x1: pt(side, xs, .8)[0], y1: ay - h / 2 - 4 * s, x2: ax, y2: ay - h / 2 - 4 * s, stroke: '#3b3034', 'stroke-width': 3 * s }, g);
    el('line', { x1: x + 12 * s, y1: y - 4 * s, x2: x + 12 * s, y2: y, stroke: '#3b3034', 'stroke-width': 1.5 }, g);
    el('line', { x1: x + w - 12 * s, y1: y - 4 * s, x2: x + w - 12 * s, y2: y, stroke: '#3b3034', 'stroke-width': 1.5 }, g);
    el('rect', { x, y, width: w, height: h, rx: 4 * s, fill: open ? '#3a2a1e' : '#2e2420', stroke: open ? '#d49a48' : '#6d6458', 'stroke-width': 2.2 * s, class: 'sign' }, g);
    const t1 = el('text', { x: ax, y: y + h * .45, 'text-anchor': 'middle', 'font-family': 'Cinzel, Georgia, serif', 'font-weight': 700, 'font-size': 19 * s, 'letter-spacing': 2 * s, fill: open ? '#e2b35e' : '#8d8172' }, g);
    t1.textContent = def.la.toUpperCase();
    const t2 = el('text', { x: ax, y: y + h * .8, 'text-anchor': 'middle', 'font-family': 'Alegreya Sans, sans-serif', 'font-size': 13 * s, fill: open ? '#f5ead6' : '#8d8172' }, g);
    t2.textContent = open ? def.nl : `${def.nl} · binnenkort`;
    // klikvlak: gevel, luifel en bord samen
    const hit = el('polygon', { class: 'hl', points: poly([pt(side, sp.x0, 0), pt(side, sp.x1, 0), out(side, sp.x1, .54, 70), [side < 0 ? x + w : x, y], [side < 0 ? x : x + w, y], pt(side, sp.x0, .66)]) }, g);
    g.insertBefore(hit, g.firstChild);
    el('title', {}, g).textContent = open ? `${def.nl} (${def.la})` : `${def.nl}: nog dicht`;
    if (open) { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', `${def.nl} binnengaan`); }
    return g;
  }

  function shutters(g, Q) {
    el('polygon', { points: poly([Q(0, 0), Q(1, 0), Q(1, .95), Q(0, .95)]), fill: '#5a3a26' }, g);
    for (let i = 1; i < 8; i++) el('line', { x1: Q(i / 8, 0)[0], y1: Q(i / 8, 0)[1], x2: Q(i / 8, .95)[0], y2: Q(i / 8, .95)[1], stroke: '#3a2416', 'stroke-width': 1.2 }, g);
    const a = Q(0, .45), b = Q(1, .45);
    el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#3b3034', 'stroke-width': 2.5 }, g);   // dwarsbalk
  }

  // Wat je in een open winkel ziet. (Alleen de wapensmid is nu open; de rest volgt.)
  const contents = {
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
    const w = 330, h = 50, x = 480 - w / 2, y = 92;
    el('rect', { x, y, width: w, height: h, rx: 6, fill: due ? '#4a1512' : '#3a2a1e', stroke: due ? '#d4463b' : '#d49a48', 'stroke-width': 2.2, class: 'sign' }, g);
    const t1 = el('text', { x: 480, y: y + 22, 'text-anchor': 'middle', 'font-family': 'Cinzel, Georgia, serif', 'font-weight': 700, 'font-size': 18, 'letter-spacing': 3, fill: '#e2b35e' }, g);
    t1.textContent = 'ARENA';
    const t2 = el('text', { x: 480, y: y + 41, 'text-anchor': 'middle', 'font-family': 'Alegreya Sans, sans-serif', 'font-size': 13, fill: '#f5ead6' }, g);
    const sub = due ? `Toernooi ${toRoman(S.stage + 1)} wacht op je` : fightLabel();
    t2.textContent = sub;
    g.setAttribute('aria-label', `Naar de arena: ${sub}`);
    el('title', {}, g).textContent = `Naar de arena: ${sub}`;
    $('townHint').textContent = due
      ? 'Je hebt je vijf gevechten gehad: nu het toernooi. Het gaat tot de dood; ga je neer, dan beslist Caesar met zijn duim.'
      : 'Kies een winkel, of klik op de arena voor je volgende gevecht (of waag je al aan het toernooi).';
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
        title: `${fightLabel()}${f.kind === 'boss' ? ' · tussenbaas' : ''}`,
        lines: [`Tegen ${listSummary(f.foes)}`, `Winst ${f.reward} d · verlies ${fine} d boete ${pips()}`],
        cls: f.kind === 'boss' ? 'boss' : '', go: () => go('fight')
      }));
    } else {
      box.appendChild(card({
        title: `Gevecht ${toRoman(fightNumber() + 1)}`,
        lines: [`Je hebt alle ${n} gevechten van deze reeks gehad ${pips()}`, 'Win eerst het toernooi: daarna komen de volgende vijf.'],
        locked: true
      }));
    }
    // Toernooi
    if (S.finished) {
      box.appendChild(card({ title: 'Toernooi', lines: ['Je hebt alle toernooien van deze proef gewonnen.'], locked: true }));
    } else {
      const t = st.tourney, boss = t.rounds[t.rounds.length - 1];
      const retry = S.over === 'lost' && S.mode === 'tournament', early = S.inStage < n;
      box.appendChild(card({
        title: `Toernooi ${toRoman(S.stage + 1)}${retry ? ' (opnieuw)' : ''}`,
        lines: [`Tot de dood · ${toRoman(t.rounds.length)} rondes · eindbaas: ${listSummary(boss)}`,
                `Winst ${t.reward} d · verlies: Caesar beslist`,
                ...(early ? [`<strong>Vroeg:</strong> je hebt pas ${S.inStage} van de ${n} gevechten gehad. Je mag het proberen, maar het is zwaar.`] : [])],
        cls: 'deadly', go: () => go('tournament')
      }));
    }
    $('pick').hidden = false;
    const first = box.querySelector('button:not(:disabled)'); if (first) first.focus();
  }
  function card({ title, lines, cls = '', locked = false, go }) {
    const b = document.createElement('button');
    b.className = `choice ${cls}${locked ? ' locked' : ''}`; b.disabled = locked;
    b.innerHTML = `<b>${title}</b>${lines.map(l => `<span>${l}</span>`).join('')}${locked ? '<em>Nog niet beschikbaar</em>' : ''}`;
    if (go) b.onclick = go;
    return b;
  }
  $('pickBack').onclick = () => { $('pick').hidden = true; };
  function go(mode) {
    $('pick').hidden = true; $('town').hidden = true; $('shop').hidden = true;
    SFX.mood('calm'); chooseArena(mode);
  }

  function render() {
    const host = $('townArt'); host.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${VB.w} ${VB.h}`, class: 'town-svg', role: 'group', 'aria-label': 'De straat naar de arena' }, host);
    defs(svg); sky(svg);
    arenaSpot(svg);
    street(svg); walls(svg);
    for (const id of ['armorer', 'stable', 'smith', 'bowyer']) shop(svg, id);   // achterste eerst
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
    $('townWeapon').textContent = WEAPONS[PLAYER.weapon].name;
    const b = $('townStats');
    b.textContent = S.points ? `Verdeel je punten (${toRoman(S.points)})` : 'Je stats';
    b.classList.toggle('has-points', S.points > 0);
  }
  $('townStats').onclick = () => openStats('town');

  /* ---------- Winkel: de toonbank ---------- */
  let current = null;
  function openShop(id) {
    current = id; renderShop(); $('shop').hidden = false; $('shopBack').focus();
  }
  function renderShop() {
    const def = SHOPS[current];
    $('shopEyebrow').textContent = `${def.la} · ${def.nl}`;
    $('shopMoney').textContent = denarii(S.money);
    const list = $('wares'); list.innerHTML = '';
    const now = WEAPONS[PLAYER.weapon];
    for (const key of def.wares) {
      const w = WEAPONS[key], owned = S.owned.includes(key), held = PLAYER.weapon === key, rich = S.money >= w.price;
      const li = document.createElement('li');
      const diff = w.dmg - now.dmg, cmp = held ? 'in je hand' : `${diff > 0 ? '+' : ''}${fmt(diff)} schade t.o.v. ${now.name.toLowerCase()}`;
      li.innerHTML = `<div><b>${w.name}</b><span>${fmt(w.dmg)} schade · bereik ${w.reach}${w.knock ? ' · duwt terug' : ''}</span><span class="eff">${cmp}</span></div>`;
      const b = document.createElement('button'); b.className = 'btn';
      if (held) { b.textContent = 'In je hand'; b.disabled = true; }
      else if (owned) { b.textContent = 'Pak op'; b.onclick = () => equip(key); }
      else { b.textContent = `${w.price} d`; b.disabled = !rich; b.setAttribute('aria-label', `${w.name} kopen voor ${w.price} denarii`); b.onclick = () => buy(key); }
      li.appendChild(b); list.appendChild(li);
    }
    const cheapest = def.wares.filter(k => !S.owned.includes(k)).map(k => WEAPONS[k].price).sort((a, b) => a - b)[0];
    $('shopNote').textContent = cheapest > S.money ? `Je komt ${denarii(cheapest - S.money)} tekort voor het goedkoopste wapen. Win een gevecht en kom terug.` : '';
  }
  function buy(key) {
    const w = WEAPONS[key]; if (S.money < w.price || S.owned.includes(key)) return;
    S.money -= w.price; S.owned.push(key); equip(key);
    SFX.hit();   // tik op het aambeeld (voorlopig het klapgeluid)
  }
  function equip(key) { PLAYER.weapon = key; updateUI(); purse(); renderShop(); }
  $('shopBack').onclick = () => { $('shop').hidden = true; current = null; purse(); };

  /* ---------- In en uit ---------- */
  function open() {
    SFX.mood('town'); settle();
    render(); $('town').hidden = false; S.townSeen = true;
  }
  return { open, render, purse };
})();
function openTown() { TOWN.open(); }
