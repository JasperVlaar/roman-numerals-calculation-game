/* ---------- Winkels van binnen ----------
   Getekend in SVG, zonder losse plaatjes: per winkel een tafereel (wand, werkbank, winkelier die bezig is)
   en per waar een klein icoon voor de toonbank. town.js gebruikt SHOPART.scene(id) en SHOPART.icon(key). */

const SHOPART = (() => {
  const line = 'stroke="#1e140f" stroke-width="1.4" stroke-linejoin="round"';

  /* ---------- Iconen (viewBox 40 × 40) ---------- */
  const ICONS = {
    fists: `<circle cx="20" cy="21" r="9" fill="#e3b78c" ${line}/><path d="M14 18h12M14 22h12" stroke="#a46d48" stroke-width="1.2"/>`,
    stick: `<path d="M9 33 L31 7" stroke="#6b4526" stroke-width="4.5" stroke-linecap="round"/><path d="M12 29 L15 26" stroke="#4a2e1a" stroke-width="2"/>`,
    gladius: `<path d="M24 16 L33 7 L34 6 L33 9 L26 18 Z" fill="#e4e0d4" ${line}/><path d="M24 16 L33 7" stroke="#b8b2a6" stroke-width="1"/>
      <path d="M20 15 L27 22" stroke="#d49a48" stroke-width="3.2" stroke-linecap="round"/><path d="M23 19 L12 30" stroke="#6b4526" stroke-width="3.6" stroke-linecap="round"/>
      <circle cx="10.5" cy="31.5" r="2.6" fill="#d49a48" ${line}/>`,
    hasta: `<path d="M7 35 L29 11" stroke="#6b4526" stroke-width="3" stroke-linecap="round"/><path d="M27 9 L35 4 L31 13 Z" fill="#3b3034" ${line}/>`,
    bow: `<path d="M12 5 Q34 20 12 35" fill="none" stroke="#5a3a26" stroke-width="3.2" stroke-linecap="round"/><path d="M12 5 L12 35" stroke="#ece3cf" stroke-width="1"/>`,
    composite: `<path d="M13 5 Q10 9 16 11 Q31 20 16 29 Q10 31 13 35" fill="none" stroke="#2a1a12" stroke-width="3.2" stroke-linecap="round"/><path d="M13 5 L13 35" stroke="#ece3cf" stroke-width="1"/>
      <path d="M17 12 L20 14 M17 28 L20 26" stroke="#d49a48" stroke-width="2"/>`,
    arrows: `${[0, 1, 2].map(i => `<g transform="translate(${i * 5 - 5} ${i * 2})"><path d="M10 32 L28 8" stroke="#6b4526" stroke-width="1.8"/><path d="M28 8 L31 4 L27 6 Z" fill="#3b3034"/><path d="M10 32 L8 28 M10 32 L13 33" stroke="#8e1f1a" stroke-width="2"/></g>`).join('')}`,
    quiver: `<rect x="13" y="12" width="13" height="24" rx="3" fill="#5a3a26" ${line} transform="rotate(12 20 24)"/>
      <path d="M17 12 L15 4 M21 12 L21 3 M25 13 L27 5" stroke="#6b4526" stroke-width="1.6"/><path d="M15 4 l-2 -2 M21 3 l0 -2.5 M27 5 l2 -2" stroke="#8e1f1a" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M15 22 L26 24" stroke="#d49a48" stroke-width="1.6"/>`,
    leather: `<path d="M11 9 Q20 5 29 9 L31 18 L28 32 L12 32 L9 18 Z" fill="#7a5230" ${line}/>
      <ellipse cx="11" cy="11" rx="5" ry="3.5" fill="#5e3c22" ${line}/><ellipse cx="29" cy="11" rx="5" ry="3.5" fill="#5e3c22" ${line}/>
      <path d="M12 18 H28 M12 24 H28" stroke="#3b2a1e" stroke-width="1.4"/><path d="M13 32 V36 M17 32 V37 M21 32 V37 M25 32 V36" stroke="#5e3c22" stroke-width="2.4"/>`,
    lorica: `<path d="M11 9 Q20 5 29 9 L31 18 L28 33 L12 33 L9 18 Z" fill="#8f8a80" ${line}/>
      ${[14, 19, 24, 29].map(y => `<path d="M11 ${y} Q20 ${y + 2.5} 29 ${y}" fill="none" stroke="#5c5a62" stroke-width="1.8"/>`).join('')}
      <ellipse cx="11" cy="11" rx="5.5" ry="4" fill="#b8b2a6" ${line}/><ellipse cx="29" cy="11" rx="5.5" ry="4" fill="#b8b2a6" ${line}/>
      <circle cx="20" cy="17" r="1.6" fill="#d49a48"/>`,
    sica: `<path d="M12 30 Q22 26 28 12 Q30 8 31 10 Q28 24 15 32 Z" fill="#e4e0d4" ${line}/><path d="M9 31 L14 28" stroke="#d49a48" stroke-width="3" stroke-linecap="round"/>`,
    spatha: `<path d="M19 6 L21 6 L22 29 L18 29 Z" fill="#e4e0d4" ${line}/><path d="M13 29 H27" stroke="#d49a48" stroke-width="3" stroke-linecap="round"/><path d="M20 30 V36" stroke="#3b2a1e" stroke-width="3"/><circle cx="20" cy="37" r="2" fill="#d49a48"/>`,
    scythian: `<path d="M10 8 Q22 12 16 20 Q22 28 10 32" fill="none" stroke="#2a1a12" stroke-width="2.6"/><path d="M10 8 L10 32" stroke="#f5ead6" stroke-width=".9"/><path d="M8 20 H33" stroke="#6b4526" stroke-width="1.6"/><path d="M33 20 l-4 -2.5 v5 Z" fill="#9aa0a6"/>`,
    parma: `<circle cx="20" cy="20" r="12" fill="#d49a48" ${line}/><circle cx="20" cy="20" r="7" fill="none" stroke="#8e1f1a" stroke-width="2"/><circle cx="20" cy="20" r="2.4" fill="#5a3a1c"/>`,
    squamata: `<path d="M10 10 Q20 6 30 10 L28 32 Q20 35 12 32 Z" fill="#8f8a80" ${line}/>${[13, 18, 23, 28].map(y => [12, 17, 22, 27].map(x => `<path d="M${x - 2.5} ${y} q2.5 3 5 0" fill="none" stroke="#5a554c" stroke-width="1"/>`).join('')).join('')}`,
    quadriga: `<path d="M3 26 H16 L18 18 H6 Z" fill="#8e1f1a" stroke="#d49a48" stroke-width="1.4"/><circle cx="10" cy="29" r="5" fill="none" stroke="#3b2a1e" stroke-width="2"/>${[0, 1, 2, 3].map(i => `<path d="M${20 + i * 4} ${22 - i} q2 -8 6 -7 q1 2 -1 4 l-1 6 Z" fill="#${i % 2 ? '7a5232' : '5a3a26'}" ${line}/>`).join('')}`,
    secutorHelm: `<ellipse cx="20" cy="21" rx="11" ry="12" fill="#cdb98a" ${line}/><ellipse cx="16" cy="16" rx="4" ry="2.4" fill="#fff" opacity=".45"/>
      <path d="M20 9 V33" stroke="#9a8250" stroke-width="2.4"/><circle cx="16.5" cy="22" r="1.4" fill="#1a0c08"/><circle cx="23.5" cy="22" r="1.4" fill="#1a0c08"/>`,
    galea: `<path d="M9 26 Q9 11 20 11 Q31 11 31 26 L27 26 L27 31 L23 31 L23 24 L17 24 L17 31 L13 31 L13 26 Z" fill="#d49a48" ${line}/>
      <path d="M10 10 Q20 0 31 10 Q20 6 10 10 Z" fill="#b8352c" ${line}/><path d="M12 9 l1 -3 M16 6 l0.5 -3 M20 5 V2 M24 6 l-0.5 -3 M28 9 l-1 -3" stroke="#7e1f1b" stroke-width="1"/>
      <path d="M9 26 H31" stroke="#a8742f" stroke-width="1.6"/>`,
    scutum: `<path d="M10 6 Q20 3 30 6 L30 34 Q20 37 10 34 Z" fill="#8e1f1a" stroke="#d49a48" stroke-width="2"/>
      <circle cx="20" cy="20" r="4" fill="#d49a48" ${line}/><path d="M20 7 V16 M20 24 V33" stroke="#d49a48" stroke-width="1.6"/>
      <path d="M13 10 l3 3 M27 10 l-3 3 M13 30 l3 -3 M27 30 l-3 -3" stroke="#e2b35e" stroke-width="1.2"/>`,
    chariot: `<path d="M5 24 H24 L26 14 H9 Z" fill="#8e1f1a" stroke="#d49a48" stroke-width="1.6"/><circle cx="14" cy="28" r="6.5" fill="none" stroke="#3b2a1e" stroke-width="2.4"/>
      <path d="M14 21.5 V34.5 M7.5 28 H20.5" stroke="#3b2a1e" stroke-width="1.2"/><path d="M24 20 L33 16" stroke="#3b2a1e" stroke-width="1.6"/>
      <path d="M31 17 Q33 9 37 10 Q39 12 36 15 L34 20 Z" fill="#5a3a26" ${line}/><path d="M33 10 l1 -3" stroke="#2a1a12" stroke-width="1.6"/>`
  };
  function icon(key) {
    return `<svg viewBox="0 0 40 40" class="ware-ico" aria-hidden="true">${ICONS[key] || ''}</svg>`;
  }

  /* ---------- Taferelen (viewBox 480 × 170) ---------- */
  // De winkelier van voren, achter de toonbank. arm = de groep die beweegt (CSS-animatie per winkel).
  function keeper({ x, tunic, apron, hair, beard, skin = '#d8a47a', tool = '' }) {
    return `<g transform="translate(${x} 0)">
      <path d="M-30 170 Q-30 108 0 102 Q30 108 30 170 Z" fill="${tunic}" ${line}/>
      ${apron ? `<path d="M-17 170 L-15 116 Q0 112 15 116 L17 170 Z" fill="${apron}" ${line}/>` : ''}
      <rect x="-7" y="86" width="14" height="20" fill="${skin}"/>
      <ellipse cx="0" cy="76" rx="17" ry="19" fill="${skin}" ${line}/>
      <path d="M-17 74 Q-18 54 0 54 Q18 54 17 74 Q12 62 0 63 Q-12 62 -17 74 Z" fill="${hair}"/>
      ${beard ? `<path d="M-14 80 Q-12 98 0 99 Q12 98 14 80 Q8 88 0 88 Q-8 88 -14 80 Z" fill="${beard}"/>` : ''}
      <circle cx="-6" cy="74" r="1.8" fill="#2a1810"/><circle cx="6" cy="74" r="1.8" fill="#2a1810"/>
      <path d="M-5 84 Q0 87 5 84" fill="none" stroke="#7a4426" stroke-width="1.4" stroke-linecap="round"/>
      <g class="arm-l"><path d="M-27 118 Q-44 132 -34 150" fill="none" stroke="${tunic}" stroke-width="11" stroke-linecap="round"/><circle cx="-33" cy="150" r="6" fill="${skin}" ${line}/></g>
      <g class="arm-r">${tool}<path d="M27 118 Q46 122 44 138" fill="none" stroke="${tunic}" stroke-width="11" stroke-linecap="round"/><circle cx="44" cy="140" r="6" fill="${skin}" ${line}/></g>
    </g>`;
  }
  const counter = (wood = '#6b4526', top = '#8a5a34') =>
    `<rect x="-10" y="142" width="500" height="40" fill="${wood}" ${line}/><rect x="-10" y="138" width="500" height="8" fill="${top}" ${line}/>
     ${[60, 160, 260, 360, 440].map(x => `<path d="M${x} 150 V180" stroke="rgba(30,15,8,.35)" stroke-width="2"/>`).join('')}`;
  // waren aan de muur: een rij iconen op de plank of het rek
  const wall = (keys, x0, y, gap = 54, size = 46) => keys.map((k, i) =>
    `<g transform="translate(${x0 + i * gap} ${y}) scale(${size / 40})">${ICONS[k] || ''}</g>`).join('');

  const SCENES = {
    smith(wares) {
      return `<defs><radialGradient id="sForge"><stop offset="0" stop-color="#ffe0a0"/><stop offset=".35" stop-color="#f08a3a"/><stop offset="1" stop-color="#7e1f1b" stop-opacity="0"/></radialGradient>
          <radialGradient id="sGlow"><stop offset="0" stop-color="#ff9a4a" stop-opacity=".45"/><stop offset="1" stop-color="#ff9a4a" stop-opacity="0"/></radialGradient></defs>
        <rect width="480" height="170" fill="#2a1d1c"/>
        ${[0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4, 5, 6, 7].map(c => `<rect x="${c * 64 - (r % 2) * 32}" y="${r * 30}" width="62" height="28" rx="3" fill="${(r + c) % 3 ? '#352624' : '#3d2c29'}"/>`).join('')).join('')}
        <ellipse cx="70" cy="110" rx="140" ry="90" fill="url(#sGlow)" class="forge"/>
        <path d="M20 140 L30 70 L110 70 L120 140 Z" fill="#3b3034" ${line}/><path d="M38 70 L50 20 L90 20 L102 70 Z" fill="#2e2628" ${line}/>
        <ellipse cx="70" cy="112" rx="34" ry="18" fill="url(#sForge)" class="forge"/>
        ${wall(wares, 330, 22, 50, 44)}
        <path d="M318 74 H470" stroke="#5a3a26" stroke-width="5"/>
        ${keeper({ x: 225, tunic: '#5c4030', apron: '#3b2a1e', hair: '#2a1a12', beard: '#2a1a12',
          tool: `<g><path d="M44 140 L62 118" stroke="#6b4526" stroke-width="4" stroke-linecap="round"/><rect x="56" y="108" width="16" height="10" rx="2" fill="#3b3034" ${line} transform="rotate(-50 64 113)"/></g>` })}
        <g class="sparks">${[0, 1, 2, 3, 4].map(i => `<circle cx="${300 + i * 6}" cy="${128 - i * 4}" r="1.6" fill="#ffd27a"/>`).join('')}</g>
        <path d="M270 140 L284 126 L330 126 L344 140 Z" fill="#3b3034" ${line}/>
        ${counter('#4a3226', '#5e4030')}`;
    },
    armorer(wares) {
      return `<rect width="480" height="170" fill="#5c4434"/>
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<rect x="${i * 56}" y="0" width="54" height="170" fill="${i % 2 ? '#634a39' : '#57402f'}"/>`).join('')}
        <path d="M0 64 H480" stroke="#3b2a1e" stroke-width="6"/>
        ${wall(wares, 20, 16, 64, 50)}
        <g transform="translate(410 40)"><path d="M0 0 V100" stroke="#3b2a1e" stroke-width="4"/><g transform="translate(-22 -6) scale(1.1)">${ICONS.lorica}</g></g>
        ${keeper({ x: 290, tunic: '#4f5a3a', apron: '#7a5230', hair: '#5c4030', beard: '',
          tool: `<g><circle cx="52" cy="132" r="9" fill="#d49a48" ${line}/><circle cx="52" cy="132" r="3" fill="#a8742f"/></g>` })}
        ${counter('#5e3c22', '#7a5230')}`;
    },
    bowyer(wares) {
      return `<rect width="480" height="170" fill="#c9b08a"/>
        <rect width="480" height="170" fill="url(#bLight)" opacity=".5"/>
        <defs><linearGradient id="bLight" x1="0" x2="1"><stop offset="0" stop-color="#fff3d6"/><stop offset="1" stop-color="#8a6a44"/></linearGradient></defs>
        ${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${30 + i * 26} 10 Q${52 + i * 26} 50 ${30 + i * 26} 90" fill="none" stroke="${i % 2 ? '#2a1a12' : '#6b4526'}" stroke-width="4"/><path d="M${30 + i * 26} 10 V90" stroke="#ece3cf" stroke-width="1"/>`).join('')}
        ${wall(wares, 300, 18, 46, 42)}
        <g transform="translate(410 100)"><rect x="0" y="0" width="40" height="44" rx="6" fill="#7a5230" ${line}/><path d="M0 12 H40 M0 32 H40" stroke="#3b2a1e" stroke-width="2"/>
          ${[6, 14, 22, 30].map(x => `<path d="M${x} 0 L${x - 2} -26" stroke="#6b4526" stroke-width="1.6"/><path d="M${x - 2} -26 l-2 -4 M${x - 2} -26 l2 -4" stroke="#8e1f1a" stroke-width="2"/>`).join('')}</g>
        ${keeper({ x: 245, tunic: '#74305a', apron: '#9a7a52', hair: '#8d8172', beard: '#8d8172',
          tool: `<g><path d="M40 146 L66 120" stroke="#e4e0d4" stroke-width="3" stroke-linecap="round"/></g>` })}
        <g class="shavings">${[0, 1, 2].map(i => `<path d="M${300 + i * 9} 134 q4 -6 8 0" fill="none" stroke="#e8c88a" stroke-width="2"/>`).join('')}</g>
        <path d="M170 138 L330 128" stroke="#8a5a34" stroke-width="6" stroke-linecap="round"/>
        ${counter('#7a5230', '#9a6a3e')}`;
    },
    stable(wares) {
      return `<rect width="480" height="170" fill="#4a3424"/>
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<rect x="0" y="${i * 17}" width="480" height="16" fill="${i % 2 ? '#523a28' : '#4a3424'}"/>`).join('')}
        ${[0, 1].map(i => `<g transform="translate(${40 + i * 120} 0)"><rect x="0" y="70" width="100" height="72" fill="#6b4526" ${line}/><path d="M0 70 L100 142 M100 70 L0 142" stroke="#3b2a1e" stroke-width="4"/>
          <g class="horse h${i}"><path d="M40 78 Q36 40 54 26 Q70 18 76 34 Q80 46 70 52 L64 78 Z" fill="${i ? '#3a271c' : '#8a5a34'}" ${line}/>
          <path d="M52 30 Q44 50 46 76" stroke="#1e140f" stroke-width="5" fill="none"/><circle cx="66" cy="34" r="2" fill="#1e140f"/><path d="M56 26 l-2 -9 l7 6" fill="${i ? '#3a271c' : '#8a5a34'}" ${line}/></g></g>`).join('')}
        <path d="M300 142 Q330 104 380 118 Q420 100 470 142 Z" fill="#d9b860" ${line}/>
        ${wall(wares, 330, 30, 60, 60)}
        ${keeper({ x: 300, tunic: '#5f6d45', apron: '', hair: '#3a271c', beard: '',
          tool: `<g><path d="M48 142 L66 96" stroke="#6b4526" stroke-width="3"/><path d="M60 92 h14 M62 92 v-8 M67 92 v-9 M72 92 v-8" stroke="#8a8a80" stroke-width="2"/></g>` })}
        ${counter('#5e3c22', '#7a5230')}`;
    }
  };
  function scene(id) {
    const wares = (SHOPS[id].wares || []).filter(k => ICONS[k]).slice(0, 4);
    return `<svg viewBox="0 0 480 170" class="shop-svg ${id}" aria-hidden="true">${SCENES[id] ? SCENES[id](wares) : ''}</svg>`;
  }
  return { icon, scene, ICONS };
})();
