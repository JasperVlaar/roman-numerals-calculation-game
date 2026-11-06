/* ---------- Quadriga: vier paarden en de wagen ----------
   De tekeningen staan als SVG in assets/ en zijn in Inkscape of Figma te bewerken.
   Hier gebeurt alles wat beweegt: benen in galop, rollende wielen, dissel en juk, teugels,
   wielsporen in het zand en de schaduw. Lokale assen: +x is vooruit, (0, 0) is het midden
   van het span, 1 eenheid = 1 SVG-eenheid. QUAD.scale maakt het geheel groter of kleiner. */

const QUAD = {
  scale: 1.15,
  // Waar de SVG's liggen ten opzichte van het midden (linkerbovenhoek van de afbeelding).
  chariot: { src: 'assets/chariot.svg', w: 26, h: 32, x: -36, y: -16, hands: [[15.6, 12.8], [15.6, 19.2]] },
  horse:   { src: 'assets/horse.svg',   w: 54, h: 16, x: -10, y: -8, collar: 24, body: 15, mouth: [50, 8] },
  horses: [-14.4, -4.8, 4.8, 14.4],     // y-positie van elk paard
  horsePhase: [.06, 0, .13, .2],        // kleine verschillen in de galop
  hitch: -12,                           // waar de dissel aan de wagen vastzit; de paarden draaien hier omheen
  wheel: { x: -28, y: 12.8, len: 16, w: 2.8 },
  legs: { front: [24, 2.4, 8.5], hind: [10, 2.8, 7.5] },   // [x op het paard, zijwaarts, reikwijdte]
  strides: 2.7,                         // galopsprongen per seconde op topsnelheid
  lead: .3,                             // hoe ver de paarden (radialen) voor de wagen uit mogen draaien
  trackLife: 5,                         // seconden dat een wielspoor zichtbaar blijft
  shadow: 'rgba(40,20,8,.26)'
};

const QS = { gait: 0, roll: 0, amp: 0, tracks: [[], []], sprites: {} };

function qSprite(def) {
  let s = QS.sprites[def.src];
  if (!s) { s = QS.sprites[def.src] = { img: new Image(), cv: null, k: 0, ok: false }; s.img.onload = () => { s.ok = true; s.k = 0; }; s.img.src = def.src; }
  if (!s.ok) return null;
  const k = Math.min(8, view.scale * view.dpr * QUAD.scale * 1.5);   // extra resolutie, want het span draait
  if (Math.abs(s.k - k) > .01) {
    s.cv = s.cv || document.createElement('canvas'); s.k = k;
    s.cv.width = Math.ceil(def.w * k); s.cv.height = Math.ceil(def.h * k);
    const g = s.cv.getContext('2d'); g.clearRect(0, 0, s.cv.width, s.cv.height); g.drawImage(s.img, 0, 0, def.w * k, def.h * k);
  }
  return s.cv;
}

// Wereldpositie van een lokaal punt op de wagen.
function qWorld(lx, ly) {
  const k = QUAD.scale, c = Math.cos(car.a), s = Math.sin(car.a);
  return [car.x + (lx * c - ly * s) * k, car.y + (lx * s + ly * c) * k];
}

/* Elk frame vanuit update(): galopfase, wielrotatie, sporen en stof. */
function quadrigaStep(dt, speed, maxSpeed) {
  const Q = QUAD, t = Math.min(1, speed / maxSpeed);
  QS.amp += (t - QS.amp) * (1 - Math.exp(-dt * 6));
  QS.gait += dt * Q.strides * (.35 + .65 * t) * (speed > 6 ? 1 : 0);
  QS.roll += speed * dt / Q.scale;
  const now = performance.now() / 1000;
  for (let i = 0; i < 2; i++) {
    const [x, y] = qWorld(Q.wheel.x, (i ? 1 : -1) * Q.wheel.y), tr = QS.tracks[i], last = tr[tr.length - 1];
    if (!last || Math.hypot(x - last.x, y - last.y) > 5) tr.push({ x, y, t: now, gap: !!last && Math.hypot(x - last.x, y - last.y) > 40 });
    while (tr.length && now - tr[0].t > Q.trackLife) tr.shift();
    if (speed > 80 && Math.random() < dt * 22) S.dust.push({ x: x + (Math.random() - .5) * 8, y: y + (Math.random() - .5) * 8, t: 1 });
  }
}
function quadrigaReset() { QS.tracks = [[], []]; }

function drawTracks(g) {
  // Gebundeld in 6 vervaagstappen, zodat het een handvol stroke-calls blijft.
  const now = performance.now() / 1000, life = QUAD.trackLife, bands = 6, paths = Array.from({ length: bands }, () => new Path2D());
  for (const tr of QS.tracks) for (let i = 1; i < tr.length; i++) {
    const a = tr[i - 1], b = tr[i]; if (b.gap) continue;
    const band = Math.min(bands - 1, Math.floor((now - b.t) / life * bands));
    paths[band].moveTo(a.x, a.y); paths[band].lineTo(b.x, b.y);
  }
  g.lineWidth = 2.2; g.lineCap = 'round';
  paths.forEach((p, n) => { g.strokeStyle = `rgba(120,84,44,${(.22 * (1 - (n + .5) / bands)).toFixed(3)})`; g.stroke(p); });
  g.lineCap = 'butt';
}

function drawQuadriga(g) {
  const Q = QUAD, k = Q.scale, H = Q.horse, Ch = Q.chariot;
  const horseImg = qSprite(H), chariotImg = qSprite(Ch);
  const rel = Math.max(-Q.lead, Math.min(Q.lead, wrapPi(car.ha - car.a)));
  g.save(); g.translate(car.x, car.y); g.rotate(car.a); g.scale(k, k);

  // Schaduw: zachte ellipsen, een stukje naar rechtsonder in de wereld (dus tegen de draairichting in gecorrigeerd).
  const c0 = Math.cos(-car.a), s0 = Math.sin(-car.a), shx = (2.5 * c0 - 3.5 * s0) / k, shy = (2.5 * s0 + 3.5 * c0) / k;
  const shadow = (x, y, rx, ry) => { g.beginPath(); g.ellipse(x + shx, y + shy, rx, ry, 0, 0, TAU); g.fill(); };
  g.fillStyle = Q.shadow;
  shadow(Ch.x + 13, 0, 11, 13.5);
  const cr0 = Math.cos(rel), sr0 = Math.sin(rel), bodyX = H.x + 26 - Q.hitch;   // midden van het paardenlijf, gemeten vanaf de dissel
  g.save(); g.translate(Q.hitch, 0); g.rotate(rel);
  const wx = shx * cr0 + shy * sr0, wy = -shx * sr0 + shy * cr0;
  for (const hy of Q.horses) { g.beginPath(); g.ellipse(bodyX + wx, hy + wy, 23, 4.4, 0, 0, TAU); g.fill(); }
  g.restore();

  // Wielen: band van opzij gezien, met spaken die meeschuiven als hij rolt.
  const Wh = Q.wheel;
  for (const sy of [-1, 1]) {
    const wy = sy * Wh.y;
    g.fillStyle = '#2e2226'; g.beginPath(); g.roundRect(Wh.x - Wh.len / 2, wy - Wh.w / 2, Wh.len, Wh.w, 1.2); g.fill();
    g.fillStyle = '#6a4630'; g.fillRect(Wh.x - Wh.len / 2 + .8, wy - Wh.w / 2 + .5, Wh.len - 1.6, Wh.w - 1);
    g.fillStyle = '#9a7048';
    for (let i = 0; i < 3; i++) {
      const p = ((-QS.roll + i * Wh.len / 3) % Wh.len + Wh.len) % Wh.len;
      g.fillRect(Wh.x - Wh.len / 2 + p - .4, wy - Wh.w / 2 + .3, .8, Wh.w - .6);
    }
    g.fillStyle = '#d49a48'; g.fillRect(Wh.x - 1.6, wy + sy * (Wh.w / 2) - (sy < 0 ? 1.2 : 0), 3.2, 1.2);
  }
  if (chariotImg) { g.drawImage(chariotImg, Ch.x, Ch.y, Ch.w, Ch.h); }

  // Paarden, licht gedraaid rond de dissel zodat ze de bocht inzetten.
  g.save(); g.translate(Q.hitch, 0); g.rotate(rel); g.translate(-Q.hitch, 0);
  const collar = H.x + H.collar;
  g.strokeStyle = '#5e4026'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(Q.hitch, 0); g.lineTo(collar + 1, 0); g.stroke();
  const mouths = [];
  Q.horses.forEach((hy, n) => {
    const ph = (QS.gait + Q.horsePhase[n]) * TAU, bob = Math.sin(ph) * .7 * QS.amp, ox = H.x + bob, oy = hy + H.y;
    g.strokeStyle = '#3a2416'; g.lineWidth = 1.8; g.lineCap = 'round'; g.fillStyle = '#1a100a';
    for (const [key, offs] of [['hind', [0, .1]], ['front', [.5, .6]]]) {
      const [lx, side, reach] = Q.legs[key];
      offs.forEach((o, j) => {
        const sy = j ? 1 : -1, ax = ox + lx, ay = hy + sy * side;
        const sw = Math.sin(ph + o * TAU), hx = ax + sw * reach * QS.amp, hyy = ay + sy * (.5 + .6 * QS.amp * Math.max(0, -sw));
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(hx, hyy); g.stroke();
        g.beginPath(); g.arc(hx, hyy, .95, 0, TAU); g.fill();
      });
    }
    g.lineCap = 'butt';
    if (horseImg) { g.drawImage(horseImg, ox, oy, H.w, H.h); }
    mouths.push([ox + H.mouth[0], hy]);
  });
  g.fillStyle = '#6e4c30'; g.fillRect(collar - .8, Q.horses[1] - 3, 1.6, Q.horses[2] - Q.horses[1] + 6);
  g.restore();

  // Teugels: van de handen van de menner naar de monden, met wat doorhang.
  const cr = Math.cos(rel), sr = Math.sin(rel);
  g.strokeStyle = 'rgba(30,18,10,.85)'; g.lineWidth = .45;
  mouths.forEach(([mx, my], n) => {
    const dx = mx - Q.hitch, x = Q.hitch + dx * cr - my * sr, y = dx * sr + my * cr;
    const [hx, hy] = Ch.hands[n < 2 ? 0 : 1], sx = Ch.x + hx, sy = Ch.y + hy;
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + x) / 2, (sy + y) / 2 + (y - sy) * .15 + 1.2, x, y); g.stroke();
  });
  g.restore();
}
