const STORAGE_KEY = 'trainer-field-sheet-v02';
const LEGACY_STORAGE_KEY = 'trainer-field-sheet-v01';
const POKEAPI = 'https://pokeapi.co/api/v2';

const runtime = {
  tab: 'battle',
  pokemonIndex: [],
  apiStatus: 'loading',
  apiError: '',
  candidate: null,
  candidateLoading: false,
  setupSlot: 0,
  setupTeamIndex: 0,
  moveCache: new Map(),
  pokemonCache: new Map(),
  speciesCache: new Map(),
};

function move(name, type, category, die, accuracy, sureHit = false, extra = {}) {
  return { name, apiName: slug(name), type, category, die, accuracy, sureHit, power: extra.power ?? null, effect: extra.effect || '', source: extra.source || '' };
}

function makeMon(name, level, types, base, moves, proficient = true, extra = {}) {
  const mon = {
    name,
    apiName: extra.apiName || slug(name),
    apiId: extra.apiId || null,
    level,
    types,
    base,
    currentHp: 0,
    moves,
    proficient,
    sprite: extra.sprite || null,
    abilities: extra.abilities || [],
    learnset: extra.learnset || [],
    megaForms: extra.megaForms || [],
    megaActive: Boolean(extra.megaActive),
    megaChoice: extra.megaChoice || '',
  };
  mon.currentHp = maxHpFor(mon);
  return mon;
}

const demoState = () => ({
  trainer: { name: 'Playtest Trainer', level: 3 },
  selectedIndex: 0,
  activeIndex: 0,
  target: { name: 'Armoured Foe', physicalDef: 13, specialDef: 13, hp: 100, maxHp: 100 },
  settings: {
    minRank: 1,
    milestoneDamage: true,
    shortRestActiveOnly: false,
    shortRestMultiplier: 1,
    naturalCrits: true,
  },
  team: [
    makeMon('Charizard', 3, ['Fire', 'Flying'], { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 }, [
      move('Flamethrower', 'Fire', 'special', 'd8', 100),
      move('Slash', 'Normal', 'physical', 'd6', 100),
      move('Fire Blast', 'Fire', 'special', 'd10', 85),
      move('Aerial Ace', 'Flying', 'physical', 'd6', null, true),
    ], true),
    makeMon('Pikachu', 3, ['Electric'], { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 }, [
      move('Thunderbolt', 'Electric', 'special', 'd8', 100),
      move('Quick Attack', 'Normal', 'physical', 'd4', 100),
      move('Iron Tail', 'Steel', 'physical', 'd8', 75),
      move('Electro Ball', 'Electric', 'special', 'd6', 100),
    ], true),
    makeMon('Shuckle', 3, ['Bug', 'Rock'], { hp: 20, atk: 10, def: 230, spa: 10, spd: 230, spe: 5 }, [
      move('Rock Throw', 'Rock', 'physical', 'd6', 90),
      move('Struggle Bug', 'Bug', 'special', 'd6', 100),
      move('Rollout', 'Rock', 'physical', 'd6', 90),
      move('Power Trick', 'Psychic', 'status', 'd4', null, true),
    ], true),
    makeMon('Garchomp', 3, ['Dragon', 'Ground'], { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 }, [
      move('Dragon Claw', 'Dragon', 'physical', 'd8', 100),
      move('Earthquake', 'Ground', 'physical', 'd10', 100),
      move('Draco Meteor', 'Dragon', 'special', 'd12', 90),
      move('Crunch', 'Dark', 'physical', 'd8', 100),
    ], true),
    makeMon('Alakazam', 3, ['Psychic'], { hp: 55, atk: 50, def: 45, spa: 135, spd: 95, spe: 120 }, [
      move('Psychic', 'Psychic', 'special', 'd8', 100),
      move('Psybeam', 'Psychic', 'special', 'd6', 100),
      move('Focus Blast', 'Fighting', 'special', 'd12', 70),
      move('Swift', 'Normal', 'special', 'd6', null, true),
    ], true),
    makeMon('Blissey', 3, ['Normal'], { hp: 255, atk: 10, def: 10, spa: 75, spd: 135, spe: 55 }, [
      move('Hyper Voice', 'Normal', 'special', 'd8', 100),
      move('Pound', 'Normal', 'physical', 'd4', 100),
      move('Disarming Voice', 'Fairy', 'special', 'd6', null, true),
      move('Soft-Boiled', 'Normal', 'status', 'd4', null, true),
    ], true),
  ],
  log: [],
});

let state = loadState();

function roundHalfUp(n) { return Math.floor(Number(n) + 0.5); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, Number(n))); }
function slug(value = '') { return String(value).trim().toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function displayName(value = '') { return String(value).split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' '); }
function isMegaApiName(value = '') { return /-mega(?:-|$)/.test(String(value).toLowerCase()); }
function selectedMegaForm(mon) {
  if (!mon?.megaActive || !Array.isArray(mon.megaForms) || !mon.megaForms.length) return null;
  return mon.megaForms.find(form => form.apiName === mon.megaChoice) || mon.megaForms[0] || null;
}
function effectiveBase(mon) { return selectedMegaForm(mon)?.base || mon?.base || {}; }
function effectiveTypes(mon) { return selectedMegaForm(mon)?.types || mon?.types || []; }
function effectiveSprite(mon) { return selectedMegaForm(mon)?.sprite || mon?.sprite || null; }
function effectiveAbilities(mon) { return selectedMegaForm(mon)?.abilities || mon?.abilities || []; }
function effectiveName(mon) { const mega = selectedMegaForm(mon); return mega ? displayName(mega.apiName) : mon?.name || 'Pokémon'; }
function rank(base) { return Math.max(Number(state?.settings?.minRank) || 0, roundHalfUp((Number(base) || 0) / 17)); }
function statModFromRank(r) { return Math.floor((Number(r) - 5) / 2); }
function hpGrowthFor(mon) { return roundHalfUp((Number(mon?.base?.hp) || 0) / 10) + 1; }
function maxHpFor(mon) { return (Number(mon?.base?.hp) || 0) + (Math.max(1, Number(mon?.level) || 1) - 1) * hpGrowthFor(mon); }
function trainerPB() { const level = clamp(Number(state.trainer.level) || 1, 1, 20); return 2 + Math.floor((level - 1) / 4); }
function eligiblePB(mon) { return mon?.proficient ? trainerPB() : 0; }
function accuracyScore(m) { if (m.sureHit || m.accuracy === null || m.accuracy === '') return null; return roundHalfUp(8 + Number(m.accuracy) / 20); }
function accuracyMod(m) { const score = accuracyScore(m); return score === null ? null : score - 10; }
function offensiveKey(m) { return m.category === 'physical' ? 'atk' : 'spa'; }
function defensiveKey(m) { return m.category === 'physical' ? 'physicalDef' : 'specialDef'; }
function milestoneCount(level) { if (!state.settings.milestoneDamage) return 0; const n = Number(level) || 1; return (n >= 5 ? 1 : 0) + (n >= 10 ? 1 : 0) + (n >= 15 ? 1 : 0); }
function damageDice(mon, m) { if (m.category === 'status') return 0; const r = rank(effectiveBase(mon)[offensiveKey(m)]); return Math.ceil(r / 2) + milestoneCount(mon.level) * eligiblePB(mon); }
function dieSides(die) { return Number(String(die).replace('d', '')) || 4; }
function powerToDie(power, category) {
  if (category === 'status') return 'd4';
  const p = Number(power);
  if (!p) return 'd6';
  if (p <= 40) return 'd4';
  if (p <= 60) return 'd6';
  if (p <= 90) return 'd8';
  if (p <= 120) return 'd10';
  return 'd12';
}
function rollDie(sides) { return 1 + Math.floor(Math.random() * sides); }
function rollDice(count, sides) { const rolls = []; let total = 0; for (let i = 0; i < count; i++) { const v = rollDie(sides); rolls.push(v); total += v; } return { rolls, total }; }
function isFainted(mon) { return !mon || Number(mon.currentHp) <= 0; }
function sign(n) { return Number(n) >= 0 ? `+${Number(n)}` : `${Number(n)}`; }
function pct(cur, max) { return Number(max) > 0 ? clamp((Number(cur) / Number(max)) * 100, 0, 100) : 0; }
function teamCount() { return state.team.filter(Boolean).length; }
function availableCount() { return state.team.filter(mon => mon && !isFainted(mon)).length; }

function normalizeState(raw) {
  const fallback = demoState();
  if (!raw || !Array.isArray(raw.team)) return fallback;
  raw.trainer ||= fallback.trainer;
  raw.settings = { ...fallback.settings, ...(raw.settings || {}) };
  raw.target = { ...fallback.target, ...(raw.target || {}) };
  raw.log ||= [];
  raw.selectedIndex = clamp(Number(raw.selectedIndex) || 0, 0, 5);
  raw.activeIndex = clamp(Number(raw.activeIndex) || 0, 0, 5);
  raw.team = raw.team.slice(0, 6);
  while (raw.team.length < 6) raw.team.push(null);
  raw.team = raw.team.map(mon => {
    if (!mon) return null;
    mon.apiName ||= slug(mon.name);
    mon.apiId ??= null;
    mon.sprite ??= null;
    mon.abilities ||= [];
    mon.learnset ||= [];
    mon.megaForms ||= [];
    mon.megaActive = Boolean(mon.megaActive);
    mon.megaChoice ||= mon.megaForms[0]?.apiName || '';
    mon.proficient = mon.proficient !== false;
    mon.moves ||= [];
    while (mon.moves.length < 4) mon.moves.push(move(`Move ${mon.moves.length + 1}`, 'Normal', 'status', 'd4', null, true));
    mon.moves = mon.moves.slice(0, 4).map(m => ({
      name: m.name || 'Move', apiName: m.apiName || slug(m.name), type: m.type || 'Normal', category: m.category || 'status', die: m.die || 'd4',
      accuracy: m.accuracy ?? null, sureHit: Boolean(m.sureHit), power: m.power ?? null, effect: m.effect || '', source: m.source || '',
    }));
    const savedHp = Number(mon.currentHp);
    mon.currentHp = clamp(Number.isFinite(savedHp) ? savedHp : maxHpFor(mon), 0, maxHpFor(mon));
    return mon;
  });
  if (!raw.team[raw.activeIndex]) raw.activeIndex = raw.team.findIndex(Boolean);
  if (raw.activeIndex < 0) raw.activeIndex = 0;
  if (!raw.team[raw.selectedIndex]) raw.selectedIndex = raw.activeIndex;
  return raw;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : demoState();
  } catch { return demoState(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

const teamSlots = document.getElementById('teamSlots');
const pokemonEditor = document.getElementById('pokemonEditor');
const combatLog = document.getElementById('combatLog');
const setupTeamSlots = document.getElementById('setupTeamSlots');
const setupMovesEditor = document.getElementById('setupMovesEditor');
const pokemonResults = document.getElementById('pokemonResults');
const pokemonCandidate = document.getElementById('pokemonCandidate');

function renderAll() {
  document.getElementById('trainerName').value = state.trainer.name;
  document.getElementById('trainerLevel').value = state.trainer.level;
  document.getElementById('trainerPB').textContent = sign(trainerPB());
  document.getElementById('availableCount').textContent = `${availableCount()} / ${teamCount()}`;
  document.getElementById('targetName').value = state.target.name;
  document.getElementById('physicalDef').value = state.target.physicalDef;
  document.getElementById('specialDef').value = state.target.specialDef;
  document.getElementById('targetHP').value = state.target.hp;
  renderTabs();
  renderTeam();
  renderEditor();
  renderLog();
  renderSetupTeam();
  renderSetupMoves();
  renderApiStatus();
  saveState();
}

function renderTabs() {
  document.getElementById('battleView').classList.toggle('active', runtime.tab === 'battle');
  document.getElementById('setupView').classList.toggle('active', runtime.tab === 'setup');
  document.getElementById('battleTabBtn').classList.toggle('active', runtime.tab === 'battle');
  document.getElementById('setupTabBtn').classList.toggle('active', runtime.tab === 'setup');
}

function monBadge(mon, size = 'small') {
  const sprite = effectiveSprite(mon); if (sprite) return `<div class="mon-badge image ${size}"><img src="${escapeAttr(sprite)}" alt="" loading="lazy"></div>`;
  const initials = (mon?.name || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 3).toUpperCase();
  return `<div class="mon-badge ${size}">${escapeHtml(initials)}</div>`;
}

function renderTeam() {
  teamSlots.innerHTML = '';
  state.team.forEach((mon, i) => {
    const btn = document.createElement('button');
    if (!mon) {
      btn.className = 'team-slot empty';
      btn.innerHTML = `<div class="mon-badge">+</div><div class="slot-copy"><div class="slot-name">Empty Slot</div><div class="slot-meta">Add a Pokémon in Team Setup</div></div><div class="slot-status">#${i + 1}</div>`;
      btn.addEventListener('click', () => { runtime.setupSlot = i; runtime.setupTeamIndex = i; runtime.tab = 'setup'; renderAll(); });
      teamSlots.appendChild(btn);
      return;
    }
    const max = maxHpFor(mon), fainted = isFainted(mon);
    btn.className = `team-slot ${i === state.selectedIndex ? 'selected' : ''} ${i === state.activeIndex ? 'active' : ''} ${fainted ? 'fainted' : ''}`;
    btn.innerHTML = `${monBadge(mon)}<div class="slot-copy"><div class="slot-name">${escapeHtml(mon.name)} ${i === state.activeIndex ? '<span class="slot-status">ACTIVE</span>' : ''}</div><div class="slot-meta">Lv ${mon.level} · ${mon.currentHp}/${max} HP · ${mon.proficient ? 'Proficient' : 'Untrained'}</div><div class="hp-mini"><span style="width:${pct(mon.currentHp, max)}%"></span></div></div><div class="slot-status ${fainted ? 'fainted' : ''}">${fainted ? 'FAINTED' : `#${i + 1}`}</div>`;
    btn.addEventListener('click', () => { state.selectedIndex = i; renderAll(); });
    teamSlots.appendChild(btn);
  });
}

function renderEditor() {
  const mon = state.team[state.selectedIndex];
  if (!mon) {
    pokemonEditor.innerHTML = `<div class="candidate-empty"><p class="eyebrow">EMPTY SLOT</p><h2>No Pokémon here</h2><p class="muted">Use Team Setup to add a Pokémon to this slot.</p><button id="goSetupBtn" class="button primary">Open Team Setup</button></div>`;
    document.getElementById('goSetupBtn').addEventListener('click', () => { runtime.setupSlot = state.selectedIndex; runtime.setupTeamIndex = state.selectedIndex; runtime.tab = 'setup'; renderAll(); });
    return;
  }
  const max = maxHpFor(mon), fainted = isFainted(mon), active = state.selectedIndex === state.activeIndex;
  pokemonEditor.innerHTML = `
    <div class="editor-head">
      <div class="identity-row">
        ${monBadge(mon, 'large')}
        <div>
          <p class="eyebrow">POKÉMON SLOT ${state.selectedIndex + 1}</p>
          <div class="editor-title-row">
            <h2>${escapeHtml(effectiveName(mon))}</h2>
            ${effectiveTypes(mon).map(t => `<span class="type-pill">${escapeHtml(t)}</span>`).join('')}
            ${active ? '<span class="status-pill active">ACTIVE</span>' : ''}
            ${fainted ? '<span class="status-pill fainted">FAINTED</span>' : ''}
          </div>
          <div class="proficiency-line ${mon.proficient ? 'trained' : 'untrained'}">Trainer proficiency: <strong>${mon.proficient ? `Yes (${sign(trainerPB())} PB applies)` : 'No (PB does not apply)'}</strong></div>
        </div>
      </div>
      <div class="editor-actions">
        ${mon.megaForms?.length ? `<div class="mega-control">
          ${mon.megaForms.length > 1 ? `<select id="megaChoice" aria-label="Mega form">${mon.megaForms.map(form => `<option value="${escapeAttr(form.apiName)}" ${form.apiName === (mon.megaChoice || mon.megaForms[0].apiName) ? 'selected' : ''}>${escapeHtml(displayName(form.apiName))}</option>`).join('')}</select>` : `<span class="mega-name">${escapeHtml(displayName(mon.megaForms[0].apiName))}</span>`}
          <label class="mega-toggle"><input id="megaToggle" type="checkbox" ${mon.megaActive ? 'checked' : ''}><span>Mega Evolution</span></label>
        </div>` : ''}
        <button id="switchBtn" class="button primary" ${active || fainted ? 'disabled' : ''}>${active ? 'Currently Active' : fainted ? 'Cannot Switch In' : 'Switch In'}</button>
      </div>
    </div>

    ${fainted ? '<div class="fainted-overlay"><strong>This Pokémon has fainted.</strong> It cannot be switched in or use moves until restored above 0 HP.</div>' : ''}

    <div class="summary-grid four">
      <div class="summary-card"><span>Pokémon Level</span><strong><input id="monLevel" type="number" min="1" max="20" value="${mon.level}"></strong></div>
      <div class="summary-card"><span>HP Growth / Level</span><strong>+${hpGrowthFor(mon)}</strong></div>
      <div class="summary-card"><span>Eligible PB</span><strong>${sign(eligiblePB(mon))}</strong></div>
      <div class="summary-card"><span>Damage Milestones</span><strong>${milestoneCount(mon.level)} / 3</strong></div>
    </div>

    <div class="hp-block">
      <div class="hp-top"><div><span class="muted">Hit Points</span><div class="hp-values"><span>${mon.currentHp}</span> / ${max}</div></div><div class="hp-actions"><button id="damage10" class="button mini secondary">−10</button><button id="heal10" class="button mini secondary">+10</button><button id="fullHealMon" class="button mini secondary">Full</button></div></div>
      <div class="hp-bar"><div class="hp-fill" style="width:${pct(mon.currentHp, max)}%"></div></div>
    </div>

    <div class="stats-grid">
      ${statCard('HP', 'hp', mon)}${statCard('ATK', 'atk', mon)}${statCard('DEF', 'def', mon)}${statCard('SpA', 'spa', mon)}${statCard('SpD', 'spd', mon)}${statCard('SPE', 'spe', mon)}
    </div>

    <div class="moves-heading"><div><p class="eyebrow">MOVESET</p><h2>Four Moves</h2></div><button id="editMovesBtn" class="button mini secondary">Change Moves</button></div>
    <div class="moves-grid">${mon.moves.map((m, idx) => moveCard(mon, m, idx, active, fainted)).join('')}</div>`;
  bindEditor(mon);
}

function statCard(label, key, mon) {
  const base = Number(effectiveBase(mon)[key]) || 0, r = rank(base), mod = statModFromRank(r);
  const extra = key === 'hp' ? `Max ${maxHpFor(mon)}` : `Mod ${sign(mod)}`;
  const megaLocked = Boolean(selectedMegaForm(mon));
  return `<div class="stat-card"><label>${label} Base${megaLocked ? ' · Mega' : ''}</label><input class="base-stat" data-stat="${key}" type="number" min="1" max="255" value="${base}" ${megaLocked ? 'disabled title="Mega stats come from PokéAPI"' : ''}><div class="stat-derived"><span>Rank ${r}</span><span>${extra}</span></div></div>`;
}

function moveCard(mon, m, idx, active, fainted) {
  const r = m.category === 'status' ? null : rank(effectiveBase(mon)[offensiveKey(m)]);
  const dice = damageDice(mon, m);
  const aScore = accuracyScore(m), aMod = accuracyMod(m);
  const attackBonus = m.category === 'status' || m.sureHit ? null : eligiblePB(mon) + statModFromRank(r) + aMod;
  const permitted = moveIsPermitted(mon, m);
  const preview = !permitted ? '<strong>LOCKED AT CURRENT LEVEL</strong>' : m.category === 'status' ? 'Status / utility — resolve the effect manually.' : m.sureHit ? `<strong>Sure Hit</strong> · ${dice}${m.die}` : `<strong>${sign(attackBonus)} To Hit</strong> · ${dice}${m.die} · Accuracy ${aScore}`;
  return `<div class="move-card ${!permitted ? 'locked-move' : ''}" data-move-index="${idx}"><div class="move-top"><div class="move-name">${escapeHtml(m.name)}</div><span class="move-tag">${escapeHtml(m.type)}</span></div><div class="move-tags"><span class="move-tag">${m.category.toUpperCase()}</span>${m.power ? `<span class="move-tag">Power ${m.power}</span>` : ''}${m.sureHit ? '<span class="move-tag">SURE HIT</span>' : ''}${!permitted ? '<span class="move-tag">LOCKED</span>' : ''}</div>${m.effect ? `<p class="move-effect">${escapeHtml(m.effect)}</p>` : ''}<div class="move-preview">${preview}</div><button class="button primary use-move" ${!active || fainted || !permitted ? 'disabled' : ''}>Use ${escapeHtml(m.name)}</button></div>`;
}

function bindEditor(mon) {
  document.getElementById('switchBtn')?.addEventListener('click', () => switchTo(state.selectedIndex));
  document.getElementById('editMovesBtn')?.addEventListener('click', () => { runtime.setupTeamIndex = state.selectedIndex; runtime.setupSlot = state.selectedIndex; runtime.tab = 'setup'; renderAll(); ensureLearnset(state.selectedIndex); });
  document.getElementById('monLevel')?.addEventListener('change', e => {
    const oldMax = maxHpFor(mon), oldPct = oldMax ? mon.currentHp / oldMax : 1;
    mon.level = clamp(Number(e.target.value) || 1, 1, 20);
    mon.currentHp = clamp(Math.round(maxHpFor(mon) * oldPct), 0, maxHpFor(mon));
    renderAll();
  });
  document.getElementById('megaChoice')?.addEventListener('change', async e => {
    mon.megaChoice = e.target.value;
    if (mon.megaActive) await ensureMegaFormData(mon, mon.megaChoice);
    renderAll();
  });
  document.getElementById('megaToggle')?.addEventListener('change', async e => {
    mon.megaActive = e.target.checked;
    if (mon.megaActive) {
      mon.megaChoice ||= mon.megaForms?.[0]?.apiName || '';
      await ensureMegaFormData(mon, mon.megaChoice);
      addLog('system', `<strong>Mega Evolution:</strong> ${escapeHtml(mon.name)} transformed into ${escapeHtml(effectiveName(mon))}.`);
    } else {
      addLog('system', `<strong>Mega Evolution:</strong> ${escapeHtml(mon.name)} returned to its normal form.`);
    }
    renderAll();
  });
  document.querySelectorAll('.base-stat').forEach(input => input.addEventListener('change', e => {
    const oldMax = maxHpFor(mon), oldPct = oldMax ? mon.currentHp / oldMax : 1;
    mon.base[e.target.dataset.stat] = clamp(Number(e.target.value) || 1, 1, 255);
    mon.currentHp = clamp(Math.round(maxHpFor(mon) * oldPct), 0, maxHpFor(mon));
    renderAll();
  }));
  document.getElementById('damage10')?.addEventListener('click', () => adjustMonHp(mon, -10));
  document.getElementById('heal10')?.addEventListener('click', () => adjustMonHp(mon, 10));
  document.getElementById('fullHealMon')?.addEventListener('click', () => { mon.currentHp = maxHpFor(mon); renderAll(); });
  document.querySelectorAll('.use-move').forEach(btn => btn.addEventListener('click', () => {
    const idx = Number(btn.closest('.move-card').dataset.moveIndex); useMove(mon, mon.moves[idx]);
  }));
}

function switchTo(index) {
  const mon = state.team[index];
  if (!mon || isFainted(mon)) return;
  const old = state.team[state.activeIndex];
  state.activeIndex = index; state.selectedIndex = index;
  addLog('system', `<strong>Switch:</strong> ${old ? `${escapeHtml(old.name)} returned. ` : ''}${escapeHtml(mon.name)} is now active.`);
  renderAll();
}
function adjustMonHp(mon, delta) { mon.currentHp = clamp(Number(mon.currentHp) + Number(delta), 0, maxHpFor(mon)); if (isFainted(mon) && state.team[state.activeIndex] === mon) addLog('system', `<strong>${escapeHtml(mon.name)} fainted.</strong> Switch to another available partner.`); renderAll(); }

function useMove(mon, m) {
  if (state.team[state.activeIndex] !== mon || isFainted(mon) || !moveIsPermitted(mon, m)) return;
  if (m.category === 'status') { addLog('system', `<strong>${escapeHtml(mon.name)}</strong> used <strong>${escapeHtml(m.name)}</strong>. ${m.effect ? escapeHtml(m.effect) : 'Resolve its status/utility effect manually.'}`); renderAll(); return; }
  const diceCount = damageDice(mon, m), sides = dieSides(m.die);
  let hit = true, d20 = null, totalAttack = null, targetDef = null, crit = false;
  if (!m.sureHit) {
    const r = rank(effectiveBase(mon)[offensiveKey(m)]);
    const bonus = eligiblePB(mon) + statModFromRank(r) + accuracyMod(m);
    d20 = rollDie(20); totalAttack = d20 + bonus; targetDef = Number(state.target[defensiveKey(m)]) || 10;
    if (state.settings.naturalCrits && d20 === 1) hit = false;
    else if (state.settings.naturalCrits && d20 === 20) { hit = true; crit = true; }
    else hit = totalAttack >= targetDef;
  }
  let damage = 0, detail = '';
  if (hit) {
    const count = crit ? diceCount * 2 : diceCount;
    const roll = rollDice(count, sides); damage = roll.total;
    state.target.hp = clamp(Number(state.target.hp) - damage, 0, 999999); detail = `${count}${m.die} = ${roll.total}`;
  }
  const attackText = m.sureHit ? 'Sure Hit' : `d20 ${d20} + ${totalAttack - d20} = ${totalAttack} vs ${targetDef}`;
  addLog(hit ? 'hit' : 'miss', `<strong>${escapeHtml(mon.name)} used ${escapeHtml(m.name)}.</strong><br>${hit ? `Hit${crit ? ' — CRITICAL' : ''}! <strong>${damage} damage</strong>.` : 'Miss.'}<br><span class="math">${attackText}${hit ? ` · ${detail}` : ''}${mon.proficient ? '' : ' · Trainer PB not applied'}</span>`);
  renderAll();
}

function addLog(type, html) { state.log.unshift({ type, html, time: new Date().toISOString() }); state.log = state.log.slice(0, 80); }
function renderLog() { combatLog.innerHTML = state.log.length ? state.log.map(x => `<div class="log-entry ${x.type}">${x.html}</div>`).join('') : '<div class="log-empty">Use a move to begin the playtest.</div>'; }

function openShortRest() {
  const dlg = document.getElementById('shortRestDialog'), list = document.getElementById('shortRestChoices');
  const candidates = state.settings.shortRestActiveOnly ? [state.activeIndex] : state.team.map((_, i) => i);
  document.getElementById('shortRestHelp').textContent = state.settings.shortRestActiveOnly ? 'Only the active Pokémon may receive the Short Rest heal.' : 'Choose one non-fainted Pokémon to receive the Short Rest heal.';
  list.innerHTML = '';
  candidates.forEach(i => {
    const mon = state.team[i]; if (!mon) return;
    const heal = Math.round(hpGrowthFor(mon) * Number(state.settings.shortRestMultiplier || 0));
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'rest-choice'; btn.disabled = isFainted(mon) || mon.currentHp >= maxHpFor(mon);
    btn.innerHTML = `<span><strong>${escapeHtml(mon.name)}</strong><small>${mon.currentHp}/${maxHpFor(mon)} HP</small></span><strong>+${heal} HP</strong>`;
    btn.addEventListener('click', () => { const before = mon.currentHp; mon.currentHp = clamp(mon.currentHp + heal, 0, maxHpFor(mon)); addLog('system', `<strong>Short Rest:</strong> ${escapeHtml(mon.name)} recovered ${mon.currentHp - before} HP.`); dlg.close(); renderAll(); });
    list.appendChild(btn);
  });
  dlg.showModal();
}
function fullRest() { state.team.filter(Boolean).forEach(mon => mon.currentHp = maxHpFor(mon)); if (!state.team[state.activeIndex] || isFainted(state.team[state.activeIndex])) state.activeIndex = state.team.findIndex(mon => mon && !isFainted(mon)); addLog('system', '<strong>Full Rest:</strong> the whole team was fully restored.'); renderAll(); }

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`PokéAPI returned ${res.status}`);
  return res.json();
}

async function loadPokemonIndex() {
  runtime.apiStatus = 'loading'; runtime.apiError = ''; renderApiStatus();
  try {
    const data = await fetchJson(`${POKEAPI}/pokemon?limit=2000&offset=0`);
    runtime.pokemonIndex = (data.results || [])
      .map((item, idx) => ({ name: item.name, url: item.url, id: pokemonIdFromUrl(item.url) || idx + 1 }))
      .filter(item => !isMegaApiName(item.name));
    runtime.apiStatus = 'ready';
    renderApiStatus(); renderPokemonResults();
  } catch (err) {
    runtime.apiStatus = 'error'; runtime.apiError = err.message; renderApiStatus();
    pokemonResults.innerHTML = `<div class="api-error">Could not load PokéAPI. Your saved team still works offline.<br><small>${escapeHtml(err.message)}</small></div>`;
  }
}

function pokemonIdFromUrl(url = '') { const match = String(url).match(/\/pokemon\/(\d+)\/?$/); return match ? Number(match[1]) : null; }
function renderApiStatus() {
  const el = document.getElementById('apiStatus'); if (!el) return;
  if (runtime.apiStatus === 'ready') { el.textContent = `${runtime.pokemonIndex.length} loaded`; el.className = 'api-status ready'; }
  else if (runtime.apiStatus === 'error') { el.textContent = 'Offline'; el.className = 'api-status error'; }
  else { el.textContent = 'Loading…'; el.className = 'api-status'; }
}

function renderPokemonResults() {
  if (runtime.apiStatus !== 'ready') return;
  const q = document.getElementById('pokemonSearch').value.trim().toLowerCase();
  let results = runtime.pokemonIndex;
  if (q) results = results.filter(p => p.name.includes(q) || String(p.id) === q);
  else results = results.slice(0, 40);
  results = results.slice(0, 80);
  pokemonResults.innerHTML = results.length ? results.map(p => `<button class="pokemon-result" data-pokemon="${escapeAttr(p.name)}"><span>#${p.id || '?'}</span><strong>${escapeHtml(displayName(p.name))}</strong></button>`).join('') : '<div class="log-empty">No Pokémon match that search.</div>';
  pokemonResults.querySelectorAll('.pokemon-result').forEach(btn => btn.addEventListener('click', () => loadCandidate(btn.dataset.pokemon)));
}

function pokemonDataToBase(data) {
  const map = {};
  (data.stats || []).forEach(s => map[s.stat.name] = s.base_stat);
  return { hp: map.hp || 1, atk: map.attack || 1, def: map.defense || 1, spa: map['special-attack'] || 1, spd: map['special-defense'] || 1, spe: map.speed || 1 };
}
function pokemonDataToLearnset(data) {
  return (data.moves || []).map(entry => ({
    name: entry.move.name,
    url: entry.move.url,
    details: (entry.version_group_details || []).map(d => ({ level: Number(d.level_learned_at) || 0, method: d.move_learn_method?.name || 'unknown', version: d.version_group?.name || '' })),
  }));
}
function pokemonDataToMonBase(data, level, proficient) {
  return {
    name: displayName(data.name), apiName: data.name, apiId: data.id, level, types: (data.types || []).sort((a, b) => a.slot - b.slot).map(t => displayName(t.type.name)),
    base: pokemonDataToBase(data), currentHp: 0, moves: [], proficient, sprite: data.sprites?.other?.['official-artwork']?.front_default || data.sprites?.front_default || null,
    abilities: (data.abilities || []).map(a => displayName(a.ability.name)), learnset: pokemonDataToLearnset(data),
    megaForms: [], megaActive: false, megaChoice: '',
  };
}


async function fetchCachedPokemon(nameOrUrl) {
  const key = String(nameOrUrl || '');
  if (runtime.pokemonCache.has(key)) return runtime.pokemonCache.get(key);
  const url = key.startsWith('http') ? key : `${POKEAPI}/pokemon/${encodeURIComponent(key)}`;
  const data = await fetchJson(url);
  runtime.pokemonCache.set(key, data);
  runtime.pokemonCache.set(data.name, data);
  return data;
}

async function fetchCachedSpecies(urlOrName) {
  const key = String(urlOrName || '');
  if (runtime.speciesCache.has(key)) return runtime.speciesCache.get(key);
  const url = key.startsWith('http') ? key : `${POKEAPI}/pokemon-species/${encodeURIComponent(key)}`;
  const data = await fetchJson(url);
  runtime.speciesCache.set(key, data);
  runtime.speciesCache.set(data.name, data);
  return data;
}

async function discoverMegaForms(data) {
  try {
    const species = await fetchCachedSpecies(data.species?.url || data.species?.name || data.name);
    return (species.varieties || [])
      .map(v => v.pokemon)
      .filter(v => v?.name && isMegaApiName(v.name))
      .map(v => ({ apiName: v.name, url: v.url, base: null, types: [], sprite: null, abilities: [] }));
  } catch {
    return [];
  }
}

async function ensureMegaFormData(mon, apiName) {
  if (!mon || !apiName) return null;
  const form = (mon.megaForms || []).find(x => x.apiName === apiName);
  if (!form) return null;
  if (form.base && Object.keys(form.base).length) return form;
  const data = await fetchCachedPokemon(form.url || form.apiName);
  form.base = pokemonDataToBase(data);
  form.types = (data.types || []).sort((a, b) => a.slot - b.slot).map(t => displayName(t.type.name));
  form.sprite = data.sprites?.other?.['official-artwork']?.front_default || data.sprites?.front_default || null;
  form.abilities = (data.abilities || []).map(a => displayName(a.ability.name));
  return form;
}

async function ensureMegaForms(index) {
  const mon = state.team[index];
  if (!mon || mon.megaChecked || !mon.apiName || isMegaApiName(mon.apiName)) return;
  mon.megaChecked = true;
  try {
    const data = await fetchCachedPokemon(mon.apiName);
    mon.megaForms = await discoverMegaForms(data);
    mon.megaChoice ||= mon.megaForms[0]?.apiName || '';
    saveState();
    renderAll();
  } catch {
    mon.megaChecked = false;
  }
}

async function hydrateTeamMetadata() {
  for (let i = 0; i < state.team.length; i++) {
    const mon = state.team[i];
    if (!mon?.apiName || isMegaApiName(mon.apiName)) continue;
    if (!mon.megaChecked) ensureMegaForms(i);
  }
}

function dndLevelFromPokemonLevel(gameLevel) {
  const n = Number(gameLevel) || 1;
  return clamp(Math.ceil(Math.max(1, n) / 5), 1, 20);
}

function learnsetRule(entry, level) {
  const details = entry.details || [];
  if (!details.length) return { allowed: true, kind: 'listed', dndLevel: 1, gameLevel: 0, method: 'listed' };

  const nonLevel = details.filter(d => d.method !== 'level-up');
  if (nonLevel.length) {
    return { allowed: true, kind: 'other', dndLevel: 1, gameLevel: 0, method: nonLevel[0].method || 'listed' };
  }

  const levelDetails = details.filter(d => d.method === 'level-up');
  if (!levelDetails.length) return { allowed: true, kind: 'listed', dndLevel: 1, gameLevel: 0, method: 'listed' };
  const earliest = levelDetails.reduce((best, d) => Number(d.level) < Number(best.level) ? d : best, levelDetails[0]);
  const gameLevel = Math.max(1, Number(earliest.level) || 1);
  const dndLevel = dndLevelFromPokemonLevel(gameLevel);
  return { allowed: dndLevel <= level, kind: 'level-up', dndLevel, gameLevel, method: 'level-up', version: earliest.version || '' };
}

function permittedLearnset(mon) {
  const level = Number(mon.level) || 1;
  return (mon.learnset || []).filter(entry => learnsetRule(entry, level).allowed)
    .sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
}

function bestDefaultMoveNames(mon) {
  const level = Number(mon.level) || 1;
  const permitted = permittedLearnset(mon).map(entry => {
    const rule = learnsetRule(entry, level);
    return { ...entry, rule };
  });
  permitted.sort((a, b) => {
    const aLevel = a.rule.kind === 'level-up' ? a.rule.dndLevel : 0;
    const bLevel = b.rule.kind === 'level-up' ? b.rule.dndLevel : 0;
    return (bLevel - aLevel) || a.name.localeCompare(b.name);
  });
  return permitted.slice(0, 4).map(x => x.name);
}

async function loadCandidate(nameOrId) {
  runtime.candidateLoading = true;
  pokemonCandidate.innerHTML = '<div class="loading-card">Loading Pokémon data and learnset…</div>';
  try {
    const data = await fetchJson(`${POKEAPI}/pokemon/${encodeURIComponent(nameOrId)}`);
    if (isMegaApiName(data.name)) throw new Error('Mega Evolutions are transformations and cannot be added directly. Choose the base Pokémon instead.');
    runtime.candidate = data;
    renderCandidate();
  } catch (err) {
    pokemonCandidate.innerHTML = `<div class="api-error">Could not load that Pokémon.<br><small>${escapeHtml(err.message)}</small></div>`;
  } finally { runtime.candidateLoading = false; }
}

function renderCandidate() {
  const data = runtime.candidate;
  if (!data) return;
  const base = pokemonDataToBase(data);
  const sprite = data.sprites?.other?.['official-artwork']?.front_default || data.sprites?.front_default || '';
  const types = (data.types || []).sort((a, b) => a.slot - b.slot).map(t => displayName(t.type.name));
  const abilities = (data.abilities || []).map(a => displayName(a.ability.name));
  pokemonCandidate.innerHTML = `
    <div class="candidate-head">
      <div class="candidate-art">${sprite ? `<img src="${escapeAttr(sprite)}" alt="${escapeAttr(displayName(data.name))}">` : '<span>?</span>'}</div>
      <div><p class="eyebrow">#${data.id} · POKÉAPI</p><h2>${escapeHtml(displayName(data.name))}</h2><div class="move-tags">${types.map(t => `<span class="type-pill">${escapeHtml(t)}</span>`).join('')}</div><p class="muted compact">Abilities: ${abilities.length ? abilities.map(escapeHtml).join(', ') : 'None listed'}</p></div>
    </div>
    <div class="candidate-stats">${Object.entries(base).map(([k, v]) => `<div><span>${k.toUpperCase()}</span><strong>${v}</strong><small>Rank ${rank(v)}</small></div>`).join('')}</div>
    <div class="candidate-controls">
      <label class="field"><span>Team slot</span><select id="candidateSlot">${state.team.map((mon, i) => `<option value="${i}" ${i === runtime.setupSlot ? 'selected' : ''}>Slot ${i + 1}${mon ? ` — ${escapeHtml(mon.name)}` : ' — Empty'}</option>`).join('')}</select></label>
      <label class="field"><span>Pokémon level</span><input id="candidateLevel" type="number" min="1" max="20" value="${state.trainer.level}"></label>
      <label class="proficiency-toggle"><input id="candidateProficient" type="checkbox"><span><strong>Trainer is proficient with this Pokémon</strong><small>Only proficient Pokémon receive the Trainer's PB on attacks and PB-based damage milestones.</small></span></label>
    </div>
    <div class="candidate-foot"><p class="muted">The first four permitted moves will be loaded as a starting set. You can replace them from the legal learnset below after adding.</p><button id="addCandidateBtn" class="button primary">${state.team[runtime.setupSlot] ? 'Replace Slot' : 'Add to Team'}</button></div>`;
  document.getElementById('candidateSlot').addEventListener('change', e => { runtime.setupSlot = Number(e.target.value); renderCandidate(); });
  document.getElementById('addCandidateBtn').addEventListener('click', addCandidateToTeam);
}

async function addCandidateToTeam() {
  const data = runtime.candidate; if (!data) return;
  const slot = Number(document.getElementById('candidateSlot').value);
  const level = clamp(Number(document.getElementById('candidateLevel').value) || state.trainer.level, 1, 20);
  const proficient = document.getElementById('candidateProficient').checked;
  const button = document.getElementById('addCandidateBtn'); button.disabled = true; button.textContent = 'Loading moves…';
  try {
    const mon = pokemonDataToMonBase(data, level, proficient);
    mon.megaForms = await discoverMegaForms(data);
    mon.megaChoice = mon.megaForms[0]?.apiName || '';
    mon.megaChecked = true;
    const names = bestDefaultMoveNames(mon);
    mon.moves = await Promise.all(names.map(name => fetchMoveAsSheetMove(name)));
    while (mon.moves.length < 4) mon.moves.push(move(`Open Move Slot ${mon.moves.length + 1}`, 'Normal', 'status', 'd4', null, true));
    mon.currentHp = maxHpFor(mon);
    state.team[slot] = mon;
    runtime.setupTeamIndex = slot; runtime.setupSlot = slot;
    if (!state.team[state.activeIndex]) state.activeIndex = slot;
    state.selectedIndex = slot;
    addLog('system', `<strong>Team Setup:</strong> ${escapeHtml(mon.name)} was added to Slot ${slot + 1} at Level ${level}${proficient ? ' with Trainer proficiency' : ' without Trainer proficiency'}.`);
    renderAll(); renderCandidate();
  } catch (err) {
    alert(`Could not add Pokémon: ${err.message}`);
    button.disabled = false; button.textContent = 'Try Again';
  }
}

function renderSetupTeam() {
  setupTeamSlots.innerHTML = '';
  state.team.forEach((mon, i) => {
    const btn = document.createElement('button'); btn.className = `team-slot compact-slot ${i === runtime.setupTeamIndex ? 'selected' : ''}`;
    btn.innerHTML = mon ? `${monBadge(mon)}<div class="slot-copy"><div class="slot-name">${escapeHtml(mon.name)}</div><div class="slot-meta">Lv ${mon.level} · ${mon.proficient ? 'Proficient' : 'Untrained'}</div></div><div class="slot-status">#${i + 1}</div>` : `<div class="mon-badge">+</div><div class="slot-copy"><div class="slot-name">Empty Slot</div><div class="slot-meta">Select a Pokémon to fill it</div></div><div class="slot-status">#${i + 1}</div>`;
    btn.addEventListener('click', () => { runtime.setupTeamIndex = i; runtime.setupSlot = i; renderAll(); if (mon && !mon.learnset?.length) ensureLearnset(i); });
    setupTeamSlots.appendChild(btn);
  });
}

async function ensureLearnset(index) {
  const mon = state.team[index]; if (!mon || mon.learnset?.length || !mon.apiName) return;
  setupMovesEditor.innerHTML = '<div class="loading-card">Loading legal moves from PokéAPI…</div>';
  try {
    const data = await fetchJson(`${POKEAPI}/pokemon/${encodeURIComponent(mon.apiName)}`);
    mon.learnset = pokemonDataToLearnset(data);
    mon.sprite ||= data.sprites?.other?.['official-artwork']?.front_default || data.sprites?.front_default || null;
    mon.abilities = (data.abilities || []).map(a => displayName(a.ability.name));
    mon.apiId ||= data.id;
    if (!mon.megaChecked) {
      mon.megaForms = await discoverMegaForms(data);
      mon.megaChoice ||= mon.megaForms[0]?.apiName || '';
      mon.megaChecked = true;
    }
    saveState(); renderAll();
  } catch (err) { setupMovesEditor.innerHTML = `<div class="api-error">Could not load the learnset.<br><small>${escapeHtml(err.message)}</small></div>`; }
}

function describeLearn(entry, level) {
  if (!entry) return 'Listed move';
  const rule = learnsetRule(entry, Number(level) || 1);
  if (rule.kind === 'level-up') {
    return `${rule.allowed ? 'D&D Lv' : 'LOCKED · D&D Lv'} ${rule.dndLevel} (Pokémon Lv ${rule.gameLevel})`;
  }
  if (rule.kind === 'other') return displayName(rule.method);
  return 'Listed move';
}

function renderSetupMoves() {
  const mon = state.team[runtime.setupTeamIndex];
  document.getElementById('setupMovesHeading').textContent = mon ? `${mon.name} Moveset` : 'Team Moveset';
  if (!mon) { setupMovesEditor.innerHTML = '<div class="candidate-empty"><p class="muted">Choose a filled team slot to manage its four moves.</p></div>'; return; }
  if (!mon.learnset?.length) {
    setupMovesEditor.innerHTML = `<div class="learnset-empty"><p><strong>${escapeHtml(mon.name)}</strong> has not loaded a PokéAPI learnset yet.</p><button id="loadLearnsetBtn" class="button secondary">Load Legal Moves</button></div>`;
    document.getElementById('loadLearnsetBtn').addEventListener('click', () => ensureLearnset(runtime.setupTeamIndex)); return;
  }
  const allMoves = (mon.learnset || []).slice().sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
  const allowed = allMoves.filter(entry => learnsetRule(entry, Number(mon.level) || 1).allowed);
  const allowedMap = new Map(allowed.map(entry => [entry.name, entry]));
  setupMovesEditor.innerHTML = `
    <div class="moveset-meta"><div><strong>${allowed.length} / ${allMoves.length}</strong><span>moves currently permitted</span></div><label class="moveset-level-control"><span>D&D Pokémon level</span><input id="movesetPokemonLevel" type="number" min="1" max="20" value="${mon.level}"></label><label class="proficiency-toggle inline"><input id="teamProficientToggle" type="checkbox" ${mon.proficient ? 'checked' : ''}><span><strong>Trainer Proficient</strong><small>${mon.proficient ? `${sign(trainerPB())} PB applies` : 'PB is withheld'}</small></span></label></div>
    <p class="tiny-note">Level-up learnsets are mapped from Pokémon's 1–100 scale to D&D's 1–20 scale at 5 Pokémon levels per D&D level. Locked moves stay visible below.</p>
    <div class="move-picker-grid">${mon.moves.map((m, slot) => {
      const currentName = m.apiName || slug(m.name);
      const currentAllowed = allowedMap.has(currentName);
      const options = allMoves.map(entry => {
        const rule = learnsetRule(entry, Number(mon.level) || 1);
        const selected = currentName === entry.name ? 'selected' : '';
        const disabled = !rule.allowed && !selected ? 'disabled' : '';
        return `<option value="${escapeAttr(entry.name)}" ${selected} ${disabled}>${escapeHtml(displayName(entry.name))} — ${escapeHtml(describeLearn(entry, mon.level))}</option>`;
      }).join('');
      return `<div class="move-picker"><label>Move ${slot + 1}</label><select class="legal-move-select" data-slot="${slot}">${!allMoves.some(entry => entry.name === currentName) ? `<option value="${escapeAttr(currentName)}" selected>${escapeHtml(m.name)} — saved/custom move</option>` : ''}${options}</select><div class="chosen-move-summary"><span>${escapeHtml(m.category.toUpperCase())} · ${escapeHtml(m.type)}</span><span>${m.sureHit ? 'Sure Hit' : m.accuracy ? `${m.accuracy}% Accuracy` : 'No Accuracy Roll'}</span><span>${m.power ? `Power ${m.power} → ${m.die}` : m.category === 'status' ? 'Status' : m.die}</span></div>${m.effect ? `<p>${escapeHtml(m.effect)}</p>` : ''}</div>`;
    }).join('')}</div>`;
  document.getElementById('movesetPokemonLevel').addEventListener('change', e => {
    const oldMax = maxHpFor(mon), oldPct = oldMax ? mon.currentHp / oldMax : 1;
    mon.level = clamp(Number(e.target.value) || 1, 1, 20);
    mon.currentHp = clamp(Math.round(maxHpFor(mon) * oldPct), 0, maxHpFor(mon));
    addLog('system', `<strong>Level:</strong> ${escapeHtml(mon.name)} is now D&D Pokémon Level ${mon.level}.`);
    renderAll();
  });
  document.getElementById('teamProficientToggle').addEventListener('change', e => { mon.proficient = e.target.checked; renderAll(); });
  setupMovesEditor.querySelectorAll('.legal-move-select').forEach(sel => sel.addEventListener('change', async e => {
    const slot = Number(e.target.dataset.slot), old = mon.moves[slot]; e.target.disabled = true;
    try { mon.moves[slot] = await fetchMoveAsSheetMove(e.target.value, describeLearn(allowedMap.get(e.target.value), mon.level)); addLog('system', `<strong>Moveset:</strong> ${escapeHtml(mon.name)} replaced ${escapeHtml(old.name)} with ${escapeHtml(mon.moves[slot].name)}.`); renderAll(); }
    catch (err) { alert(`Could not load move: ${err.message}`); e.target.disabled = false; }
  }));
}

function moveIsPermitted(mon, m) {
  const apiName = m?.apiName || slug(m?.name || '');
  const entry = (mon?.learnset || []).find(x => x.name === apiName);
  return !entry || learnsetRule(entry, Number(mon.level) || 1).allowed;
}

async function fetchMoveAsSheetMove(name, source = '') {
  const key = slug(name);
  let data = runtime.moveCache.get(key);
  if (!data) { data = await fetchJson(`${POKEAPI}/move/${encodeURIComponent(key)}`); runtime.moveCache.set(key, data); }
  const category = data.damage_class?.name || 'status';
  const accuracy = data.accuracy ?? null;
  const sureHit = category !== 'status' && accuracy === null;
  const effect = (data.effect_entries || []).find(e => e.language?.name === 'en')?.short_effect || '';
  return move(displayName(data.name), displayName(data.type?.name || 'normal'), category, powerToDie(data.power, category), accuracy, sureHit, { power: data.power, effect, source });
}

function bindGlobal() {
  document.getElementById('battleTabBtn').addEventListener('click', () => { runtime.tab = 'battle'; renderAll(); });
  document.getElementById('setupTabBtn').addEventListener('click', () => { runtime.tab = 'setup'; renderAll(); });
  document.getElementById('trainerName').addEventListener('change', e => { state.trainer.name = e.target.value; renderAll(); });
  document.getElementById('trainerLevel').addEventListener('change', e => { state.trainer.level = clamp(Number(e.target.value) || 1, 1, 20); renderAll(); });
  ['targetName', 'physicalDef', 'specialDef', 'targetHP'].forEach(id => document.getElementById(id).addEventListener('change', e => {
    const map = { targetName: 'name', physicalDef: 'physicalDef', specialDef: 'specialDef', targetHP: 'hp' };
    state.target[map[id]] = id === 'targetName' ? e.target.value : Number(e.target.value);
    if (id === 'targetHP') state.target.maxHp = Number(e.target.value); renderAll();
  }));
  document.getElementById('resetTargetBtn').addEventListener('click', () => { state.target.hp = state.target.maxHp || 100; renderAll(); });
  document.getElementById('clearLogBtn').addEventListener('click', () => { state.log = []; renderAll(); });
  document.getElementById('shortRestBtn').addEventListener('click', openShortRest);
  document.getElementById('longRestBtn').addEventListener('click', fullRest);
  document.getElementById('pokemonSearch').addEventListener('input', renderPokemonResults);

  const rulesDialog = document.getElementById('rulesDialog');
  document.getElementById('rulesBtn').addEventListener('click', () => {
    document.getElementById('minRankSetting').value = state.settings.minRank;
    document.getElementById('milestoneSetting').checked = state.settings.milestoneDamage;
    document.getElementById('shortRestActiveSetting').checked = state.settings.shortRestActiveOnly;
    document.getElementById('shortRestMultiplierSetting').value = state.settings.shortRestMultiplier;
    document.getElementById('critSetting').checked = state.settings.naturalCrits;
    rulesDialog.showModal();
  });
  document.getElementById('saveRulesBtn').addEventListener('click', () => {
    state.settings.minRank = Number(document.getElementById('minRankSetting').value);
    state.settings.milestoneDamage = document.getElementById('milestoneSetting').checked;
    state.settings.shortRestActiveOnly = document.getElementById('shortRestActiveSetting').checked;
    state.settings.shortRestMultiplier = Number(document.getElementById('shortRestMultiplierSetting').value);
    state.settings.naturalCrits = document.getElementById('critSetting').checked;
    setTimeout(renderAll, 0);
  });
  document.getElementById('resetDemoBtn').addEventListener('click', () => { if (confirm('Reset the whole sheet to the six-Pokémon demo team?')) { state = demoState(); rulesDialog.close(); renderAll(); } });
  document.getElementById('exportBtn').addEventListener('click', exportJSON);
  document.getElementById('importInput').addEventListener('change', importJSON);
}

function exportJSON() { const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'trainer-sheet-save-v02.json'; a.click(); URL.revokeObjectURL(a.href); }
function importJSON(e) { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { state = normalizeState(JSON.parse(reader.result)); renderAll(); } catch (err) { alert(`Could not import save: ${err.message}`); } e.target.value = ''; }; reader.readAsText(file); }
function escapeHtml(str = '') { return String(str).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c])); }
function escapeAttr(str = '') { return escapeHtml(str); }

bindGlobal();
renderAll();
loadPokemonIndex();
hydrateTeamMetadata();
