const STORAGE_KEY = 'trainer-field-sheet-v01';

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
    makeMon('Charizard', 3, ['Fire','Flying'], {hp:78, atk:84, def:78, spa:109, spd:85, spe:100}, [
      move('Flamethrower','Fire','special','d8',100),
      move('Slash','Normal','physical','d6',100),
      move('Fire Blast','Fire','special','d10',85),
      move('Aerial Ace','Flying','physical','d6',null,true),
    ]),
    makeMon('Pikachu', 3, ['Electric'], {hp:35, atk:55, def:40, spa:50, spd:50, spe:90}, [
      move('Thunderbolt','Electric','special','d8',100),
      move('Quick Attack','Normal','physical','d4',100),
      move('Iron Tail','Steel','physical','d8',75),
      move('Electro Ball','Electric','special','d6',100),
    ]),
    makeMon('Shuckle', 3, ['Bug','Rock'], {hp:20, atk:10, def:230, spa:10, spd:230, spe:5}, [
      move('Rock Throw','Rock','physical','d6',90),
      move('Struggle Bug','Bug','special','d6',100),
      move('Rollout','Rock','physical','d6',90),
      move('Power Trick','Psychic','status','d4',null,true),
    ]),
    makeMon('Garchomp', 3, ['Dragon','Ground'], {hp:108, atk:130, def:95, spa:80, spd:85, spe:102}, [
      move('Dragon Claw','Dragon','physical','d8',100),
      move('Earthquake','Ground','physical','d10',100),
      move('Draco Meteor','Dragon','special','d12',90),
      move('Crunch','Dark','physical','d8',100),
    ]),
    makeMon('Alakazam', 3, ['Psychic'], {hp:55, atk:50, def:45, spa:135, spd:95, spe:120}, [
      move('Psychic','Psychic','special','d8',100),
      move('Psybeam','Psychic','special','d6',100),
      move('Focus Blast','Fighting','special','d12',70),
      move('Swift','Normal','special','d6',null,true),
    ]),
    makeMon('Blissey', 3, ['Normal'], {hp:255, atk:10, def:10, spa:75, spd:135, spe:55}, [
      move('Hyper Voice','Normal','special','d8',100),
      move('Pound','Normal','physical','d4',100),
      move('Disarming Voice','Fairy','special','d6',null,true),
      move('Soft-Boiled','Normal','status','d4',null,true),
    ]),
  ],
  log: []
});

function makeMon(name, level, types, base, moves) {
  const mon = { name, level, types, base, currentHp: 0, moves };
  mon.currentHp = maxHp(mon);
  return mon;
}
function move(name,type,category,die,accuracy,sureHit=false) { return { name,type,category,die,accuracy,sureHit }; }

let state = loadState();

function roundHalfUp(n) { return Math.floor(n + 0.5); }
function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
function rank(base) { return Math.max(Number(state.settings.minRank)||0, roundHalfUp(Number(base||0)/17)); }
function statModFromRank(r) { return Math.floor((r - 5) / 2); }
function hpGrowth(mon) { return Math.ceil(Number(mon.base.hp||0)/2) + 1; }
function maxHp(mon) { return Number(mon.base.hp||0) + (Math.max(1,Number(mon.level||1))-1) * hpGrowth(mon); }
function trainerPB() {
  const level = clamp(Number(state.trainer.level)||1,1,20);
  return 2 + Math.floor((level-1)/4);
}
function accuracyScore(move) {
  if (move.sureHit || move.accuracy === null || move.accuracy === '') return null;
  return roundHalfUp(8 + Number(move.accuracy)/20);
}
function accuracyMod(move) {
  const score = accuracyScore(move);
  return score === null ? null : score - 10;
}
function offensiveKey(move) { return move.category === 'physical' ? 'atk' : 'spa'; }
function defensiveKey(move) { return move.category === 'physical' ? 'physicalDef' : 'specialDef'; }
function milestoneCount(level) {
  if (!state.settings.milestoneDamage) return 0;
  return (level >= 5 ? 1 : 0) + (level >= 10 ? 1 : 0) + (level >= 15 ? 1 : 0);
}
function damageDice(mon, move) {
  if (move.category === 'status') return 0;
  const r = rank(mon.base[offensiveKey(move)]);
  return Math.ceil(r/2) + milestoneCount(Number(mon.level)||1) * trainerPB();
}
function dieSides(die) { return Number(String(die).replace('d','')) || 4; }
function rollDie(sides) { return 1 + Math.floor(Math.random()*sides); }
function rollDice(count,sides) {
  const rolls=[]; let total=0;
  for(let i=0;i<count;i++){ const v=rollDie(sides); rolls.push(v); total+=v; }
  return {rolls,total};
}
function isFainted(mon){ return Number(mon.currentHp) <= 0; }
function initials(name){ return name.split(/\s+/).map(x=>x[0]).join('').slice(0,3).toUpperCase(); }
function sign(n){ return n>=0 ? `+${n}` : `${n}`; }
function pct(cur,max){ return max>0 ? clamp((cur/max)*100,0,100) : 0; }

function loadState(){
  try {
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return demoState();
    const parsed=JSON.parse(raw);
    return parsed?.team?.length===6 ? parsed : demoState();
  } catch { return demoState(); }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

const teamSlots = document.getElementById('teamSlots');
const pokemonEditor = document.getElementById('pokemonEditor');
const combatLog = document.getElementById('combatLog');

function renderAll(){
  document.getElementById('trainerName').value=state.trainer.name;
  document.getElementById('trainerLevel').value=state.trainer.level;
  document.getElementById('trainerPB').textContent=sign(trainerPB());
  document.getElementById('availableCount').textContent=`${state.team.filter(m=>!isFainted(m)).length} / 6`;
  document.getElementById('targetName').value=state.target.name;
  document.getElementById('physicalDef').value=state.target.physicalDef;
  document.getElementById('specialDef').value=state.target.specialDef;
  document.getElementById('targetHP').value=state.target.hp;
  renderTeam(); renderEditor(); renderLog();
  saveState();
}

function renderTeam(){
  teamSlots.innerHTML='';
  state.team.forEach((mon,i)=>{
    const max=maxHp(mon), fainted=isFainted(mon);
    const btn=document.createElement('button');
    btn.className=`team-slot ${i===state.selectedIndex?'selected':''} ${i===state.activeIndex?'active':''} ${fainted?'fainted':''}`;
    btn.innerHTML=`
      <div class="mon-badge">${initials(mon.name)}</div>
      <div class="slot-copy">
        <div class="slot-name">${escapeHtml(mon.name)} ${i===state.activeIndex?'<span class="slot-status">ACTIVE</span>':''}</div>
        <div class="slot-meta">Lv ${mon.level} · ${mon.currentHp}/${max} HP</div>
        <div class="hp-mini"><span style="width:${pct(mon.currentHp,max)}%"></span></div>
      </div>
      <div class="slot-status ${fainted?'fainted':''}">${fainted?'FAINTED':`#${i+1}`}</div>`;
    btn.addEventListener('click',()=>{ state.selectedIndex=i; renderAll(); });
    teamSlots.appendChild(btn);
  });
}

function renderEditor(){
  const mon=state.team[state.selectedIndex];
  const max=maxHp(mon), fainted=isFainted(mon), active=state.selectedIndex===state.activeIndex;
  pokemonEditor.innerHTML=`
    <div class="editor-head">
      <div>
        <p class="eyebrow">POKÉMON SLOT ${state.selectedIndex+1}</p>
        <div class="editor-title-row">
          <h2>${escapeHtml(mon.name)}</h2>
          ${mon.types.map(t=>`<span class="type-pill">${escapeHtml(t)}</span>`).join('')}
          ${active?'<span class="status-pill active">ACTIVE</span>':''}
          ${fainted?'<span class="status-pill fainted">FAINTED</span>':''}
        </div>
      </div>
      <div class="editor-actions">
        <button id="switchBtn" class="button primary" ${active||fainted?'disabled':''}>${active?'Currently Active':fainted?'Cannot Switch In':'Switch In'}</button>
      </div>
    </div>

    ${fainted?'<div class="fainted-overlay"><strong>This Pokémon has fainted.</strong> It cannot be made active or use moves until restored above 0 HP.</div>':''}

    <div class="summary-grid">
      <div class="summary-card"><span>Pokémon Level</span><strong><input id="monLevel" type="number" min="1" max="20" value="${mon.level}"></strong></div>
      <div class="summary-card"><span>HP Growth / Level</span><strong>+${hpGrowth(mon)}</strong></div>
      <div class="summary-card"><span>Damage Milestones</span><strong>${milestoneCount(mon.level)} / 3</strong></div>
    </div>

    <div class="hp-block">
      <div class="hp-top">
        <div><span class="muted">Hit Points</span><div class="hp-values"><span id="currentHpText">${mon.currentHp}</span> / ${max}</div></div>
        <div class="hp-actions">
          <button id="damage10" class="button mini secondary">−10</button>
          <button id="heal10" class="button mini secondary">+10</button>
          <button id="fullHealMon" class="button mini secondary">Full</button>
        </div>
      </div>
      <div class="hp-bar"><div class="hp-fill" style="width:${pct(mon.currentHp,max)}%"></div></div>
    </div>

    <div class="stats-grid">
      ${statCard('HP','hp',mon)}
      ${statCard('ATK','atk',mon)}
      ${statCard('DEF','def',mon)}
      ${statCard('SpA','spa',mon)}
      ${statCard('SpD','spd',mon)}
      ${statCard('SPE','spe',mon)}
    </div>

    <div class="moves-heading">
      <div><p class="eyebrow">MOVESET</p><h2>Four Moves</h2></div>
      <span class="tiny-note">Only the active Pokémon can act.</span>
    </div>
    <div class="moves-grid">
      ${mon.moves.map((m,idx)=>moveCard(mon,m,idx,active,fainted)).join('')}
    </div>`;

  bindEditor(mon);
}

function statCard(label,key,mon){
  const b=Number(mon.base[key]||0), r=rank(b), mod=statModFromRank(r);
  const extra = key==='hp' ? `Max ${maxHp(mon)}` : `Mod ${sign(mod)}`;
  return `<div class="stat-card">
    <label>${label} Base</label>
    <input class="base-stat" data-stat="${key}" type="number" min="1" max="255" value="${b}">
    <div class="stat-derived"><span>Rank ${r}</span><span>${extra}</span></div>
  </div>`;
}

function moveCard(mon,m,idx,active,fainted){
  const r = m.category==='status' ? null : rank(mon.base[offensiveKey(m)]);
  const dice=damageDice(mon,m);
  const aScore=accuracyScore(m), aMod=accuracyMod(m);
  const attackBonus = m.category==='status' || m.sureHit ? null : trainerPB()+statModFromRank(r)+aMod;
  const preview = m.category==='status'
    ? 'Status / utility move — resolve its written effect manually.'
    : m.sureHit
      ? `<strong>Sure Hit</strong> · ${dice}${m.die} damage dice`
      : `<strong>${sign(attackBonus)} To Hit</strong> · ${dice}${m.die} · Accuracy ${aScore}`;
  return `<div class="move-card" data-move-index="${idx}">
    <div class="move-top"><input class="move-name-input" value="${escapeAttr(m.name)}"><span class="move-tag">${escapeHtml(m.type)}</span></div>
    <div class="move-tags"><span class="move-tag">${m.category.toUpperCase()}</span>${m.sureHit?'<span class="move-tag">SURE HIT</span>':''}</div>
    <div class="move-fields">
      <div class="field"><label>Category</label><select class="move-category"><option value="physical" ${m.category==='physical'?'selected':''}>Physical</option><option value="special" ${m.category==='special'?'selected':''}>Special</option><option value="status" ${m.category==='status'?'selected':''}>Status</option></select></div>
      <div class="field"><label>Die</label><select class="move-die">${['d4','d6','d8','d10','d12'].map(d=>`<option ${m.die===d?'selected':''}>${d}</option>`).join('')}</select></div>
      <div class="field"><label>Accuracy %</label><input class="move-accuracy" type="number" min="1" max="100" value="${m.accuracy??100}" ${m.sureHit?'disabled':''}></div>
    </div>
    <label class="move-tag" style="display:inline-flex;gap:6px;align-items:center;margin-bottom:8px;"><input class="move-sure-hit" type="checkbox" style="width:auto" ${m.sureHit?'checked':''}> Sure Hit</label>
    <div class="move-preview">${preview}</div>
    <button class="button primary use-move" ${!active||fainted?'disabled':''}>Use ${escapeHtml(m.name)}</button>
  </div>`;
}

function bindEditor(mon){
  const switchBtn=document.getElementById('switchBtn');
  if(switchBtn) switchBtn.addEventListener('click',()=>switchTo(state.selectedIndex));
  document.getElementById('monLevel').addEventListener('change',e=>{
    const oldMax=maxHp(mon); const oldPct=oldMax?mon.currentHp/oldMax:1;
    mon.level=clamp(Number(e.target.value)||1,1,20);
    const newMax=maxHp(mon);
    mon.currentHp=clamp(Math.round(newMax*oldPct),0,newMax);
    renderAll();
  });
  document.querySelectorAll('.base-stat').forEach(inp=>inp.addEventListener('change',e=>{
    const oldMax=maxHp(mon); const oldPct=oldMax?mon.currentHp/oldMax:1;
    mon.base[e.target.dataset.stat]=clamp(Number(e.target.value)||1,1,255);
    const newMax=maxHp(mon);
    mon.currentHp=clamp(Math.round(newMax*oldPct),0,newMax);
    renderAll();
  }));
  document.getElementById('damage10').addEventListener('click',()=>adjustMonHp(mon,-10));
  document.getElementById('heal10').addEventListener('click',()=>adjustMonHp(mon,10));
  document.getElementById('fullHealMon').addEventListener('click',()=>{ mon.currentHp=maxHp(mon); renderAll(); });

  document.querySelectorAll('.move-card').forEach(card=>{
    const idx=Number(card.dataset.moveIndex), m=mon.moves[idx];
    card.querySelector('.move-name-input').addEventListener('change',e=>{m.name=e.target.value.trim()||`Move ${idx+1}`; renderAll();});
    card.querySelector('.move-category').addEventListener('change',e=>{m.category=e.target.value; renderAll();});
    card.querySelector('.move-die').addEventListener('change',e=>{m.die=e.target.value; renderAll();});
    card.querySelector('.move-accuracy').addEventListener('change',e=>{m.accuracy=clamp(Number(e.target.value)||1,1,100); renderAll();});
    card.querySelector('.move-sure-hit').addEventListener('change',e=>{m.sureHit=e.target.checked; renderAll();});
    card.querySelector('.use-move').addEventListener('click',()=>useMove(mon,m));
  });
}

function switchTo(index){
  const mon=state.team[index];
  if(isFainted(mon)) return;
  const old=state.team[state.activeIndex];
  state.activeIndex=index;
  state.selectedIndex=index;
  addLog('system',`<strong>Switch:</strong> ${escapeHtml(old.name)} returned. ${escapeHtml(mon.name)} is now active.`);
  renderAll();
}

function adjustMonHp(mon,delta){
  mon.currentHp=clamp(Number(mon.currentHp)+delta,0,maxHp(mon));
  if(isFainted(mon) && state.team[state.activeIndex]===mon) {
    addLog('system',`<strong>${escapeHtml(mon.name)} fainted.</strong> It remains active only as a marker; switch to another available partner.`);
  }
  renderAll();
}

function useMove(mon,m){
  if(state.team[state.activeIndex]!==mon || isFainted(mon)) return;
  if(m.category==='status') {
    addLog('system',`<strong>${escapeHtml(mon.name)}</strong> used <strong>${escapeHtml(m.name)}</strong>. Status/utility effect is resolved manually in this prototype.`);
    renderAll(); return;
  }
  const diceCount=damageDice(mon,m), sides=dieSides(m.die);
  let hit=true, d20=null, totalAttack=null, targetDef=null, crit=false;
  if(!m.sureHit){
    const r=rank(mon.base[offensiveKey(m)]);
    const bonus=trainerPB()+statModFromRank(r)+accuracyMod(m);
    d20=rollDie(20); totalAttack=d20+bonus;
    targetDef=Number(state.target[defensiveKey(m)])||10;
    if(state.settings.naturalCrits && d20===1) hit=false;
    else if(state.settings.naturalCrits && d20===20){ hit=true; crit=true; }
    else hit=totalAttack>=targetDef;
  }
  if(m.sureHit) hit=true;
  let damage=0, detail='';
  if(hit){
    const count=crit?diceCount*2:diceCount;
    const roll=rollDice(count,sides); damage=roll.total;
    state.target.hp=clamp(Number(state.target.hp)-damage,0,999999);
    detail=`${count}${m.die} = ${roll.total}`;
  }
  const cls=hit?'hit':'miss';
  const attackText=m.sureHit?'Sure Hit':`d20 ${d20} + ${totalAttack-d20} = ${totalAttack} vs ${targetDef}`;
  addLog(cls,`<strong>${escapeHtml(mon.name)} used ${escapeHtml(m.name)}.</strong><br>${hit?`Hit${crit?' — CRITICAL':''}! <strong>${damage} damage</strong>.`:'Miss.'}<br><span class="math">${attackText}${hit?` · ${detail}`:''}</span>`);
  renderAll();
}

function addLog(type,html){
  state.log.unshift({type,html,time:new Date().toISOString()});
  state.log=state.log.slice(0,80);
}
function renderLog(){
  if(!state.log.length){ combatLog.innerHTML='<div class="log-empty">Use a move to begin the playtest.</div>'; return; }
  combatLog.innerHTML=state.log.map(x=>`<div class="log-entry ${x.type}">${x.html}</div>`).join('');
}

function openShortRest(){
  const dlg=document.getElementById('shortRestDialog');
  const list=document.getElementById('shortRestChoices');
  const candidates=state.settings.shortRestActiveOnly ? [state.activeIndex] : state.team.map((_,i)=>i);
  document.getElementById('shortRestHelp').textContent=state.settings.shortRestActiveOnly
    ? 'Current rule: only the active Pokémon may receive the Short Rest heal.'
    : 'Current rule: choose one non-fainted Pokémon to receive the Short Rest heal.';
  list.innerHTML='';
  candidates.forEach(i=>{
    const mon=state.team[i], heal=Math.round(hpGrowth(mon)*Number(state.settings.shortRestMultiplier||0));
    const btn=document.createElement('button');
    btn.type='button'; btn.className='rest-choice'; btn.disabled=isFainted(mon) || mon.currentHp>=maxHp(mon);
    btn.innerHTML=`<span><strong>${escapeHtml(mon.name)}</strong><small>${mon.currentHp}/${maxHp(mon)} HP</small></span><strong>+${heal} HP</strong>`;
    btn.addEventListener('click',()=>{
      const before=mon.currentHp; mon.currentHp=clamp(mon.currentHp+heal,0,maxHp(mon));
      addLog('system',`<strong>Short Rest:</strong> ${escapeHtml(mon.name)} recovered ${mon.currentHp-before} HP.`);
      dlg.close(); renderAll();
    });
    list.appendChild(btn);
  });
  dlg.showModal();
}
function fullRest(){
  state.team.forEach(mon=>mon.currentHp=maxHp(mon));
  if(isFainted(state.team[state.activeIndex])) state.activeIndex=state.team.findIndex(m=>!isFainted(m));
  addLog('system','<strong>Full Rest:</strong> the entire team was fully restored. Fainted Pokémon are available again.');
  renderAll();
}

function bindGlobal(){
  document.getElementById('trainerName').addEventListener('change',e=>{state.trainer.name=e.target.value;renderAll();});
  document.getElementById('trainerLevel').addEventListener('change',e=>{state.trainer.level=clamp(Number(e.target.value)||1,1,20);renderAll();});
  ['targetName','physicalDef','specialDef','targetHP'].forEach(id=>document.getElementById(id).addEventListener('change',e=>{
    const map={targetName:'name',physicalDef:'physicalDef',specialDef:'specialDef',targetHP:'hp'};
    state.target[map[id]]=id==='targetName'?e.target.value:Number(e.target.value);
    if(id==='targetHP') state.target.maxHp=Number(e.target.value);
    renderAll();
  }));
  document.getElementById('resetTargetBtn').addEventListener('click',()=>{state.target.hp=state.target.maxHp||100;renderAll();});
  document.getElementById('clearLogBtn').addEventListener('click',()=>{state.log=[];renderAll();});
  document.getElementById('shortRestBtn').addEventListener('click',openShortRest);
  document.getElementById('longRestBtn').addEventListener('click',fullRest);

  const rulesDialog=document.getElementById('rulesDialog');
  document.getElementById('rulesBtn').addEventListener('click',()=>{
    document.getElementById('minRankSetting').value=state.settings.minRank;
    document.getElementById('milestoneSetting').checked=state.settings.milestoneDamage;
    document.getElementById('shortRestActiveSetting').checked=state.settings.shortRestActiveOnly;
    document.getElementById('shortRestMultiplierSetting').value=state.settings.shortRestMultiplier;
    document.getElementById('critSetting').checked=state.settings.naturalCrits;
    rulesDialog.showModal();
  });
  document.getElementById('saveRulesBtn').addEventListener('click',()=>{
    state.settings.minRank=Number(document.getElementById('minRankSetting').value);
    state.settings.milestoneDamage=document.getElementById('milestoneSetting').checked;
    state.settings.shortRestActiveOnly=document.getElementById('shortRestActiveSetting').checked;
    state.settings.shortRestMultiplier=Number(document.getElementById('shortRestMultiplierSetting').value);
    state.settings.naturalCrits=document.getElementById('critSetting').checked;
    setTimeout(renderAll,0);
  });
  document.getElementById('resetDemoBtn').addEventListener('click',()=>{
    if(confirm('Reset the entire sheet to the six-Pokémon demo team?')) { state=demoState(); rulesDialog.close(); renderAll(); }
  });

  document.getElementById('exportBtn').addEventListener('click',exportJSON);
  document.getElementById('importInput').addEventListener('change',importJSON);
}

function exportJSON(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='trainer-sheet-save.json'; a.click(); URL.revokeObjectURL(a.href);
}
function importJSON(e){
  const file=e.target.files?.[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try { const parsed=JSON.parse(reader.result); if(!parsed.team||parsed.team.length!==6) throw new Error('Expected six team slots.'); state=parsed; renderAll(); }
    catch(err){ alert(`Could not import save: ${err.message}`); }
    e.target.value='';
  };
  reader.readAsText(file);
}
function escapeHtml(str=''){ return String(str).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function escapeAttr(str=''){ return escapeHtml(str); }

bindGlobal();
renderAll();
