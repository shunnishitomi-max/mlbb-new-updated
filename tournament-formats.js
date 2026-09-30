// Tournament ban-format extension: user can choose 6-ban or 10-ban competitive draft formats.
const TOURNAMENT_6_STEPS=[
 ['Blue','ban',1],['Red','ban',1],['Blue','ban',2],['Red','ban',2],
 ['Blue','pick',1],['Red','pick',1],['Red','pick',2],['Blue','pick',2],['Blue','pick',3],['Red','pick',3],
 ['Blue','ban',3],['Red','ban',3],
 ['Red','pick',4],['Blue','pick',4],['Blue','pick',5],['Red','pick',5]
].map((x,i)=>({side:x[0],type:x[1],slot:x[2],index:i}));

const TOURNAMENT_10_STEPS=[
 ['Blue','ban',1],['Red','ban',1],['Red','ban',2],['Blue','ban',2],['Blue','ban',3],['Red','ban',3],
 ['Blue','pick',1],['Red','pick',1],['Red','pick',2],['Blue','pick',2],['Blue','pick',3],['Red','pick',3],
 ['Blue','ban',4],['Red','ban',4],['Red','ban',5],['Blue','ban',5],
 ['Red','pick',4],['Blue','pick',4],['Blue','pick',5],['Red','pick',5]
].map((x,i)=>({side:x[0],type:x[1],slot:x[2],index:i}));

state.tournamentBanFormat=Number(localStorage.getItem('mlbb-tournament-ban-format')||6)===10?10:6;

const modeTabs=document.querySelector('.mode-tabs');
const tournamentSetup=document.createElement('div');
tournamentSetup.id='tournamentSetup';
tournamentSetup.className='ranked-setup';
tournamentSetup.innerHTML=`
  <div class="ranked-copy">
    <strong>Tournament ban format</strong>
    <span>Choose between the 6-ban and 10-ban professional draft sequences.</span>
  </div>
  <div class="ranked-config">
    <label>Format
      <select id="tournamentBanFormat">
        <option value="6">6 bans</option>
        <option value="10">10 bans</option>
      </select>
    </label>
    <span id="tournamentFormatNote"></span>
  </div>`;
modeTabs.insertAdjacentElement('afterend',tournamentSetup);

document.getElementById('tournamentBanFormat').value=String(state.tournamentBanFormat);

const baseRenderMode=renderMode;
renderMode=function(){
  baseRenderMode();
  const setup=document.getElementById('tournamentSetup');
  if(setup)setup.classList.toggle('hidden',state.mode!=='tournament');
  const sel=document.getElementById('tournamentBanFormat');
  if(sel)sel.value=String(state.tournamentBanFormat);
  const note=document.getElementById('tournamentFormatNote');
  if(note)note.textContent=state.tournamentBanFormat===6
    ?'2 bans each → 3 picks each → 1 ban each → final picks'
    :'3 bans each → 3 picks each → 2 bans each → final picks';
  const pill=document.getElementById('modePill');
  if(pill&&state.mode==='tournament')pill.textContent=`MODE: TOURNAMENT • ${state.tournamentBanFormat} BANS`;
};

steps=function(){
  if(state.mode==='ranked')return RANKED_PICK_STEPS;
  return state.tournamentBanFormat===10?TOURNAMENT_10_STEPS:TOURNAMENT_6_STEPS;
};

phaseText=function(){
  if(state.mode==='ranked'&&!state.started)return'RANKED • BAN SETUP';
  const i=state.actions.length;
  if(state.mode==='ranked')return i<6?'RANKED • FIRST PICK PHASE':'RANKED • FINAL PICK PHASE';
  if(state.tournamentBanFormat===6){
    if(i<4)return'TOURNAMENT 6-BAN • FIRST BAN PHASE';
    if(i<10)return'TOURNAMENT 6-BAN • FIRST PICK PHASE';
    if(i<12)return'TOURNAMENT 6-BAN • SECOND BAN PHASE';
    if(i<16)return'TOURNAMENT 6-BAN • SECOND PICK PHASE';
    return'DRAFT COMPLETE';
  }
  if(i<6)return'TOURNAMENT 10-BAN • FIRST BAN PHASE';
  if(i<12)return'TOURNAMENT 10-BAN • FIRST PICK PHASE';
  if(i<16)return'TOURNAMENT 10-BAN • SECOND BAN PHASE';
  if(i<20)return'TOURNAMENT 10-BAN • SECOND PICK PHASE';
  return'DRAFT COMPLETE';
};

renderBans=function(){
  const blue=document.getElementById('blueBans'),red=document.getElementById('redBans');
  if(state.mode==='ranked'){
    const list=state.rankedBans.map(byName).filter(Boolean);
    const a=list.filter((_,i)=>i%2===0),b=list.filter((_,i)=>i%2===1);
    blue.innerHTML=a.map(h=>banToken(h,true)).join('');
    red.innerHTML=b.map(h=>banToken(h,true)).join('');
    return;
  }
  const bb=sideBans('Blue'),rb=sideBans('Red');
  const slots=state.tournamentBanFormat===10?5:3;
  blue.innerHTML='';red.innerHTML='';
  for(let i=0;i<slots;i++){
    blue.innerHTML+=banToken(bb[i]);
    red.innerHTML+=banToken(rb[i]);
  }
};

const baseRenderIntel=renderIntel;
renderIntel=function(){
  baseRenderIntel();
  if(state.mode!=='tournament')return;
  const intel=document.getElementById('draftIntel');
  const rows=intel?.querySelectorAll('.intel-row');
  if(!rows?.length)return;
  const banRow=[...rows].find(r=>r.querySelector('b')?.textContent==='BAN STATE');
  if(banRow){
    const used=sideBans('Blue').length+sideBans('Red').length;
    const total=state.tournamentBanFormat;
    banRow.querySelector('span').textContent=`${used}/${total} tournament bans used • ${total}-ban format`;
  }
};

const basePersist=persist;
persist=function(){
  localStorage.setItem('mlbb-tournament-ban-format',String(state.tournamentBanFormat));
  basePersist();
};

const baseSwitchMode=switchMode;
switchMode=function(mode){
  if(mode===state.mode)return;
  clearTimeout(aiTimer);
  state.mode=mode;
  state.started=false;
  state.actions=[];
  state.rankedBans=[];
  renderAll();
  if(mode==='ranked')toast('Ranked mode: select 5–10 bans first');
  else toast(`Tournament mode: ${state.tournamentBanFormat}-ban format selected`);
};

document.getElementById('tournamentBanFormat').onchange=e=>{
  const next=Number(e.target.value)===10?10:6;
  if(next===state.tournamentBanFormat)return;
  clearTimeout(aiTimer);
  state.tournamentBanFormat=next;
  state.started=false;
  state.actions=[];
  localStorage.setItem('mlbb-tournament-ban-format',String(next));
  renderAll();
  toast(`Tournament format changed to ${next} bans`);
};

renderAll();
