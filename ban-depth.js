// Deep professional banning layer.
// Team-neutral and Week 6+ only. First-phase bans shape the power-pick/flex pool;
// second-phase bans protect revealed picks, attack remaining roles, break synergy,
// and exploit role scarcity. No opponent/team/player identity is used.
(function(){
  function bdEnemy(side){return side==='Blue'?'Red':'Blue'}
  function bdBanNumber(step){return step?.type==='ban'?sideBans(step.side).length+1:null}
  function bdPhase(){return (picks('Blue').length+picks('Red').length)<6?'FIRST BAN PHASE':'SECOND BAN PHASE'}
  function bdAvailable(exclude=[]){const blocked=new Set([...usedNames(),...exclude]);return heroes.filter(h=>!blocked.has(h.name))}
  function bdFlex(hero,side){
    const total=[...new Set(lanes(hero))].length;
    const viable=[...new Set(lanes(hero).filter(l=>openRoles(side).includes(l)))];
    let score=total>=3?96:total===2?82:48;
    if(viable.length>=2)score+=6;
    if(!viable.length)score-=18;
    return{score:clamp(score),total,viable};
  }
  function bdRoleScarcity(hero,targetSide,exclude=[]){
    const targetNeeds=openRoles(targetSide);
    const values=[];
    for(const lane of lanes(hero)){
      if(!targetNeeds.includes(lane))continue;
      const options=bdAvailable([hero.name,...exclude]).filter(h=>lanes(h).includes(lane)&&metaEvidence(h).score>=65);
      let v=42;
      if(options.length<=1)v=96;else if(options.length===2)v=86;else if(options.length===3)v=76;else if(options.length<=5)v=62;
      values.push({lane,value:v,count:options.length});
    }
    return values.length?values.sort((a,b)=>b.value-a.value)[0]:{lane:null,value:45,count:null};
  }
  function bdThreatToCurrentPicks(hero,side){
    const own=picks(side);if(!own.length)return 45;
    const vals=own.map(a=>({hero:a.name,v:matchupValue(hero,a)})).sort((a,b)=>b.v-a.v);
    const best=vals[0]?.v||0;
    const avg=vals.reduce((s,x)=>s+x.v,0)/vals.length;
    return{score:clamp(Math.round(48+best*10+avg*5)),targets:vals.filter(x=>x.v>0).slice(0,3).map(x=>x.hero)};
  }
  function bdSynergyBreak(hero,targetSide){
    const enemyPicks=picks(targetSide);if(!enemyPicks.length)return{score:45,with:[]};
    const pairs=enemyPicks.map(a=>({hero:a.name,v:synergyPair(hero,a)})).sort((a,b)=>b.v-a.v);
    const best=pairs[0]?.v||0,avg=pairs.reduce((s,x)=>s+x.v,0)/pairs.length;
    return{score:clamp(Math.round(45+best*12+avg*7)),with:pairs.filter(x=>x.v>0).slice(0,3).map(x=>x.hero)};
  }
  function bdPowerPickRisk(hero,targetSide){
    const meta=metaEvidence(hero).score;
    const flex=bdFlex(hero,targetSide).score;
    const blind=typeof ddBlindSafety==='function'?ddBlindSafety(hero,{side:targetSide,type:'pick'}):55;
    return clamp(Math.round(meta*.52+flex*.25+blind*.23));
  }
  function bdReplacementPenalty(hero,targetSide){
    const targetNeeds=openRoles(targetSide);
    const candidateLanes=lanes(hero).filter(l=>targetNeeds.includes(l));
    if(!candidateLanes.length)return 55;
    let bestAlternatives=99;
    for(const lane of candidateLanes){
      const alternatives=bdAvailable([hero.name]).filter(h=>lanes(h).includes(lane)&&metaEvidence(h).score>=65).length;
      bestAlternatives=Math.min(bestAlternatives,alternatives);
    }
    if(bestAlternatives<=1)return 95;
    if(bestAlternatives===2)return 85;
    if(bestAlternatives===3)return 74;
    if(bestAlternatives<=5)return 60;
    return 45;
  }
  function bdTradeImpact(hero,step){
    const enemy=bdEnemy(step.side);
    const enemyNeed=openRoles(enemy);
    let s=45;
    if(lanes(hero).some(l=>enemyNeed.includes(l)))s+=12;
    if(metaEvidence(hero).score>=85)s+=14;
    if(bdFlex(hero,enemy).score>=82)s+=12;
    const scarcity=bdRoleScarcity(hero,enemy).value;
    if(scarcity>=80)s+=12;
    return clamp(s);
  }
  function bdBanClass(data,phase){
    if(phase==='FIRST BAN PHASE'){
      if(data.meta>=88&&data.power>=82)return'AUTO / NEAR-AUTO META BAN';
      if(data.flex>=84&&data.power>=76)return'FLEX POWER BAN';
      if(data.trade>=78)return'TRADE CONTROL BAN';
      if(data.scarcity>=82)return'ROLE-SCARCITY BAN';
      return'META POOL BAN';
    }
    if(data.threat>=78)return'PROTECTION BAN';
    if(data.synergy>=76)return'SYNERGY BREAK BAN';
    if(data.scarcity>=82)return'ROLE TARGET BAN';
    if(data.denial>=76)return'DENIAL BAN';
    if(data.flex>=84)return'FLEX CLOSURE BAN';
    return'COMPOSITION / POOL BAN';
  }

  const bdBaseCoach=coachAnalysis;
  coachAnalysis=function(hero,step){
    const base=bdBaseCoach(hero,step);
    if(step.type!=='ban')return base;

    const phase=bdPhase(),enemy=bdEnemy(step.side),banNo=bdBanNumber(step);
    const flex=bdFlex(hero,enemy);
    const scarcity=bdRoleScarcity(hero,enemy);
    const threat=bdThreatToCurrentPicks(hero,step.side);
    const synergy=bdSynergyBreak(hero,enemy);
    const power=bdPowerPickRisk(hero,enemy);
    const replacement=bdReplacementPenalty(hero,enemy);
    const trade=bdTradeImpact(hero,step);
    const meta=base.meta.score,denial=base.denial,counter=base.counter;

    let score;
    if(phase==='FIRST BAN PHASE'){
      score=clamp(Math.round(
        meta*.30+
        power*.20+
        flex.score*.14+
        trade*.12+
        scarcity.value*.09+
        replacement*.07+
        denial*.05+
        counter*.03
      ));
    }else{
      score=clamp(Math.round(
        threat.score*.24+
        synergy.score*.16+
        scarcity.value*.15+
        denial*.13+
        meta*.10+
        replacement*.08+
        flex.score*.06+
        trade*.05+
        counter*.03
      ));
    }

    const banClass=bdBanClass({meta,power,flex:flex.score,trade,scarcity:scarcity.value,threat:threat.score,synergy:synergy.score,denial},phase);
    const reasons=[];
    if(phase==='FIRST BAN PHASE'){
      if(meta>=78)reasons.push('removes a current Week 6+ priority hero');
      if(power>=75)reasons.push('prevents a strong early power pick');
      if(flex.score>=80)reasons.push('removes flex and role-concealment value');
      if(trade>=72)reasons.push('improves the first-pick trade tree');
      if(scarcity.value>=75)reasons.push(`compresses ${scarcity.lane||'role'} options`);
    }else{
      if(threat.score>=68)reasons.push(`protects current picks${threat.targets.length?` from ${threat.targets.join(', ')}`:''}`);
      if(synergy.score>=68)reasons.push(`breaks likely synergy${synergy.with.length?` with ${synergy.with.join(', ')}`:''}`);
      if(scarcity.value>=72)reasons.push(`targets remaining ${scarcity.lane||'role'} depth`);
      if(denial>=68)reasons.push('denies a strong remaining response');
      if(flex.score>=80)reasons.push('removes a flexible late answer');
    }
    if(replacement>=80)reasons.push('few comparable replacements remain');
    if(!reasons.length)reasons.push('best overall phase-specific ban value');

    return{...base,score,type:banClass,reason:reasons.slice(0,3).join(' • '),banDepth:{phase,banNo,meta,power,flex:flex.score,trade,scarcity:scarcity.value,scarcityLane:scarcity.lane,replacement,threat:threat.score,threatTargets:threat.targets,synergy:synergy.score,synergyWith:synergy.with,denial,counter}};
  };

  const bdBaseRenderIntel=renderIntel;
  renderIntel=function(){
    bdBaseRenderIntel();
    const step=pseudoStep();if(step.type!=='ban')return;
    const top=topRecommendations(1)[0];if(!top?.a?.banDepth)return;
    const b=top.a.banDepth,root=document.querySelector('#draftIntel .intel');if(!root)return;
    root.insertAdjacentHTML('afterbegin',`<div class="intel-row"><b>BAN PHILOSOPHY</b><span>${esc(b.phase)} • Ban ${b.banNo||'—'} • ${esc(top.a.type)}. First phase shapes the power-pick/flex pool; second phase protects revealed picks, attacks remaining roles, breaks synergy and exploits scarcity.</span></div><div class="intel-row"><b>BAN DEPTH</b><span>Meta ${b.meta}/100 • Power-pick risk ${b.power}/100 • Flex threat ${b.flex}/100 • Trade impact ${b.trade}/100 • Role scarcity ${b.scarcity}/100 • Replacement scarcity ${b.replacement}/100.</span></div><div class="intel-row"><b>PROTECTION / SYNERGY BREAK</b><span>Threat to current picks ${b.threat}/100${b.threatTargets.length?` (${esc(b.threatTargets.join(', '))})`:''} • Synergy-break ${b.synergy}/100${b.synergyWith.length?` (${esc(b.synergyWith.join(', '))})`:''}.</span></div>`);
  };

  const bdBaseOpenDrawer=openHeroDrawer;
  openHeroDrawer=function(hero){
    bdBaseOpenDrawer(hero);
    const step=pseudoStep();if(step.type!=='ban')return;
    const a=coachAnalysis(hero,step);if(!a.banDepth)return;
    const b=a.banDepth,grid=document.querySelector('#drawerBody .analysis-grid');if(!grid)return;
    grid.insertAdjacentHTML('beforeend',`<div class="analysis-box"><b>BAN PHASE</b><span>${esc(b.phase)} • Ban ${b.banNo||'—'} • ${esc(a.type)}</span></div><div class="analysis-box"><b>POWER-PICK RISK</b><span>${b.power}/100</span></div><div class="analysis-box"><b>FLEX THREAT</b><span>${b.flex}/100</span></div><div class="analysis-box"><b>TRADE IMPACT</b><span>${b.trade}/100</span></div><div class="analysis-box"><b>ROLE SCARCITY</b><span>${b.scarcity}/100${b.scarcityLane?` • ${esc(b.scarcityLane)}`:''}</span></div><div class="analysis-box"><b>REPLACEMENT SCARCITY</b><span>${b.replacement}/100 • higher means fewer comparable alternatives remain.</span></div><div class="analysis-box"><b>PROTECTION VALUE</b><span>${b.threat}/100${b.threatTargets.length?` • threatens ${esc(b.threatTargets.join(', '))}`:''}</span></div><div class="analysis-box"><b>SYNERGY BREAK</b><span>${b.synergy}/100${b.synergyWith.length?` • potential partners ${esc(b.synergyWith.join(', '))}`:''}</span></div>`);
  };

  const bdBaseRenderSources=renderSources;
  renderSources=function(){
    bdBaseRenderSources();
    const root=document.getElementById('sourcesContent');if(!root)return;
    root.insertAdjacentHTML('beforeend',`<div class="source-item"><b>Deep ban methodology</b><p>First-phase bans prioritize current Week 6+ meta pressure, power-pick risk, flex threat, role concealment, trade control and role scarcity. Second-phase bans prioritize protecting revealed picks, removing counters, breaking likely synergies, attacking remaining roles, denial value, replacement scarcity and flexible late answers. No pre-Week-6 MPL data or opponent-specific team/player history is used.</p></div>`);
  };

  renderAll();
})();