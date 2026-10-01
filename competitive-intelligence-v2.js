// Dynamic professional draft-intelligence engine.
// Current professional usage is primary. Static hero lanes are only a weak fallback
// when verified current-role evidence is unavailable.
(function(){
  const CI_ROLES=['EXP','JUNGLE','MID','GOLD','ROAM'];
  const ciBaseLanes=lanes;
  const ciBaseCoach=coachAnalysis;
  const ciBaseOpenDrawer=openHeroDrawer;
  const ciBaseRenderSources=renderSources;
  const ciBaseRenderMeta=renderMeta;
  const ciBaseRenderDirectory=renderDirectory;
  const ciBaseRenderIntel=renderIntel;
  const ciBaseRenderHeader=renderHeader;

  window.MLBB_DRAFT_WEIGHTS=window.MLBB_DRAFT_WEIGHTS||{
    pick:{meta:.14,recentPresence:.09,draftPosition:.06,side:.04,roleNeed:.12,flex:.09,synergy:.09,counter:.10,denial:.06,scarcity:.05,composition:.08,secondPhase:.04,pool:.04,patch:.03,recentForm:.03,evidence:.04,risk:.11},
    ban:{meta:.14,recentPresence:.08,draftPosition:.04,side:.03,roleNeed:.07,flex:.11,synergy:.05,counter:.10,denial:.12,scarcity:.08,composition:.07,secondPhase:.06,pool:.08,patch:.02,recentForm:.02,evidence:.04,risk:.08},
    competition:{'MPL PH':1,'MPL ID':1,'Asian Games 2026':1.05},
    recencyHalfLifeDays:24,
    samplePrior:8,
    sequenceMinimum:3
  };

  const ciCache={key:'',profiles:new Map(),lineups:new Map(),analysis:new Map(),top:new Map(),stats:null,pool:null};
  function ciStateKey(){
    return [state.scope,state.mode,state.tournamentBanFormat||'',state.rankedBans.join(','),state.actions.map(a=>`${a.side[0]}${a.type[0]}${a.slot}:${a.hero}`).join('|')].join('~');
  }
  function ciResetIfNeeded(){
    const k=ciStateKey();
    if(k===ciCache.key)return;
    ciCache.key=k;ciCache.profiles.clear();ciCache.lineups.clear();ciCache.analysis.clear();ciCache.top.clear();ciCache.pool=null;
  }
  function ciNormRole(v){
    const r=String(v||'').trim().toUpperCase();
    if(r==='EXP'||r.includes('EXP'))return'EXP';
    if(r==='JUNGLE'||r.includes('JUNG'))return'JUNGLE';
    if(r==='MID'||r.includes('MID'))return'MID';
    if(r==='GOLD'||r.includes('GOLD'))return'GOLD';
    if(r==='ROAM'||r.includes('ROAM'))return'ROAM';
    return null;
  }
  function ciScopeCompetition(comp){
    if(state.scope==='Combined')return true;
    if(state.scope==='Asian Games 2026')return comp==='Asian Games 2026'||comp==='Asian Games';
    return comp===state.scope;
  }
  function ciWeek(m){
    if(Number.isFinite(Number(m.week)))return Number(m.week);
    const x=String(m.weekOrStage||'').match(/week\s*(\d+)/i);return x?Number(x[1]):null;
  }
  function ciDateValue(m){const t=Date.parse(m.matchDate||m.date||'');return Number.isFinite(t)?t:null;}
  function ciWinnerSide(m){
    const w=String(m.winnerSide||m.result?.winnerSide||'').toLowerCase();
    if(w==='blue')return'Blue';if(w==='red')return'Red';return null;
  }
  function ciAllRawMatches(){
    const out=[],seen=new Set();
    const store=window.MLBB_COMPETITIVE_MATCH_DATA;
    if(store?.competitions){for(const arr of Object.values(store.competitions))for(const m of arr||[])out.push(m);}
    for(const m of window.MLBB_SEQUENCE_DATA?.matches||[])out.push(m);
    return out.filter((m,i)=>{const id=m.id||`${m.competition}|${m.matchDate||m.date||''}|${m.gameNumber||''}|${i}`;if(seen.has(id))return false;seen.add(id);return true;});
  }
  function ciEligibleMatches(){
    return ciAllRawMatches().filter(m=>{
      const c=m.competition||m.league||'';if(!ciScopeCompetition(c))return false;
      if(c==='MPL PH'||c==='MPL ID'){const w=ciWeek(m);return w!=null&&w>=6;}
      if(c==='Asian Games'||c==='Asian Games 2026')return true;
      return false;
    });
  }
  function ciLatestTimestamp(matches){let latest=0;for(const m of matches){const t=ciDateValue(m);if(t&&t>latest)latest=t;}return latest||Date.now();}
  function ciRecencyWeight(m,latest){
    const t=ciDateValue(m);if(!t)return .55;
    const days=Math.max(0,(latest-t)/86400000);const half=window.MLBB_DRAFT_WEIGHTS.recencyHalfLifeDays||24;
    return Math.pow(.5,days/half);
  }
  function ciCompetitionWeight(m){return window.MLBB_DRAFT_WEIGHTS.competition[m.competition]||1;}
  function ciPatchWeight(m,latestPatch){if(!m.patch||!latestPatch)return .85;return m.patch===latestPatch?1:.68;}
  function ciConfidenceLabel(n){return n>=12?'HIGH CONFIDENCE':n>=6?'MEDIUM CONFIDENCE':n>=3?'LOW CONFIDENCE':'INSUFFICIENT DATA';}
  function ciConfidenceScore(n){const k=window.MLBB_DRAFT_WEIGHTS.samplePrior||8;return clamp(Math.round(100*n/(n+k)));}
  function ciActionList(m){return Array.isArray(m.actions)?m.actions:[];}
  function ciActionRole(a){return ciNormRole(a.actualRole||a.rolePlayed||a.role);}
  function ciPositionLabel(a,counters){
    if(a.type==='pick'){counters.pick[a.side]=(counters.pick[a.side]||0)+1;return `${a.side==='Blue'?'B':'R'}${counters.pick[a.side]}`;}
    counters.ban[a.side]=(counters.ban[a.side]||0)+1;return `${a.side==='Blue'?'B':'R'}-BAN${counters.ban[a.side]}`;
  }

  function ciBuildStats(){
    const matches=ciEligibleMatches(),latest=ciLatestTimestamp(matches);
    let latestPatch=null,latestPatchT=0;
    for(const m of matches){const t=ciDateValue(m)||0;if(m.patch&&t>=latestPatchT){latestPatch=m.patch;latestPatchT=t;}}
    const hero={},pairs={},matchups={};let weightedGames=0;
    function H(name){return hero[name]||(hero[name]={name,picks:0,bans:0,wPick:0,wBan:0,wWins:0,wResultGames:0,bluePicks:0,redPicks:0,blueWins:0,redWins:0,roles:Object.fromEntries(CI_ROLES.map(r=>[r,0])),roleRaw:Object.fromEntries(CI_ROLES.map(r=>[r,0])),recentRoles:Object.fromEntries(CI_ROLES.map(r=>[r,0])),olderRoles:Object.fromEntries(CI_ROLES.map(r=>[r,0])),positions:{},banPositions:{},patchUse:{},latestUse:0,totalWeight:0});}
    for(const m of matches){
      const rw=ciRecencyWeight(m,latest),cw=ciCompetitionWeight(m),pw=ciPatchWeight(m,latestPatch),mw=rw*cw*pw;weightedGames+=mw;
      const win=ciWinnerSide(m),ctr={pick:{Blue:0,Red:0},ban:{Blue:0,Red:0}},blue=[],red=[];
      for(const a0 of ciActionList(m)){
        const a={...a0,type:String(a0.type||'').toLowerCase(),side:a0.side};if(!a.hero||!['pick','ban'].includes(a.type)||!['Blue','Red'].includes(a.side))continue;
        const h=H(a.hero),pos=ciPositionLabel(a,ctr);h.totalWeight+=mw;
        if(a.type==='ban'){
          h.bans++;h.wBan+=mw;h.banPositions[pos]=(h.banPositions[pos]||0)+mw;continue;
        }
        h.picks++;h.wPick+=mw;h.positions[pos]=(h.positions[pos]||0)+mw;
        if(a.side==='Blue')h.bluePicks++;else h.redPicks++;
        if(win){h.wResultGames+=mw;if(win===a.side){h.wWins+=mw;if(a.side==='Blue')h.blueWins++;else h.redWins++;}}
        const rr=ciActionRole(a);if(rr){h.roles[rr]+=mw;h.roleRaw[rr]++;const t=ciDateValue(m),days=t?Math.max(0,(latest-t)/86400000):999;if(days<=14)h.recentRoles[rr]+=mw;else h.olderRoles[rr]+=mw;}
        if(m.patch)h.patchUse[m.patch]=(h.patchUse[m.patch]||0)+mw;
        h.latestUse=Math.max(h.latestUse,ciDateValue(m)||0);
        (a.side==='Blue'?blue:red).push(a.hero);
      }
      for(const sideHeroes of [blue,red])for(let i=0;i<sideHeroes.length;i++)for(let j=i+1;j<sideHeroes.length;j++){
        const k=[sideHeroes[i],sideHeroes[j]].sort().join('|'),p=pairs[k]||(pairs[k]={games:0,wGames:0,wins:0});p.games++;p.wGames+=mw;
        if(win){const side=blue.includes(sideHeroes[i])?'Blue':'Red';if(win===side)p.wins+=mw;}
      }
      for(const b of blue)for(const r of red){
        const kb=`${b}>${r}`,kr=`${r}>${b}`;const pb=matchups[kb]||(matchups[kb]={games:0,wGames:0,wins:0});const pr=matchups[kr]||(matchups[kr]={games:0,wGames:0,wins:0});pb.games++;pr.games++;pb.wGames+=mw;pr.wGames+=mw;if(win==='Blue')pb.wins+=mw;if(win==='Red')pr.wins+=mw;
      }
    }
    return{matches,latest,latestPatch,hero,pairs,matchups,weightedGames,totalGames:matches.length};
  }
  function ciStats(){ciResetIfNeeded();if(!ciCache.stats||ciCache.stats.key!==`${state.scope}|${window.MLBB_COMPETITIVE_MATCH_DATA?.updated||''}|${window.MLBB_SEQUENCE_DATA?.updated||''}`){ciCache.stats={key:`${state.scope}|${window.MLBB_COMPETITIVE_MATCH_DATA?.updated||''}|${window.MLBB_SEQUENCE_DATA?.updated||''}`,data:ciBuildStats()};}return ciCache.stats.data;}

  function ciObservedRoleProfile(hero){
    ciResetIfNeeded();if(ciCache.profiles.has(hero.name))return ciCache.profiles.get(hero.name);
    const s=ciStats().hero[hero.name],raw=s?Object.values(s.roleRaw).reduce((a,b)=>a+b,0):0;
    let probs={},source='OFFICIAL MATCH DATA',confidence=ciConfidenceLabel(raw),trend={};
    if(raw>0){
      const total=Object.values(s.roles).reduce((a,b)=>a+b,0)||1;
      for(const r of CI_ROLES)probs[r]=s.roles[r]/total;
      for(const r of CI_ROLES){const recent=s.recentRoles[r],old=s.olderRoles[r];trend[r]=recent>old*1.2?'↑':old>recent*1.2?'↓':'→';}
    }else{
      const fallback=ciBaseLanes(hero).map(ciNormRole).filter(Boolean);for(const r of CI_ROLES)probs[r]=fallback.includes(r)?1/Math.max(1,fallback.length):0;
      confidence='INSUFFICIENT DATA';source='HISTORICAL FALLBACK';for(const r of CI_ROLES)trend[r]='?';
    }
    const sorted=CI_ROLES.map(r=>({role:r,p:probs[r]||0,trend:trend[r]})).sort((a,b)=>b.p-a.p);
    const out={probs,sorted,sample:raw,confidence,source,trend,primary:sorted[0]?.role||'UNAVAILABLE',primaryP:sorted[0]?.p||0};ciCache.profiles.set(hero.name,out);return out;
  }

  lanes=function(hero){
    const p=ciObservedRoleProfile(hero);
    if(p.sample>=3){const observed=p.sorted.filter(x=>x.p>=.10).map(x=>x.role);if(observed.length)return observed;}
    return ciBaseLanes(hero);
  };

  function ciEnumerateLineups(team){
    if(!team.length)return[{weight:1,assign:{}}];
    const rows=[];
    function rec(i,used,assign,w){
      if(i===team.length){rows.push({weight:w,assign:{...assign}});return;}
      const h=team[i],p=ciObservedRoleProfile(h);
      for(const r of CI_ROLES){if(used.has(r))continue;let pr=p.probs[r]||0;if(pr<=0&&p.sample<3&&ciBaseLanes(h).map(ciNormRole).includes(r))pr=.04;if(pr<=0)pr=.002;used.add(r);assign[h.name]=r;rec(i+1,used,assign,w*pr);used.delete(r);delete assign[h.name];}
    }
    rec(0,new Set(),{},1);const sum=rows.reduce((a,b)=>a+b.weight,0)||1;for(const x of rows)x.weight/=sum;return rows.sort((a,b)=>b.weight-a.weight);
  }
  function ciLineup(side,extraHero=null){
    ciResetIfNeeded();const key=`${side}|${extraHero?.name||''}`;if(ciCache.lineups.has(key))return ciCache.lineups.get(key);
    const team=[...picks(side),...(extraHero&& !picks(side).some(h=>h.name===extraHero.name)?[extraHero]:[])].slice(0,5),configs=ciEnumerateLineups(team);
    const marginals={},occupancy=Object.fromEntries(CI_ROLES.map(r=>[r,0]));for(const h of team)marginals[h.name]=Object.fromEntries(CI_ROLES.map(r=>[r,0]));
    for(const c of configs){for(const [name,r] of Object.entries(c.assign)){marginals[name][r]+=c.weight;occupancy[r]+=c.weight;}}
    const status={};for(const r of CI_ROLES){const x=occupancy[r];status[r]=x>=.90?'LOCKED':x>=.68?'LIKELY FILLED':x>=.35?'UNCERTAIN':x>=.12?'LIKELY OPEN':'OPEN';}
    const out={team,configs:configs.slice(0,20),best:configs[0]?.assign||{},marginals,occupancy,status};ciCache.lineups.set(key,out);return out;
  }

  function ciMetaProfile(hero){
    const st=ciStats(),h=st.hero[hero.name];
    if(!h||(!h.picks&&!h.bans)){
      const fallback=metaEvidence(hero);return{score:fallback.score||50,presence:50,pickRate:0,banRate:0,winAdjusted:50,sample:0,confidence:'INSUFFICIENT DATA',confidenceScore:20,source:'ANALYTICAL INFERENCE'};
    }
    const denom=Math.max(.001,st.weightedGames),pickRate=h.wPick/denom,banRate=h.wBan/denom,presence=Math.min(1,(h.wPick+h.wBan)/denom);
    const prior=5,winAdjusted=h.wResultGames>0?((h.wWins+prior*.5)/(h.wResultGames+prior))*100:50;
    const n=h.picks+h.bans,conf=ciConfidenceScore(n),score=clamp(Math.round((25+presence*75)*.48+(pickRate*100)*.14+(banRate*100)*.18+winAdjusted*.10+conf*.10));
    return{score,presence:Math.round(presence*100),pickRate:Math.round(pickRate*100),banRate:Math.round(banRate*100),winAdjusted:Math.round(winAdjusted),sample:n,confidence:ciConfidenceLabel(n),confidenceScore:conf,source:'CALCULATED DATA'};
  }
  function ciDraftPosition(hero,step){
    const h=ciStats().hero[hero.name];if(!h)return 48;
    const label=step.type==='pick'?`${step.side==='Blue'?'B':'R'}${step.slot}`:`${step.side==='Blue'?'B':'R'}-BAN${step.slot}`;
    const map=step.type==='pick'?h.positions:h.banPositions,total=Object.values(map).reduce((a,b)=>a+b,0)||0;if(!total)return 48;
    return clamp(Math.round(42+(map[label]||0)/total*58));
  }
  function ciSideValue(hero,step){
    const h=ciStats().hero[hero.name];if(!h||step.type!=='pick')return 50;
    const picksN=step.side==='Blue'?h.bluePicks:h.redPicks;if(!picksN)return 45;
    const wins=step.side==='Blue'?h.blueWins:h.redWins;const adj=(wins+2.5)/(picksN+5);return clamp(Math.round(40+adj*45+Math.min(15,picksN*2)));
  }
  function ciRoleNeed(hero,side){
    const lineup=ciLineup(side),p=ciObservedRoleProfile(hero);let score=0;
    for(const r of CI_ROLES)score+=(p.probs[r]||0)*(1-lineup.occupancy[r])*100;
    return clamp(Math.round(score));
  }
  function ciFlexValue(hero){
    const p=ciObservedRoleProfile(hero),active=p.sorted.filter(x=>x.p>=.12);if(active.length<=1)return p.sample>=3?44:50;
    let entropy=0;for(const x of active)entropy-=x.p*Math.log2(Math.max(.001,x.p));return clamp(Math.round(58+active.length*9+entropy*10));
  }
  function ciPairEvidence(a,b){
    const key=[a.name,b.name].sort().join('|'),p=ciStats().pairs[key];if(!p)return null;const conf=ciConfidenceScore(p.games),wr=p.wGames?((p.wins+3*.5)/(p.wGames+3))*100:50;return{games:p.games,score:clamp(Math.round(45+wr*.35+conf*.20)),confidence:ciConfidenceLabel(p.games)};
  }
  function ciSynergy(hero,side){
    const allies=picks(side);if(!allies.length)return{score:50,with:[],classification:'UNPROVEN'};
    let total=0,w=0;const withs=[];
    for(const a of allies){const pro=ciPairEvidence(hero,a),heur=clamp(50+synergyPair(hero,a)*10),sampleW=pro?Math.min(.8,pro.games/10):0;const s=pro?heur*(1-sampleW)+pro.score*sampleW:heur*.7+50*.3;total+=s;w++;if(s>=62)withs.push(a.name);}
    const A=tags(hero),AT=allies.map(tags),cls=A.has('engage')&&AT.some(t=>t.has('burst'))?'Engage + Follow-up':A.has('peel')&&AT.some(t=>t.has('backline'))?'Peel':A.has('frontline')&&AT.some(t=>t.has('backline'))?'Frontline + Backline':A.has('poke')?'Poke':'Professional Pairing';
    return{score:clamp(Math.round(total/Math.max(1,w))),with:withs.slice(0,3),classification:cls};
  }
  function ciCounter(hero,step){
    const enemy=picks(bdEnemy?bdEnemy(step.side):(step.side==='Blue'?'Red':'Blue'));if(!enemy.length)return{score:50,types:[],targets:[],explanation:'No enemy picks revealed yet.'};
    const types=new Set(),targets=[];let sum=0;
    const hp=ciObservedRoleProfile(hero);
    for(const e of enemy){
      const ep=ciObservedRoleProfile(e),mech=matchupValue(hero,e),pro=ciStats().matchups[`${hero.name}>${e.name}`],shared=CI_ROLES.reduce((s,r)=>s+Math.min(hp.probs[r]||0,ep.probs[r]||0),0);
      let s=50+mech*7+shared*12;
      if(pro&&pro.games>=3){const wr=pro.wGames?((pro.wins+2.5)/(pro.wGames+5))*100:50;s=s*.65+wr*.35;types.add('DIRECT COUNTER');}
      if(shared>=.35)types.add('LANE COUNTER');if(mech>=2)types.add('DRAFT COUNTER');if(mech>=1&&tags(hero).has('disengage'))types.add('COMPOSITION COUNTER');
      sum+=clamp(s);if(s>=60)targets.push(e.name);
    }
    const score=clamp(Math.round(sum/enemy.length));return{score,types:[...types],targets:targets.slice(0,3),explanation:targets.length?`Best current interaction into ${targets.slice(0,3).join(', ')}.`:'No strong verified matchup edge; score is mainly analytical interaction.'};
  }

  function ciCompositionMetrics(team){
    const ts=team.map(tags),n=Math.max(1,team.length),count=q=>ts.filter(q).length;
    const metric=(c,bonus=0)=>clamp(Math.round(20+c/n*75+bonus));
    const physical=team.filter(h=>!/mage/i.test(roles(h).join(' '))).length,magic=team.filter(h=>tags(h).has('magic')).length;
    return{
      Frontline:metric(count(t=>t.has('frontline'))),Backline:metric(count(t=>t.has('backline'))),Engage:metric(count(t=>t.has('engage'))),Disengage:metric(count(t=>t.has('disengage'))),
      'Crowd Control':metric(count(t=>t.has('hard_cc'))),'Burst':metric(count(t=>t.has('burst'))),'Sustained Damage':metric(count(t=>t.has('sustained'))),'Physical Damage':metric(physical),'Magic Damage':metric(magic),
      Poke:metric(count(t=>t.has('poke'))),Sustain:metric(count(t=>t.has('sustain'))),Mobility:metric(count(t=>t.has('dash')||t.has('dive'))),'Wave Clear':metric(count(t=>t.has('waveclear'))),
      'Objective Control':metric(count(t=>t.has('objective'))),'Backline Access':metric(count(t=>t.has('dive'))),'Pick-off':metric(count(t=>t.has('burst')||t.has('hard_cc'))),Peel:metric(count(t=>t.has('peel'))),
      'Early Game':metric(count(t=>t.has('engage')||t.has('burst'))),'Mid Game':metric(count(t=>t.has('objective')||t.has('engage'))),'Late Game':metric(count(t=>t.has('sustained')||t.has('backline')))
    };
  }
  function ciCompositionFit(hero,side){
    const before=ciCompositionMetrics(picks(side)),after=ciCompositionMetrics([...picks(side),hero]);
    const priorities=['Frontline','Engage','Disengage','Crowd Control','Magic Damage','Wave Clear','Objective Control','Peel'];let gain=0,need=0;
    for(const k of priorities){const deficit=Math.max(0,62-before[k]);need+=deficit;gain+=Math.max(0,after[k]-before[k])*(1+deficit/60);}
    return clamp(Math.round(45+gain*.9+Math.min(15,need*.05)));
  }
  function ciDenial(hero,step){
    const enemy=step.side==='Blue'?'Red':'Blue',need=ciRoleNeed(hero,enemy),syn=ciSynergy(hero,enemy).score,meta=ciMetaProfile(hero).score,flex=ciFlexValue(hero);
    return clamp(Math.round(need*.31+syn*.25+meta*.25+flex*.19));
  }
  function ciRolePool(){
    ciResetIfNeeded();if(ciCache.pool)return ciCache.pool;const counts=Object.fromEntries(CI_ROLES.map(r=>[r,0]));
    for(const h of heroes){if(usedNames().has(h.name))continue;const p=ciObservedRoleProfile(h);for(const r of CI_ROLES)if((p.probs[r]||0)>=.15)counts[r]++;}
    ciCache.pool=counts;return counts;
  }
  function ciScarcity(hero){const p=ciObservedRoleProfile(hero),pool=ciRolePool();let best=45;for(const r of CI_ROLES)if((p.probs[r]||0)>=.15)best=Math.max(best,clamp(100-pool[r]*5));return best;}
  function ciPoolValue(hero,step){return clamp(Math.round(ciScarcity(hero)*.50+ciRoleNeed(hero,step.side)*.25+ciFlexValue(hero)*.25));}
  function ciPatchRelevance(hero){const st=ciStats(),h=st.hero[hero.name];if(!h||!st.latestPatch)return 50;const total=Object.values(h.patchUse).reduce((a,b)=>a+b,0)||1;return clamp(Math.round(35+(h.patchUse[st.latestPatch]||0)/total*65));}
  function ciRecentForm(hero){const h=ciStats().hero[hero.name];if(!h||!h.wResultGames)return 50;const adj=(h.wWins+2.5)/(h.wResultGames+5);return clamp(Math.round(adj*100));}
  function ciRecentPresence(hero){const m=ciMetaProfile(hero);return clamp(Math.round(m.presence*.70+ciPatchRelevance(hero)*.30));}
  function ciSecondPhaseValue(hero,step){const total=picks('Blue').length+picks('Red').length;if(total<6)return 50;return clamp(Math.round(ciRoleNeed(hero,step.side)*.35+ciFlexValue(hero)*.25+ciScarcity(hero)*.25+ciDenial(hero,step)*.15));}
  function ciRisk(hero,step){const p=ciObservedRoleProfile(hero),line=ciLineup(step.side,step.type==='pick'?hero:null),meta=ciMetaProfile(hero);let risk=0;if(p.sample<3)risk+=30;if(meta.sample<3)risk+=20;if(step.type==='pick'){const best=Math.max(...Object.values(line.marginals[hero.name]||{x:.2}));if(best<.45)risk+=18;const comp=ciCompositionMetrics([...picks(step.side),hero]);if(comp.Frontline<35&&picks(step.side).length>=3)risk+=8;}return clamp(risk);}
  function ciEvidence(hero){const p=ciObservedRoleProfile(hero),m=ciMetaProfile(hero);return clamp(Math.round((ciConfidenceScore(p.sample)+m.confidenceScore)/2));}
  function ciSequenceScore(hero,step){
    const seq=window.MLBB_SEQUENCE_MODEL?.candidateScore?.(hero.name,step);if(Number.isFinite(seq))return clamp(seq);
    return 50;
  }
  function ciWeightedScore(c,step){
    const w=window.MLBB_DRAFT_WEIGHTS[step.type==='ban'?'ban':'pick'];let sum=0,den=0;
    for(const [k,v] of Object.entries(w)){if(k==='risk')continue;const x=c[k];if(Number.isFinite(x)){sum+=x*v;den+=v;}}
    let score=den?sum/den:50;score-=c.risk*(w.risk||0);return clamp(Math.round(score));
  }
  function ciDraftSpecificExplanation(hero,step,c,profile){
    const side=step.side,enemy=side==='Blue'?'Red':'Blue',allyOpen=ciLineup(side).status,enemyOpen=ciLineup(enemy).status,parts=[];
    const probable=profile.sorted.filter(x=>x.p>=.15).slice(0,2).map(x=>`${x.role} ${Math.round(x.p*100)}%`).join(' / ');
    if(step.type==='pick'){
      if(c.roleNeed>=65)parts.push(`fits ${Object.entries(allyOpen).filter(([,s])=>s==='OPEN'||s==='LIKELY OPEN').map(([r])=>r).slice(0,2).join(' or ')||'an unresolved role'}`);
      if(c.flex>=70)parts.push(`preserves ${probable||'role'} ambiguity`);
      if(c.counter>=65&&c.counterInfo.targets.length)parts.push(`answers ${c.counterInfo.targets.join(', ')}`);
      if(c.denial>=70)parts.push(`also removes a strong ${enemy} fit`);
      if(c.composition>=65)parts.push('repairs a current composition weakness');
    }else{
      if(c.roleNeed>=65)parts.push(`targets ${enemy}'s likely remaining roles`);
      if(c.flex>=72)parts.push('removes a flexible role-concealment option');
      if(c.counter>=65&&c.counterInfo.targets.length)parts.push(`protects the draft from ${c.counterInfo.targets.join(', ')}`);
      if(c.denial>=70)parts.push('removes a high-value opponent completion');
      if(c.scarcity>=70)parts.push('compresses the remaining role pool');
    }
    return parts.slice(0,3).join(' • ')||'best current balance of professional evidence, role probability, draft position and composition fit';
  }

  coachAnalysis=function(hero,step){
    ciResetIfNeeded();const key=`${hero.name}|${step.side}|${step.type}|${step.slot}`;if(ciCache.analysis.has(key))return ciCache.analysis.get(key);
    const base=ciBaseCoach(hero,step),profile=ciObservedRoleProfile(hero),meta=ciMetaProfile(hero),counterInfo=ciCounter(hero,step),synInfo=ciSynergy(hero,step.side);
    const c={
      meta:meta.score,recentPresence:ciRecentPresence(hero),draftPosition:ciDraftPosition(hero,step),side:ciSideValue(hero,step),roleNeed:ciRoleNeed(hero,step.side),flex:ciFlexValue(hero),
      synergy:synInfo.score,counter:counterInfo.score,denial:ciDenial(hero,step),scarcity:ciScarcity(hero),composition:ciCompositionFit(hero,step.side),secondPhase:ciSecondPhaseValue(hero,step),pool:ciPoolValue(hero,step),
      patch:ciPatchRelevance(hero),recentForm:ciRecentForm(hero),evidence:ciEvidence(hero),risk:ciRisk(hero,step),counterInfo,synInfo,sequence:ciSequenceScore(hero,step)
    };
    // Verified sequence evidence, when available, is additive but never allowed to dominate tiny samples.
    if(c.sequence!==50){c.draftPosition=clamp(Math.round(c.draftPosition*.75+c.sequence*.25));}
    const score=ciWeightedScore(c,step),reason=ciDraftSpecificExplanation(hero,step,c,profile);
    let type=base.type;
    if(step.type==='pick'){
      if(c.denial>=76&&c.roleNeed>=58)type='DENIAL PICK';else if(c.counter>=72)type='CONTEXTUAL COUNTER PICK';else if(c.flex>=76)type='CURRENT-META FLEX PICK';else if(c.roleNeed>=72)type='ROLE-RESOLUTION PICK';else type='DYNAMIC PRIORITY PICK';
    }else{
      if(meta.score>=86&&meta.confidence!=='INSUFFICIENT DATA')type='META BAN';else if(c.counter>=72||c.denial>=75||c.roleNeed>=70)type='DRAFT-SPECIFIC BAN';else if(c.flex>=78)type='FLEX CONTROL BAN';else type='POOL CONTROL BAN';
    }
    const result={...base,score,type,reason,competitive:{...c,profile,meta,confidence:meta.confidence,provenance:meta.source,roleStatus:ciLineup(step.side).status,enemyRoleStatus:ciLineup(step.side==='Blue'?'Red':'Blue').status}};
    ciCache.analysis.set(key,result);return result;
  };

  topRecommendations=function(limit=5){
    ciResetIfNeeded();const step=pseudoStep(),key=`${step.side}|${step.type}|${step.slot}|${limit}`;if(ciCache.top.has(key))return ciCache.top.get(key);
    const out=heroes.filter(h=>!usedNames().has(h.name)).map(hero=>({hero,a:coachAnalysis(hero,step)})).sort((a,b)=>b.a.score-a.a.score||a.hero.name.localeCompare(b.hero.name)).slice(0,limit);ciCache.top.set(key,out);return out;
  };

  function ciRoleText(hero,side=null){
    const p=ciObservedRoleProfile(hero),m=side&&ciLineup(side).marginals[hero.name];
    const rows=m?CI_ROLES.map(r=>({role:r,p:m[r]||0,trend:p.trend[r]})).sort((a,b)=>b.p-a.p):p.sorted;
    return rows.slice(0,2).map(x=>`${x.role} ${Math.round(x.p*100)}%${x.trend&&x.trend!=='?'?` ${x.trend}`:''}`).join(' • ');
  }
  cardRole=function(hero){return ciRoleText(hero)||'ROLE DATA UNAVAILABLE';};

  renderRoleTabs=function(){
    const root=document.getElementById('roleTabs'),tabs=['All',...CI_ROLES];root.innerHTML=tabs.map(r=>`<button class="role-tab${state.filter===r?' active':''}" data-ci-role="${r}">${r}</button>`).join('');
    root.onclick=e=>{const b=e.target.closest('[data-ci-role]');if(!b)return;state.filter=b.dataset.ciRole;renderRoleTabs();renderHeroGrid();};
  };
  function ciHeroVisible(h){
    const q=state.search.toLowerCase();if(q&&!h.name.toLowerCase().includes(q))return false;if(state.filter==='All')return true;
    return (ciObservedRoleProfile(h).probs[state.filter]||0)>=.12;
  }
  renderHeroGrid=function(){
    const root=document.getElementById('heroGrid'),step=pseudoStep(),recs=new Set(topRecommendations().map(x=>x.hero.name));
    const visible=heroes.filter(ciHeroVisible).map(h=>({h,a:coachAnalysis(h,step)})).sort((x,y)=>y.a.score-x.a.score||x.h.name.localeCompare(y.h.name));
    root.innerHTML=visible.map(({h,a})=>{const used=usedNames().has(h.name),pre=state.rankedBans.includes(h.name),disabled=!isRankedBanSetup()&&!isUserTurn(currentStep()),p=ciObservedRoleProfile(h),flex=p.sorted.filter(x=>x.p>=.15).length>1;
      return `<div class="hero-card${used&&!pre?' used':''}${disabled?' disabled':''}${recs.has(h.name)?' recommended':''}${pre?' prebanned':''}" data-ci-hero="${esc(h.name)}"><div class="hero-face">${heroImg(h)}</div><div class="hero-name">${esc(h.name)}</div><div class="hero-role">${esc(ciRoleText(h))}${flex?' • FLEX':''}</div><div class="hero-score">${a.score}</div></div>`;}).join('');
    if(!root.__ciBound){root.__ciBound=true;root.addEventListener('click',e=>{const c=e.target.closest('[data-ci-hero]');if(c)handleHeroClick(c.dataset.ciHero);});root.addEventListener('dblclick',e=>{const c=e.target.closest('[data-ci-hero]');if(c){const h=byName(c.dataset.ciHero);if(h)openHeroDrawer(h);}});}
    document.getElementById('heroCountLabel').textContent=`${visible.length}/${heroes.length} heroes • sorted by current draft score`;
  };
  renderPicks=function(){
    for(const side of['Blue','Red']){const root=document.getElementById(side.toLowerCase()+'Picks'),list=picks(side),line=ciLineup(side);root.innerHTML='';for(let i=0;i<5;i++){
      const h=list[i],el=document.createElement('div');el.className='pick-slot'+(h?' filled':'');
      if(h){const marg=line.marginals[h.name]||{},txt=CI_ROLES.map(r=>({r,p:marg[r]||0})).sort((a,b)=>b.p-a.p).slice(0,2).map(x=>`${x.r} ${Math.round(x.p*100)}%`).join(' / ');el.innerHTML=`<div class="hero-face" style="width:56px;height:56px;flex:none">${heroImg(h)}</div><div><div class="pick-name">${esc(h.name)}</div><div class="pick-role">${esc(txt||ciRoleText(h))}</div></div>`;el.onclick=()=>openHeroDrawer(h);}else el.innerHTML=`<span class="placeholder">Pick ${i+1}</span>`;root.appendChild(el);
    }}
  };
  renderRecommendations=function(){
    const root=document.getElementById('recommendations');root.innerHTML=topRecommendations().map(({hero,a})=>{const c=a.competitive,p=c.profile,rolesTxt=p.sorted.filter(x=>x.p>=.08).slice(0,2).map(x=>`${x.role} ${Math.round(x.p*100)}%`).join(' • ');
      return `<div class="rec" data-ci-rec="${esc(hero.name)}"><div class="rec-head"><div class="rec-face">${heroImg(hero)}</div><div><div class="rec-name">${esc(hero.name)}</div><div class="rec-score">Draft Score ${a.score}/100</div></div></div><span class="rec-type">${esc(a.type)}</span><div class="ci-roleline">${esc(rolesTxt||'Role evidence unavailable')} • ${esc(c.confidence)}</div><div class="rec-reason">${esc(a.reason)}</div><div class="ci-mini">Meta ${c.meta.score} • Role ${c.roleNeed} • Counter ${c.counter} • Synergy ${c.synergy} • Flex ${c.flex} • Denial ${c.denial} • Comp ${c.composition}</div></div>`;}).join('');
    root.onclick=e=>{const x=e.target.closest('[data-ci-rec]');if(x){const h=byName(x.dataset.ciRec);if(h)openHeroDrawer(h);}};
  };

  function ciMemoryHtml(){
    const fmt=list=>list.length?list.map(h=>h.name).join(', '):'—',step=currentStep();let turn='DRAFT COMPLETE';
    if(step){const seq=steps(),i=state.actions.length,next=seq[i+1],same=next&&next.side===step.side&&next.type===step.type;turn=`${isUserTurn(step)?'YOUR TURN':'CURRENT ACTION'} — ${step.side.toUpperCase()} ${step.type.toUpperCase()} ${step.slot}${same?` + ${step.side.toUpperCase()} ${step.type.toUpperCase()} ${next.slot}`:''}`;}
    return `<div class="intel-row ci-memory"><b>DRAFT COACH MEMORY</b><span><strong>${esc(turn)}</strong><br>Blue bans: ${esc(fmt(sideBans('Blue')))}<br>Red bans: ${esc(fmt(sideBans('Red')))}<br>Blue picks: ${esc(fmt(picks('Blue')))}<br>Red picks: ${esc(fmt(picks('Red')))}</span></div>`;
  }
  function ciRoleStateHtml(side){const l=ciLineup(side);return `<div class="intel-row"><b>${side.toUpperCase()} ROLE PROBABILITY STATE</b><span>${CI_ROLES.map(r=>`${r}: ${l.status[r]} (${Math.round(l.occupancy[r]*100)}%)`).join(' • ')}</span></div>`;}
  renderIntel=function(){
    ciBaseRenderIntel();const root=document.querySelector('#draftIntel .intel');if(!root)return;root.insertAdjacentHTML('afterbegin',ciMemoryHtml()+ciRoleStateHtml('Blue')+ciRoleStateHtml('Red'));
    const top=topRecommendations(1)[0];if(top?.a?.competitive){const c=top.a.competitive;root.insertAdjacentHTML('beforeend',`<div class="intel-row"><b>DATA PROVENANCE</b><span>Meta: ${esc(c.provenance)} • Role model: ${esc(c.profile.source)} • Recommendation: COACHING RECOMMENDATION • Counter/composition: ANALYTICAL INFERENCE.</span></div>`);}
  };
  renderHeader=function(){ciBaseRenderHeader();const pill=document.getElementById('metaPill');if(pill)pill.textContent='META: WEEK 6+ • OBSERVED ROLES • DYNAMIC';};

  openHeroDrawer=function(hero){
    ciBaseOpenDrawer(hero);const a=coachAnalysis(hero,pseudoStep()),c=a.competitive,grid=document.querySelector('#drawerBody .analysis-grid');if(!grid||!c)return;
    const roleLines=c.profile.sorted.map(x=>`${x.role} ${Math.round(x.p*100)}% ${x.trend}`).join(' • '),counterTypes=c.counterInfo.types.join(', ')||'No verified counter class';
    grid.insertAdjacentHTML('beforeend',`<div class="analysis-box"><b>CURRENT OBSERVED ROLE MODEL</b><span>${esc(roleLines)}<br>${esc(c.profile.confidence)} • sample ${c.profile.sample}</span></div><div class="analysis-box"><b>DYNAMIC DRAFT SCORE</b><span>${a.score}/100 • evidence ${c.evidence}/100 • risk ${c.risk}/100</span></div><div class="analysis-box"><b>COUNTER ENGINE</b><span>${c.counter}/100 • ${esc(counterTypes)}<br>${esc(c.counterInfo.explanation)}</span></div><div class="analysis-box"><b>SYNERGY ENGINE</b><span>${c.synergy}/100 • ${esc(c.synInfo.classification)}${c.synInfo.with.length?` • with ${esc(c.synInfo.with.join(', '))}`:''}</span></div><div class="analysis-box"><b>DENIAL VALUE</b><span>${c.denial}/100${a.type==='DENIAL PICK'?' • DENIAL PICK DETECTED':''}</span></div><div class="analysis-box"><b>DRAFT POSITION / SIDE</b><span>Position ${c.draftPosition}/100 • Side ${c.side}/100 • Patch ${c.patch}/100</span></div>`);
  };

  function ciBestAssignment(side){return ciLineup(side).configs[0]?.assign||{};}
  function ciRoleHero(side,role){const a=ciBestAssignment(side),name=Object.keys(a).find(n=>a[n]===role);return name?byName(name):null;}
  function ciPairCounter(a,b){if(!a||!b)return 50;const pro=ciStats().matchups[`${a.name}>${b.name}`],mech=matchupValue(a,b);let s=50+mech*7;if(pro&&pro.games>=3){const wr=pro.wGames?((pro.wins+2.5)/(pro.wGames+5))*100:50;s=s*.65+wr*.35;}return clamp(Math.round(s));}
  function ciTeamQuality(side){
    const team=picks(side),comp=ciCompositionMetrics(team),meta=team.reduce((s,h)=>s+ciMetaProfile(h).score,0)/Math.max(1,team.length),core=['Frontline','Engage','Crowd Control','Sustained Damage','Magic Damage','Objective Control','Peel'];
    const compAvg=core.reduce((s,k)=>s+comp[k],0)/core.length;return{score:clamp(Math.round(meta*.42+compAvg*.58)),comp,meta};
  }
  function ciWinCondition(side){const q=ciTeamQuality(side),c=q.comp,weak=Object.entries(c).sort((a,b)=>a[1]-b[1]).slice(0,2).map(x=>x[0]),strong=Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);return `Lean on ${strong.join(', ')} while avoiding extended situations that expose weaker ${weak.join(' and ')}.`;}
  renderComplete=function(){
    const root=document.getElementById('completeReport');if(!state.started||state.actions.length<steps().length){root.innerHTML='';return;}
    const bq=ciTeamQuality('Blue'),rq=ciTeamQuality('Red');let laneBlue=0,laneRed=0;
    const rows=CI_ROLES.map(r=>{const b=ciRoleHero('Blue',r),rd=ciRoleHero('Red',r),s=ciPairCounter(b,rd);laneBlue+=s;laneRed+=100-s;return`<div><b>${r}</b><br>Blue: ${esc(b?.name||'Unresolved')}<br>Red: ${esc(rd?.name||'Unresolved')}<br>Matchup: Blue ${s}% / Red ${100-s}%</div>`;});
    laneBlue/=5;laneRed/=5;let bp=50+(bq.score-rq.score)*.22+(laneBlue-laneRed)*.13;bp=Math.max(35,Math.min(65,Math.round(bp)));const rp=100-bp;
    const allSamples=[...picks('Blue'),...picks('Red')].map(h=>ciMetaProfile(h).sample),conf=ciConfidenceLabel(Math.min(...allSamples,0));
    const metricRows=Object.keys(bq.comp).map(k=>`<div><b>${esc(k)}</b><br>Blue ${bq.comp[k]} • Red ${rq.comp[k]}</div>`).join('');
    root.innerHTML=`<div class="complete-report"><h2>Professional Draft Review</h2><div class="advbar"><div class="blue" style="width:${bp}%"></div><div class="red" style="width:${rp}%"></div></div><div class="mode-note"><b>Draft advantage: Blue ${bp}% • Red ${rp}%</b> • Confidence: ${esc(conf)}<br>Draft advantage is an analytical estimate and does not predict the actual match winner.</div><div class="matchups">${rows.join('')}</div><div class="ci-win"><b>BLUE WIN CONDITION</b><span>${esc(ciWinCondition('Blue'))}</span></div><div class="ci-win"><b>RED WIN CONDITION</b><span>${esc(ciWinCondition('Red'))}</span></div><h3 class="ci-subhead">Composition comparison</h3><div class="matchups">${metricRows}</div></div>`;
  };

  // Lazy off-screen rendering: static pages are not rebuilt after every pick/ban.
  let ciMetaBuilt=false,ciDirBuilt=false,ciSourcesBuilt=false;
  renderMeta=function(){const active=document.getElementById('metaPage')?.classList.contains('active');if(!active&&ciMetaBuilt)return;ciBaseRenderMeta();ciMetaBuilt=true;};
  renderDirectory=function(){const active=document.getElementById('heroesPage')?.classList.contains('active');if(!active&&ciDirBuilt)return;ciBaseRenderDirectory();ciDirBuilt=true;};
  renderSources=function(){const active=document.getElementById('sourcesPage')?.classList.contains('active');if(!active&&ciSourcesBuilt)return;ciBaseRenderSources();const root=document.getElementById('sourcesContent');if(root)root.insertAdjacentHTML('beforeend',`<div class="source-item"><b>Dynamic competitive-intelligence model</b><p>Role probabilities come from verified recent professional role usage when available. Static historical lanes are only a weak fallback and are marked INSUFFICIENT DATA. Draft Priority is recalculated after every action from meta, recent presence, exact draft position, side, probabilistic role need, flex, synergy, counters, denial, scarcity, composition, second-phase value, remaining pool, patch relevance, recent form, evidence confidence and draft risk.</p></div>`);ciSourcesBuilt=true;};

  // Export read-only helpers for other extensions and future verified-data ingestion.
  window.MLBB_PRO_MODEL={eligibleMatches:ciEligibleMatches,roleProfile:ciObservedRoleProfile,lineup:ciLineup,metaProfile:ciMetaProfile,composition:ciCompositionMetrics,stats:ciStats};

  renderAll();
})();