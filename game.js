const $ = id => document.getElementById(id);
const cvs = $('arena'), ctx = cvs.getContext('2d'), stage = $('stage');
const css = getComputedStyle(document.documentElement);
const C = {}; ['night','stone','stone-2','porphyry','bronze','sand','sand-2','ink','muted','blood','blood-dark','laurel','coin','coin-edge','coin-ink','horse','wall','silver','silver-edge'].forEach(k => C[k] = css.getPropertyValue('--' + k).trim());

const PRICE = { armor: 20, augur: 12 };
// expect: welk soort munt je nu kunt vangen ('num' = cijfer, 'op' = teken). pendingOp: het gevangen teken dat op een cijfer wacht.
const S = { level: 1, money: 0, armor: 0, augur: 0, tokens: [], total: null, target: 0, expect: 'num', pendingOp: null,
  time: 0, shownTime: null, loot: 0, ents: [], floats: [], dust: [], paused: true, cfg: null };
const W = { rx: 280, ry: 220, area: 66000 };
const view = { cw: 1, ch: 1, dpr: 1, scale: 1 };
const car = { x: 0, y: 0, vx: 0, vy: 0, a: -Math.PI / 2, ha: -Math.PI / 2 };   // a = richting van de wagen, ha = van de paarden
const steer = { active: false, down: false, x: 0, y: 0 };
const keys = new Set();

const ROMAN = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
function toRoman(n) {
  if (n < 0) return '−' + toRoman(-n);
  if (n === 0) return 'nulla';
  if (n > 3999) return 'MMMM+';
  let s = ''; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s;
}
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function cfg(l) {
  const sets = [[1,2,3,5,10],[1,2,3,4,5,6,10],[1,2,3,4,5,7,9,10,50],[1,2,3,4,5,6,8,9,10,50,100]];
  const ranges = [[8,20],[16,45],[30,110],[60,240]];
  const i = Math.min(l - 1, 3), extra = Math.max(0, l - 4);
  return {
    time: 30,                                      // seconden per ronde; later per level te variëren
    values: sets[i],
    count: Math.min(6 + (l - 1) * 2, 14),          // cijfermunten
    ops: l === 1 ? ['+', '−'] : ['+', '−', '×'],    // tekens die als munt in het veld liggen
    opCount: l === 1 ? 3 : 4,
    denarii: { count: 4 + Math.min(l, 4), value: 2 },
    range: ranges[i].map(v => Math.round(v * Math.pow(1.5, extra))),
    terms: l === 1 ? [2] : l < 4 ? [2, 3] : [3],
    fakeRate: Math.min(.1 + .07 * (l - 1), .4),
    area: 66000 * Math.pow(1.2, l - 1)
  };
}
const applyOp = (t, op, v) => op === '+' ? t + v : op === '−' ? t - v : t * v;
function evalSeq(vals, ops) { let t = vals[0]; for (let i = 1; i < vals.length; i++) t = applyOp(t, ops[i - 1], vals[i]); return t; }
function findTarget(vals, c) {
  for (let n = 0; n < 400; n++) {
    const k = pick(c.terms), idx = [];
    while (idx.length < k) { const j = Math.floor(Math.random() * vals.length); if (!idx.includes(j)) idx.push(j); }
    const ops = Array.from({ length: k - 1 }, () => pick(c.ops));
    const target = evalSeq(idx.map(j => vals[j]), ops);
    if (target >= c.range[0] && target <= c.range[1] && !vals.includes(target)) return { target, idx };
  }
  return null;
}

/* ---------- world ---------- */
function fitWorld(reset) {
  const r = stage.getBoundingClientRect();
  view.cw = Math.max(r.width, 1); view.ch = Math.max(r.height, 1);
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  cvs.width = Math.round(view.cw * view.dpr); cvs.height = Math.round(view.ch * view.dpr);
  const aspect = clamp(view.cw / view.ch, .6, 1.8);
  const nrx = Math.sqrt(W.area * aspect), nry = Math.sqrt(W.area / aspect);
  if (!reset) {
    const sx = nrx / W.rx, sy = nry / W.ry;
    for (const e of S.ents) { e.x *= sx; e.y *= sy; }
    car.x *= sx; car.y *= sy; steer.x *= sx; steer.y *= sy;
  }
  W.rx = nrx; W.ry = nry;
  // Ruimte rondom de zandvloer: opzij de muur en een paar rijen publiek, boven ook Caesars loge.
  view.scale = Math.min(view.cw / (2 * (W.rx + 40)), view.ch / (2 * (W.ry + 58)));
  AR.dirty = true;
}
function place(e) {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * .82;
    const x = W.rx * r * Math.cos(a), y = W.ry * r * Math.sin(a);
    if (Math.hypot(x - car.x, y - car.y) < 110) continue;
    if (S.ents.some(o => o !== e && Math.hypot(o.x - x, o.y - y) < 40)) continue;
    e.x = x; e.y = y; break;
  }
  const a = Math.random() * Math.PI * 2, sp = 18 + Math.random() * 26;
  e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp;
}
function rollFake(e) {
  e.fake = e.kind === 'num' && !e.anchor && Math.random() < S.cfg.fakeRate;
  e.trueVal = e.fake ? pick(S.cfg.values.filter(v => v !== e.val)) : e.val;
}
// kind: 'num' = cijfer, 'op' = teken (+ − ×), 'den' = denarius om op te rapen
function mkEnt(kind, val, anchor) {
  const e = { kind, val, shown: val, anchor, state: 'free', t: 0, spawn: 0, oracle: false, x: 0, y: 0, vx: 0, vy: 0 };
  rollFake(e); place(e);
  if (kind === 'den') { e.vx *= .5; e.vy *= .5; }
  return e;
}
const catchable = e => e.state === 'free' && e.spawn === 0 && (e.kind === 'den' || e.kind === S.expect);
function respawn(e) { e.shown = e.val; e.oracle = false; e.state = 'free'; e.spawn = .35; rollFake(e); place(e); }

function newRound() {
  const c = S.cfg = cfg(S.level);
  W.area = c.area; car.x = 0; car.y = 0; car.vx = car.vy = 0; steer.active = false;
  fitWorld(true);
  let vals, sol;
  do { vals = Array.from({ length: c.count }, () => pick(c.values)); sol = findTarget(vals, c); } while (!sol);
  S.target = sol.target; S.ents = [];
  vals.forEach((v, i) => S.ents.push(mkEnt('num', v, sol.idx.includes(i))));
  const ops = [...c.ops]; while (ops.length < c.opCount) ops.push(pick(c.ops));   // elk teken minstens één keer
  ops.forEach(op => S.ents.push(mkEnt('op', op, false)));
  for (let i = 0; i < c.denarii.count; i++) S.ents.push(mkEnt('den', c.denarii.value, false));
  S.tokens = []; S.total = null; S.expect = 'num'; S.pendingOp = null; S.loot = 0;
  S.time = c.time; S.shownTime = null; S.floats = []; S.dust = []; quadrigaReset();
  updateUI();
}

/* ---------- rules ---------- */
// Een cijfer rekent met het teken dat ervoor gevangen is. Daarna moet er eerst weer een teken komen.
function applyVal(v, fake) {
  S.total = S.total === null ? v : applyOp(S.total, S.pendingOp || '+', v);
  S.tokens.push({ k: 'n', v, fake }); S.pendingOp = null; S.expect = 'op';
  updateUI();
}
function applyOperator(op) {
  S.tokens.push({ k: 'o', op }); S.pendingOp = op; S.expect = 'num';
  updateUI();
}
function catchEnt(e) {
  if (e.kind === 'den') {
    S.money += e.val; S.loot += e.val; e.state = 'gone';
    float(e.x, e.y - 24, `+${e.val} d`, C.coin); updateUI();
  } else if (e.kind === 'op') {
    applyOperator(e.val); float(e.x, e.y - 30, e.val, C.ink); respawn(e);
  } else if (e.fake) {
    if (S.armor > 0) { S.armor--; e.state = 'blocked'; e.t = .7; float(e.x, e.y - 30, 'Lorica!', C.sand); updateUI(); }
    else {
      // Vals cijfer: telt meteen mee met zijn echte waarde; de munt laat zien dat hij verandert.
      const op = S.pendingOp;
      e.state = 'reveal'; e.t = 1; applyVal(e.trueVal, true);
      float(e.x, e.y - 34, `Vals! ${op ? op + ' ' : ''}${toRoman(e.trueVal)}`, C.blood);
    }
  } else {
    const label = (S.pendingOp ? S.pendingOp + ' ' : '') + toRoman(e.val);
    applyVal(e.val, false); float(e.x, e.y - 30, label, C.ink); respawn(e);
  }
}
function float(x, y, text, color) { S.floats.push({ x, y, text, color, t: 1 }); }

// Augur: zoekt de kortste reeks cijfers (met de tekens die in het veld liggen) naar het doel.
// Hij wijst alleen cijfers aan; volgorde en tekens verraadt hij niet.
function oracleSearch() {
  const byVal = new Map();
  for (const e of S.ents) if (e.kind === 'num' && !e.fake && e.state === 'free' && !byVal.has(e.val)) byVal.set(e.val, e);
  const vals = [...byVal.keys()];
  const ops = [...new Set(S.ents.filter(e => e.kind === 'op' && e.state === 'free').map(e => e.val))];
  const lim = Math.max(60, S.target * 4), used = []; let best = null;
  function rec(total, first, depth, maxD) {
    if (total === S.target && used.length) { best = used.slice(); return true; }
    if (depth === maxD) return false;
    const useOps = total === null ? [null] : first && S.pendingOp ? [S.pendingOp] : ops;
    for (const v of vals) for (const op of useOps) {
      const nt = op === null ? v : applyOp(total, op, v);
      if (Math.abs(nt) > lim) continue;
      used.push(byVal.get(v)); if (rec(nt, false, depth + 1, maxD)) return true; used.pop();
    }
    return false;
  }
  for (let d = 1; d <= 4; d++) if (rec(S.total, true, 0, d)) break;
  return best;
}

/* ---------- loop ---------- */
function contain(o, ex, ey, bounce) {
  const k = (o.x / ex) ** 2 + (o.y / ey) ** 2;
  if (k <= 1) return;
  const s = 1 / Math.sqrt(k); o.x *= s; o.y *= s;
  let nx = o.x / (ex * ex), ny = o.y / (ey * ey); const l = Math.hypot(nx, ny); nx /= l; ny /= l;
  const vn = o.vx * nx + o.vy * ny;
  if (vn > 0) { const f = bounce ? 2 : 1; o.vx -= f * vn * nx; o.vy -= f * vn * ny; }
}
function lerpAngle(a, b, t) { const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * t; }

function update(dt) {
  S.time = Math.max(0, S.time - dt);
  showTime();
  if (S.time === 0) { toast('De tijd is om!'); openJudge(); return; }
  const MAX = 230; let dx = 0, dy = 0, tx = 0, ty = 0;
  if (keys.has('ArrowLeft') || keys.has('a')) dx--;
  if (keys.has('ArrowRight') || keys.has('d')) dx++;
  if (keys.has('ArrowUp') || keys.has('w')) dy--;
  if (keys.has('ArrowDown') || keys.has('s')) dy++;
  if (dx || dy) { const l = Math.hypot(dx, dy); tx = dx / l * MAX; ty = dy / l * MAX; steer.active = false; }
  else if (steer.active) {
    const ddx = steer.x - car.x, ddy = steer.y - car.y, d = Math.hypot(ddx, ddy);
    if (d > 12) { const sp = Math.min(MAX, d * 3); tx = ddx / d * sp; ty = ddy / d * sp; }
    else if (!steer.down) steer.active = false;
  }
  const k = 1 - Math.exp(-dt * 5);
  car.vx += (tx - car.vx) * k; car.vy += (ty - car.vy) * k;
  car.x += car.vx * dt; car.y += car.vy * dt;
  contain(car, W.rx - 32, W.ry - 32, false);
  const sp = Math.hypot(car.vx, car.vy);
  // De paarden draaien eerst, de wagen zwaait erachteraan.
  if (sp > 8) car.ha = lerpAngle(car.ha, Math.atan2(car.vy, car.vx), 1 - Math.exp(-dt * 14));
  car.a = lerpAngle(car.a, car.ha, 1 - Math.exp(-dt * 8));
  quadrigaStep(dt, sp, MAX);

  for (const e of S.ents) {
    if (e.spawn > 0) e.spawn = Math.max(0, e.spawn - dt);
    if (e.state === 'free') {
      const r = (Math.random() - .5) * dt * 1.6, c = Math.cos(r), s = Math.sin(r);
      [e.vx, e.vy] = [e.vx * c - e.vy * s, e.vx * s + e.vy * c];
      e.x += e.vx * dt; e.y += e.vy * dt;
      contain(e, W.rx - 18, W.ry - 18, true);
      if (catchable(e) && Math.hypot(e.x - car.x, e.y - car.y) < (e.kind === 'den' ? 28 : 33)) catchEnt(e);
    } else {
      e.t -= dt;
      if (e.state === 'reveal') {
        if (e.t < .55) e.shown = e.trueVal;
        if (e.t <= 0) respawn(e);
      } else if (e.state === 'blocked' && e.t <= 0) respawn(e);
    }
  }
  S.ents = S.ents.filter(e => e.state !== 'gone');
  for (const f of S.floats) { f.t -= dt * .9; f.y -= dt * 30; }
  S.floats = S.floats.filter(f => f.t > 0);
  for (const p of S.dust) p.t -= dt * 1.8;
  S.dust = S.dust.filter(p => p.t > 0);
}

function draw(now) {
  const { cw, ch, dpr, scale } = view;
  if (AR.dirty) buildArena();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(AR.bg, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save(); ctx.translate(cw / 2, ch / 2); ctx.scale(scale, scale);
  drawArenaLive(ctx, now);

  if (steer.active) {
    ctx.strokeStyle = C.porphyry; ctx.lineWidth = 2; ctx.globalAlpha = .6;
    ctx.beginPath(); ctx.arc(steer.x, steer.y, 10 + Math.sin(now / 150) * 2, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  drawTracks(ctx);
  for (const p of S.dust) { ctx.fillStyle = C['sand-2']; ctx.globalAlpha = p.t * .5; ctx.beginPath(); ctx.arc(p.x, p.y, 4 + (1 - p.t) * 6, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;

  for (const e of S.ents) drawCoin(e, now);
  drawQuadriga(ctx);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of S.floats) {
    ctx.globalAlpha = Math.min(1, f.t * 1.5); ctx.font = '700 20px Cinzel, Georgia, serif';
    ctx.lineWidth = 4; ctx.strokeStyle = C.night; ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  // Laatste 5 seconden: groot aftellen midden in de arena, dat elke seconde klopt.
  if (!S.paused && S.time > 0 && S.time <= 5) {
    const n = Math.ceil(S.time), f = S.time - Math.floor(S.time), pulse = 1 + .25 * Math.pow(f, 3);
    ctx.save(); ctx.scale(pulse, pulse);
    ctx.font = `900 ${Math.round(W.ry * .9)}px Cinzel, Georgia, serif`;
    ctx.globalAlpha = .18 + .22 * f; ctx.lineWidth = 6; ctx.strokeStyle = C.night; ctx.strokeText(n, 0, 6);
    ctx.fillStyle = C.blood; ctx.fillText(n, 0, 6); ctx.restore();
  }
  ctx.restore();
}
// Munten: goud = cijfer, purper = teken, klein goud = denarius. Wat je nu niet kunt vangen is gedimd.
function drawCoin(e, now) {
  if (e.kind === 'den') return drawDenarius(e, now);
  const isOp = e.kind === 'op', can = e.state !== 'free' || catchable(e) || e.spawn > 0;
  let r = (isOp ? 11 : 12) * (1 - e.spawn / .35 * .9), alpha = can ? 1 : .38;
  let fill = isOp ? C.porphyry : C.coin, ink = isOp ? C.ink : C['coin-ink'], edge = isOp ? C.bronze : C['coin-edge'];
  if (e.state === 'reveal') { const on = Math.floor(now / 90) % 2 === 0; fill = on ? C.blood : C['blood-dark']; ink = C.ink; }
  if (e.state === 'blocked') { alpha = Math.max(0, e.t / .7); r *= 1 + (1 - alpha) * .5; fill = C.muted; }
  ctx.save(); ctx.translate(e.x, e.y); ctx.globalAlpha = alpha;
  if (e.oracle && e.state === 'free') {
    ctx.strokeStyle = C.laurel; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r + 8 + Math.sin(now / 180) * 2.5, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(2, 4, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.globalAlpha = alpha * .35; ctx.beginPath(); ctx.arc(0, 0, Math.max(0, r - 5), 0, Math.PI * 2); ctx.lineWidth = 1; ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (isOp) { ctx.font = `700 ${30 * r / 22}px Cinzel, Georgia, serif`; ctx.fillText(e.val, 0, 2); }
  else {
    const txt = toRoman(e.shown), size = txt.length <= 2 ? 21 : txt.length === 3 ? 17 : 14;
    ctx.font = `700 ${size * r / 24}px Cinzel, Georgia, serif`; ctx.fillText(txt, 0, 1);
  }
  ctx.restore();
}
function drawDenarius(e, now) {
  // Cartoonmuntje zoals in veel spellen: felgeel, dikke omtrek, gleufje in het midden, glans,
  // draait om zijn as (met een donkere zijkant als hij smal staat) en fonkelt af en toe.
  const r = 8 * (1 - e.spawn / .35 * .9), ph = now / 380 + e.x * .05, c = Math.cos(ph);
  const w = Math.max(.14, Math.abs(c)), bob = Math.sin(now / 260 + e.x) * 1.4, line = '#7a3f0c';
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(40,20,5,.25)'; ctx.beginPath(); ctx.ellipse(0, r + 3, r * .8 * (.6 + .4 * w), r * .28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(0, bob);
  const side = (1 - w) * r * .38 * Math.sign(Math.sin(ph) || 1);   // dikte van de munt, zichtbaar als hij draait
  ctx.lineWidth = 2.2; ctx.strokeStyle = line;
  ctx.fillStyle = '#d98a14'; ctx.beginPath(); ctx.ellipse(side, 0, r * w, r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(0, 0, r * w, r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#e39b1c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, 0, r * w * .68, r * .68, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#e39b1c'; ctx.beginPath(); ctx.roundRect(-r * .13 * w, -r * .42, r * .26 * w, r * .84, r * .13); ctx.fill();
  if (w > .45) {   // glans linksboven
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(0, 0, r * w * .78, r * .78, 0, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke(); ctx.lineCap = 'butt';
  }
  const tw = (now / 1100 + e.x * .013) % 1;   // fonkeling: kort sterretje rechtsboven
  if (tw < .22) {
    const k = Math.sin(tw / .22 * Math.PI) * r * .55, sx = r * .7, sy = -r * .75;
    ctx.fillStyle = '#fff'; ctx.beginPath();
    ctx.moveTo(sx, sy - k); ctx.lineTo(sx + k * .22, sy - k * .22); ctx.lineTo(sx + k, sy); ctx.lineTo(sx + k * .22, sy + k * .22);
    ctx.lineTo(sx, sy + k); ctx.lineTo(sx - k * .22, sy + k * .22); ctx.lineTo(sx - k, sy); ctx.lineTo(sx - k * .22, sy - k * .22); ctx.fill();
  }
  ctx.restore();
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  requestAnimationFrame(loop);
  try { if (!S.paused) update(dt); draw(now); } catch (err) { console.error(err); }
}

/* ---------- UI ---------- */
// Timer: groot getal in de HUD, een balk die leegloopt, en onder 5 s rood.
function showTime() {
  const ts = Math.ceil(S.time);
  $('timebarFill').style.transform = `scaleX(${S.cfg ? S.time / S.cfg.time : 1})`;
  if (ts === S.shownTime) return;
  S.shownTime = ts; $('time').textContent = ts;
  const warn = ts <= 5; $('timer').classList.toggle('warn', warn); document.querySelector('.timebar').classList.toggle('warn', warn);
}
function updateUI() {
  $('goal').textContent = toRoman(S.target);
  $('lvl').textContent = toRoman(S.level);
  $('money').textContent = S.money;
  $('armor').textContent = S.armor;
  showTime();
  $('augur').textContent = `Augur · ${S.augur}`;
  $('augur').disabled = S.augur <= 0;
  $('claim').disabled = S.total === null;
  const el = $('expr'); el.innerHTML = '';
  const add = (cls, text, title) => { const s = document.createElement('span'); s.className = 'tok ' + cls; s.textContent = text; if (title) s.title = title; el.appendChild(s); };
  if (!S.tokens.length) { el.innerHTML = '<span class="hint">Vang je eerste cijfer</span>'; return; }
  for (const t of S.tokens) t.k === 'o' ? add('op', t.op) : add(t.fake ? 'fake' : '', toRoman(t.v), t.fake ? 'Vals cijfer: veranderd bij het oppakken' : '');
  if (S.tokens.length > 1 && S.total !== null) add('sum', '= ' + toRoman(S.total));
  add('next', S.expect === 'num' ? 'cijfer' : S.cfg.ops.join(' '));
  el.scrollLeft = el.scrollWidth;
}
let toastTimer;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400); }
function anyOverlay() { return !$('start').hidden || !$('judge').hidden || !$('shop').hidden; }

let jt = [];
function openJudge() {
  if (S.paused || (S.total === null && S.time > 0)) return;
  S.paused = true; keys.clear(); steer.down = false;
  const ok = S.total !== null && S.total === S.target;
  // Uitslag en knop staan er meteen (onzichtbaar), zodat het venster niet verspringt als ze verschijnen.
  const d = $('judgeDetail'), b = $('judgeBtn');
  d.innerHTML = `<dt>Jouw som</dt><dd class="${ok ? 'good' : 'bad'}">${S.total === null ? 'geen' : toRoman(S.total) + ' · ' + String(S.total).replace('-', '−')}</dd>
    <dt>Doel</dt><dd>${toRoman(S.target)} · ${S.target}</dd>
    <dt>Opgeraapt</dt><dd>${S.loot} denarii</dd>
    <dt>Tijd over</dt><dd>${Math.ceil(S.time)} s</dd>`;
  b.textContent = ok ? 'Naar de wapensmid' : 'Nieuwe poging'; b.dataset.ok = ok ? '1' : '';
  for (const el of [d, b]) { el.hidden = false; el.style.visibility = 'hidden'; }
  $('judgeTitle').textContent = 'Caesar overweegt…';
  $('judge').hidden = false;
  judgeStart();
  jt.forEach(clearTimeout);
  jt = [
    setTimeout(() => { $('judgeTitle').textContent = ok ? 'Duim omhoog!' : 'Duim omlaag.'; judgeVerdict(ok); }, JUDGE.think),
    setTimeout(() => {
      if (ok) { S.level++; updateUI(); }
      for (const el of [d, b]) { el.style.visibility = ''; el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' }); }
      b.focus();
    }, JUDGE.think + JUDGE.detail)
  ];
}
function openShop() {
  $('shopMoney').textContent = S.money;
  $('buyArmor').disabled = S.money < PRICE.armor;
  $('buyAugur').disabled = S.money < PRICE.augur;
  $('shopNote').textContent = `Je hebt Lorica ${S.armor} en Augur ${S.augur}. In ronde ${toRoman(S.level)} wordt het doel groter, het veld groter en zijn meer cijfers vals.${S.level === 2 ? ' Vanaf nu ligt ook × in het veld.' : ''}`;
  $('shopNext').textContent = `Betreed ronde ${toRoman(S.level)}`;
  $('shop').hidden = false;
}

$('claim').onclick = openJudge;
$('augur').onclick = () => {
  if (S.total === S.target) { toast('De augur knikt: zeg het tegen Caesar.'); return; }
  const path = oracleSearch();
  if (!path) { toast('De augur ziet geen weg binnen vier cijfers.'); return; }
  S.augur--; path.forEach(e => e.oracle = true); updateUI();
  toast(`De augur wijst ${path.length} ${path.length === 1 ? 'cijfer' : 'cijfers'} aan.`);
};
$('startBtn').onclick = () => { $('start').hidden = true; S.paused = false; arenaCheer(); };
$('judgeBtn').onclick = () => {
  $('judge').hidden = true; judgeEnd();
  if ($('judgeBtn').dataset.ok) openShop();
  else { newRound(); S.paused = false; }
};
$('buyArmor').onclick = () => { if (S.money >= PRICE.armor) { S.money -= PRICE.armor; S.armor += 3; updateUI(); openShop(); } };
$('buyAugur').onclick = () => { if (S.money >= PRICE.augur) { S.money -= PRICE.augur; S.augur++; updateUI(); openShop(); } };
$('shopNext').onclick = () => { $('shop').hidden = true; newRound(); S.paused = false; };

function toWorld(ev) {
  const r = cvs.getBoundingClientRect();
  steer.x = (ev.clientX - r.left - view.cw / 2) / view.scale;
  steer.y = (ev.clientY - r.top - view.ch / 2) / view.scale;
}
cvs.addEventListener('pointerdown', ev => { if (S.paused) return; cvs.setPointerCapture(ev.pointerId); steer.down = steer.active = true; toWorld(ev); });
cvs.addEventListener('pointermove', ev => { if (steer.down) toWorld(ev); });
['pointerup', 'pointercancel'].forEach(t => cvs.addEventListener(t, () => steer.down = false));

addEventListener('keydown', ev => {
  if (anyOverlay()) return;
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].includes(k)) { keys.add(k); ev.preventDefault(); }
  else if (k === 'Enter' && document.activeElement === document.body) { ev.preventDefault(); openJudge(); }
});
addEventListener('keyup', ev => keys.delete(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key));
addEventListener('blur', () => keys.clear());
new ResizeObserver(() => fitWorld(false)).observe(stage);

newRound();
requestAnimationFrame(loop);
