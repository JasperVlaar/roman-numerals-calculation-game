/* ---------- Balanstest (plan-chaos) ----------
   In de console: BALANCE.run()  (of BALANCE.run({ from: 6, to: 12 }) voor een deel; nummers zoals in de reeks, toernooien
   tellen mee als 'T1'..'T5'). Een bot speelt elk gevecht met wat je op dat moment redelijkerwijs hebt:
   - alle XP van de gevechten ervoor opgeraapt; punten om en om naar Vitality, Strength, Attack speed, Agility;
   - alles gekocht zodra het kon (goedkoopste eerst), het sterkste wapen voor dichtbij in de hand, beste uitrusting per vak.
   De bot loopt naar de dichtstbijzijnde, slaat, houdt zijn schild op als iemand vlakbij aanzet, en raapt brood op.
   Hij kan niet dood (veel leven); gemeten wordt de schade, als deel van je echte leven. Een bot speelt slechter dan jij:
   gebruik het om gevechten met elkaar te vergelijken, niet als absolute waarheid.
   Doel (plan): gewoon gevecht 20–45 s en 30–60% leven kwijt; chaos langer, op te vangen met brood. */
const BALANCE = (() => {
  const xpOfDef = def => {
    const lists = [...roundsOf(def), ...extraOf(def).filter(Boolean).map(e => e.foes)];
    for (const c of [def, ...(def.rounds || []).filter(r => !Array.isArray(r))]) {
      for (const h of [].concat(c.hatches || [])) if (h.foes) lists.push(h.foes);
      for (const w of [].concat(c.waves || [])) if (w.foes) for (let k = 0; k < (w.max ?? 3); k++) lists.push(w.foes);
    }
    return lists;
  };
  const count = def => xpOfDef(def).flat().reduce((n, [, c]) => n + c, 0);
  const xpOf = def => xpOfDef(def).flat().reduce((n, [t, c]) => n + foeXp(t) * c, 0);
  // De reeks als lijst: { label, stage, idx (of 't'), def }
  function series() {
    const out = []; let n = 0;
    STAGES.forEach((st, si) => {
      st.fights.forEach((def, fi) => { n++; out.push({ label: toRoman(n), num: n, stage: si, idx: fi, def }); });
      out.push({ label: 'T' + (si + 1), num: 'T' + (si + 1), stage: si, idx: 't', def: st.tourney });
    });
    return out;
  }
  // Wat je hebt op het moment van gevecht i (alles ervoor gewonnen).
  function loadout(list, i) {
    let xp = 0, money = 0, tourneys = 0; const owned = ['fists'], gear = {};
    const shopAt = k => Object.values(SHOPS).find(sh => sh.wares.includes(k));
    const priceOf = k => (GEAR[k] || WEAPONS[k]).price;
    let wish = Object.values(SHOPS).flatMap(sh => sh.wares).filter(k => k !== 'arrows').sort((a, b) => priceOf(a) - priceOf(b));
    for (let j = 0; j < i; j++) {
      const { def } = list[j];
      xp += xpOf(def); money += def.reward || 0; if (def.kind === 'tournament') tourneys++;
      for (const k of [...wish]) {
        if (shopAt(k).after > tourneys || ((GEAR[k] || WEAPONS[k]).after || 0) > tourneys || money < priceOf(k)) continue;
        money -= priceOf(k); wish = wish.filter(x => x !== k); owned.push(k); if (GEAR[k]) gear[GEAR[k].slot] = k;
      }
    }
    const melee = owned.filter(k => WEAPONS[k] && !isBow(k)).sort((a, b) => WEAPONS[b].price - WEAPONS[a].price)[0];   // duurste = laatst gekocht
    const lvl = levelOf(xp), pts = (lvl - 1) * POINTS.perLevel, order = ['vitality', 'strength', 'haste', 'agility'], stats = { strength: 0, agility: 0, vitality: 0, haste: 0 };
    for (let p = 0; p < pts; p++) stats[order[p % order.length]]++;
    return { xp, lvl, stats, melee, gear: { body: gear.body || null, head: gear.head || null, shield: gear.shield || null, mount: null, quiver: null } };
  }
  // Eén gevecht spelen. Geeft duur, schade (deel van je echte leven), geheeld met brood, en of het gewonnen is.
  function play(entry, lo, cap = 150) {
    for (const id of ['title', 'settings', 'credits', 'start', 'result', 'stats', 'town', 'shop', 'pick', 'judge']) $(id).hidden = true;
    S.test = null; S.god = false; S.finished = false; S.stage = entry.stage;
    S.inStage = entry.idx === 't' ? STAGES[entry.stage].fights.length : entry.idx; S.mode = entry.idx === 't' ? 'tournament' : 'fight';
    Object.assign(S.stats, lo.stats); S.melee = lo.melee; S.ranged = null; S.active = 'melee'; S.gear = { ...lo.gear }; syncWeapon();
    S.xp = lo.xp; S.points = 0; S.over = null; S.seen = { basics: true };
    const realMax = me.maxHp, BIG = 9999, oldHp = PLAYER.hp;
    PLAYER.hp = BIG; startFight(); S.paused = false;
    const start = P.hp;   // incl. extra leven van Vitality
    let t = 0, healed = 0, breads = 0, maxOnField = 0, last = P.hp;
    const step = 1 / 60;
    for (; t < cap && !S.over; t += step) {
      if (S.intro > 0) S.intro = 0;
      keys.clear(); P.atkBuf = 0;
      const g = S.cfg && S.cfg.goal;
      // bij 'laat de olifant vertrappen' slaat de bot de olifant niet
      const live = S.foes.filter(f => f.side !== 'hero' && targetable(f) && !(g && g.kind === 'trample' && f.d.ai === 'elephant'));
      maxOnField = Math.max(maxOnField, live.length);
      // brood in de buurt? eerst dat
      const bread = (S.breads || []).filter(b => b.state === 'ground').sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0];
      const near = live.sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0];
      let gx = null, gy = null;
      if (bread && Math.hypot(bread.x - P.x, bread.y - P.y) < 110) { gx = bread.x; gy = bread.y; }
      else if (g && g.kind === 'hold') { gx = 0; gy = 0; }
      else if (near) { const gap = Math.hypot(near.x - P.x, near.y - P.y) - near.d.radius - PLAYER.radius; if (gap > WEAPONS[S.melee].reach - 3) { gx = near.x; gy = near.y; } }
      if (gx !== null) { const dx = gx - P.x, dy = gy - P.y; if (Math.abs(dx) > 4) keys.add(dx > 0 ? 'd' : 'a'); if (Math.abs(dy) > 4) keys.add(dy > 0 ? 's' : 'w'); }
      // schild op als iemand vlakbij aanzet
      if (me.shield && live.some(f => (f.state === 'windup' || f.state === 'combo') && Math.hypot(f.x - P.x, f.y - P.y) < 50)) keys.add('k');
      else if (P.cd === 0) P.atkBuf = .2;
      if (S.netsLeft > 0 && near && near.d.animal && near.hp <= near.d.hp * .5) throwPlayerNet();
      const hp0 = P.hp;
      update(step);
      if (P.hp > hp0) { healed += P.hp - hp0; breads++; }
      last = P.hp;
    }
    const taken = start - P.hp + healed;
    const left = S.foes.filter(f => f.side !== 'hero' && targetable(f)).map(f => f.d.name).join(',');
    const res = { fight: entry.label, kind: entry.def.kind, type: fightTag(entry.def) || '', enemies: count(entry.def), maxOnField, level: lo.lvl, weapon: WEAPONS[lo.melee].name,
                  shield: lo.gear.shield || '-', armor: me.armor, hp: realMax, seconds: Math.round(t), result: S.over === 'won' ? 'won' : S.over === 'lost' ? 'LOST' : 'timeout',
                  damage: Math.round(taken), lostPct: Math.round(taken / realMax * 100), breads, healedPct: Math.round(healed / realMax * 100), netPct: Math.round((taken - healed) / realMax * 100), left: S.over ? '' : left };
    PLAYER.hp = oldHp; S.paused = true; S.over = 'done';
    return res;
  }
  function run({ from = 1, to = 99, cap = 150, quiet = false } = {}) {
    const list = series(), rows = [];
    list.forEach((e, i) => {
      const n = typeof e.num === 'number' ? e.num : list.slice(0, i).filter(x => typeof x.num === 'number').length + .5;
      if (n < from || n > to) return;
      rows.push(play(e, loadout(list, i), cap));
    });
    if (!quiet) console.table(rows);
    return rows;
  }
  return { run, play, series, loadout };
})();
