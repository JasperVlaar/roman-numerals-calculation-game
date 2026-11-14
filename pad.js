/* ---------- Controller (Gamepad API) ----------
   Werkt met elke controller die de browser als 'standard' ziet (Xbox, PlayStation, de meeste andere).
   In het gevecht:
     linkerstick / D-pad = lopen, rechterstick = richten (los = je kijkt naar wie het dichtst bij staat),
     RT of X = slaan, LT of LB (vasthouden) = blokken, A = rollen, B = net, Y = wapen wisselen,
     Start = pauze, Back = geluid aan/uit. Een klap op jou laat de controller trillen.
   Het startscherm toont de knoppen van jouw controller: Xbox, PlayStation, Nintendo Switch of Steam Deck.
   In menu's en de stad: D-pad of linkerstick = kiezen, A = ok, B (of Start) = terug.
   Beweeg je de muis, dan neemt de muis het weer over. */
const PAD = (() => {
  const BTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
  const DEAD = .22, AIM_DEAD = .35, NAV_REPEAT = .22;   // dode zone van de sticks; in menu's: zo snel springt de keuze door als je vasthoudt
  const OVERLAYS = ['dev', 'pause', 'judge', 'result', 'stats', 'shop', 'pick', 'town', 'start', 'settings', 'credits', 'title'];
  const st = { active: false, connected: false, move: null, aim: null, block: false, prev: [], navDir: null, navT: 0, last: performance.now() };

  const stick = (x, y, dz) => { const m = Math.hypot(x, y); if (m < dz) return null; const k = Math.min(1, (m - dz) / (1 - dz)) / m; return [x * k, y * k]; };
  const key = k => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

  // Menu's: het bovenste open scherm, en wat je daarin kunt kiezen.
  function scope() { for (const id of OVERLAYS) { const el = document.getElementById(id); if (el && !el.hidden) return el; } return null; }
  function choices() {
    const sc = scope(); if (!sc) return [];
    return [...sc.querySelectorAll('button, [tabindex="0"], select, input, a[href]')]
      .filter(e => !e.disabled && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  }
  const mid = e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  function moveFocus(dx, dy) {
    const list = choices(); if (!list.length) return;
    const cur = list.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) { list[0].focus(); return; }
    // Eerst: wat ongeveer in de richting ligt (binnen CONE graden), daarvan het dichtstbij.
    // Niets in die kegel: dan het beste compromis tussen dichtbij en recht ervoor (zoals de kat rechtsonder in de straat).
    const CONE = 50, [cx, cy] = mid(cur); let best = null, bs = Infinity, cone = null, cs = Infinity;
    for (const e of list) {
      if (e === cur) continue;
      const [x, y] = mid(e), vx = x - cx, vy = y - cy, along = vx * dx + vy * dy, side = Math.abs(vx * dy - vy * dx);
      if (along <= 4) continue;                               // alleen in de richting die je kiest
      const dist = Math.hypot(vx, vy);
      if (Math.atan2(side, along) * 180 / Math.PI <= CONE && dist < cs) { cs = dist; cone = e; }
      const score = along + 2.5 * side;
      if (score < bs) { bs = score; best = e; }
    }
    best = cone || best;
    if (best) { best.focus(); if (best.scrollIntoView) best.scrollIntoView({ block: 'nearest' }); }
  }
  function activate() {
    const list = choices(), el = document.activeElement;
    if (!list.includes(el)) { if (list[0]) list[0].focus(); return; }
    const [px, py] = mid(el), sc = scope();
    if (el.tagName === 'BUTTON' || el.tagName === 'A' || (el.tagName === 'INPUT' && el.type === 'checkbox')) el.click();
    else el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));   // de winkels en de arena in de straat
    // Bouwt het scherm zich opnieuw op (stats, winkel), dan is de knop weg: kies de knop die nu op dezelfde plek staat.
    requestAnimationFrame(() => {
      const now = choices();
      if (!now.length || now.includes(document.activeElement) || scope() !== sc) return;
      let best = null, bd = Infinity;
      for (const e of now) { const [x, y] = mid(e), d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = e; } }
      if (best) best.focus();
    });
  }

  function poll() {
    const now = performance.now(), dt = Math.min(.1, (now - st.last) / 1000); st.last = now;
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null;
    if (!!gp !== st.connected) { st.connected = !!gp; document.body.classList.toggle('has-pad', st.connected); }
    if (!gp) { st.move = st.aim = null; st.block = false; return; }
    const prev = st.prev, on = gp.buttons.map(b => !!b && (b.pressed || b.value > .5)), down = i => on[i] && !prev[i];   // net ingedrukt
    st.prev = on;
    let mv = stick(gp.axes[0] || 0, gp.axes[1] || 0, DEAD);
    const px = (on[BTN.right] ? 1 : 0) - (on[BTN.left] ? 1 : 0), py = (on[BTN.down] ? 1 : 0) - (on[BTN.up] ? 1 : 0);
    if (!mv && (px || py)) { const l = Math.hypot(px, py); mv = [px / l, py / l]; }
    const aim = stick(gp.axes[2] || 0, gp.axes[3] || 0, AIM_DEAD);
    if (mv || aim || on.some(Boolean)) { st.padAt = now; st.moved = 0; if (!st.active) { st.active = true; document.body.classList.add('pad'); } }
    if (!st.active) return;   // controller ligt stil: muis en toetsen hebben het voor het zeggen
    if (typeof inFight === 'function' && inFight()) {
      st.move = mv; st.aim = aim ? Math.atan2(aim[1], aim[0]) : null;
      st.block = on[BTN.lt] || on[BTN.lb];
      if (down(BTN.lt) || down(BTN.lb)) P.guardPress = true;
      if (down(BTN.rt) || down(BTN.x)) { P.atkBuf = ATTACK.buffer; P.atkMouse = false; }
      if (down(BTN.a)) tryRoll();
      if (down(BTN.b)) throwPlayerNet();
      if (down(BTN.y)) switchTo(S.active === 'melee' ? 'ranged' : 'melee');
      if (down(BTN.start)) key('Escape');
      if (down(BTN.back)) $('mute').click();
      st.navDir = null;
      return;
    }
    // Menu's: kiezen met D-pad of stick (vasthouden = doorspringen), A = ok, B / Start = terug.
    st.move = st.aim = null; st.block = false;
    let dir = null;
    if (mv) dir = Math.abs(mv[0]) > Math.abs(mv[1]) ? [Math.sign(mv[0]), 0] : [0, Math.sign(mv[1])];
    if (dir) {
      const same = st.navDir && st.navDir[0] === dir[0] && st.navDir[1] === dir[1];
      st.navT = same ? st.navT - dt : 0;
      if (!same || st.navT <= 0) { moveFocus(dir[0], dir[1]); st.navT = same ? NAV_REPEAT : NAV_REPEAT * 1.8; }
      st.navDir = dir;
    } else st.navDir = null;
    if (down(BTN.a)) activate();
    if (down(BTN.b) || down(BTN.start)) key('Escape');
  }
  // Trillen bij een klap (als de controller dat kan).
  function rumble(strength = .5, ms = 120) {
    if (!st.active) return;
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null, a = gp && gp.vibrationActuator;
    if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * .6 }).catch(() => {});
  }
  // Muis bewegen: de muis neemt het over.
  // Muis terug pas als je hem echt beweegt: kleine trillingen en de nep-bewegingen die de browser stuurt als het scherm
  // eronder verandert (einde gevecht, nieuw menu) tellen niet. MOUSE_BACK px binnen 0,3 s, en niet vlak na controllerinvoer.
  const MOUSE_BACK = 30;
  addEventListener('mousemove', ev => {
    if (!st.active) return;
    const now = performance.now(), d = Math.abs(ev.movementX) + Math.abs(ev.movementY);
    if (!d || now - (st.padAt || 0) < 400) return;
    if (now - (st.movedAt || 0) > 300) st.moved = 0;
    st.moved = (st.moved || 0) + d; st.movedAt = now;
    if (st.moved < MOUSE_BACK) return;
    st.active = false; st.moved = 0; st.move = st.aim = null; st.block = false; document.body.classList.remove('pad');
  });
  addEventListener('gamepadconnected', () => { st.connected = true; document.body.classList.add('has-pad'); });
  addEventListener('gamepaddisconnected', () => { st.connected = false; st.active = false; document.body.classList.remove('has-pad', 'pad'); });
  // Knoppen-iconen per soort controller (Kenney Input Prompts). De standaard-indeling geeft de knop op een plek
  // (0 = onderste, 1 = rechter, 2 = linker, 3 = bovenste), dus bij Nintendo is 'a' (onder) de B-knop.
  const ROOT = 'assets/kenney_input-prompts_1.5/';
  const SETS = {
    xbox: { dir: 'Xbox Series', ls: 'xbox_stick_l', rs: 'xbox_stick_r', a: 'xbox_button_color_a', b: 'xbox_button_color_b', x: 'xbox_button_color_x', y: 'xbox_button_color_y',
            lb: 'xbox_lb', lt: 'xbox_lt', rt: 'xbox_rt', back: 'xbox_button_view', start: 'xbox_button_menu', dpad: 'xbox_dpad' },
    ps: { dir: 'PlayStation Series', ls: 'playstation_stick_l', rs: 'playstation_stick_r', a: 'playstation_button_color_cross', b: 'playstation_button_color_circle', x: 'playstation_button_color_square', y: 'playstation_button_color_triangle',
          lb: 'playstation_trigger_l1', lt: 'playstation_trigger_l2', rt: 'playstation_trigger_r2', back: 'playstation5_button_create', start: 'playstation5_button_options', dpad: 'playstation_dpad' },
    switch: { dir: 'Nintendo Switch', ls: 'switch_stick_l', rs: 'switch_stick_r', a: 'switch_button_b', b: 'switch_button_a', x: 'switch_button_y', y: 'switch_button_x',
              lb: 'switch_button_l', lt: 'switch_button_zl', rt: 'switch_button_zr', back: 'switch_button_minus', start: 'switch_button_plus', dpad: 'switch_dpad' },
    deck: { dir: 'Steam Deck', ls: 'steamdeck_stick_l', rs: 'steamdeck_stick_r', a: 'steamdeck_button_a', b: 'steamdeck_button_b', x: 'steamdeck_button_x', y: 'steamdeck_button_y',
            lb: 'steamdeck_button_l1', lt: 'steamdeck_button_l2', rt: 'steamdeck_button_r2', back: 'steamdeck_button_view', start: 'steamdeck_button_options', dpad: 'steamdeck_dpad' }
  };
  // Welke soort: uit de naam die de browser geeft (fabrikant-code of naam). Onbekend = Xbox-indeling.
  const typeOf = id => /054c|playstation|dualsense|dualshock|wireless controller/i.test(id) ? 'ps'
    : /057e|nintendo|switch|joy-con|pro controller/i.test(id) ? 'switch'
    : /28de.*1205|steam deck/i.test(id) ? 'deck' : 'xbox';
  function renderHelp(type) {
    const set = SETS[type], ul = document.getElementById('padKeys'); if (!ul || !set) return;
    const ico = k => `<img src="${encodeURI(ROOT + set.dir + '/Vector/' + set[k] + '.svg')}" alt="${k}">`, or = '<i>/</i>';
    const rows = [[ico('ls') + or + ico('dpad'), 'move'], [ico('rs'), 'aim'], [ico('rt') + or + ico('x'), 'attack'], [ico('lt') + or + ico('lb'), 'block'],
                  ...(typeof ROLL !== 'undefined' && ROLL.enabled ? [[ico('a'), 'roll']] : []), [ico('y'), 'switch weapon'], [ico('b'), 'throw net'], [ico('back') + or + ico('start'), 'sound · pause'],
                  [ico('dpad') + ico('a') + ico('b'), 'menus: choose · ok · back']];
    ul.innerHTML = rows.map(([i, t]) => `<li><span class="key-ico">${i}</span><span>${t}</span></li>`).join('');
    st.type = type;
  }
  renderHelp('xbox');
  // Icoon voor een handeling (uitleg in beeld): controller als die in gebruik is, anders toetsenbord en muis.
  const KB = ROOT + 'Keyboard & Mouse/Vector/';
  const KBMAP = { move: ['keyboard_w', 'keyboard_a', 'keyboard_s', 'keyboard_d'], aim: ['mouse_move'], attack: ['mouse_left'], block: ['mouse_right'],
                  switch1: ['keyboard_1'], switch2: ['keyboard_2'], net: ['keyboard_e'] };
  const PADMAP = { move: ['ls'], aim: ['rs'], attack: ['rt'], block: ['lt'], switch1: ['y'], switch2: ['y'], net: ['b'] };
  const img = (src, alt) => `<img src="${encodeURI(src).replace(/&/g, '%26')}" alt="${alt}">`;
  function icon(action) {
    if (st.active) { const set = SETS[st.type || 'xbox']; return (PADMAP[action] || []).map(k => img(ROOT + set.dir + '/Vector/' + set[k] + '.svg', k)).join(''); }
    return (KBMAP[action] || []).map(n => img(KB + n + '.svg', n)).join('');
  }
  const _poll = poll;
  function pollTyped() {   // ook de soort controller bijhouden (voor de iconen)
    _poll();
    if (!st.connected) return;
    const gp = [...navigator.getGamepads()].find(g => g && g.connected), t = gp ? typeOf(gp.id) : st.type;
    if (t !== st.type) renderHelp(t);
  }
  return Object.assign(st, { poll: pollTyped, rumble, typeOf, icon });
})();
