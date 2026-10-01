// Runtime rendering guard: keep the live draft fast by skipping heavy off-screen pages.
(function(){
  const baseMeta=renderMeta,baseDirectory=renderDirectory,baseSources=renderSources;
  renderMeta=function(){if(!document.getElementById('metaPage')?.classList.contains('active'))return;baseMeta();};
  renderDirectory=function(){if(!document.getElementById('heroesPage')?.classList.contains('active'))return;baseDirectory();};
  renderSources=function(){if(!document.getElementById('sourcesPage')?.classList.contains('active'))return;baseSources();};

  // Avoid repeated layout work while typing into hero search.
  const input=document.getElementById('searchInput');
  if(input){
    let frame=0;
    input.oninput=e=>{
      state.search=e.target.value;
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>renderHeroGrid());
    };
  }
})();