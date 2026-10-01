// Strict Week-6-and-later recency prioritization for MPL PH and MPL ID.
// Data before Week 6 is excluded from all scoring and recommendations.
(function(){
  const m=window.MLBB_META||{};
  const cfg=m.weekRecency||{};
  const minWeek=Number(cfg.minEligibleWeek||6);
  const weights=Array.isArray(cfg.weights)?cfg.weights:[1,.85,.70,.55,.40,.25,.15,.10];
  const leagues=cfg.leagues||{};

  function leagueWeeklyScore(heroName,league){
    const l=leagues[league];
    if(!l)return null;
    const latest=Number(l.latestCompletedWeek||0);
    if(latest<minWeek)return null;
    let weighted=0,totalWeight=0,observations=0,currentWeekScore=null,previousWeekScore=null;
    for(let week=latest;week>=minWeek;week--){
      const age=latest-week;
      const w=weights[age]??Math.max(.05,1-age*.15);
      const map=l.weeklyPriority?.[week]||{};
      const v=map[heroName];
      if(v!=null){
        if(week===latest)currentWeekScore=Number(v);
        if(week===latest-1)previousWeekScore=Number(v);
        weighted+=Number(v)*w;
        totalWeight+=w;
        observations++;
      }
    }
    if(!observations)return null;
    const score=clamp(Math.round(weighted/totalWeight));
    let trend='INSUFFICIENT DATA';
    if(currentWeekScore!=null&&previousWeekScore!=null){
      const d=currentWeekScore-previousWeekScore;
      trend=d>=8?'RISING':d<=-8?'FALLING':'STABLE';
    }else if(currentWeekScore!=null&&latest===minWeek){trend='BASELINE';}
    else if(currentWeekScore!=null){trend='EMERGING';}
    return{score,latest,currentWeekScore,previousWeekScore,trend,observations};
  }

  function asianScore(heroName){
    const s=m.asianGames?.[heroName];
    if(!s)return null;
    if(s.signal!=null)return Number(s.signal);
    if(s.pick!=null)return clamp(Math.round(55+Math.min(35,s.pick*4)+((s.wr??50)-50)*.08));
    return null;
  }

  window.MLBB_WEEKLY_META={leagueWeeklyScore};

  metaEvidence=function(hero){
    const name=hero.name;
    const ph=leagueWeeklyScore(name,'MPL PH');
    const id=leagueWeeklyScore(name,'MPL ID');
    const ag=asianScore(name);

    if(state.scope==='MPL PH'){
      if(ph)return{score:ph.score,confidence:ph.latest===minWeek?'Medium':'High',detail:`MPL PH Week ${ph.latest} is the latest completed week. Only Week ${minWeek}+ games are eligible. Trend: ${ph.trend}.`};
      return{score:50,confidence:'Low',detail:`INSUFFICIENT DATA: no verified MPL PH Week ${minWeek}+ priority signal is bundled for this hero.`};
    }

    if(state.scope==='MPL ID'){
      if(id)return{score:id.score,confidence:id.latest===minWeek?'Medium':'High',detail:`MPL ID Week ${id.latest} is the latest completed week. Only Week ${minWeek}+ games are eligible. Trend: ${id.trend}.`};
      return{score:50,confidence:'Low',detail:`INSUFFICIENT DATA: no verified MPL ID Week ${minWeek}+ priority signal is bundled for this hero. Pre-Week-${minWeek} and full-season fallback data are excluded.`};
    }

    if(state.scope==='Asian Games 2026'){
      if(ag!=null)return{score:ag,confidence:'Medium',detail:'Current Asian Games completed-match signal. This event is separate from MPL weekly data.'};
      return{score:50,confidence:'Low',detail:'INSUFFICIENT DATA: no verified current Asian Games signal is bundled for this hero.'};
    }

    const components=[];
    if(ph)components.push({v:ph.score,w:.45,label:`MPL PH W${ph.latest}`});
    if(id)components.push({v:id.score,w:.40,label:`MPL ID W${id.latest}`});
    if(ag!=null)components.push({v:ag,w:.35,label:'Asian Games'});
    if(!components.length)return{score:50,confidence:'Low',detail:`INSUFFICIENT DATA: no eligible MPL Week ${minWeek}+ or current Asian Games signal is available for this hero.`};
    const sw=components.reduce((a,x)=>a+x.w,0);
    const score=clamp(Math.round(components.reduce((a,x)=>a+x.v*x.w,0)/sw));
    const currentWeeks=[ph?`PH W${ph.latest}`:null,id?`ID W${id.latest}`:null].filter(Boolean).join(' • ');
    return{score,confidence:(ph&&id)||ag!=null?'Medium':'Low',detail:`Combined eligible signal: ${currentWeeks||`no MPL Week ${minWeek}+ hero data`}${ag!=null?' • Asian Games':''}. MPL data before Week ${minWeek} are excluded.`};
  };

  renderMeta=function(){
    const root=document.getElementById('metaContent');
    const phLatest=leagues['MPL PH']?.latestCompletedWeek||'—';
    const idLatest=leagues['MPL ID']?.latestCompletedWeek||'—';
    const rows=heroes.map(h=>({h,a:metaEvidence(h),ph:leagueWeeklyScore(h.name,'MPL PH'),id:leagueWeeklyScore(h.name,'MPL ID')})).sort((a,b)=>b.a.score-a.a.score).slice(0,40);
    root.innerHTML=`<p class="mode-note">${esc(m.methodology||'')}</p><p class="mode-note"><b>Strict data window:</b> MPL PH and MPL ID use Week ${minWeek} and later only. Pre-Week-${minWeek} matches and full-season aggregates containing earlier weeks are excluded.</p><p class="mode-note"><b>Latest completed weeks:</b> MPL PH Week ${phLatest} • MPL ID Week ${idLatest}. Newest completed week gets the highest weight, descending only to Week ${minWeek}.</p><table class="meta-table"><thead><tr><th>#</th><th>Hero</th><th>Live Priority</th><th>MPL PH trend</th><th>MPL ID trend</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td><b>${esc(r.h.name)}</b></td><td class="meta-score">${r.a.score}</td><td>${r.ph?`${r.ph.trend} • W${r.ph.latest}`:'INSUFFICIENT WEEK 6+ DATA'}</td><td>${r.id?`${r.id.trend} • W${r.id.latest}`:'INSUFFICIENT WEEK 6+ DATA'}</td></tr>`).join('')}</tbody></table>`;
  };

  const baseRenderIntel=renderIntel;
  renderIntel=function(){
    baseRenderIntel();
    const root=document.getElementById('draftIntel');
    if(!root)return;
    const ph=leagues['MPL PH'],id=leagues['MPL ID'];
    root.querySelector('.intel')?.insertAdjacentHTML('afterbegin',`<div class="intel-row"><b>STRICT DATA WINDOW</b><span>Only MPL PH and MPL ID games from Week ${minWeek} onward are used. Data before Week ${minWeek} are excluded from scoring and recommendations.</span></div><div class="intel-row"><b>WEEKLY RECENCY</b><span>MPL PH W${ph?.latestCompletedWeek??'—'} and MPL ID W${id?.latestCompletedWeek??'—'} are the latest completed weeks in the bundled model. Newer eligible weeks receive higher weight.</span></div>`);
  };

  const baseRenderSources=renderSources;
  renderSources=function(){
    baseRenderSources();
    const root=document.getElementById('sourcesContent');
    if(root)root.insertAdjacentHTML('beforeend',`<div class="source-item"><b>Strict Week ${minWeek}+ rule</b><p>MPL PH and MPL ID matches before Week ${minWeek} are not used for draft scoring, recommendations, trends, counters, bans, picks, or combined meta calculations. No full-season fallback is allowed if it contains pre-Week-${minWeek} matches.</p></div>`);
  };

  renderAll();
})();
