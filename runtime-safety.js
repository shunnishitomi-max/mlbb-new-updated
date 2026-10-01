// Runtime guard for the layered draft-analysis extensions.
// Keeps the drafting sequence functional even if one optional intelligence panel fails.
(function(){
  function safeCall(name,fn){
    try{if(typeof fn==='function')fn();}
    catch(err){console.error(`[MLBB Coach] ${name} render failed`,err);}
  }

  renderAll=function(){
    safeCall('mode',renderMode);
    safeCall('role tabs',renderRoleTabs);
    safeCall('bans',renderBans);
    safeCall('picks',renderPicks);
    safeCall('header',renderHeader);
    safeCall('hero grid',renderHeroGrid);
    safeCall('recommendations',renderRecommendations);
    safeCall('draft intelligence',renderIntel);
    safeCall('meta',renderMeta);
    safeCall('directory',renderDirectory);
    safeCall('sources',renderSources);
    safeCall('complete report',renderComplete);
    try{persist();}catch(err){console.error('[MLBB Coach] persist failed',err);}
  };

  function rtFallbackRecommendation(step){
    const pool=heroes.filter(h=>!usedNames().has(h.name));
    if(!pool.length)return null;
    let ranked=[];
    try{
      ranked=pool.map(hero=>{
        let score=50;
        try{
          const meta=Number(metaEvidence(hero)?.score);
          if(Number.isFinite(meta))score=meta;
          if(step.type==='ban'){
            const enemy=step.side==='Blue'?'Red':'Blue';
            if(lanes(hero).some(l=>openRoles(enemy).includes(l)))score+=8;
            if(lanes(hero).length>1)score+=5;
          }
        }catch{}
        return{hero,score};
      }).sort((a,b)=>b.score-a.score||a.hero.name.localeCompare(b.hero.name));
    }catch{}
    return ranked[0]||{hero:pool[0],score:50};
  }

  aiAction=function(){
    const step=currentStep();
    if(!step||!isAITurn(step))return;
    let top=null;
    try{top=topRecommendations(1)?.[0]||null;}
    catch(err){console.error('[MLBB Coach] deep recommendation failed; using fallback',err);}
    if(!top)top=rtFallbackRecommendation(step);
    if(!top?.hero)return;
    state.actions.push({...step,hero:top.hero.name,controlledBy:'ai'});
    renderAll();
    toast(`AI ${step.side} ${step.type}: ${top.hero.name}`);
    scheduleAI();
  };

  scheduleAI=function(){
    clearTimeout(aiTimer);
    const step=currentStep();
    if(step&&isAITurn(step))aiTimer=setTimeout(aiAction,450);
  };

  // Repaint and resume any pending AI turn after all extensions are loaded.
  renderAll();
  if(state.started&&isAITurn(currentStep()))scheduleAI();
})();