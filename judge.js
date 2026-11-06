/* ---------- Caesars oordeel ----------
   Een scène van voren: Caesar onscherp op zijn troon onder de tent in de keizersloge, publiek erachter,
   en zijn hand scherp op de voorgrond. Zijn onderarm wijst naar de kijker, dus het draaien van de hand
   in beeld is ook echt het draaien van zijn pols.
   game.js roept judgeStart(), judgeVerdict(ok) en judgeEnd() aan. */

const JUDGE = {
  rise: 420,        // ms: hand komt naar voren
  think: 2200,      // ms vanaf de start tot het oordeel valt
  snap: 440,        // ms: duim slaat om
  detail: 800,      // ms na het oordeel: uitslag en knop verschijnen
  // Twijfel: hoeken (graden) waar de duim langs gaat. -90 is opzij (hand in het verlengde van de arm), 0 omhoog, -180 omlaag.
  waver: [-90, -64, -98, -124, -88, -70, -110, -96, -80, -95, -86, -90],
  // De hand als afbeelding, in pixels van die afbeelding:
  // pivot = de pols (daar draait de hand om en daar sluit de arm aan), tip = top van de duim (daar komen de deeltjes vandaan).
  // scale = scène-eenheden per pixel. Ontbreekt het bestand, dan valt het spel terug op de getekende hand.
  hand: { src: 'assets/recraft free plan/hand.png', w: 562, h: 815, pivot: [460, 740], tip: [280, 8], scale: .18 },
  // De onderarm als afbeelding, in pixels van die afbeelding: wrist = midden van de pols, sleeve = midden van het
  // mouwuiteinde. from/to = waar die twee in de scène moeten komen (bij de pols van de hand en bij Caesars schouder).
  arm: { src: 'assets/recraft free plan/arm.png', wrist: [208.5, 521.7], sleeve: [593, 182], from: [176, 182], to: [250, 163] },
  handAt: [175, 182],          // waar de pols in de scène zit (viewBox 480 × 320); de hand draait hieromheen
  shadowOffset: [5, 9],          // waar het midden van de vuist in de scène staat (viewBox 480 × 320)
  tipUp: [137, 70], tipDown: [163, 310]   // worden hieronder uit hand berekend
};

// Afbeelding van de hand plaatsen, of terugvallen op de getekende hand als het bestand er niet is.
(function setupHand() {
  const H = JUDGE.hand, el = id => document.getElementById(id), imgs = [el('handImg'), el('handShadowImg')];
  const useDrawn = () => {
    imgs.forEach(i => i.style.display = 'none'); el('handDrawn').style.display = ''; el('handShadowDrawn').style.display = '';
    JUDGE.tipUp = [137, 70]; JUDGE.tipDown = [163, 310];
  };
  const [hx, hy] = JUDGE.handAt, [ox, oy] = JUDGE.shadowOffset;
  el('hand').firstElementChild.setAttribute('transform', `translate(${hx} ${hy})`);
  el('hand').style.transformOrigin = `${hx}px ${hy}px`;
  el('handShadow').firstElementChild.setAttribute('transform', `translate(${hx + ox} ${hy + oy})`);
  el('handShadow').style.transformOrigin = `${hx + ox}px ${hy + oy}px`;
  for (const img of imgs) {
    img.setAttribute('href', encodeURI(H.src));
    img.setAttribute('x', -H.pivot[0] * H.scale); img.setAttribute('y', -H.pivot[1] * H.scale);
    img.setAttribute('width', H.w * H.scale); img.setAttribute('height', H.h * H.scale);
  }
  const [cx, cy] = JUDGE.handAt, tx = (H.tip[0] - H.pivot[0]) * H.scale, ty = (H.tip[1] - H.pivot[1]) * H.scale;
  JUDGE.tipUp = [cx + tx, cy + ty]; JUDGE.tipDown = [cx - tx, cy - ty];
  const probe = new Image(); probe.onerror = useDrawn; probe.src = encodeURI(H.src);
})();

// Onderarm: draaien en schalen zodat pols en mouw op de goede plek liggen, of terugvallen op de getekende arm.
(function setupArm() {
  const A = JUDGE.arm, imgs = document.querySelectorAll('.armImg');
  const angA = Math.atan2(A.sleeve[1] - A.wrist[1], A.sleeve[0] - A.wrist[0]);
  const angT = Math.atan2(A.to[1] - A.from[1], A.to[0] - A.from[0]);
  const sc = Math.hypot(A.to[0] - A.from[0], A.to[1] - A.from[1]) / Math.hypot(A.sleeve[0] - A.wrist[0], A.sleeve[1] - A.wrist[1]);
  const t = `translate(${A.from[0]} ${A.from[1]}) rotate(${(angT - angA) * 180 / Math.PI}) scale(${sc}) translate(${-A.wrist[0]} ${-A.wrist[1]})`;
  imgs.forEach(i => { i.setAttribute('href', encodeURI(A.src)); i.setAttribute('transform', t); });
  const probe = new Image();
  probe.onerror = () => { imgs.forEach(i => i.style.display = 'none'); document.querySelectorAll('.armDrawn').forEach(g => g.style.display = ''); };
  probe.src = encodeURI(A.src);
})();
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rot = d => `rotate(${d}deg)`;
// De hand en zijn slagschaduw bewegen altijd samen.
const handParts = () => [$('hand'), $('handShadow')];
const handSet = t => handParts().forEach(e => { e.getAnimations().forEach(a => a.cancel()); e.style.transform = t; });
const handAnimate = (keys, opts) => handParts().forEach(e => e.animate(keys, opts));

// Publiek in de tribunes naast de loge: rijen hoofden en schouders, kleiner en donkerder naar achteren.
function fillSceneCrowd() {
  const g = $('sceneCrowd'); if (g.childElementCount) return;
  const ns = 'http://www.w3.org/2000/svg', css = getComputedStyle(document.documentElement);
  const v = k => css.getPropertyValue('--' + k).trim();
  const tunics = [1, 2, 3, 4, 5, 6, 7].map(i => v('crowd-' + i)), heads = ['hair-1', 'hair-2', 'hair-3', 'skin', 'skin-2'].map(v);
  const skins = ['skin', 'skin-2', 'skin-3'].map(v), night = v('night');
  for (let i = 11; i >= 0; i--) {
    const y = 232 - i * 17, r = 7.4 - i * .32, dark = .25 + i * .055, step = r * 2.3 + 2;
    const row = document.createElementNS(ns, 'g'); row.setAttribute('class', 'row'); row.style.setProperty('--i', i);
    let html = '';
    for (const [x0, x1] of [[-14, 186], [394, 494]]) for (let x = x0 + (i % 2) * step / 2; x < x1; x += step) {
      if (Math.random() < .1) continue;
      const jx = x + (Math.random() - .5) * 3, jy = y + (Math.random() - .5) * 2;
      html += `<ellipse cx="${jx.toFixed(1)}" cy="${(jy + r * 1.5).toFixed(1)}" rx="${(r * 1.25).toFixed(1)}" ry="${(r * .95).toFixed(1)}" fill="${mix(pick(tunics), night, dark)}"/>`;
      html += `<circle cx="${jx.toFixed(1)}" cy="${jy.toFixed(1)}" r="${r.toFixed(1)}" fill="${mix(pick(Math.random() < .5 ? heads : skins), night, dark)}"/>`;
    }
    row.innerHTML = html; g.appendChild(row);
  }
}

function judgeStart() {
  fillSceneCrowd();
  const scene = $('scene');
  handSet(rot(-90));
  scene.classList.remove('cheer', 'jeer');
  $('burst').replaceChildren();
  AR.judging = 'thinking';
  if (reduceMotion()) return;
  handAnimate([
    { transform: 'translate(40px, 90px) scale(.7) ' + rot(-90), opacity: 0 },
    { transform: 'translate(-4px, -6px) scale(1.03) ' + rot(-90), opacity: 1, offset: .7 },
    { transform: 'translate(0, 0) scale(1) ' + rot(-90), opacity: 1 }
  ], { duration: JUDGE.rise, easing: 'cubic-bezier(.2,.8,.3,1)' });
  // Twijfelen: steeds sneller en kleiner, met een paar plagerige uitschieters naar boven en beneden.
  const w = JUDGE.waver, n = w.length - 1;
  handAnimate(w.map((d, i) => ({ transform: rot(d), offset: Math.pow(i / n, .85), easing: 'ease-in-out' })),
    { duration: JUDGE.think - JUDGE.rise, delay: JUDGE.rise });
}

function judgeVerdict(ok) {
  const end = ok ? 0 : -180, over = ok ? 16 : -196;
  handSet(rot(end));
  AR.judging = ok ? 'up' : 'down';
  ok ? arenaCheer() : arenaJeer();
  if (reduceMotion()) return;
  handAnimate([
    { transform: rot(-90) },
    { transform: rot(-90 + (ok ? -10 : 10)), offset: .25 },          // even aanzetten
    { transform: rot(over), offset: .7, easing: 'ease-out' },
    { transform: rot(end) }
  ], { duration: JUDGE.snap, easing: 'cubic-bezier(.6,0,.3,1)' });
  setTimeout(() => judgeImpact(ok), JUDGE.snap * .62);
  $('judgeTitle').animate([
    { transform: 'scale(1.6)', opacity: 0 }, { transform: 'scale(.94)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1 }
  ], { duration: 360, delay: JUDGE.snap * .5, fill: 'backwards', easing: 'ease-out' });
}

function judgeImpact(ok) {
  const panel = document.querySelector('#judge .panel'), scene = $('scene'), box = $('burst'), k = box.clientWidth / 480;
  scene.classList.add(ok ? 'cheer' : 'jeer');
  if (ok) panel.animate([
    { boxShadow: '0 0 0 0 rgba(166,200,90,0)' }, { boxShadow: '0 0 0 5px rgba(166,200,90,.6)', offset: .2 }, { boxShadow: '0 0 60px 14px rgba(166,200,90,0)' }
  ], { duration: 800, easing: 'ease-out' });
  else panel.animate([0, -12, 10, -8, 6, -3, 0].map(x => ({ transform: `translateX(${x}px)` })), { duration: 440, easing: 'ease-out' });

  // Deeltjes vanaf de duimtop: lauwerblaadjes, rozenblaadjes en goud omhoog; zand en bloed omlaag.
  const tip = ok ? JUDGE.tipUp : JUDGE.tipDown, kinds = ok ? ['leaf', 'leaf', 'petal', 'gold'] : ['dust', 'dust', 'blood'];
  for (let i = 0; i < (ok ? 20 : 14); i++) {
    const b = document.createElement('span'); b.className = 'bit ' + kinds[i % kinds.length];
    b.style.left = tip[0] * k + 'px'; b.style.top = tip[1] * k + 'px'; box.appendChild(b);
    const a = (ok ? -Math.PI / 2 : -Math.PI / 2) + (Math.random() - .5) * (ok ? 2.6 : 2.4), d = 40 + Math.random() * 90;
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d * (ok ? 1 : .5), r = (Math.random() - .5) * 600, fall = ok ? 80 : 40;
    b.animate([
      { transform: 'translate(0,0) rotate(0) scale(.5)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) rotate(${r / 2}deg) scale(1)`, opacity: 1, offset: .45 },
      { transform: `translate(${dx * 1.25}px,${dy + fall}px) rotate(${r}deg) scale(.8)`, opacity: 0 }
    ], { duration: 1000 + Math.random() * 500, easing: 'cubic-bezier(.15,.7,.4,1)' }).onfinish = () => b.remove();
  }
}

function judgeEnd() { AR.judging = null; $('scene').classList.remove('cheer', 'jeer'); }
