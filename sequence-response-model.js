// Conditional draft-sequence model.
// Answers: after hero X is banned, what does the other side ban next; what is
// each side's first pick; and after enemy picks X, what response pick follows.
// Verified frequencies are used only when chronological match data exist.
(function(){
  const SR_MIN_SAMPLE=3;
  const SR_WEEK_WEIGHTS=[1,.85,.70,.55,.40,.25,.15,.10];
  function srEnemy(side){return side==='Blue'?'Red':'Blue'}
  function srAvailable(exclude=[]){const blocked=new Set([...usedNames(),...exclude]);return heroes.filter(h=>!blocked.has(h.name))}
  function srScope(){return state.scope||document.getElementById('scopeSelect')?.value||'Combined'}
  function srMatches(){
    const all=Array.isArray(window.MLBB_SEQUENCE_DATA?.matches)?window.MLBB_SEQUENCE_DATA.matches:[];
    const scope=srScope();
    return all.filter(m=>{
      if(!Array.isArray(m.actions)||!m.actions.length)return false;
      if((m.competition==='MPL PH'||m.competition==='MPL ID')&&Number(m.week)<6)return false;
      if(scope==='Combined')return true;
      return m.competition===scope;
    });
  }
  function srMatchWeight(m){
    if(m.competition==='MPL PH'||m.competition==='MPL ID'){
      const latest=Number(window.MLBB_META?.weekRecency?.leagues?.[m.competition]?.latestCompletedWeek||m.week||6);
      const gap=Math.max(0,latest-Number(m.week||latest));
      return SR_WEEK_WEIGHTS[Math.min(gap,SR_WEEK_WEIGHTS.length-1)]||.1;
    }
    return 1;
  }
  function srAdd(map,hero,w){
    if(!hero)return;
    const x=map.get(hero)||{hero,count:0,weighted:0};x.count++;x.weighted+=w;map.set(hero,x);
  }
  function srRank(map,totalCount,totalWeight){
    return [...map.values()].map(x=>({...x,rate:totalCount?x.count/totalCount*100:0,weightedRate:totalWeight?x.weighted/totalWeight*100:0})).sort((a,b)=>b.weighted-a.weighted||b.count-a.count||a.hero.localeCompare(b.hero));
  }
  function srEvidenceLabel(sample){return sample>=SR_MIN_SAMPLE?'OFFICIAL MATCH DATA':sample>0?'LIMITED OFFICIAL MATCH DATA':'INSUFFICIENT DATA'}

  function srNextOpponentBan(triggerHero){
    const out=new Map();let sample=0,totalWeight=0;
    for(const m of srMatches()){
      const w=srMatchWeight(m),A=m.actions;
      for(let i=0;i<A.length;i++){
        const a=A[i];if(a.type!=='ban'||a.hero!==triggerHero)continue;
        for(let j=i+1;j<A.length;j++){
          const b=A[j];if(b.type==='pick')break;
          if(b.type==='ban'&&b.side!==a.side){srAdd(out,b.hero,w);sample++;totalWeight+=w;break;}
        }
      }
    }
    return{sample,rows:srRank(out,sample,totalWeight),label:srEvidenceLabel(sample)};
  }
  function srFirstPicksAfterBan(triggerHero){
    const own=new Map(),opp=new Map();let sample=0,totalWeight=0;
    for(const m of srMatches()){
      const w=srMatchWeight(m),A=m.actions;
      for(let i=0;i<A.length;i++){
        const a=A[i];if(a.type!=='ban'||a.hero!==triggerHero)continue;
        let ownPick=null,oppPick=null;
        for(let j=i+1;j<A.length;j++){
          const b=A[j];if(b.type!=='pick')continue;
          if(b.side===a.side&&!ownPick)ownPick=b.hero;
          if(b.side!==a.side&&!oppPick)oppPick=b.hero;
          if(ownPick&&oppPick)break;
        }
        if(ownPick||oppPick){sample++;totalWeight+=w;srAdd(own,ownPick,w);srAdd(opp,oppPick,w);}
      }
    }
    return{sample,own:srRank(own,sample,totalWeight),opp:srRank(opp,sample,totalWeight),label:srEvidenceLabel(sample)};
  }
  function srEnemyResponsePick(triggerHero){
    const out=new Map();let sample=0,totalWeight=0;
    for(const m of srMatches()){
      const w=srMatchWeight(m),A=m.actions;
      for(let i=0;i<A.length;i++){
        const a=A[i];if(a.type!=='pick'||a.hero!==triggerHero)continue;
        for(let j=i+1;j<A.length;j++){
          const b=A[j];
          if(b.type==='pick'&&b.side!==a.side){srAdd(out,b.hero,w);sample++;totalWeight+=w;break;}
        }
      }
    }
    return{sample,rows:srRank(out,sample,totalWeight),label:srEvidenceLabel(sample)};
  }

  function srHeuristicBanAfter(triggerHero,side){
    const step={side:srEnemy(side),type:'ban'};
    return srAvailable([triggerHero]).map(h=>({hero:h.name,score:coachAnalysis(h,step).score})).sort((a,b)=>b.score-a.score).slice(0,3);
  }
  function srHeuristicFirstPick(side,exclude=[]){
    const step={side,type:'pick'};
    return srAvailable(exclude).map(h=>({hero:h.name,score:coachAnalysis(h,step).score})).sort((a,b)=>b.score-a.score).slice(0,3);
  }
  function srHeuristicResponse(triggerHero,side){
    const trigger=heroes.find(h=>h.name===triggerHero);if(!trigger)return[];
    const step={side,type:'pick'};
    return srAvailable([triggerHero]).map(h=>{
      const a=coachAnalysis(h,step);
      let counter=50;try{counter=counterScore(h,side);}catch{}
      let direct=matchupValue(h,trigger);
      const score=clamp(Math.round(a.score*.72+counter*.18+(50+direct*10)*.10));
      return{hero:h.name,score};
    }).sort((a,b)=>b.score-a.score).slice(0,5);
  }
  function srTopText(result){
    if(!result?.rows?.length)return'INSUFFICIENT VERIFIED SEQUENCE DATA';
    return result.rows.slice(0,3).map(x=>`${x.hero} ${Math.round(x.weightedRate)}% (${x.count}/${result.sample})`).join(' • ');
  }

  function srHypothetical(hero,step){
    if(step.type==='ban'){
      const nextBan=srNextOpponentBan(hero.name),first=srFirstPicksAfterBan(hero.name);
      return{
        kind:'ban',nextBan,first,
        inferredNextBan:srHeuristicBanAfter(hero.name,step.side),
        inferredOurFirst:srHeuristicFirstPick(step.side,[hero.name]),
        inferredEnemyFirst:srHeuristicFirstPick(srEnemy(step.side),[hero.name])
      };
    }
    const response=srEnemyResponsePick(hero.name);
    return{kind:'pick',response,inferredResponse:srHeuristicResponse(hero.name,srEnemy(step.side))};
  }

  // Small scoring boost only when verified chronological evidence exists.
  const srBaseCoach=coachAnalysis;
  coachAnalysis=function(hero,step){
    const base=srBaseCoach(hero,step);
    const last=state.actions?.[state.actions.length-1];
    if(!last)return base;
    let observed=null;
    if(step.type==='pick'&&last.type==='pick'&&last.side!==step.side){observed=srEnemyResponsePick(last.hero);}
    else if(step.type==='ban'&&last.type==='ban'&&last.side!==step.side){observed=srNextOpponentBan(last.hero);}
    if(!observed||observed.sample<SR_MIN_SAMPLE)return base;
    const row=observed.rows.find(x=>x.hero===hero.name);if(!row)return base;
    const bonus=Math.min(12,Math.round(row.weightedRate*.12));
    return{...base,score:clamp(base.score+bonus),sequenceBonus:bonus,sequenceEvidence:{trigger:last.hero,sample:observed.sample,rate:row.weightedRate,label:'OFFICIAL MATCH DATA'}};
  };

  const srBaseIntel=renderIntel;
  renderIntel=function(){
    srBaseIntel();
    const root=document.querySelector('#draftIntel .intel');if(!root)return;
    const last=state.actions?.[state.actions.length-1];
    if(!last){root.insertAdjacentHTML('afterbegin',`<div class="intel-row"><b>SEQUENCE RESPONSE MODEL</b><span>Tracks ban→next opposing ban, ban→first picks, and enemy pick→response pick using verified chronological Week 6+ match data when available.</span></div>`);return;}
    if(last.type==='ban'){
      const nb=srNextOpponentBan(last.hero),fp=srFirstPicksAfterBan(last.hero);
      const verified=nb.sample||fp.sample;
      let text;
      if(verified){
        const own=fp.own?.[0],opp=fp.opp?.[0];
        text=`After ${esc(last.hero)} ban: next opposing ban ${esc(srTopText(nb))}. First pick by banning side: ${own?esc(`${own.hero} ${Math.round(own.weightedRate)}% (${own.count}/${fp.sample})`):'INSUFFICIENT DATA'}. First pick by other side: ${opp?esc(`${opp.hero} ${Math.round(opp.weightedRate)}% (${opp.count}/${fp.sample})`):'INSUFFICIENT DATA'}.`;
      }else{
        const inf=srHeuristicBanAfter(last.hero,last.side).map(x=>`${x.hero} ${x.score}`).join(' • ');
        text=`INSUFFICIENT VERIFIED SEQUENCE DATA. Analytical inference for the next opposing ban: ${esc(inf||'—')}. No professional frequency is invented.`;
      }
      root.insertAdjacentHTML('afterbegin',`<div class="intel-row"><b>AFTER ${esc(last.hero.toUpperCase())} BAN</b><span>${text}</span></div>`);
    }else{
      const r=srEnemyResponsePick(last.hero);
      const text=r.sample?`${srTopText(r)} • ${r.label}`:`INSUFFICIENT VERIFIED SEQUENCE DATA. Analytical response inference: ${srHeuristicResponse(last.hero,srEnemy(last.side)).slice(0,3).map(x=>`${x.hero} ${x.score}`).join(' • ')}.`;
      root.insertAdjacentHTML('afterbegin',`<div class="intel-row"><b>RESPONSE TO ${esc(last.hero.toUpperCase())}</b><span>${text}</span></div>`);
    }
  };

  const srBaseDrawer=openHeroDrawer;
  openHeroDrawer=function(hero){
    srBaseDrawer(hero);
    const step=pseudoStep(),h=srHypothetical(hero,step),grid=document.querySelector('#drawerBody .analysis-grid');if(!grid)return;
    if(h.kind==='ban'){
      const nb=h.nextBan.sample?srTopText(h.nextBan):`INFERENCE: ${h.inferredNextBan.map(x=>x.hero).join(', ')}`;
      const own=h.first.sample&&h.first.own[0]?`${h.first.own[0].hero} ${Math.round(h.first.own[0].weightedRate)}%`:`INFERENCE: ${h.inferredOurFirst.map(x=>x.hero).join(', ')}`;
      const opp=h.first.sample&&h.first.opp[0]?`${h.first.opp[0].hero} ${Math.round(h.first.opp[0].weightedRate)}%`:`INFERENCE: ${h.inferredEnemyFirst.map(x=>x.hero).join(', ')}`;
      grid.insertAdjacentHTML('beforeend',`<div class="analysis-box"><b>IF WE BAN ${esc(hero.name)}</b><span>Likely next opposing ban: ${esc(nb)}</span></div><div class="analysis-box"><b>FIRST PICK AFTER THIS BAN</b><span>Our side: ${esc(own)}<br>Other side: ${esc(opp)}</span></div>`);
    }else{
      const response=h.response.sample?srTopText(h.response):`INFERENCE: ${h.inferredResponse.slice(0,5).map(x=>x.hero).join(', ')}`;
      grid.insertAdjacentHTML('beforeend',`<div class="analysis-box"><b>IF ${esc(hero.name)} IS PICKED</b><span>Likely opposing response: ${esc(response)}</span></div>`);
    }
  };

  const srBaseSources=renderSources;
  renderSources=function(){
    srBaseSources();
    const root=document.getElementById('sourcesContent');if(!root)return;
    const n=srMatches().length;
    root.insertAdjacentHTML('beforeend',`<div class="source-item"><b>Conditional sequence model</b><p>Calculates team-neutral conditional draft transitions from exact chronological match actions: ban → next opposing ban, ban → first pick by each side, and pick → next opposing response pick. MPL PH and MPL ID matches before Week 6 are excluded. A minimum sample of ${SR_MIN_SAMPLE} observed transitions is required before sequence frequency can affect recommendation scores. Current loaded verified sequence matches: ${n}. When evidence is missing, the UI explicitly labels the result as analytical inference or insufficient data.</p></div>`);
  };

  window.MLBB_SEQUENCE_ANALYSIS={nextOpponentBan:srNextOpponentBan,firstPicksAfterBan:srFirstPicksAfterBan,responsePick:srEnemyResponsePick,hypothetical:srHypothetical};
  renderAll();
})();