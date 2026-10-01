// Advanced team-neutral draft-depth layer.
// Prioritizes verified early-pick evidence when available, then current Week 6+
// recency, flex value, blind safety, role concealment, counters and draft timing.
// No team/player identity data is used.
(function(){
  function ddEnemy(side){return side==='Blue'?'Red':'Blue'}
  function ddPickNumber(step){return step?.type==='pick'?picks(step.side).length+1:null}
  function ddStage(step){
    if(!step)return'WAITING';
    if(step.type==='ban'){
      const totalPicks=picks('Blue').length+picks('Red').length;
      return totalPicks<6?'FIRST BAN PHASE':'SECOND BAN PHASE';
    }
    const n=ddPickNumber(step)||1;
    if(n===1)return'FIRST PICK';
    if(n<=3)return'FIRST PICK PHASE';
    return'SECOND PICK PHASE';
  }
  function ddVerifiedFirstPick(hero){
    const e=window.MLBB_SEQUENCE_DATA?.firstPick?.[hero.name];
    if(!e)return null;
    let rate=null;
    if(Number.isFinite(Number(e.rate))){rate=Number(e.rate);if(rate<=1)rate*=100;}
    else if(Number(e.sample)>0&&Number.isFinite(Number(e.count)))rate=Number(e.count)/Number(e.sample)*100;
    if(rate==null)return null;
    return{score:clamp(Math.round(rate)),count:Number(e.count||0),sample:Number(e.sample||0),confidence:e.confidence||'Medium'};
  }
  function ddFlexDepth(hero,side){
    const viable=[...new Set(lanes(hero).filter(l=>openRoles(side).includes(l)))];
    const total=[...new Set(lanes(hero))].length;
    let score=total>=3?96:total===2?82:48;
    if(viable.length>=3)score+=4;
    else if(viable.length===2)score+=8;
    else if(!viable.length)score-=18;
    return{score:clamp(score),viable,total,label:viable.length>=2?'HIGH ROLE CONCEALMENT':total>=2?'FLEX POTENTIAL':'ROLE REVEAL'};
  }
  function ddBlindSafety(hero,step){
    const T=tags(hero);let s=55;
    if(lanes(hero).length>1)s+=10;
    if(T.has('frontline'))s+=8;
    if(T.has('sustain'))s+=6;
    if(T.has('peel')||T.has('disengage'))s+=5;
    if(T.has('objective'))s+=3;
    if(T.has('squishy')&&lanes(hero).length===1)s-=8;
    const enemy=picks(ddEnemy(step.side));
    if(enemy.length){
      const vals=enemy.map(e=>matchupValue(hero,e));
      const worst=Math.min(...vals),avg=vals.reduce((a,b)=>a+b,0)/vals.length;
      s+=avg*4+Math.min(0,worst)*5;
    }
    return clamp(Math.round(s));
  }
  function ddThreatToUs(hero,step){
    const allies=picks(step.side);if(!allies.length)return 48;
    const vals=allies.map(a=>matchupValue(hero,a));
    const strongest=Math.max(...vals),avg=vals.reduce((a,b)=>a+b,0)/vals.length;
    return clamp(Math.round(48+strongest*9+avg*4));
  }
  function ddEarlyPriority(hero,step,base){
    const fp=ddVerifiedFirstPick(hero),flex=ddFlexDepth(hero,step.side),blind=ddBlindSafety(hero,step);
    if(fp){
      return{score:clamp(Math.round(fp.score*.30+base.meta.score*.28+flex.score*.18+blind*.14+base.control*.10)),fp,flex,blind};
    }
    return{score:clamp(Math.round(base.meta.score*.42+flex.score*.22+blind*.18+base.control*.10+base.scarcity*.08)),fp:null,flex,blind};
  }
  function ddBanPressure(hero,step,base,early){
    if(step.type!=='pick')return 45;
    const n=ddPickNumber(step)||1;
    let s=42+(early.flex.score-50)*.32+(base.meta.score-50)*.24+(base.scarcity-50)*.12;
    if(n<=3)s+=12;
    if(early.flex.viable.length>=2)s+=8;
    return clamp(Math.round(s));
  }
  function ddPickUrgency(base){
    return clamp(Math.round((100-base.returnProb)*.54+base.scarcity*.24+base.meta.score*.22));
  }

  const ddBaseCoach=coachAnalysis;
  coachAnalysis=function(hero,step){
    const base=ddBaseCoach(hero,step);
    const pickNo=ddPickNumber(step),stage=ddStage(step);
    const early=ddEarlyPriority(hero,step,base);
    const banPressure=ddBanPressure(hero,step,base,early);
    const urgency=ddPickUrgency(base);
    const threatToUs=ddThreatToUs(hero,step);
    let score=base.score,type=base.type;

    if(step.type==='ban'){
      if(stage==='FIRST BAN PHASE'){
        score=clamp(Math.round(base.meta.score*.38+base.control*.18+early.flex.score*.12+base.scarcity*.12+base.denial*.12+base.counter*.08));
        if(base.meta.score>=88)type='Current-Meta Priority Ban';
        else if(early.flex.score>=82)type='Flex Threat Ban';
        else if(base.control>=76)type='Draft Control Ban';
      }else{
        score=clamp(Math.round(threatToUs*.26+base.denial*.20+base.meta.score*.18+base.scarcity*.12+base.control*.12+early.flex.score*.07+base.counter*.05));
        if(threatToUs>=74)type='Protection Ban';
        else if(base.denial>=74)type='Denial Ban';
        else if(base.scarcity>=80)type='Role Target Ban';
      }
    }else if(pickNo===1){
      score=clamp(Math.round(early.score*.34+base.meta.score*.22+early.flex.score*.13+early.blind*.10+base.role*.08+base.comp*.05+base.scarcity*.05+base.control*.03));
      if(early.fp&&early.fp.score>=65)type='Observed First-Pick Priority';
      else if(early.flex.score>=82)type='Flex First Pick';
      else if(early.blind>=72)type='Blind-Safe First Pick';
      else type='First-Pick Priority';
    }else if(pickNo<=3){
      score=clamp(Math.round(base.meta.score*.22+early.score*.20+base.counter*.15+base.role*.12+early.flex.score*.10+base.comp*.08+base.scarcity*.05+base.control*.05+base.syn*.03));
      if(base.counter>=75)type='Early Counter Pick';
      else if(early.flex.score>=82)type='Flex Priority Pick';
      else if(base.scarcity>=82)type='Role-Securing Pick';
      else if(banPressure>=78)type='Ban-Pressure Pick';
    }else{
      score=clamp(Math.round(base.counter*.23+base.role*.17+base.comp*.14+base.timing*.12+base.meta.score*.12+base.protection*.08+base.scarcity*.05+base.syn*.05+base.denial*.04));
      if(base.counter>=74)type='Counter Pick';
      else if(base.protection>=74)type='Problem Solver Pick';
      else if(base.role>=80)type='Role Completion Pick';
      else if(base.comp>=74)type='Composition Completion Pick';
    }

    const reason=[];
    if(step.type==='pick'&&pickNo===1){
      if(early.fp)reason.push(`verified first-pick signal ${early.fp.score}/100`);
      else reason.push('early-pick priority from Week 6+ meta, flex and blind safety');
      if(early.flex.score>=75)reason.push(`${early.flex.label.toLowerCase()}`);
      if(early.blind>=70)reason.push('safe to reveal early');
    }else if(step.type==='pick'&&pickNo<=3){
      if(early.flex.score>=75)reason.push('preserves role ambiguity');
      if(base.counter>=65)reason.push('answers current enemy draft');
      if(banPressure>=70)reason.push('creates second-phase ban pressure');
    }else if(step.type==='pick'){
      if(base.counter>=65)reason.push('late counter value');
      if(base.role>=72)reason.push('completes an open role');
      if(base.comp>=68)reason.push('improves final composition');
    }else{
      if(stage==='FIRST BAN PHASE'&&base.meta.score>=75)reason.push('current Week 6+ meta pressure');
      if(stage==='FIRST BAN PHASE'&&early.flex.score>=75)reason.push('removes flexible early-pick option');
      if(stage==='SECOND BAN PHASE'&&threatToUs>=65)reason.push('protects current picks from a strong answer');
      if(base.denial>=68)reason.push('denial value');
    }
    if(!reason.length)reason.push(base.reason||'best current draft value');

    return{...base,score,type,reason:reason.slice(0,3).join(' • '),pickNo,stage,firstPickEvidence:early.fp,earlyPriority:early.score,flexDepth:early.flex,blindSafety:early.blind,banPressure,urgency,threatToUs};
  };

  const ddBaseRenderHeader=renderHeader;
  renderHeader=function(){
    ddBaseRenderHeader();
    const pill=document.getElementById('metaPill');
    if(pill)pill.textContent='META: WEEK 6+ ONLY • RECENCY';
  };

  const ddBaseRenderIntel=renderIntel;
  renderIntel=function(){
    ddBaseRenderIntel();
    const root=document.getElementById('draftIntel');if(!root)return;
    const top=topRecommendations(1)[0],step=pseudoStep();if(!top)return;
    const a=top.a,box=root.querySelector('.intel');if(!box)return;
    const position=step.type==='pick'?`${step.side} Pick ${a.pickNo} • ${a.stage}`:`${step.side} Ban • ${a.stage}`;
    const fp=a.firstPickEvidence?`${a.firstPickEvidence.score}/100 verified signal (${a.firstPickEvidence.count}/${a.firstPickEvidence.sample||'?'})`:'INSUFFICIENT VERIFIED FIRST-PICK FREQUENCY — using Week 6+ recency + flex + blind-safety inference';
    const flexRoles=a.flexDepth.viable.length?a.flexDepth.viable.join(' / '):(lanes(top.hero).join(' / ')||'single role');
    box.insertAdjacentHTML('afterbegin',`<div class="intel-row"><b>DRAFT POSITION</b><span>${esc(position)}</span></div><div class="intel-row"><b>EARLY-PICK PRIORITY</b><span>${a.earlyPriority}/100 • ${esc(fp)}</span></div><div class="intel-row"><b>FLEX / ROLE CONCEALMENT</b><span>${a.flexDepth.score}/100 • ${esc(a.flexDepth.label)} • viable now: ${esc(flexRoles)}</span></div><div class="intel-row"><b>BLIND SAFETY</b><span>${a.blindSafety}/100 • early picks favor heroes that are difficult to punish before roles are fully revealed.</span></div><div class="intel-row"><b>BAN PRESSURE / PICK URGENCY</b><span>${a.banPressure}/100 ban pressure • ${a.urgency}/100 urgency • return probability ${a.returnProb}/100.</span></div>`);
  };

  const ddBaseOpenDrawer=openHeroDrawer;
  openHeroDrawer=function(hero){
    ddBaseOpenDrawer(hero);
    const grid=document.querySelector('#drawerBody .analysis-grid');if(!grid)return;
    const a=coachAnalysis(hero,pseudoStep());
    const fp=a.firstPickEvidence?`${a.firstPickEvidence.score}/100 • ${a.firstPickEvidence.count}/${a.firstPickEvidence.sample||'?'} observed first-pick sample`:'INSUFFICIENT VERIFIED FIRST-PICK DATA — no frequency is invented.';
    const flexNow=a.flexDepth.viable.length?a.flexDepth.viable.join(' / '):(lanes(hero).join(' / ')||'single role');
    grid.insertAdjacentHTML('beforeend',`<div class="analysis-box"><b>DRAFT POSITION MODEL</b><span>${esc(a.stage)}${a.pickNo?` • Pick ${a.pickNo}`:''}</span></div><div class="analysis-box"><b>EARLY-PICK PRIORITY</b><span>${a.earlyPriority}/100<br>${esc(fp)}</span></div><div class="analysis-box"><b>FLEX / ROLE CONCEALMENT</b><span>${a.flexDepth.score}/100 • ${esc(a.flexDepth.label)}<br>Viable current roles: ${esc(flexNow)}</span></div><div class="analysis-box"><b>BLIND SAFETY</b><span>${a.blindSafety}/100</span></div><div class="analysis-box"><b>BAN PRESSURE</b><span>${a.banPressure}/100 • measures how much an early flexible pick can complicate second-phase bans.</span></div><div class="analysis-box"><b>PICK URGENCY</b><span>${a.urgency}/100 • Return probability ${a.returnProb}/100</span></div><div class="analysis-box"><b>THREAT TO CURRENT DRAFT</b><span>${a.threatToUs}/100 • used heavily for second-phase protection bans.</span></div>`);
  };

  const ddBaseRenderSources=renderSources;
  renderSources=function(){
    ddBaseRenderSources();
    const root=document.getElementById('sourcesContent');if(!root)return;
    root.insertAdjacentHTML('beforeend',`<div class="source-item"><b>Pick-order and flex methodology</b><p>Pick 1 prioritizes verified first-pick evidence when available, then Week 6+ recency, flex depth, role concealment and blind safety. Picks 2–3 balance early priority with counters and composition. Picks 4–5 shift toward counter value, role completion and final composition. If exact first-pick frequency is unavailable, the system labels it insufficient rather than inventing a statistic.</p></div>`);
  };

  renderAll();
})();