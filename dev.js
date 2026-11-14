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
    // Elk gevecht met zijn soort erbij ([Team fight], [Survive 40 s], ...) en categorieën om op te filteren.
    const opts = [];
    let n = 0;
    const cats = def => {   // soorten in een gevecht (of in de rondes van een toernooi)
      const parts = [def, ...(def.rounds || []).filter(r => !Array.isArray(r))], c = new Set();
      for (const p of parts) { if (p.type) c.add(p.type); if (p.goal) c.add(p.goal.kind); if (p.hatches) c.add('hatches'); }
      if (def.kind === 'boss') c.add('boss');
      if (def.kind === 'tournament') c.add('tournament');
      if (![...c].some(k => k in TYPES || k in GOALS_DEFAULT)) c.add('plain');
      return [...c].join(' ');
    };
    const tag = def => fightTag(def) ? `[${fightTag(def)}] ` : '';
    STAGES.forEach((st, si) => {
      st.fights.forEach((f, fi) => { n++; opts.push(`<option value="f:${si}:${fi}" data-cats="${cats(f)}">Fight ${toRoman(n)} · ${tag(f)}${f.kind === 'boss' ? 'mini-boss: ' : ''}${listSummary(f.foes)}</option>`); });
      const t = st.tourney, rt = t.rounds.map((r, i) => !Array.isArray(r) && fightTag(r) ? `R${i + 1} ${fightTag(r)}` : '').filter(Boolean);
      opts.push(`<option value="t:${si}" data-cats="${cats(t)}">Tournament ${toRoman(si + 1)} · ${rt.length ? `[${rt.join(', ')}] ` : ''}final boss ${listSummary(roundsOf(t).at(-1))}</option>`);
    });
    const filters = [['', 'all fights'], ['plain', 'defeat all (no special type)'], ...Object.entries(TYPES), ['survive', 'Survive'], ['trample', 'Let the elephant trample'],
                     ['champion', 'Defeat the champion'], ['timed', 'Win in time'], ['hold', 'Hold the center'], ['hatches', 'Hatches (animals)'], ['boss', 'Mini-boss'], ['tournament', 'Tournament']];
    const weapons = Object.entries(WEAPONS).filter(([k]) => !isBow(k)).map(([k, w]) => `<option value="${k}">${w.name}</option>`).join('');
    const bows = '<option value="">none</option>' + Object.entries(WEAPONS).filter(([k]) => isBow(k)).map(([k, w]) => `<option value="${k}">${w.name}</option>`).join('');
    box.innerHTML = `<div class="panel dev">
      <p class="eyebrow">Test menu</p>
      <div class="dev-cols">
      <section class="dev-col">
      <h2>Jump to a fight</h2>
      <label>Show<select id="devFilter">${filters.map(([k, nm]) => `<option value="${k}">${nm}</option>`).join('')}</select></label>
      <label>Fight<select id="devFight">${opts.join('')}</select></label>
      <div class="dev-grid">
        ${Object.entries(STATS).map(([k, d]) => `<label>${d.nl}<input type="number" min="0" max="30" step="1" id="dev_${k}" value="0"></label>`).join('')}
        <label>Weapon (1)<select id="devWeapon">${weapons}</select></label>
        <label>Bow (2)<select id="devBow">${bows}</select></label>
        ${Object.entries(SLOTS).map(([slot, nl]) => `<label>${nl}<select id="dev_gear_${slot}"><option value="">none</option>${Object.entries(GEAR).filter(([, g]) => g.slot === slot).map(([k, g]) => `<option value="${k}">${g.name}</option>`).join('')}</select></label>`).join('')}
        <label>Arrows<input type="number" min="0" max="15" step="1" id="devAmmo" value="0"></label>
        <label>Denarii<input type="number" min="0" max="9999" step="1" id="devMoney" value="0"></label>
      </div>
      <p class="muted small" id="devNote"></p>
      <div class="dev-row">
        <button class="btn" id="devRandom">Random</button>
        <button class="btn" id="devTown">To the town</button>
        <button class="primary" id="devGo">Fight</button>
      </div>
      </section>
      <section class="dev-col">
      <h2>Test arena</h2>
      <p class="muted small">Pick enemies and a fight type; your stats and gear come from the left.</p>
      <div class="dev-grid dev-test">
        ${[0, 1, 2].map(i => `<label>Enemy ${i + 1}<select id="devFoe${i}"><option value="">—</option>${foeTypes()}</select></label><label>Count<input type="number" min="1" max="20" step="1" id="devFoeN${i}" value="1"></label>`).join('')}
        <label>Type<select id="devType"><option value="">normal</option>${Object.entries(TYPES).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
        <label>Goal<select id="devGoal"><option value="">defeat all</option>${Object.keys(GOALS_DEFAULT).map(k => `<option value="${k}">${k}</option>`).join('')}</select></label>
        <label>Ally (team)<select id="devAlly"><option value="">—</option>${foeTypes()}</select></label><label>Count<input type="number" min="1" max="10" step="1" id="devAllyN" value="1"></label>
        <label>Hatches<select id="devHatch"><option value="">—</option>${['hyena', 'tiger', 'lion', 'bear'].map(k => `<option value="${k}">${FOES[k].plural} every 10 s</option>`).join('')}</select></label>
        <label>Nets<input type="number" min="0" max="9" step="1" id="devNets" value="0"></label>
      </div>
      <div class="dev-row">
        <button class="primary" id="devTest">Test</button>
      </div>
      </section>
      </div>
      <div class="dev-row dev-foot">
        <label class="dev-check"><input type="checkbox" id="devGod"> Immortal</label>
        <button class="btn wide" id="devClose">Close (Esc)</button>
      </div>
    </div>`;
    document.body.appendChild(box);
    $('devRandom').onclick = randomize;
    $('devGo').onclick = () => apply(true);
    $('devTest').onclick = () => {
      const list = [0, 1, 2].map(i => [$('devFoe' + i).value, Math.max(1, Math.round(+$('devFoeN' + i).value || 1))]).filter(([t]) => t);
      const ally = $('devAlly').value, hatch = $('devHatch').value, nets = Math.round(+$('devNets').value || 0);
      S.testCfg = { type: $('devType').value || undefined, goal: $('devGoal').value ? { kind: $('devGoal').value } : undefined,
                    allies: ally ? [[ally, Math.max(1, Math.round(+$('devAllyN').value || 1))]] : undefined,
                    hatches: hatch ? { every: 10, foes: [[hatch, hatch === 'hyena' ? 2 : 1]], max: 3 } : undefined, nets: nets || undefined };
      if (list.length || hatch) apply(true, list);
    };
    $('devFoe0').value = 'murmillo';
    $('devTown').onclick = () => apply(false);
    $('devClose').onclick = close;
    $('devFight').onchange = randomize;   // ander gevecht: meteen logische stats, wapen en geld
    $('devFilter').onchange = () => {   // filter op soort gevecht: alleen die gevechten in de lijst
      const want = $('devFilter').value, sel = $('devFight');
      let first = null;
      for (const o of sel.options) { o.hidden = !!want && !o.dataset.cats.split(' ').includes(want); if (!o.hidden && !first) first = o; }
      $('devNote').textContent = first ? '' : 'No fight of this kind in the series yet.';
      if (first && sel.selectedOptions[0].hidden) { sel.value = first.value; randomize(); }
    };
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
  const xpOf = def => [...roundsOf(def), ...extraOf(def).filter(Boolean).map(e => e.foes)].flat().reduce((n, [t, c]) => n + foeXp(t) * c, 0);
  function randomize() {
    // Wat je kunt kopen, goedkoopste eerst; een winkel telt pas mee als hij op dat moment open is.
    const done = history(), priceOf = k => (GEAR[k] || WEAPONS[k]).price;
    const shopAt = k => Object.values(SHOPS).find(sh => sh.wares.includes(k));
    let wish = Object.values(SHOPS).flatMap(sh => sh.wares).filter(k => k !== 'arrows').sort((a, b) => priceOf(a) - priceOf(b));
    let xp = 0, money = 0, spent = 0, tourneys = 0; const bought = [], owned = ['fists'], gear = { body: '', head: '', shield: '', mount: '' };
    for (const def of done) {
      xp += xpOf(def); money += def.reward || 0;
      if (def.kind === 'tournament') tourneys++;
      for (const k of [...wish]) {
        if (shopAt(k).after > tourneys || ((GEAR[k] || WEAPONS[k]).after || 0) > tourneys || money < priceOf(k)) continue;
        money -= priceOf(k); spent += priceOf(k); bought.push((GEAR[k] || WEAPONS[k]).name.toLowerCase()); wish = wish.filter(x => x !== k);
        owned.push(k); if (GEAR[k]) gear[GEAR[k].slot] = k;   // duurder = beter: het laatst gekochte stuk per vak draag je
      }
    }
    // Wapen: met strijdwagen de beste boog (en dan geen schild), anders het sterkste wapen voor dichtbij.
    const bows = owned.filter(k => WEAPONS[k] && isBow(k)), melee = owned.filter(k => WEAPONS[k] && !isBow(k));
    const best = list => list.sort((a, b) => WEAPONS[b].dmg - WEAPONS[a].dmg)[0];
    const weapon = best(melee), bow = bows.length ? best(bows) : '';
    if (!bow) gear.mount = '';
    const level = levelOf(xp), pts = POINTS.start + (level - 1) * POINTS.perLevel;
    const keys = Object.keys(STATS), v = Object.fromEntries(keys.map(k => [k, 0]));
    for (let i = 0; i < pts; i++) v[keys[Math.floor(Math.random() * keys.length)]]++;
    for (const k of keys) $('dev_' + k).value = v[k];
    $('devWeapon').value = weapon; $('devBow').value = bow; $('devMoney').value = money;
    $('devAmmo').value = bow ? (gear.quiver ? GEAR[gear.quiver].capacity : AMMO.base) : 0;   // pijlen: koker vol (niet meegeteld in het geld)
    for (const slot of Object.keys(SLOTS)) $('dev_gear_' + slot).value = gear[slot];
    plan = { xp, pts, bought: done.length, sig: JSON.stringify(v) + weapon + money };
    $('devNote').textContent = `${done.length} ${done.length === 1 ? 'fight' : 'fights'} won, all XP picked up: ${xp} XP, level ${toRoman(level)}, ${pts} points (randomly spent). `
      + `Earned ${money + spent} d, spent ${spent} d${bought.length ? ` on ${bought.slice(0, -1).join(', ')}${bought.length > 1 ? ' and ' : ''}${bought[bought.length - 1]}` : ''}, ${money} d left.`;
  }
  function note(ev) {
    if (ev && ev.target && ev.target.id === 'devFight') { plan = null; }
    const pts = Object.keys(STATS).reduce((a, k) => a + (+$('dev_' + k).value || 0), 0);
    $('devNote').textContent = `${pts} points spent. The game counts this as a normal run: winning and losing work as usual.`;
  }
  // Alle vijanden, plus van elke klasse (geen slaaf of dier) de kampioen-versie.
  function foeTypes() {
    const keys = Object.keys(FOES), champs = keys.filter(k => !['slave', 'archer'].includes(k) && !FOES[k].animal).map(k => 'champion:' + k);
    return [...keys, ...champs].map(k => `<option value="${k}">${foeBase(k).name}</option>`).join('');
  }
  function apply(fight, test = null) {
    const [type, si, fi] = $('devFight').value.split(':').map((v, i) => i ? +v : v);
    for (const id of ['title', 'settings', 'credits', 'start', 'result', 'stats', 'town', 'shop', 'pick', 'judge']) $(id).hidden = true;
    judgeEnd();
    S.stage = si; S.finished = false; S.test = test; S.god = $('devGod').checked;
    S.inStage = type === 't' ? STAGES[si].fights.length : fi;   // bij een toernooi: alsof je het blok al hebt gehad
    S.mode = type === 't' ? 'tournament' : 'fight';
    for (const k of Object.keys(STATS)) S.stats[k] = Math.max(0, Math.round(+$('dev_' + k).value || 0));
    const w = $('devWeapon').value, all = Object.keys(WEAPONS);
    const bw = $('devBow').value || null;
    S.melee = w; S.ranged = bw; S.active = 'melee'; S.switching = 0;
    S.owned = all.filter(k => !isBow(k) && WEAPONS[k].price <= WEAPONS[w].price || bw && isBow(k) && WEAPONS[k].price <= WEAPONS[bw].price);
    S.gear = { body: null, head: null, shield: null, mount: null };
    for (const slot of Object.keys(SLOTS)) {
      const g = $('dev_gear_' + slot).value || null; S.gear[slot] = g;
      // wat goedkoper is in hetzelfde vak heb je dan ook al gekocht
      if (g) S.owned.push(...Object.keys(GEAR).filter(k => GEAR[k].slot === slot && GEAR[k].price <= GEAR[g].price));
    }
    if (!bw) S.gear.mount = null;   // strijdwagen alleen met een boog
    syncWeapon();
    S.ammo = Math.max(0, Math.min(me.ammoMax, Math.round(+$('devAmmo').value || 0)));
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
  function close() { box.hidden = true; if (['title', 'settings', 'credits', 'start', 'result', 'stats', 'town', 'shop', 'pick', 'judge'].every(id => $(id).hidden) && !S.over) S.paused = false; }
})();
