// Professional banning engine — team-neutral and STRICT Week 6+ for MPL data.
// The ban itself is not the only object being optimized: the engine evaluates
// the open hero pool and the next draft tree created by each possible ban.
(function(){
  function bdEnemy(side){return side==='Blue'?'Red':'Blue'}
  function bdPhase(){return (picks('Blue').length+picks('Red').length)<6?'FIRST BAN PHASE':'SECOND BAN PHASE'}
  function bdBanNumber(step){return step?.type==='ban'?sideBans(step.side).length+1:null}
  function bdPhaseLimit(){return Number(state.tournamentBanFormat)===10?3:2}
  function bdAvailable(exclude=[]){const blocked=new Set([...usedNames(),...exclude]);return heroes.filter(h=>!blocked.has(h.name))}

  function bdFlex(hero,side){
    const unique=[...new Set(lanes(hero))];
    const viable=unique.filter(l=>openRoles(side).includes(l));
    let score=unique.length>=3?96:unique.length===2?82:48;
    if(viable.length>=2)score+=7;
    if(!viable.length)score-=15;
    return{score:clamp(score),roles:unique,viable};
  }

  function bdBlindSafety(hero,side){
    const T=tags(hero);let s=54;
    if(lanes(hero).length>1)s+=10;
    if(T.has('frontline'))s+=7;
    if(T.has('sustain'))s+=5;
    if(T.has('peel')||T.has('disengage'))s+=5;
    if(T.has('objective'))s+=3;
    if(T.has('squishy')&&lanes(hero).length===1)s-=8;
    const currentEnemy=picks(bdEnemy(side));
    for(const e of currentEnemy)s+=Math.max(-6,Math.min(6,matchupValue(hero,e)*2));
    return clamp(Math.round(s));
  }

  function bdEarlyPickScore(hero,side){
    const meta=metaEvidence(hero).score;
    const flex=bdFlex(hero,side).score;
    const blind=bdBlindSafety(hero,side);
    return clamp(Math.round(meta*.54+flex*.25+blind*.21));
  }

  function bdRoleScarcity(hero,targetSide,exclude=[]){
    const needs=openRoles(targetSide),rows=[];
    for(const lane of lanes(hero)){
      if(!needs.includes(lane))continue;
      const alternatives=bdAvailable([hero.name,...exclude]).filter(h=>lanes(h).includes(lane)&&metaEvidence(h).score>=65);
      let score=44;
      if(alternatives.length<=1)score=97;
      else if(alternatives.length===2)score=88;
      else if(alternatives.length===3)score=78;
      else if(alternatives.length<=5)score=64;
      rows.push({lane,score,count:alternatives.length});
    }
    return rows.length?rows.sort((a,b)=>b.score-a.score)[0]:{lane:null,score:43,count:null};
  }

  function bdThreatToCurrentPicks(hero,side){
    const own=picks(side);if(!own.length)return{score:45,targets:[],problemCount:0};
    const vals=own.map(a=>({hero:a.name,v:matchupValue(hero,a)})).sort((a,b)=>b.v-a.v);
    const positives=vals.filter(x=>x.v>0),best=vals[0]?.v||0;
    const avg=vals.reduce((s,x)=>s+x.v,0)/vals.length;
    const problemCount=positives.length;
    return{
      score:clamp(Math.round(46+best*9+avg*4+Math.max(0,problemCount-1)*8)),
      targets:positives.slice(0,3).map(x=>x.hero),
      problemCount
    };
  }

  function bdSynergyBreak(hero,targetSide){
    const core=picks(targetSide);if(!core.length)return{score:44,with:[]};
    const rows=core.map(a=>({hero:a.name,v:synergyPair(hero,a)})).sort((a,b)=>b.v-a.v);
    const strong=rows.filter(x=>x.v>0),best=rows[0]?.v||0;
    const total=rows.reduce((s,x)=>s+Math.max(0,x.v),0);
    return{score:clamp(Math.round(44+best*11+total*5)),with:strong.slice(0,3).map(x=>x.hero)};
  }

  function bdFlexCollapse(hero,targetSide){
    const core=picks(targetSide);
    const flexible=core.filter(h=>lanes(h).length>1);
    if(!flexible.length)return 40;
    const overlap=lanes(hero).filter(l=>openRoles(targetSide).includes(l)).length;
    const synergy=bdSynergyBreak(hero,targetSide).score;
    const scarcity=bdRoleScarcity(hero,targetSide).score;
    return clamp(Math.round(38+flexible.length*9+overlap*8+(synergy-50)*.22+(scarcity-50)*.18));
  }

  function bdRoleChoke(hero,step){
    const target=bdEnemy(step.side),scarcity=bdRoleScarcity(hero,target);
    if(!scarcity.lane)return 38;
    const prior=sideBans(step.side).filter(Boolean).filter(h=>lanes(h).includes(scarcity.lane)).length;
    let s=scarcity.score+prior*10;
    if(bdPhase()==='SECOND BAN PHASE')s+=8;
    return clamp(Math.round(s));
  }

  function bdReplacementScarcity(hero,targetSide){
    const needs=openRoles(targetSide);
    const relevant=lanes(hero).filter(l=>needs.includes(l));
    if(!relevant.length)return 52;
    let worst=45;
    for(const lane of relevant){
      const alternatives=bdAvailable([hero.name]).filter(h=>lanes(h).includes(lane)&&metaEvidence(h).score>=65);
      const score=alternatives.length<=1?96:alternatives.length===2?86:alternatives.length===3?74:alternatives.length<=5?60:44;
      worst=Math.max(worst,score);
    }
    return worst;
  }

  function bdPoolCleaning(hero,targetSide){
    const flex=bdFlex(hero,targetSide).score;
    const meta=metaEvidence(hero).score;
    const branchCount=lanes(hero).length;
    const synergy=bdSynergyBreak(hero,targetSide).score;
    return clamp(Math.round(meta*.28+flex*.35+synergy*.17+Math.min(100,45+branchCount*14)*.20));
  }

  function bdOpenPoolAfter(candidate,step){
    const pool=bdAvailable([candidate.name]);
    const scored=pool.map(h=>({hero:h,score:bdEarlyPickScore(h,'Blue')})).sort((a,b)=>b.score-a.score||a.hero.name.localeCompare(b.hero.name));
    const top=scored.slice(0,5);
    const a=top[0]?.score||50,b=top[1]?.score||50,c=top[2]?.score||50;
    let advantage;
    if(step.side==='Blue'){
      // Blue owns first pick: a singular premium hero left open can be valuable.
      advantage=clamp(Math.round(50+(a-(b+c)/2)*1.5));
    }else{
      // Red answers with two picks: a flat top pool improves two-for-one trade quality.
      const pair=(b+c)/2;
      const singularGap=Math.max(0,a-pair);
      advantage=clamp(Math.round(50+(pair-60)*.35-singularGap*1.35));
    }
    return{advantage,top:top.map(x=>({name:x.hero.name,score:x.score}))};
  }

  function bdTradeOpenValue(hero,step){
    const early=bdEarlyPickScore(hero,'Blue');
    const pool=bdAvailable([hero.name]).map(h=>bdEarlyPickScore(h,'Blue')).sort((a,b)=>b-a);
    const next1=pool[0]||50,next2=pool[1]||50;
    if(step.side==='Blue'){
      // Blue should be reluctant to ban an elite hero it can first-pick itself.
      return clamp(Math.round(early*.72+Math.max(0,early-next1)*.55));
    }
    // Red may intentionally leave a strong hero if two comparable answers remain.
    const tradePair=(next1+next2)/2;
    const balance=100-Math.abs(early-tradePair)*2;
    return clamp(Math.round(tradePair*.55+balance*.45));
  }

  function bdBanTiming(hero,step,power,tradeOpen){
    const banNo=bdBanNumber(step)||1,max=bdPhaseLimit();
    if(bdPhase()!=='FIRST BAN PHASE')return{score:70,label:'BAN NOW'};
    if(tradeOpen>=78&&power<92)return{score:36,label:'INTENTIONAL OPEN / TRADE CANDIDATE'};
    if(banNo<max&&power>=76&&tradeOpen>=60)return{score:52,label:'HOLD FOR LATER BAN'};
    if(power>=84)return{score:88,label:'BAN NOW'};
    return{score:68,label:'BAN NOW'};
  }

  function bdProblemOverload(hero,side){
    const threat=bdThreatToCurrentPicks(hero,side);
    return clamp(Math.round(threat.score+Math.max(0,threat.problemCount-1)*10));
  }

  function bdClass(d,phase){
    if(phase==='FIRST BAN PHASE'){
      if(d.tradeOpen>=80&&d.power<92)return'INTENTIONAL OPEN CANDIDATE';
      if(d.meta>=90&&d.power>=86)return'RESIDENT / NEAR-AUTO META BAN';
      if(d.flex>=86&&d.poolClean>=76)return'FLEX CONTROL BAN';
      if(d.poolClean>=78)return'POOL-CLEANING BAN';
      if(d.poolAdvantage>=68)return'OPEN-POOL CONTROL BAN';
      if(d.power>=80)return'POWER-PICK BAN';
      return'FIRST-PHASE STRUCTURE BAN';
    }
    if(d.problemOverload>=82)return'PROBLEM-OVERLOAD BAN';
    if(d.threat>=78)return'PROTECTION BAN';
    if(d.roleChoke>=82)return'ROLE-CHOKE BAN';
    if(d.synergy>=76)return'SYNERGY-BREAK BAN';
    if(d.flexCollapse>=74)return'FLEX-COLLAPSE BAN';
    if(d.denial>=76)return'DENIAL BAN';
    return'SECOND-PHASE TARGET BAN';
  }

  const bdBaseCoach=coachAnalysis;
  coachAnalysis=function(hero,step){
    const base=bdBaseCoach(hero,step);
    if(step.type!=='ban')return base;

    const phase=bdPhase(),target=bdEnemy(step.side);
    const flex=bdFlex(hero,target),scarcity=bdRoleScarcity(hero,target);
    const threat=bdThreatToCurrentPicks(hero,step.side),synergy=bdSynergyBreak(hero,target);
    const power=bdEarlyPickScore(hero,target),replacement=bdReplacementScarcity(hero,target);
    const poolClean=bdPoolCleaning(hero,target),openPool=bdOpenPoolAfter(hero,step);
    const tradeOpen=bdTradeOpenValue(hero,step),timing=bdBanTiming(hero,step,power,tradeOpen);
    const roleChoke=bdRoleChoke(hero,step),flexCollapse=bdFlexCollapse(hero,target);
    const problemOverload=bdProblemOverload(hero,step.side);
    const meta=base.meta.score,denial=base.denial,counter=base.counter;

    let score;
    if(phase==='FIRST BAN PHASE'){
      score=clamp(Math.round(
        meta*.20+power*.17+flex.score*.11+poolClean*.11+openPool.advantage*.12+
        replacement*.06+scarcity.score*.05+timing.score*.09+denial*.04+counter*.02+
        (100-tradeOpen)*.03
      ));
    }else{
      const oneBanOnly=Number(state.tournamentBanFormat)!==10;
      if(oneBanOnly){
        score=clamp(Math.round(
          threat.score*.24+problemOverload*.17+roleChoke*.16+synergy.score*.13+
          flexCollapse*.10+denial*.09+replacement*.05+meta*.04+counter*.02
        ));
      }else{
        score=clamp(Math.round(
          threat.score*.20+problemOverload*.14+roleChoke*.15+synergy.score*.12+
          flexCollapse*.10+denial*.10+replacement*.07+meta*.06+counter*.03+poolClean*.03
        ));
      }
    }

    // An intentional-open candidate must remain selectable as a ban, but its score
    // is lowered so the coach can prefer a better pool-shaping ban instead.
    if(phase==='FIRST BAN PHASE'&&timing.label==='INTENTIONAL OPEN / TRADE CANDIDATE')score=clamp(score-10);
    if(phase==='FIRST BAN PHASE'&&timing.label==='HOLD FOR LATER BAN')score=clamp(score-5);

    const data={
      phase,banNo:bdBanNumber(step),meta,power,flex:flex.score,poolClean,
      poolAdvantage:openPool.advantage,openPool:openPool.top,tradeOpen,
      timing:timing.score,timingLabel:timing.label,scarcity:scarcity.score,
      scarcityLane:scarcity.lane,replacement,threat:threat.score,
      threatTargets:threat.targets,problemOverload,synergy:synergy.score,
      synergyWith:synergy.with,roleChoke,flexCollapse,denial,counter
    };
    const type=bdClass(data,phase),reasons=[];

    if(phase==='FIRST BAN PHASE'){
      if(meta>=78)reasons.push('removes current Week 6+ meta pressure');
      if(power>=78)reasons.push('removes a strong early-pick option');
      if(flex.score>=82)reasons.push('cuts flex and role-concealment branches');
      if(poolClean>=74)reasons.push('simplifies the remaining draft tree');
      if(openPool.advantage>=64)reasons.push('creates a better post-ban open pool');
      if(timing.label==='HOLD FOR LATER BAN')reasons.push('can be delayed to preserve ban-order pressure');
      if(timing.label==='INTENTIONAL OPEN / TRADE CANDIDATE')reasons.push('may be stronger to leave open for a favorable trade');
    }else{
      if(threat.score>=68)reasons.push(`protects revealed picks${threat.targets.length?` from ${threat.targets.join(', ')}`:''}`);
      if(problemOverload>=74)reasons.push('prevents one hero from overloading multiple answers');
      if(roleChoke>=74)reasons.push(`chokes remaining ${scarcity.lane||'role'} depth`);
      if(synergy.score>=68)reasons.push(`breaks a strong follow-up${synergy.with.length?` to ${synergy.with.join(', ')}`:''}`);
      if(flexCollapse>=70)reasons.push('reduces remaining flex assignments');
      if(denial>=70)reasons.push('denies a strong late response');
    }
    if(!reasons.length)reasons.push('best resulting draft-tree value for this ban slot');

    return{...base,score,type,reason:reasons.slice(0,3).join(' • '),banDepth:data};
  };

  const bdBaseIntel=renderIntel;
  renderIntel=function(){
    bdBaseIntel();
    const step=pseudoStep();if(step.type!=='ban')return;
    const top=topRecommendations(1)[0];if(!top?.a?.banDepth)return;
    const b=top.a.banDepth,root=document.querySelector('#draftIntel .intel');if(!root)return;
    const pool=b.openPool.length?b.openPool.map(x=>`${x.name} ${x.score}`).join(' • '):'No projected pool';
    root.insertAdjacentHTML('afterbegin',
      `<div class="intel-row"><b>BAN PLAN</b><span>${esc(b.phase)} • ${esc(top.a.type)} • ${esc(b.timingLabel)}</span></div>`+
      `<div class="intel-row"><b>RESULTING OPEN POOL</b><span>Pool-control ${b.poolAdvantage}/100 • projected top open early picks after this ban: ${esc(pool)}.</span></div>`+
      `<div class="intel-row"><b>FIRST-PHASE STRUCTURE</b><span>Power ${b.power}/100 • Flex ${b.flex}/100 • Pool-cleaning ${b.poolClean}/100 • Trade-open value ${b.tradeOpen}/100 • Ban timing ${b.timing}/100.</span></div>`+
      `<div class="intel-row"><b>SECOND-PHASE TARGETING</b><span>Protection ${b.threat}/100 • Problem overload ${b.problemOverload}/100 • Role choke ${b.roleChoke}/100 • Synergy break ${b.synergy}/100 • Flex collapse ${b.flexCollapse}/100.</span></div>`
    );
  };

  const bdBaseDrawer=openHeroDrawer;
  openHeroDrawer=function(hero){
    bdBaseDrawer(hero);
    const step=pseudoStep();if(step.type!=='ban')return;
    const a=coachAnalysis(hero,step),b=a.banDepth,grid=document.querySelector('#drawerBody .analysis-grid');if(!grid||!b)return;
    const pool=b.openPool.length?b.openPool.map(x=>`${x.name} (${x.score})`).join(', '):'No projected pool';
    grid.insertAdjacentHTML('beforeend',
      `<div class="analysis-box"><b>BAN ORDER</b><span>${esc(b.timingLabel)} • Timing ${b.timing}/100</span></div>`+
      `<div class="analysis-box"><b>OPEN / TRADE VALUE</b><span>${b.tradeOpen}/100 • high value means consider intentionally leaving this hero open.</span></div>`+
      `<div class="analysis-box"><b>POST-BAN POOL CONTROL</b><span>${b.poolAdvantage}/100<br>${esc(pool)}</span></div>`+
      `<div class="analysis-box"><b>POOL-CLEANING VALUE</b><span>${b.poolClean}/100</span></div>`+
      `<div class="analysis-box"><b>PROBLEM OVERLOAD</b><span>${b.problemOverload}/100</span></div>`+
      `<div class="analysis-box"><b>ROLE CHOKE</b><span>${b.roleChoke}/100${b.scarcityLane?` • ${esc(b.scarcityLane)}`:''}</span></div>`+
      `<div class="analysis-box"><b>FLEX COLLAPSE</b><span>${b.flexCollapse}/100</span></div>`+
      `<div class="analysis-box"><b>PROTECTION VALUE</b><span>${b.threat}/100${b.threatTargets.length?` • threatens ${esc(b.threatTargets.join(', '))}`:''}</span></div>`+
      `<div class="analysis-box"><b>SYNERGY BREAK</b><span>${b.synergy}/100${b.synergyWith.length?` • pairs with ${esc(b.synergyWith.join(', '))}`:''}</span></div>`
    );
  };

  const bdBaseSources=renderSources;
  renderSources=function(){
    bdBaseSources();
    const root=document.getElementById('sourcesContent');if(!root)return;
    root.insertAdjacentHTML('beforeend',`<div class="source-item"><b>Draft-tree banning methodology</b><p>The banning engine evaluates the resulting open hero pool, not only the hero being removed. First phase models resident meta pressure, early-pick power, flex control, pool-cleaning, intentional opens/trades and ban timing. Second phase prioritizes protection, problem-overload prevention, role choke, synergy breaks, flex collapse and late denial. MPL scoring remains restricted to Week 6 and later and is team-neutral.</p></div>`);
  };

  renderAll();
})();