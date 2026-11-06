const $ = id => document.getElementById(id);
const cvs = $('arena'), ctx = cvs.getContext('2d'), stage = $('stage');
const css = getComputedStyle(document.documentElement);
const C = {}; ['night','stone','stone-2','porphyry','bronze','sand','sand-2','ink','muted','blood','blood-dark','laurel','coin','coin-edge','coin-ink','horse','wall'].forEach(k => C[k] = css.getPropertyValue('--' + k).trim());

const PRICE = { armor: 20, augur: 12 };
const S = { level: 1, money: 0, armor: 0, augur: 0, op: '+', tokens: [], total: null, target: 0, ents: [], floats: [], dust: [], paused: true, cfg: null };
const W = { rx: 280, ry: 220, area: 66000 };
const view = { cw: 1, ch: 1, dpr: 1, scale: 1 };
const car = { x: 0, y: 0, vx: 0, vy: 0, a: -Math.PI / 2 };
const steer = { active: false, down: false, x: 0, y: 0 };
const keys = new Set();

const ROMAN = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
function toRoman(n) {
  if (n <= 0) return 'nulla';
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
    values: sets[i],
    count: Math.min(7 + (l - 1) * 2, 16),
    range: ranges[i].map(v => Math.round(v * Math.pow(1.5, extra))),
    terms: l === 1 ? [2] : l < 4 ? [2, 3] : [3],
    fakeRate: Math.min(.1 + .07 * (l - 1), .4),
    area: 66000 * Math.pow(1.2, l - 1)
  };
}
function evalSeq(vals, ops) { let t = vals[0]; for (let i = 1; i < vals.length; i++) t = ops[i - 1] === '+' ? t + vals[i] : t * vals[i]; return t; }
function findTarget(vals, c) {
  for (let n = 0; n < 400; n++) {
    const k = pick(c.terms), idx = [];
    while (idx.length < k) { const j = Math.floor(Math.random() * vals.length); if (!idx.includes(j)) idx.push(j); }
    const ops = Array.from({ length: k - 1 }, () => Math.random() < .5 ? '+' : '×');
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
    if (S.ents.some(o => o !== e && Math.hypot(o.x - x, o.y - y) < 60)) continue;
    e.x = x; e.y = y; break;
  }
  const a = Math.random() * Math.PI * 2, sp = 18 + Math.random() * 26;
  e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp;
}
function rollFake(e) {
  e.fake = !e.anchor && Math.random() < S.cfg.fakeRate;
  e.trueVal = e.fake ? pick(S.cfg.values.filter(v => v !== e.val)) : e.val;
}
function mkEnt(val, anchor) {
  const e = { val, shown: val, anchor, state: 'free', t: 0, spawn: 0, oracle: false, x: 0, y: 0, vx: 0, vy: 0 };
  rollFake(e); place(e); return e;
}
function respawn(e) { e.shown = e.val; e.oracle = false; e.state = 'free'; e.spawn = .35; rollFake(e); place(e); }

function newRound() {
  const c = S.cfg = cfg(S.level);
  W.area = c.area; car.x = 0; car.y = 0; car.vx = car.vy = 0; steer.active = false;
  fitWorld(true);
  let vals, sol;
  do { vals = Array.from({ length: c.count }, () => pick(c.values)); sol = findTarget(vals, c); } while (!sol);
  S.target = sol.target; S.ents = [];
  vals.forEach((v, i) => S.ents.push(mkEnt(v, sol.idx.includes(i))));
  S.tokens = []; S.total = null; S.floats = []; S.dust = [];
  updateUI();
}

/* ---------- rules ---------- */
function applyVal(v, fake) {
  if (S.total === null) { S.tokens.push({ k: 'n', v, fake }); S.total = v; }
  else {
    S.tokens.push({ k: 'o', op: S.op }, { k: 'n', v, fake });
    S.total = S.op === '+' ? S.total + v : S.total * v;
  }
  updateUI();
}
function catchEnt(e) {
  if (e.fake) {
    if (S.armor > 0) { S.armor--; e.state = 'blocked'; e.t = .7; float(e.x, e.y - 30, 'Lorica!', C.sand); }
    else { e.state = 'reveal'; e.t = 1; float(e.x, e.y - 34, 'Vals!', C.blood); }
    updateUI();
  } else {
    const label = (S.total === null ? '' : S.op + ' ') + toRoman(e.val);
    applyVal(e.val, false); float(e.x, e.y - 30, label, C.ink); respawn(e);
  }
}
function float(x, y, text, color) { S.floats.push({ x, y, text, color, t: 1 }); }

function oracleSearch() {
  const reals = S.ents.filter(e => !e.fake && e.state === 'free');
  const used = []; let best = null;
  function rec(total, depth, maxD) {
    if (total === S.target && used.length) { best = used.slice(); return true; }
    if (depth === maxD) return false;
    for (const e of reals) {
      if (used.includes(e)) continue;
      const opts = total === null ? [e.val] : [total + e.val, total * e.val];
      for (const nt of opts) {
        if (nt > S.target) continue;
        used.push(e); if (rec(nt, depth + 1, maxD)) return true; used.pop();
      }
    }
    return false;
  }
  for (let d = 1; d <= 4; d++) if (rec(S.total, 0, d)) break;
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
  contain(car, W.rx - 20, W.ry - 20, false);
  const sp = Math.hypot(car.vx, car.vy);
  if (sp > 8) car.a = lerpAngle(car.a, Math.atan2(car.vy, car.vx), 1 - Math.exp(-dt * 10));
  if (sp > 80 && Math.random() < dt * 40) S.dust.push({ x: car.x - Math.cos(car.a) * 18 + (Math.random() - .5) * 14, y: car.y - Math.sin(car.a) * 18 + (Math.random() - .5) * 14, t: 1 });

  for (const e of S.ents) {
    if (e.spawn > 0) e.spawn = Math.max(0, e.spawn - dt);
    if (e.state === 'free') {
      const r = (Math.random() - .5) * dt * 1.6, c = Math.cos(r), s = Math.sin(r);
      [e.vx, e.vy] = [e.vx * c - e.vy * s, e.vx * s + e.vy * c];
      e.x += e.vx * dt; e.y += e.vy * dt;
      contain(e, W.rx - 26, W.ry - 26, true);
      if (e.spawn === 0 && Math.hypot(e.x - car.x, e.y - car.y) < 42) catchEnt(e);
    } else {
      e.t -= dt;
      if (e.state === 'reveal') {
        if (e.t < .55) e.shown = e.trueVal;
        if (e.t <= 0) { applyVal(e.trueVal, true); respawn(e); }
      } else if (e.state === 'blocked' && e.t <= 0) respawn(e);
    }
  }
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
  for (const p of S.dust) { ctx.fillStyle = C['sand-2']; ctx.globalAlpha = p.t * .5; ctx.beginPath(); ctx.arc(p.x, p.y, 4 + (1 - p.t) * 6, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;

  for (const e of S.ents) drawCoin(e, now);
  drawCar();

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of S.floats) {
    ctx.globalAlpha = Math.min(1, f.t * 1.5); ctx.font = '700 20px Cinzel, Georgia, serif';
    ctx.lineWidth = 4; ctx.strokeStyle = C.night; ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1; ctx.restore();
}
function drawCoin(e, now) {
  let r = 24 * (1 - e.spawn / .35 * .9), alpha = 1, fill = C.coin, ink = C['coin-ink'];
  if (e.state === 'reveal') { const on = Math.floor(now / 90) % 2 === 0; fill = on ? C.blood : C['blood-dark']; ink = C.ink; }
  if (e.state === 'blocked') { alpha = Math.max(0, e.t / .7); r *= 1 + (1 - alpha) * .5; fill = C.muted; }
  ctx.save(); ctx.translate(e.x, e.y); ctx.globalAlpha = alpha;
  if (e.oracle && e.state === 'free') {
    ctx.strokeStyle = C.laurel; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r + 8 + Math.sin(now / 180) * 2.5, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(2, 4, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C['coin-edge']; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.globalAlpha = alpha * .35; ctx.beginPath(); ctx.arc(0, 0, Math.max(0, r - 5), 0, Math.PI * 2); ctx.lineWidth = 1; ctx.stroke();
  ctx.globalAlpha = alpha;
  const txt = toRoman(e.shown), size = txt.length <= 2 ? 21 : txt.length === 3 ? 17 : 14;
  ctx.fillStyle = ink; ctx.font = `700 ${size * r / 24}px Cinzel, Georgia, serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 1);
  ctx.restore();
}
function drawCar() {
  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.a);
  ctx.strokeStyle = C.wall; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(2, -6); ctx.lineTo(18, -7); ctx.moveTo(2, 6); ctx.lineTo(18, 7); ctx.stroke();
  for (const y of [-7, 7]) {
    ctx.fillStyle = C.horse;
    ctx.beginPath(); ctx.ellipse(24, y, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(39, y, 5.5, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = C['coin-ink'];
  ctx.fillRect(-14, -16, 14, 4); ctx.fillRect(-14, 12, 14, 4);
  ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(-4, -12); ctx.arc(-4, 0, 12, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-14, 12); ctx.closePath();
  ctx.fillStyle = C.porphyry; ctx.fill(); ctx.strokeStyle = C.bronze; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.bronze; ctx.beginPath(); ctx.arc(-6, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  requestAnimationFrame(loop);
  try { if (!S.paused) update(dt); draw(now); } catch (err) { console.error(err); }
}

/* ---------- UI ---------- */
function updateUI() {
  $('goal').textContent = toRoman(S.target);
  $('lvl').textContent = toRoman(S.level);
  $('money').textContent = S.money;
  $('armor').textContent = S.armor;
  $('augur').textContent = `Augur · ${S.augur}`;
  $('augur').disabled = S.augur <= 0;
  $('claim').disabled = S.total === null;
  $('clear').disabled = !S.tokens.length;
  $('opAdd').setAttribute('aria-pressed', S.op === '+');
  $('opMul').setAttribute('aria-pressed', S.op === '×');
  const el = $('expr'); el.innerHTML = '';
  if (!S.tokens.length) { el.innerHTML = '<span class="hint">Vang je eerste cijfer</span>'; return; }
  const add = (cls, text, title) => { const s = document.createElement('span'); s.className = 'tok ' + cls; s.textContent = text; if (title) s.title = title; el.appendChild(s); };
  for (const t of S.tokens) t.k === 'o' ? add('op', t.op) : add(t.fake ? 'fake' : '', toRoman(t.v), t.fake ? 'Vals cijfer: veranderd bij het oppakken' : '');
  add('op', S.op); add('next', '?');
  el.scrollLeft = el.scrollWidth;
}
let toastTimer;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400); }
function setOp(op) { S.op = op; updateUI(); }
function anyOverlay() { return !$('start').hidden || !$('judge').hidden || !$('shop').hidden; }

let jt = [];
function openJudge() {
  if (S.total === null) return;
  S.paused = true; keys.clear(); steer.down = false;
  const ok = S.total === S.target, salary = 10 + S.target;
  const hand = $('hand');
  hand.style.transition = 'none'; hand.classList.remove('up', 'down'); hand.classList.add('side');
  void hand.getBoundingClientRect(); hand.style.transition = '';
  $('judgeTitle').textContent = 'Caesar overweegt…';
  $('judgeDetail').hidden = true; $('judgeBtn').hidden = true; $('judge').hidden = false;
  jt.forEach(clearTimeout);
  jt = [
    setTimeout(() => { hand.classList.remove('side'); hand.classList.add(ok ? 'up' : 'down'); if (ok) arenaCheer(); $('judgeTitle').textContent = ok ? 'Duim omhoog!' : 'Duim omlaag.'; }, 1700),
    setTimeout(() => {
      const d = $('judgeDetail');
      d.innerHTML = `<dt>Jouw som</dt><dd class="${ok ? 'good' : 'bad'}">${toRoman(S.total)} · ${S.total}</dd>
        <dt>Doel</dt><dd>${toRoman(S.target)} · ${S.target}</dd>
        <dt>Salaris</dt><dd>${ok ? '+' + salary + ' denarii' : 'geen'}</dd>`;
      d.hidden = false;
      if (ok) { S.money += salary; S.level++; updateUI(); }
      const b = $('judgeBtn'); b.textContent = ok ? 'Naar de wapensmid' : 'Nieuwe poging'; b.dataset.ok = ok ? '1' : ''; b.hidden = false; b.focus();
    }, 2400)
  ];
}
function openShop() {
  $('shopMoney').textContent = S.money;
  $('buyArmor').disabled = S.money < PRICE.armor;
  $('buyAugur').disabled = S.money < PRICE.augur;
  $('shopNote').textContent = `Je hebt Lorica ${S.armor} en Augur ${S.augur}. In ronde ${toRoman(S.level)} wordt het doel groter, het veld groter en zijn meer cijfers vals.`;
  $('shopNext').textContent = `Betreed ronde ${toRoman(S.level)}`;
  $('shop').hidden = false;
}

$('opAdd').onclick = () => setOp('+');
$('opMul').onclick = () => setOp('×');
$('clear').onclick = () => { S.tokens = []; S.total = null; updateUI(); toast('Som gewist.'); };
$('claim').onclick = openJudge;
$('augur').onclick = () => {
  if (S.total === S.target) { toast('De augur knikt: zeg het tegen Caesar.'); return; }
  const path = oracleSearch();
  if (!path) { toast('De augur ziet geen weg. Wis je som en begin opnieuw.'); return; }
  S.augur--; path.forEach(e => e.oracle = true); updateUI();
  toast(`De augur wijst ${path.length} ${path.length === 1 ? 'cijfer' : 'cijfers'} aan.`);
};
$('startBtn').onclick = () => { $('start').hidden = true; S.paused = false; arenaCheer(); };
$('judgeBtn').onclick = () => {
  $('judge').hidden = true;
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
  else if (k === ' ') { ev.preventDefault(); setOp(S.op === '+' ? '×' : '+'); }
  else if (k === 'Enter' && document.activeElement === document.body) { ev.preventDefault(); openJudge(); }
  else if (k === 'Backspace') { ev.preventDefault(); $('clear').click(); }
});
addEventListener('keyup', ev => keys.delete(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key));
addEventListener('blur', () => keys.clear());
new ResizeObserver(() => fitWorld(false)).observe(stage);

newRound();
requestAnimationFrame(loop);
