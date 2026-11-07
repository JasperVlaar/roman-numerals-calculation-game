/* ---------- Testmenu (geheim) ----------
   Typ snel achter elkaar s p q r (binnen 1,5 seconde, waar je ook bent in het spel) en er opent een menu:
   kies een gevecht of toernooi, je stats, wapen en denarii, en spring er direct in.
   Let op: wie de broncode leest, vindt dit ook. Voor vrienden die gewoon spelen is het onzichtbaar. */

(() => {
  const CODE = 'spqr', WINDOW = 1500;
  let typed = '', last = 0;
  addEventListener('keydown', ev => {
    if (ev.target.closest && ev.target.closest('input, select, textarea')) return;
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : '';
    if (!k) return;
    const now = performance.now();
    typed = (now - last > WINDOW ? '' : typed) + k; last = now;
    if (typed.endsWith(CODE)) { typed = ''; open(); }
  }, true);

  let box = null;
  function build() {
    box = document.createElement('div');
    box.className = 'overlay'; box.id = 'dev'; box.hidden = true;
    const opts = [];
    let n = 0;
    STAGES.forEach((st, si) => {
      st.fights.forEach((f, fi) => { n++; opts.push(`<option value="f:${si}:${fi}">Gevecht ${toRoman(n)} · ${f.kind === 'boss' ? 'tussenbaas: ' : ''}${listSummary(f.foes)}</option>`); });
      opts.push(`<option value="t:${si}">Toernooi ${toRoman(si + 1)} · eindbaas ${listSummary(st.tourney.rounds[st.tourney.rounds.length - 1])}</option>`);
    });
    const weapons = Object.entries(WEAPONS).map(([k, w]) => `<option value="${k}">${w.name}</option>`).join('');
    box.innerHTML = `<div class="panel dev">
      <p class="eyebrow">Testmenu</p>
      <h2>Spring naar een gevecht</h2>
      <label>Gevecht<select id="devFight">${opts.join('')}</select></label>
      <div class="dev-grid">
        ${Object.entries(STATS).map(([k, d]) => `<label>${d.nl}<input type="number" min="0" max="30" step="1" id="dev_${k}" value="0"></label>`).join('')}
        <label>Wapen<select id="devWeapon">${weapons}</select></label>
        <label>Denarii<input type="number" min="0" max="9999" step="1" id="devMoney" value="0"></label>
      </div>
      <p class="muted small" id="devNote"></p>
      <div class="dev-row">
        <button class="btn" id="devRandom">Willekeurig</button>
        <button class="btn" id="devTown">Naar de stad</button>
        <button class="primary" id="devGo">Vecht</button>
      </div>
      <button class="btn wide" id="devClose">Sluiten (Esc)</button>
    </div>`;
    document.body.appendChild(box);
    $('devRandom').onclick = randomize;
    $('devGo').onclick = () => apply(true);
    $('devTown').onclick = () => apply(false);
    $('devClose').onclick = close;
    $('devFight').onchange = randomize;   // ander gevecht: meteen logische stats, wapen en geld
    for (const k of Object.keys(STATS)) $('dev_' + k).oninput = note;
    box.addEventListener('keydown', ev => { if (ev.key === 'Escape') close(); });
  }
  // Willekeurig, maar wel logisch: wat je zou hebben als je alles ervoor gewonnen had en alle XP had opgeraapt.
  // Punten = 2 per niveau uit die XP, willekeurig verdeeld. Geld = alle beloningen, en na elk gevecht koop je het
  // volgende wapen zodra je het kunt betalen (stok, daarna gladius). Wat overblijft is je geld.
  let plan = null;
  function history() {
    const [type, si, fi] = $('devFight').value.split(':').map((v, i) => i ? +v : v), done = [];
    STAGES.forEach((st, s) => {
      if (s < si) { done.push(...st.fights, st.tourney); return; }
      if (s === si) done.push(...st.fights.slice(0, type === 't' ? st.fights.length : fi));
    });
    return done;
  }
  const xpOf = def => roundsOf(def).flat().reduce((n, [t, c]) => n + (XP.perFoe[t] || 3) * c, 0);
  function randomize() {
    const done = history(), shop = Object.keys(WEAPONS).filter(k => WEAPONS[k].price > 0).sort((a, b) => WEAPONS[a].price - WEAPONS[b].price);
    let xp = 0, money = 0, spent = 0, weapon = 'fists'; const bought = [];
    for (const def of done) {
      xp += xpOf(def); money += def.reward || 0;
      while (shop.length && money >= WEAPONS[shop[0]].price) { const k = shop.shift(); money -= WEAPONS[k].price; spent += WEAPONS[k].price; bought.push(WEAPONS[k].name.toLowerCase()); weapon = k; }
    }
    const level = levelOf(xp), pts = POINTS.start + (level - 1) * POINTS.perLevel;
    const keys = Object.keys(STATS), v = Object.fromEntries(keys.map(k => [k, 0]));
    for (let i = 0; i < pts; i++) v[keys[Math.floor(Math.random() * keys.length)]]++;
    for (const k of keys) $('dev_' + k).value = v[k];
    $('devWeapon').value = weapon; $('devMoney').value = money;
    plan = { xp, pts, sig: JSON.stringify(v) + weapon + money };
    $('devNote').textContent = `${done.length} ${done.length === 1 ? 'gevecht' : 'gevechten'} gewonnen, alle XP opgeraapt: ${xp} XP, niveau ${toRoman(level)}, ${pts} punten (willekeurig verdeeld). `
      + `Verdiend ${money + spent} d, uitgegeven ${spent} d${bought.length ? ` aan ${bought.join(' en ')}` : ''}, over ${money} d.`;
  }
  function note(ev) {
    if (ev && ev.target && ev.target.id === 'devFight') { plan = null; }
    const pts = Object.keys(STATS).reduce((a, k) => a + (+$('dev_' + k).value || 0), 0);
    $('devNote').textContent = `${pts} punten verdeeld. Het spel telt dit als een gewone run: winnen en verliezen werken zoals normaal.`;
  }
  function apply(fight) {
    const [type, si, fi] = $('devFight').value.split(':').map((v, i) => i ? +v : v);
    for (const id of ['start', 'result', 'stats', 'town', 'shop', 'pick', 'judge']) $(id).hidden = true;
    judgeEnd();
    S.stage = si; S.finished = false;
    S.inStage = type === 't' ? STAGES[si].fights.length : fi;   // bij een toernooi: alsof je het blok al hebt gehad
    S.mode = type === 't' ? 'tournament' : 'fight';
    for (const k of Object.keys(STATS)) S.stats[k] = Math.max(0, Math.round(+$('dev_' + k).value || 0));
    const w = $('devWeapon').value, all = Object.keys(WEAPONS);
    PLAYER.weapon = w; S.owned = all.slice(0, all.indexOf(w) + 1);
    S.money = Math.max(0, Math.round(+$('devMoney').value || 0));
    S.points = 0; S.townSeen = true; S.over = null; S.delta = 0;
    // XP: na 'Willekeurig' (en niets daarna aangepast) de echte XP; anders het begin van het niveau dat bij de punten hoort.
    const pts = Object.values(S.stats).reduce((a, b) => a + b, 0), lvl = Math.floor(pts / POINTS.perLevel);
    const sig = JSON.stringify(Object.fromEntries(Object.keys(STATS).map(k => [k, S.stats[k]]))) + w + S.money;
    S.xp = plan && plan.sig === sig ? plan.xp : lvl > 0 ? LEVELS[Math.min(lvl, LEVELS.length) - 1] : 0;
    SFX.init(); keys.clear();
    close();
    if (fight) { startFight(); S.paused = false; }
    else { S.paused = true; startFight(); S.over = 'done'; openTown(); }
  }
  function open() {
    if (!box) build();
    S.paused = true; keys.clear();
    note(); box.hidden = false; $('devFight').focus();
  }
  function close() { box.hidden = true; if (['start', 'result', 'stats', 'town', 'shop', 'pick', 'judge'].every(id => $(id).hidden) && !S.over) S.paused = false; }
})();
