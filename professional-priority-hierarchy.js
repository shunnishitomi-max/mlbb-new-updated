// Professional priority hierarchy.
// Ban turns: 1) verified recent ban rate / ban pressure, 2) flexibility,
// 3) current team-composition and matchup context.
// Pick turns: 1) recent professional draft priority, 2) flexibility,
// 3) current composition and enemy matchup.
(function(){
  const ppBaseCoach=coachAnalysis;
  const ppBaseTop=topRecommendations;
  const ppBaseIntel=renderIntel;
  const ppBaseSources=renderSources;

  function ppModel(){return window.MLBB_PRO_MODEL||null;}
  function ppClamp(v){return Math.max(0,Math.min(100,Math.round(v)));}

  function ppPrimaryBan(hero,base){
    const model=ppModel();
    const m=model?.metaProfile?.(hero);
    const c=base.competitive||{};
    const verified=!!(m&&Number(m.sample)>=3&&Number.isFinite(Number(m.banRate)));
    if(verified){
      return{
        score:ppClamp(Number(m.banRate)),
        verified:true,
        label:`Verified recent ban rate ${Math.round(Number(m.banRate))}%`,
        confidence:m.confidence||'LOW CONFIDENCE'
      };
    }
    // Do not invent a ban percentage. Use current professional priority only as a fallback.
    const fallback=Number(c.meta?.score??c.meta??base.meta?.score??50);
    const presence=Number(c.recentPresence??50);
    return{
      score:ppClamp(fallback*.72+presence*.28),
      verified:false,
      label:'INSUFFICIENT VERIFIED BAN-RATE DATA — recent professional priority fallback',
      confidence:'INSUFFICIENT DATA'
    };
  }

  function ppPrimaryPick(hero,base){
    const model=ppModel();
    const m=model?.metaProfile?.(hero);
    const c=base.competitive||{};
    if(m&&Number(m.sample)>=3){
      // Pick/draft presence is primary during pick turns, not ban rate alone.
      const score=ppClamp(Number(m.presence||0)*.58+Number(m.pickRate||0)*.27+Number(m.score||50)*.15);
      return{score,verified:true,label:`Recent professional draft presence ${Math.round(Number(m.presence||0))}%`,confidence:m.confidence||'LOW CONFIDENCE'};
    }
    return{score:ppClamp(Number(c.recentPresence??c.meta?.score??c.meta??50)),verified:false,label:'INSUFFICIENT VERIFIED PICK-PRESENCE DATA — current professional priority fallback',confidence:'INSUFFICIENT DATA'};
  }

  function ppFlex(base){
    const c=base.competitive||{};
    // Flex is intentionally secondary. It can break close calls but should not erase a clear primary-data gap.
    return ppClamp(Number(c.flex??base.flex??50));
  }

  function ppBanContext(base){
    const c=base.competitive||{};
    const b=base.banDepth||{};
    const threat=Number(b.threat??b.problemOverload??c.counter??base.counter??50);
    const completion=Number(c.denial??b.synergy??50);
    const roleTarget=Number(b.roleChoke??c.roleNeed??50);
    return ppClamp(threat*.46+completion*.34+roleTarget*.20);
  }

  function ppPickContext(base){
    const c=base.competitive||{};
    const matchup=Number(c.counter??base.counter??50);
    const comp=Number(c.composition??base.comp??50);
    const synergy=Number(c.synergy??base.syn??50);
    return ppClamp(matchup*.45+comp*.35+synergy*.20);
  }

  function ppScore(primary,flex,context,step){
    // Primary professional evidence carries the most weight.
    // Flex is secondary, not an automatic first priority.
    // Composition/matchup is third, but becomes more important in second phase.
    const second=(picks('Blue').length+picks('Red').length)>=6;
    if(step.type==='ban'&&second)return ppClamp(primary*.47+flex*.18+context*.35);
    if(step.type==='ban')return ppClamp(primary*.55+flex*.22+context*.23);
    if(second)return ppClamp(primary*.50+flex*.18+context*.32);
    return ppClamp(primary*.56+flex*.21+context*.23);
  }

  function ppBand(primary){
    // A clear primary-data lead should not be overturned just because another hero is flexible.
    return Math.floor(primary/12);
  }

  coachAnalysis=function(hero,step){
    const base=ppBaseCoach(hero,step);
    const primary=step.type==='ban'?ppPrimaryBan(hero,base):ppPrimaryPick(hero,base);
    const flex=ppFlex(base);
    const context=step.type==='ban'?ppBanContext(base):ppPickContext(base);
    const score=ppScore(primary.score,flex,context,step);

    let type=base.type;
    if(step.type==='ban'){
      if(primary.verified&&primary.score>=70)type='HIGH BAN-RATE PRIORITY';
      else if(context>=76)type='DRAFT-SPECIFIC BAN';
      else if(flex>=78&&primary.score>=48)type='FLEX CONTROL BAN';
      else type='PROFESSIONAL PRIORITY BAN';
    }else{
      if(primary.verified&&primary.score>=72)type='HIGH PRO-DRAFT PRIORITY PICK';
      else if(context>=76)type='DRAFT-SPECIFIC PICK';
      else if(flex>=78&&primary.score>=48)type='FLEXIBLE PRIORITY PICK';
      else type='PROFESSIONAL PRIORITY PICK';
    }

    const reasonParts=[];
    reasonParts.push(primary.label);
    if(flex>=70)reasonParts.push(`secondary flex value ${flex}/100`);
    if(context>=65)reasonParts.push(`${step.type==='ban'?'current draft threat/targeting':'composition + enemy matchup'} ${context}/100`);
    if(reasonParts.length<3&&base.reason)reasonParts.push(base.reason);

    return{
      ...base,
      score,
      type,
      reason:reasonParts.slice(0,3).join(' • '),
      priorityHierarchy:{
        primary:primary.score,
        primaryVerified:primary.verified,
        primaryLabel:primary.label,
        confidence:primary.confidence,
        flex,
        context,
        band:ppBand(primary.score),
        phase:(picks('Blue').length+picks('Red').length)>=6?'SECOND PHASE':'FIRST PHASE'
      }
    };
  };

  topRecommendations=function(limit=5){
    const step=pseudoStep();
    const rows=heroes.filter(h=>!usedNames().has(h.name)).map(hero=>({hero,a:coachAnalysis(hero,step)}));
    rows.sort((x,y)=>{
      const xb=x.a.priorityHierarchy?.band??0,yb=y.a.priorityHierarchy?.band??0;
      if(yb!==xb)return yb-xb;
      return y.a.score-x.a.score||x.hero.name.localeCompare(y.hero.name);
    });
    return rows.slice(0,limit);
  };

  renderIntel=function(){
    ppBaseIntel();
    const root=document.querySelector('#draftIntel .intel');if(!root)return;
    const top=topRecommendations(1)[0];const p=top?.a?.priorityHierarchy;if(!p)return;
    root.insertAdjacentHTML('afterbegin',`<div class="intel-row"><b>PRO COACH PRIORITY ORDER</b><span>1) ${currentStep()?.type==='ban'?'Recent verified ban rate':'Recent professional draft presence'} • 2) Hero flexibility • 3) Current team composition and enemy matchup. Flex is a secondary tie-breaker, not an automatic top priority.</span></div><div class="intel-row"><b>TOP OPTION BREAKDOWN</b><span>${esc(top.hero.name)} • Primary ${p.primary}/100 • Flex ${p.flex}/100 • Draft context ${p.context}/100 • ${esc(p.confidence)}</span></div>`);
  };

  renderSources=function(){
    ppBaseSources();
    const root=document.getElementById('sourcesContent');if(!root)return;
    root.insertAdjacentHTML('beforeend',`<div class="source-item"><b>Professional priority hierarchy</b><p>The coach does not automatically prefer flexible heroes. During ban phases, verified recent ban rate and ban pressure are evaluated first, flexibility second, and current team-composition/enemy-matchup context third. During pick phases, recent professional draft presence replaces ban rate as the primary signal. Clear primary-data differences are protected from being overturned solely by flex value. Missing verified rates are labeled insufficient data rather than fabricated.</p></div>`);
  };

  renderAll();
})();
