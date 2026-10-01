// Exact professional draft-slot priority layer.
// Primary signal: what is actually banned/picked at THIS exact side + slot in recent eligible pro games.
// Secondary signal: current matchup/threat. Other context is tertiary.
(function(){
  const esBaseCoach=coachAnalysis;
  const esBaseIntel=renderIntel;
  const esBaseSources=renderSources;

  function esStepLabel(step){
    if(!step)return null;
    if(step.type==='pick')return `${step.side==='Blue'?'B':'R'}${step.slot}`;
    return `${step.side==='Blue'?'B':'R'}-BAN${step.slot}`;
  }
  function esStats(){try{return window.MLBB_PRO_MODEL?.stats?.()||null}catch{return null}}
  function esHeroStats(hero){const s=esStats();return s?.hero?.[hero.name]||null}
  function esWeightedGames(){const s=esStats();return Math.max(.001,Number(s?.weightedGames||0))}
  function esSlotEvidence(hero,step){
    const h=esHeroStats(hero),label=esStepLabel(step),games=esWeightedGames();
    if(!h||!label||games<=.001)return{label,rate:null,weightedCount:0,confidence:'INSUFFICIENT DATA',verified:false};
    const map=step.type==='pick'?h.positions:h.banPositions;
    const weightedCount=Number(map?.[label]||0);
    if(weightedCount<=0)return{label,rate:0,weightedCount:0,confidence:'LOW CONFIDENCE',verified:true};
    const rate=Math.max(0,Math.min(100,weightedCount/games*100));
    const confidence=weightedCount>=8?'HIGH CONFIDENCE':weightedCount>=4?'MEDIUM CONFIDENCE':weightedCount>=1.5?'LOW CONFIDENCE':'INSUFFICIENT DATA';
    return{label,rate,weightedCount,confidence,verified:true};
  }
  function esMatchup(base,step){
    const c=base.competitive||{};
    if(step.type==='pick')return Math.max(0,Math.min(100,Number(c.counter??base.counter??50)));
    const b=base.banDepth||{};
    const threat=Number(b.threat??b.problemOverload??c.counter??base.counter??50);
    const denial=Number(c.denial??b.synergy??base.denial??50);
    return Math.max(0,Math.min(100,Math.round(threat*.62+denial*.38)));
  }
  function esTertiary(base,step){
    const c=base.competitive||{};
    if(step.type==='pick'){
      const comp=Number(c.composition??base.comp??50),role=Number(c.roleNeed??base.role??50),flex=Number(c.flex??base.flex??50),syn=Number(c.synergy??base.syn??50);
      return Math.max(0,Math.min(100,Math.round(comp*.38+role*.27+syn*.20+flex*.15)));
    }
    const flex=Number(c.flex??base.flex??50),scarcity=Number(c.scarcity??base.banDepth?.scarcity??50),pool=Number(c.pool??base.banDepth?.poolAdvantage??50);
    return Math.max(0,Math.min(100,Math.round(flex*.34+scarcity*.33+pool*.33)));
  }
  function esFallbackPrimary(base,step){
    const p=base.priorityHierarchy;
    if(p&&Number.isFinite(Number(p.primary)))return Number(p.primary);
    const c=base.competitive||{};
    if(step.type==='pick')return Number(c.recentPresence??c.meta?.score??c.meta??base.meta?.score??50);
    return Number(c.meta?.banRate??c.meta?.score??c.meta??base.meta?.score??50);
  }
  function esScore(slot,matchup,tertiary,base,step){
    // Exact slot behavior dominates when verified. If exact slot evidence is unavailable,
    // fall back to the broader recent professional priority instead of inventing a slot rate.
    const primary=slot.verified?slot.rate:esFallbackPrimary(base,step);
    if(step.type==='pick')return Math.max(0,Math.min(100,Math.round(primary*.62+matchup*.25+tertiary*.13)));
    return Math.max(0,Math.min(100,Math.round(primary*.65+matchup*.23+tertiary*.12)));
  }

  coachAnalysis=function(hero,step){
    const base=esBaseCoach(hero,step),slot=esSlotEvidence(hero,step),matchup=esMatchup(base,step),tertiary=esTertiary(base,step),score=esScore(slot,matchup,tertiary,base,step);
    const primaryText=slot.verified?`${slot.label} recent weighted frequency ${Math.round(slot.rate)}%`:`${slot.label||'exact slot'}: INSUFFICIENT VERIFIED SLOT DATA`;
    const reason=[primaryText,`${step.type==='pick'?'enemy matchup':'draft threat / matchup'} ${matchup}/100`,step.type==='pick'?`composition/role/flex ${tertiary}/100`:`flex/scarcity/pool ${tertiary}/100`].join(' • ');
    let type;
    if(step.type==='pick')type=slot.verified&&slot.rate>=45?'EXACT-SLOT PRIORITY PICK':matchup>=75?'MATCHUP RESPONSE PICK':'CONTEXTUAL PICK';
    else type=slot.verified&&slot.rate>=45?'EXACT-SLOT PRIORITY BAN':matchup>=75?'DRAFT-SPECIFIC BAN':'CONTEXTUAL BAN';
    return{...base,score,type,reason,exactSlotPriority:{...slot,matchup,tertiary,primaryUsed:slot.verified?slot.rate:esFallbackPrimary(base,step)}};
  };

  topRecommendations=function(limit=5){
    const step=pseudoStep();
    return heroes.filter(h=>!usedNames().has(h.name)).map(hero=>({hero,a:coachAnalysis(hero,step)})).sort((x,y)=>{
      const xs=x.a.exactSlotPriority,ys=y.a.exactSlotPriority;
      // If both have verified current-slot samples, compare exact-slot frequency first.
      if(xs?.verified&&ys?.verified&&Math.abs((ys.rate||0)-(xs.rate||0))>=2)return (ys.rate||0)-(xs.rate||0);
      if(ys?.verified!==xs?.verified)return ys?.verified?1:-1;
      if(y.a.score!==x.a.score)return y.a.score-x.a.score;
      if((ys?.matchup||0)!==(xs?.matchup||0))return (ys?.matchup||0)-(xs?.matchup||0);
      return x.hero.name.localeCompare(y.hero.name);
    }).slice(0,limit);
  };

  function esLeaderboard(step,limit=5){
    return heroes.filter(h=>!usedNames().has(h.name)).map(hero=>({hero,e:esSlotEvidence(hero,step)})).filter(x=>x.e.verified).sort((a,b)=>(b.e.rate||0)-(a.e.rate||0)||a.hero.name.localeCompare(b.hero.name)).slice(0,limit);
  }
  renderIntel=function(){
    esBaseIntel();
    const root=document.querySelector('#draftIntel .intel'),step=pseudoStep();if(!root||!step)return;
    const rows=esLeaderboard(step,5),label=esStepLabel(step);
    const text=rows.length?rows.map((x,i)=>`${i+1}. ${x.hero.name} ${Math.round(x.e.rate)}%`).join(' • '):'INSUFFICIENT VERIFIED EXACT-SLOT DATA';
    root.insertAdjacentHTML('afterbegin',`<div class="intel-row"><b>EXACT ${esc(label||'DRAFT SLOT')} PROFESSIONAL TENDENCY</b><span>${esc(text)}</span></div><div class="intel-row"><b>POSITION-AWARE PRIORITY</b><span>Priority 1: recent exact-slot pick/ban tendency at ${esc(label||'this action')} • Priority 2: current matchup/threat • Priority 3: composition, role fit, flexibility, scarcity and remaining pool. This applies to Ban 1–5 and Pick 1–5 for both Blue and Red.</span></div>`);
  };

  renderSources=function(){
    esBaseSources();const root=document.getElementById('sourcesContent');if(!root)return;
    root.insertAdjacentHTML('beforeend',`<div class="source-item"><b>Exact draft-slot model</b><p>The coach tracks Blue Ban 1–5, Red Ban 1–5, B1–B5 and R1–R5 separately. Recent recency-weighted professional frequency at the current exact slot is the primary recommendation signal. Current matchup/threat is second. Composition, role fit, flexibility, scarcity and remaining-pool value are tertiary. When exact chronological match data is unavailable, the UI says insufficient data instead of inventing a position frequency.</p></div>`);
  };

  renderAll();
})();
