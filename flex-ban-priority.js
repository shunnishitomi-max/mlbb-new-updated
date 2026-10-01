// First-phase EXP <-> Roam flex priority layer.
// Based on the transcript-derived principle that a true EXP/Roam flex removes
// role information and keeps second-phase targeting ambiguous. Team-neutral;
// MPL evidence remains Week 6+ only through the underlying meta model.
(function(){
  function fbNormRole(x){return String(x||'').trim().toLowerCase();}
  function fbIsExp(role){const r=fbNormRole(role);return r==='exp'||r.includes('exp lane')||r.includes('explane');}
  function fbIsRoam(role){const r=fbNormRole(role);return r==='roam'||r.includes('roamer')||r.includes('roam');}
  function fbRoles(hero){return [...new Set(lanes(hero).map(fbNormRole))];}
  function fbExpRoam(hero){
    const roles=fbRoles(hero);
    return roles.some(fbIsExp)&&roles.some(fbIsRoam);
  }
  function fbAnyMultiRole(hero){return fbRoles(hero).length>=2;}
  function fbFirstBanPhase(){return (picks('Blue').length+picks('Red').length)<6;}
  function fbResidentEvidence(base){
    const meta=Number(base?.meta?.score||0);
    const power=Number(base?.banDepth?.power||0);
    // A genuine current-meta resident/near-auto ban stays above flex preference.
    return meta>=90&&power>=86;
  }
  function fbFlexConcealment(hero){
    if(fbExpRoam(hero))return 100;
    if(fbAnyMultiRole(hero))return 76;
    return 42;
  }
  function fbSecondPhasePressure(hero,base){
    const conceal=fbFlexConcealment(hero);
    const meta=Number(base?.meta?.score||50);
    const pool=Number(base?.banDepth?.poolClean||50);
    return clamp(Math.round(conceal*.55+meta*.25+pool*.20));
  }

  const fbBaseCoach=coachAnalysis;
  coachAnalysis=function(hero,step){
    const base=fbBaseCoach(hero,step);
    if(step.type!=='ban'||!fbFirstBanPhase())return base;

    const expRoam=fbExpRoam(hero);
    const multi=fbAnyMultiRole(hero);
    const resident=fbResidentEvidence(base);
    const concealment=fbFlexConcealment(hero);
    const secondPhasePressure=fbSecondPhasePressure(hero,base);
    let score=base.score;
    let type=base.type;
    const reasons=[];

    if(resident){
      // Current Week 6+ resident/near-auto bans are still the highest tier.
      score=clamp(Math.round(score+5));
      type='RESIDENT / NEAR-AUTO META BAN';
      reasons.push('current Week 6+ resident-ban pressure overrides ordinary flex priority');
    }else if(expRoam){
      // True EXP/Roam flexes receive a major first-phase bonus because banning
      // them collapses two role branches at once and improves phase-two targeting.
      const flexBonus=18;
      const concealBonus=Math.round(Math.max(0,concealment-70)*.18);
      const pressureBonus=Math.round(Math.max(0,secondPhasePressure-65)*.12);
      score=clamp(Math.round(score+flexBonus+concealBonus+pressureBonus));
      type='EXP ↔ ROAM FLEX PRIORITY BAN';
      reasons.push('removes a true EXP/Roam flex before roles are revealed');
      reasons.push('collapses two role branches and improves second-phase targeting');
      if(secondPhasePressure>=75)reasons.push('high role-concealment and future ban-pressure value');
    }else if(multi){
      // Other legitimate multi-role flexes are still preferred over comparable
      // single-role power picks, but below EXP/Roam flexes and true auto-bans.
      score=clamp(Math.round(score+8));
      if(!String(type).includes('FLEX'))type='MULTI-ROLE FLEX CONTROL BAN';
      reasons.push('removes multi-role ambiguity from the first-phase pool');
    }

    if(!resident&&!expRoam&&!multi&&Number(base?.banDepth?.power||0)>=80){
      // No artificial penalty if a single-role hero is an overwhelming power pick;
      // the flex preference applies when choices are otherwise comparable.
      reasons.push('single-role power pick remains viable when its current-meta pressure is exceptional');
    }

    const inherited=String(base.reason||'').split(' • ').filter(Boolean);
    const reason=[...reasons,...inherited].slice(0,3).join(' • ');
    return{
      ...base,
      score,
      type,
      reason,
      flexBanPriority:{
        expRoam,
        multiRole:multi,
        residentOverride:resident,
        concealment,
        secondPhasePressure,
        roles:fbRoles(hero)
      }
    };
  };

  const fbBaseIntel=renderIntel;
  renderIntel=function(){
    fbBaseIntel();
    const step=pseudoStep();
    if(step.type!=='ban'||!fbFirstBanPhase())return;
    const top=topRecommendations(1)[0];
    if(!top?.a?.flexBanPriority)return;
    const f=top.a.flexBanPriority;
    const root=document.querySelector('#draftIntel .intel');
    if(!root)return;
    root.insertAdjacentHTML('afterbegin',
      `<div class="intel-row"><b>FIRST-BAN FLEX PRIORITY</b><span>${f.expRoam?'TRUE EXP ↔ ROAM FLEX':f.multiRole?'MULTI-ROLE FLEX':'SINGLE-ROLE'} • Role concealment ${f.concealment}/100 • Second-phase pressure ${f.secondPhasePressure}/100. Current resident/near-auto bans remain above ordinary flex preference.</span></div>`
    );
  };

  const fbBaseDrawer=openHeroDrawer;
  openHeroDrawer=function(hero){
    fbBaseDrawer(hero);
    const step=pseudoStep();
    if(step.type!=='ban'||!fbFirstBanPhase())return;
    const a=coachAnalysis(hero,step),f=a.flexBanPriority;
    const grid=document.querySelector('#drawerBody .analysis-grid');
    if(!grid||!f)return;
    grid.insertAdjacentHTML('beforeend',
      `<div class="analysis-box"><b>FIRST-BAN FLEX PRIORITY</b><span>${f.expRoam?'EXP ↔ ROAM FLEX':f.multiRole?'MULTI-ROLE FLEX':'SINGLE-ROLE'}<br>Concealment ${f.concealment}/100 • Phase-two pressure ${f.secondPhasePressure}/100</span></div>`
    );
  };

  const fbBaseSources=renderSources;
  renderSources=function(){
    fbBaseSources();
    const root=document.getElementById('sourcesContent');
    if(!root)return;
    root.insertAdjacentHTML('beforeend',`<div class="source-item"><b>First-phase flex-ban rule</b><p>When first-phase choices are otherwise comparable, true EXP/Roam flex heroes receive priority over ordinary single-role power picks because they conceal roles and complicate second-phase targeting. Genuine current Week 6+ resident or near-auto bans remain the highest priority. This rule is team-neutral.</p></div>`);
  };

  renderAll();
})();