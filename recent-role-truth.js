// Recent-match truth layer.
// Newer completed matches carry materially more weight than older eligible games.
// Exact role percentages are only shown when supported by verified role-tagged match records.
(function(){
  if(window.MLBB_DRAFT_WEIGHTS){
    window.MLBB_DRAFT_WEIGHTS.recencyHalfLifeDays=5;
    window.MLBB_DRAFT_WEIGHTS.competition=Object.assign({},window.MLBB_DRAFT_WEIGHTS.competition,{
      'MPL PH':1,
      'MPL ID':1,
      'Asian Games 2026':1
    });
  }

  // Force the competitive model to rebuild cached weighted statistics using the tighter recency window.
  if(window.MLBB_COMPETITIVE_MATCH_DATA){
    window.MLBB_COMPETITIVE_MATCH_DATA.updated='2026-10-01T15:00:00+08:00-recency5d';
  }

  // Verified recent role-tagged evidence currently bundled here only when the player-role assignment
  // is directly supported by a completed professional match page. This is intentionally conservative.
  // Paquito: MPL PH Week 6 official match pages show K1NGKONG (Jungler) on Paquito twice on Sep 26,
  // and Domeng (Gold Laner) on Paquito once on Sep 27. This proves that a static "100% EXP" label is wrong.
  const RECENT_ROLE_EVIDENCE={
    Paquito:{
      scope:'MPL PH Week 6 verified subset',
      verified:true,
      sample:3,
      counts:{JUNGLE:2,GOLD:1,EXP:0,MID:0,ROAM:0},
      latest:'2026-09-27',
      confidence:'LOW CONFIDENCE',
      note:'Verified subset only. Jungle is the dominant role in the directly verified recent sample. Do not interpret this as a complete Week 6 event-wide role split.',
      sources:[
        'https://ph-mpl.com/data/match/flcn-onic-20260926',
        'https://ph-mpl.com/data/match/rora-flcn-20260927'
      ]
    }
  };
  window.MLBB_RECENT_ROLE_EVIDENCE=RECENT_ROLE_EVIDENCE;

  const rrBaseLanes=lanes;
  const rrBaseCoach=coachAnalysis;
  const rrBaseCardRole=cardRole;
  const rrBaseRenderPicks=renderPicks;
  const rrBaseRenderRecommendations=renderRecommendations;
  const rrBaseOpenHeroDrawer=openHeroDrawer;
  const rrBaseRenderIntel=renderIntel;
  const rrBaseRenderHeader=renderHeader;
  const rrBaseRenderSources=renderSources;

  function rrEvidence(hero){return hero&&RECENT_ROLE_EVIDENCE[hero.name]||null;}
  function rrPct(e){
    const total=Object.values(e.counts).reduce((a,b)=>a+b,0)||1;
    return Object.entries(e.counts).map(([role,n])=>({role,n,p:n/total})).filter(x=>x.n>0).sort((a,b)=>b.p-a.p);
  }
  function rrModelProfile(hero){
    try{return window.MLBB_PRO_MODEL?.roleProfile?.(hero)||null}catch{return null}
  }
  function rrHasExactCurrentRoleData(hero){
    const p=rrModelProfile(hero);return !!(p&&Number(p.sample)>=3&&p.source!=='HISTORICAL FALLBACK');
  }
  function rrRoleDisplay(hero){
    const exact=rrModelProfile(hero);
    if(rrHasExactCurrentRoleData(hero)){
      const rows=(exact.sorted||[]).filter(x=>Number(x.p)>0).slice(0,3);
      return rows.map(x=>`${x.role} ${Math.round(x.p*100)}%${x.trend&&x.trend!=='?'?` ${x.trend}`:''}`).join(' • ');
    }
    const e=rrEvidence(hero);
    if(e){
      const rows=rrPct(e);
      return rows.map((x,i)=>`${x.role} ${Math.round(x.p*100)}%${i===0?' (recent verified sample)':''}`).join(' • ');
    }
    // Never turn a static historical lane into a fake current 100% role percentage.
    const fallback=rrBaseLanes(hero)||[];
    return fallback.length?`${fallback.slice(0,2).join(' / ')} • CURRENT ROLE DATA INSUFFICIENT`:'CURRENT ROLE DATA INSUFFICIENT';
  }

  lanes=function(hero){
    const exact=rrModelProfile(hero);
    if(exact&&Number(exact.sample)>=3&&exact.source!=='HISTORICAL FALLBACK'){
      const r=(exact.sorted||[]).filter(x=>Number(x.p)>=.10).map(x=>x.role);if(r.length)return r;
    }
    const e=rrEvidence(hero);
    if(e){return rrPct(e).map(x=>x.role);}
    return rrBaseLanes(hero);
  };

  cardRole=function(hero){return rrRoleDisplay(hero)};

  function rrRoleNeedFromEvidence(hero,side){
    const e=rrEvidence(hero);if(!e)return null;
    const rows=rrPct(e),open=new Set(openRoles(side));
    let v=0;for(const x of rows)v+=x.p*(open.has(x.role)?88:42);
    return Math.max(0,Math.min(100,Math.round(v)));
  }

  coachAnalysis=function(hero,step){
    const base=rrBaseCoach(hero,step),e=rrEvidence(hero);
    if(!e)return base;
    const roleNeed=rrRoleNeedFromEvidence(hero,step.side);
    const flex=rrPct(e).length>=2?72:48;
    // Current role evidence changes role fit/flex interpretation, but does not override
    // the professional hierarchy where ban rate/draft priority remains first.
    let score=base.score;
    if(Number.isFinite(roleNeed))score=Math.round(score*.92+roleNeed*.08);
    const comp=base.competitive?{...base.competitive,roleNeed:roleNeed??base.competitive.roleNeed,flex:Math.max(Number(base.competitive.flex||0),flex)}:base.competitive;
    return{
      ...base,
      score:Math.max(0,Math.min(100,score)),
      competitive:comp,
      recentRoleEvidence:{...e,distribution:rrPct(e)},
      reason:`${base.reason} • recent verified role sample: ${rrPct(e).map(x=>`${x.role} ${Math.round(x.p*100)}%`).join(' / ')}`
    };
  };

  function rrPatchPaquitoRoleText(root){
    if(!root)return;
    root.querySelectorAll('[data-ci-hero="Paquito"] .hero-role').forEach(el=>el.textContent=rrRoleDisplay(byName('Paquito')));
    root.querySelectorAll('[data-ci-rec="Paquito"] .ci-roleline').forEach(el=>el.textContent=`${rrRoleDisplay(byName('Paquito'))} • LOW CONFIDENCE`);
  }

  const rrBaseRenderHeroGrid=renderHeroGrid;
  renderHeroGrid=function(){rrBaseRenderHeroGrid();rrPatchPaquitoRoleText(document.getElementById('heroGrid'));};

  renderPicks=function(){
    rrBaseRenderPicks();
    for(const side of['Blue','Red']){
      const list=picks(side),root=document.getElementById(side.toLowerCase()+'Picks');
      [...root.querySelectorAll('.pick-slot.filled')].forEach((el,i)=>{const h=list[i];if(h?.name==='Paquito'){const r=el.querySelector('.pick-role');if(r)r.textContent=rrRoleDisplay(h);}});
    }
  };

  renderRecommendations=function(){rrBaseRenderRecommendations();rrPatchPaquitoRoleText(document.getElementById('recommendations'));};

  openHeroDrawer=function(hero){
    rrBaseOpenHeroDrawer(hero);
    const grid=document.querySelector('#drawerBody .analysis-grid');if(!grid)return;
    const e=rrEvidence(hero),p=rrModelProfile(hero);
    let html;
    if(rrHasExactCurrentRoleData(hero)){
      html=`<div class="analysis-box"><b>RECENT ROLE TRUTH</b><span>${esc(rrRoleDisplay(hero))}<br>${esc(p.confidence)} • exact role-tagged sample ${p.sample}</span></div>`;
    }else if(e){
      html=`<div class="analysis-box"><b>RECENT ROLE TRUTH</b><span>${esc(rrRoleDisplay(hero))}<br>${esc(e.confidence)} • ${esc(e.note)}</span></div>`;
    }else{
      html=`<div class="analysis-box"><b>RECENT ROLE TRUTH</b><span>CURRENT ROLE DATA INSUFFICIENT. Historical/default lanes are not presented as a current professional percentage.</span></div>`;
    }
    grid.insertAdjacentHTML('beforeend',html);
  };

  renderIntel=function(){
    rrBaseRenderIntel();
    const root=document.querySelector('#draftIntel .intel');if(!root)return;
    root.insertAdjacentHTML('afterbegin',`<div class="intel-row"><b>RECENCY MODEL</b><span>Newest completed matches are weighted most heavily. Current half-life: 5 days, so evidence roughly halves in influence every five days within the eligible Week 6+ / Asian Games window.</span></div>`);
  };

  renderHeader=function(){
    rrBaseRenderHeader();
    const pill=document.getElementById('metaPill');if(pill)pill.textContent='META: LATEST MATCHES HEAVIEST • VERIFIED ROLES';
  };

  renderSources=function(){
    rrBaseRenderSources();
    const root=document.getElementById('sourcesContent');if(!root)return;
    root.insertAdjacentHTML('beforeend',`<div class="source-item"><b>Recent-role verification rule</b><p>Exact current role percentages are shown only when role-tagged professional match evidence is available. Static/default hero lanes are never converted into a fake 100% current-role statistic. Paquito is corrected from the previous 100% EXP display: directly verified MPL PH Week 6 match records show recent Jungle usage as the dominant role in the verified subset, with a Gold-lane appearance also observed. The subset is labeled low confidence until the complete eligible match-level role log is populated.</p></div>`);
  };

  renderAll();
})();
