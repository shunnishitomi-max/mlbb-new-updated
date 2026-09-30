// Week-by-week recency prioritization for MPL PH and MPL ID.
// Latest completed week has highest weight, descending to Week 6.
(function(){
  const m=window.MLBB_META||{};
  const cfg=m.weekRecency||{};
  const weights=Array.isArray(cfg.weights)?cfg.weights:[1,.85,.70,.55,.40,.25,.15,.10];
  const leagues=cfg.leagues||{};

  function leagueWeeklyScore(heroName,league){
    const l=leagues[league];
    if(!l)return null;
    const latest=Number(l.latestCompletedWeek||0);
    if(latest<6)return null;
    let weighted=0,totalWeight=0,observations=0,currentWeekScore=null,previousWeekScore=null;
    for(let week=latest;week>=6;week--){
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
    }else if(currentWeekScore!=null&&latest===6){trend='BASELINE';}
    else if(currentWeekScore!=null){trend='EMERGING';}
    return{score,latest,currentWeekScore,previousWeekScore,trend,observations};
  }

  function idSeasonFallback(heroName){
    const s=m.idSeason18?.[heroName];
    if(!s)return null;
    const total=(s.pick||0)+(s.ban||0);
    return clamp(Math.round(50+Math.min(42,total/3)+((s.wr??50)-50)*.08));
  }

  function asianScore(heroName){
    const s=m.asianGames?.[heroName];
    if(!s)return null;
    if(s.signal!=null)return Number(s.signal);
    if(s.pick!=null)return clamp(Math.round(55+Math.min(35,s.pick*4)+((s.wr??50)-50)*.08));
    return null;
  }

  window.MLBB_WEEKLY_META={leagueWeeklyScore};

  const baseMetaEvidence=metaEvidence;
  metaEvidence=function(hero){
    const name=hero.name;
    const ph=leagueWeeklyScore(name,'MPL PH');
    const id=leagueWeeklyScore(name,'MPL ID');
    const ag=asianScore(name);

    if(state.scope==='MPL PH'){
      if(ph){
        return{score:ph.score,confidence:ph.latest===6?'Medium':'High',detail:`MPL PH Week ${ph.latest} is the latest completed week. Week-by-week recency is weighted from Week ${ph.latest} down to Week 6. Trend: ${ph.trend}.`};
      }
      return{score:50,confidence:'Low',detail:'INSUFFICIENT DATA: no verified MPL PH weekly priority signal is bundled for this hero.'};
    }

    if(state.scope==='MPL ID'){
      if(id){
        return{score:id.score,confidence:id.latest===6?'Medium':'High',detail:`MPL ID Week ${id.latest} is the latest completed week. Week-by-week recency is weighted from Week ${id.latest} down to Week 6. Trend: ${id.trend}.`};
      }
      const fallback=idSeasonFallback(name);
      if(fallback!=null){
        return{score:fallback,confidence:'Low',detail:'INSUFFICIENT WEEKLY DATA: using current-season MPL ID totals only as a stabilizing baseline until verified Week 6+ per-week hero data is available.'};
      }
      return{score:50,confidence:'Low',detail:'INSUFFICIENT DATA: no verified MPL ID weekly or season signal is bundled for this hero.'};
    }

    if(state.scope==='Asian Games 2026'){
      if(ag!=null)return{score:ag,confidence:'Medium',detail:'Current Asian Games completed-match signal. This event is not flattened into MPL weekly data.'};
      return{score:50,confidence:'Low',detail:'INSUFFICIENT DATA: no verified current Asian Games signal is bundled for this hero.'};
    }

    // Combined: preserve league separation, then combine only the available signals.
    const components=[];
    if(ph)components.push({v:ph.score,w:.40,label:`MPL PH W${ph.latest}`});
    if(id)components.push({v:id.score,w:.35,label:`MPL ID W${id.latest}`});
    else {
      const fb=idSeasonFallback(name);
      if(fb!=null)components.push({v:fb,w:.15,label:'MPL ID season baseline'});
    }
    if(ag!=null)components.push({v:ag,w:.35,label:'Asian Games'});
    if(!components.length)return baseMetaEvidence(hero);
    const sw=components.reduce((a,x)=>a+x.w,0);
    const score=clamp(Math.round(components.reduce((a,x)=>a+x.v*x.w,0)/sw));
    const currentWeeks=[ph?`PH W${ph.latest}`:null,id?`ID W${id.latest}`:null].filter(Boolean).join(' • ');
    return{score,confidence:(ph||id)&&ag!=null?'Medium':'Low',detail:`Combined live signal: ${currentWeeks||'weekly data limited'}${ag!=null?' • Asian Games current-event signal':''}. Newer MPL weeks always outweigh older weeks down to Week 6.`};
  };

  const baseRenderMeta=renderMeta;
  renderMeta=function(){
    const root=document.getElementById('metaContent');
    const phLatest=leagues['MPL PH']?.latestCompletedWeek||'—';
    const idLatest=leagues['MPL ID']?.latestCompletedWeek||'—';
    const rows=heroes.map(h=>({h,a:metaEvidence(h),ph:leagueWeeklyScore(h.name,'MPL PH'),id:leagueWeeklyScore(h.name,'MPL ID')})).sort((a,b)=>b.a.score-a.a.score).slice(0,40);
    root.innerHTML=`<p class="mode-note">${esc(m.methodology||'')}</p><p class="mode-note"><b>Latest completed weeks:</b> MPL PH Week ${phLatest} • MPL ID Week ${idLatest}. Each league is weighted independently, newest completed week first, descending to Week 6.</p><table class="meta-table"><thead><tr><th>#</th><th>Hero</th><th>Live Priority</th><th>MPL PH trend</th><th>MPL ID trend</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td><b>${esc(r.h.name)}</b></td><td class="meta-score">${r.a.score}</td><td>${r.ph?`${r.ph.trend} • W${r.ph.latest}`:'INSUFFICIENT DATA'}</td><td>${r.id?`${r.id.trend} • W${r.id.latest}`:'INSUFFICIENT WEEKLY DATA'}</td></tr>`).join('')}</tbody></table>`;
  };

  const baseRenderIntel=renderIntel;
  renderIntel=function(){
    baseRenderIntel();
    const root=document.getElementById('draftIntel');
    if(!root)return;
    const ph=leagues['MPL PH'],id=leagues['MPL ID'];
    root.querySelector('.intel')?.insertAdjacentHTML('afterbegin',`<div class="intel-row"><b>WEEKLY RECENCY</b><span>MPL PH W${ph?.latestCompletedWeek??'—'} and MPL ID W${id?.latestCompletedWeek??'—'} are the latest completed weeks in the bundled model. Newer completed weeks get higher weight than each previous week down to Week 6.</span></div>`);
  };

  renderAll();
})();
