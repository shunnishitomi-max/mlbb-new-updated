// Team-neutral professional draft intelligence layer.
// Uses only current draft state, league-wide meta evidence, remaining hero pool,
// role requirements, counters, synergy, composition, draft phase and side.
// It intentionally does NOT use opponent/team/player identity or comfort history.

function tnEnemy(side){return side==='Blue'?'Red':'Blue'}
function tnAvailable(exclude=[]){const blocked=new Set([...usedNames(),...exclude]);return heroes.filter(h=>!blocked.has(h.name))}
function tnScarcityForLane(lane,exclude=[]){const pool=tnAvailable(exclude).filter(h=>lanes(h).includes(lane));const competitive=pool.filter(h=>metaEvidence(h).score>=70);if(competitive.length<=1)return 95;if(competitive.length===2)return 84;if(competitive.length===3)return 72;if(competitive.length<=5)return 58;return 42}
function tnRoleScarcity(hero,side,exclude=[]){const needs=openRoles(side);const values=lanes(hero).filter(l=>needs.includes(l)).map(l=>tnScarcityForLane(l,exclude));return values.length?Math.max(...values):45}
function tnProtectionValue(hero,step){if(step.type!=='pick')return 45;const enemy=picks(tnEnemy(step.side));if(!enemy.length)return 48;let pressure=0;for(const e of enemy)pressure=Math.max(pressure,-matchupValue(hero,e));const fragile=tags(hero).has('squishy')||tags(hero).has('backline')?8:0;return clamp(Math.round(48+pressure*9+fragile))}
function tnTimingValue(hero,step){if(step.type==='ban')return 55;const ownNeed=openRoles(step.side),enemyNeed=openRoles(tnEnemy(step.side));let s=52;if(lanes(hero).some(l=>ownNeed.includes(l)))s+=12;const scarcity=tnRoleScarcity(hero,step.side,[hero.name]);if(scarcity>=80)s+=18;else if(scarcity>=65)s+=10;if(lanes(hero).length>1)s+=7;if(lanes(hero).some(l=>enemyNeed.includes(l)))s+=4;if(state.actions.length>=steps().length-4)s+=5;return clamp(s)}
function tnDraftControl(hero,step){const enemy=tnEnemy(step.side),enemyNeeds=openRoles(enemy);let s=45;const denial=denialScore(hero,step);s+=(denial-50)*.35;const enemyLaneScarcity=lanes(hero).filter(l=>enemyNeeds.includes(l)).map(l=>tnScarcityForLane(l,[hero.name]));if(enemyLaneScarcity.length)s+=(Math.max(...enemyLaneScarcity)-50)*.28;if(lanes(hero).length>1)s+=9;if(step.type==='ban')s+=5;if(metaEvidence(hero).score>=85)s+=6;return clamp(Math.round(s))}
function tnReturnProbability(hero,step){if(step.type!=='pick')return 35;const enemy=tnEnemy(step.side),enemyNeeds=openRoles(enemy);let s=45;if(!lanes(hero).some(l=>enemyNeeds.includes(l)))s+=18;if(metaEvidence(hero).score<75)s+=10;if(lanes(hero).length===1)s+=4;const scarcity=Math.max(0,...lanes(hero).map(l=>tnScarcityForLane(l,[hero.name])));if(scarcity>=80)s-=18;else if(scarcity>=65)s-=10;return clamp(Math.round(s))}

function tnResponseScore(candidate,trigger,respondingSide){
  const need=openRoles(respondingSide);const meta=metaEvidence(candidate).score;
  const role=lanes(candidate).some(l=>need.includes(l))?86:lanes(candidate).length>1?64:38;
  const counter=trigger?clamp(Math.round(50+matchupValue(candidate,trigger)*10)):50;
  const comp=compositionScore(candidate,respondingSide);
  const scarce=tnRoleScarcity(candidate,respondingSide,[trigger?.name].filter(Boolean));
  return clamp(Math.round(meta*.34+role*.26+counter*.19+comp*.13+scarce*.08));
}
function tnLikelyResponses(trigger,step,limit=3){
  if(step.type!=='pick')return[];
  const respondingSide=tnEnemy(step.side);
  return tnAvailable([trigger.name]).map(hero=>({hero,score:tnResponseScore(hero,trigger,respondingSide)})).sort((a,b)=>b.score-a.score||a.hero.name.localeCompare(b.hero.name)).slice(0,limit);
}
function tnResponseType(response,trigger,side){
  const mv=matchupValue(response,trigger),need=openRoles(side),meta=metaEvidence(response).score;
  if(mv>=3)return'DIRECT COUNTER RESPONSE';
  if(mv>0)return'SOFT COUNTER RESPONSE';
  if(lanes(response).some(l=>need.includes(l)))return'ROLE RESPONSE';
  if(meta>=85)return'META RESPONSE';
  return'COMPOSITION RESPONSE';
}
function tnFollowup(trigger,response,step){
  if(step.type!=='pick')return null;
  const side=step.side;const ownNeed=openRoles(side);
  const pool=tnAvailable([trigger.name,response?.name].filter(Boolean));
  return pool.map(hero=>{
    const meta=metaEvidence(hero).score;
    const role=lanes(hero).some(l=>ownNeed.includes(l))?82:55;
    const syn=clamp(Math.round(50+synergyPair(hero,trigger)*12));
    const comp=compositionScore(hero,side);
    const control=tnDraftControl(hero,{...step,type:'pick'});
    return{hero,score:clamp(Math.round(meta*.30+role*.24+syn*.20+comp*.16+control*.10))};
  }).sort((a,b)=>b.score-a.score)[0]||null;
}
function tnSequenceEvidence(hero){
  const seq=window.MLBB_SEQUENCE_DATA;
  const entry=seq?.responses?.[hero.name];
  if(!entry||!entry.sample)return{label:'INSUFFICIENT DATA',sample:0,detail:'No verified league-wide response-frequency sample is bundled for this hero.'};
  return{label:entry.confidence||'Medium',sample:entry.sample,detail:`${entry.sample} verified league-wide sequence observations.`};
}

const tnBaseCoachAnalysis=coachAnalysis;
coachAnalysis=function(hero,step){
  const base=tnBaseCoachAnalysis(hero,step);
  const scarcity=tnRoleScarcity(hero,step.side,[hero.name]);
  const timing=tnTimingValue(hero,step);
  const protection=tnProtectionValue(hero,step);
  const control=tnDraftControl(hero,step);
  const returnProb=tnReturnProbability(hero,step);
  const responses=tnLikelyResponses(hero,step,3);
  const followup=tnFollowup(hero,responses[0]?.hero,step);
  const sequence=tnSequenceEvidence(hero);
  let score;
  if(step.type==='ban'){
    score=clamp(Math.round(base.meta.score*.30+base.counter*.16+base.denial*.19+scarcity*.11+protection*.08+control*.12+base.flex*.04));
  }else{
    score=clamp(Math.round(base.meta.score*.25+base.counter*.15+base.role*.13+base.syn*.09+base.comp*.09+base.denial*.05+base.flex*.04+scarcity*.06+timing*.06+control*.05+protection*.03));
  }
  let type=base.type;
  if(step.type==='pick'){
    if(control>=78)type='Forced Response Pick';
    else if(protection>=75)type='Problem Solver Pick';
    else if(scarcity>=82)type='Role-Securing Pick';
    else if(base.denial>=76)type='Denial Pick';
    else if(base.flex>=70)type='Flex Pick';
  }else{
    if(protection>=72)type='Protection Ban';
    else if(scarcity>=82)type='Role Target Ban';
    else if(control>=78)type='Draft Control Ban';
  }
  const reason=[];
  if(base.meta.score>=75)reason.push('high recent professional priority');
  if(base.counter>=65)reason.push('strong current-draft matchup');
  if(scarcity>=75)reason.push('valuable role scarcity');
  if(control>=72)reason.push('restricts the opponent’s reasonable options');
  if(timing>=72&&step.type==='pick')reason.push('strong timing at this exact rotation');
  if(base.denial>=70)reason.push('denial value');
  if(!reason.length)reason.push(base.reason||'balanced current-draft value');
  return{...base,score,type,reason:reason.slice(0,3).join(' • '),scarcity,timing,protection,control,returnProb,responses,followup,sequence};
};

topRecommendations=function(limit=5){
  const step=pseudoStep();
  return heroes.filter(h=>!usedNames().has(h.name)).map(hero=>({hero,a:coachAnalysis(hero,step)})).sort((x,y)=>y.a.score-x.a.score||x.hero.name.localeCompare(y.hero.name)).slice(0,limit);
};

renderRecommendations=function(){
  const root=document.getElementById('recommendations');root.innerHTML='';
  for(const{hero,a}of topRecommendations()){
    const likely=a.responses?.[0];
    const el=document.createElement('div');el.className='rec';
    el.innerHTML=`<div class="rec-head"><div class="rec-face">${heroImg(hero)}</div><div><div class="rec-name">${esc(hero.name)}</div><div class="rec-score">Priority ${a.score}/100</div></div></div><span class="rec-type">${esc(a.type)}</span><div class="rec-reason">${esc(a.reason)}</div>${likely?`<div class="rec-reason"><b>Likely response:</b> ${esc(likely.hero.name)} • ${esc(tnResponseType(likely.hero,hero,tnEnemy(pseudoStep().side)))}</div>`:''}`;
    el.onclick=()=>openHeroDrawer(hero);root.appendChild(el);
  }
};

renderIntel=function(){
  const root=document.getElementById('draftIntel'),step=pseudoStep(),enemy=tnEnemy(step.side),need=openRoles(step.side),top=topRecommendations(1)[0];
  const conf=top?.a.meta.confidence||'Low';document.getElementById('confidenceBadge').textContent='Confidence: '+conf;
  const bannedNote=state.mode==='ranked'?`${state.rankedBans.length}/${state.rankedBanTarget} ranked bans locked`:`${sideBans('Blue').length+sideBans('Red').length}/${state.tournamentBanFormat||6} tournament bans used`;
  const responses=top?.a.responses||[];
  const responseText=responses.length?responses.map((r,i)=>`${i+1}. ${r.hero.name} (${r.score}/100 • ${tnResponseType(r.hero,top.hero,enemy)})`).join('<br>'):'INSUFFICIENT DATA / no pick-response branch yet';
  const follow=top?.a.followup?.hero?.name||'No clear follow-up yet';
  root.innerHTML=`<div class="intel">
    <div class="intel-row"><b>TEAM-NEUTRAL MODEL</b><span>No opponent identity, comfort-pick, player-history, or team-specific tendency data is used.</span></div>
    <div class="intel-row"><b>RECENCY MODEL</b><span>MPL PH Week 6+, MPL ID Week 6+, and current Asian Games are prioritized.</span></div>
    <div class="intel-row"><b>OPEN ROLES (${esc(step.side)})</b><span>${esc(need.join(', ')||'Role coverage complete')}</span></div>
    <div class="intel-row"><b>ENEMY OPEN ROLES (${esc(enemy)})</b><span>${esc(openRoles(enemy).join(', ')||'Role coverage complete')}</span></div>
    <div class="intel-row"><b>LIKELY PROFESSIONAL RESPONSES</b><span>${responseText}</span></div>
    <div class="intel-row"><b>NEXT ROTATION</b><span>If the top response occurs, current best projected follow-up: ${esc(follow)}.</span></div>
    <div class="intel-row"><b>DRAFT CONTROL</b><span>${top?top.a.control:'—'}/100 • measures how strongly the recommended action restricts reasonable opposing options.</span></div>
    <div class="intel-row"><b>ROLE SCARCITY / TIMING</b><span>${top?top.a.scarcity:'—'}/100 scarcity • ${top?top.a.timing:'—'}/100 timing.</span></div>
    <div class="intel-row"><b>SEQUENCE EVIDENCE</b><span>${top?esc(top.a.sequence.detail):'INSUFFICIENT DATA'}</span></div>
    <div class="intel-row"><b>BAN STATE</b><span>${esc(bannedNote)}</span></div>
  </div>`;
};

openHeroDrawer=function(hero){
  const step=pseudoStep(),a=coachAnalysis(hero,step),alts=topRecommendations(4).filter(x=>x.hero.name!==hero.name).slice(0,3).map(x=>x.hero.name);
  const responseText=a.responses?.length?a.responses.map((r,i)=>`${i+1}. ${r.hero.name} — ${tnResponseType(r.hero,hero,tnEnemy(step.side))}`).join('<br>'):'INSUFFICIENT DATA / no response branch yet';
  document.getElementById('drawerBody').innerHTML=`<div class="drawer-hero"><div class="drawer-face">${heroImg(hero)}</div><div class="drawer-title"><h2>${esc(hero.name)}</h2><span>${esc(cardRole(hero))} • ${esc(lanes(hero).join(' / ')||'role unresolved')}</span></div></div><div class="analysis-grid">
    <div class="analysis-box"><b>DRAFT PRIORITY</b><span>${a.score}/100 • ${esc(a.type)}</span></div>
    <div class="analysis-box"><b>RECENT META</b><span>${a.meta.score}/100 • ${esc(a.meta.confidence)} confidence<br>${esc(a.meta.detail)}</span></div>
    <div class="analysis-box"><b>COUNTER VALUE</b><span>${a.counter}/100<br>Good into: ${esc(a.good.join(', ')||'No current enemy target')}</span></div>
    <div class="analysis-box"><b>ALLY SYNERGY</b><span>${a.syn}/100<br>${esc(a.allies.join(', ')||'No strong ally pairing yet')}</span></div>
    <div class="analysis-box"><b>ROLE / COMPOSITION</b><span>Role fit ${a.role}/100 • Composition ${a.comp}/100 • Flex ${a.flex}/100</span></div>
    <div class="analysis-box"><b>DENIAL / PROTECTION</b><span>Denial ${a.denial}/100 • Protection ${a.protection}/100</span></div>
    <div class="analysis-box"><b>ROLE SCARCITY</b><span>${a.scarcity}/100</span></div>
    <div class="analysis-box"><b>PICK TIMING</b><span>${a.timing}/100 • Return probability ${a.returnProb}/100</span></div>
    <div class="analysis-box"><b>DRAFT CONTROL</b><span>${a.control}/100</span></div>
    <div class="analysis-box"><b>LIKELY RESPONSES</b><span>${responseText}</span></div>
    <div class="analysis-box"><b>NEXT ROTATION</b><span>${a.followup?`Projected follow-up: ${esc(a.followup.hero.name)} (${a.followup.score}/100)`:'No clear follow-up yet'}</span></div>
    <div class="analysis-box"><b>PROFESSIONAL SEQUENCE EVIDENCE</b><span>${esc(a.sequence.detail)}</span></div>
    <div class="analysis-box"><b>THREATS</b><span>${esc(a.threats.join(', ')||'No major threat identified yet')}</span></div>
    <div class="analysis-box"><b>ALTERNATIVES</b><span>${esc(alts.join(', ')||'None')}</span></div>
    <div class="analysis-box"><b>INTEGRITY</b><span>Response ranking is team-neutral. If verified league-wide sequence counts are unavailable, it is analytical inference and never presented as an official frequency.</span></div>
  </div>`;
  document.getElementById('heroDrawer').classList.add('show');
};

const tnBaseRenderSources=renderSources;
renderSources=function(){
  tnBaseRenderSources();
  const root=document.getElementById('sourcesContent');
  if(root)root.insertAdjacentHTML('beforeend',`<div class="source-item"><b>Team-neutral draft intelligence</b><p>Recommendations do not use opponent/team/player identity, comfort pools, historical team-specific bans, player-specific habits, or team-specific response frequencies. Likely responses are derived from current draft state, remaining roles, hero scarcity, league-wide meta evidence, counters, composition, and available professional sequence evidence only.</p></div>`);
};

renderAll();
