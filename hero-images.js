const HERO_IMAGE_CDN='https://cdn.jsdelivr.net/gh/Ceplin03/database-mlbb.Mobile-Legends-Bang-Bang@master/images-hero/';
const HERO_IMAGE_RAW='https://raw.githubusercontent.com/Ceplin03/database-mlbb.Mobile-Legends-Bang-Bang/master/images-hero/';

function heroPortraitFilename(name){
  const specials={
    "Chang'e":'chang27e.png',
    'X.Borg':'xborg.png'
  };
  if(specials[name])return specials[name];
  return String(name||'')
    .trim()
    .toLowerCase()
    .replace(/\./g,'')
    .replace(/\s+/g,'_')+'.png';
}

function heroPortraitUrl(name,raw=false){
  const file=heroPortraitFilename(name);
  return (raw?HERO_IMAGE_RAW:HERO_IMAGE_CDN)+encodeURIComponent(file).replace(/%2F/g,'/');
}

function repairBrokenHeroImage(img,heroName){
  if(!img)return;
  // First failure: retry the same portrait from raw.githubusercontent.com.
  if(img.dataset.source!=='raw'){
    img.dataset.source='raw';
    img.src=heroPortraitUrl(heroName,true);
    return;
  }
  // Second failure: keep the app usable with a single-letter fallback.
  const card=img.closest('.hero-face,.rec-face,.drawer-face,.ban-token');
  if(card){
    img.remove();
    card.textContent=(heroName||'?').charAt(0).toUpperCase();
  }
}

// Always render a portrait immediately. Do not wait for the optional metadata
// feed, because the hero grid is drawn before that async request completes.
heroImg=function(hero,cls=''){
  const name=String(hero?.name||'');
  const src=heroPortraitUrl(name,false);
  const safeName=name.replace(/'/g,'&#39;');
  return `<img class="${cls}" src="${src}" alt="${esc(name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-source="cdn" onerror="repairBrokenHeroImage(this,'${safeName}')">`;
};

function forcePortraitRefresh(){
  if(!Array.isArray(heroes)||!heroes.length)return false;
  // Store the deterministic source on the hero objects too so every renderer,
  // including ban and pick slots, has a concrete image URL available.
  for(const hero of heroes)hero.icon_url=heroPortraitUrl(hero.name,false);
  renderAll();
  const label=document.getElementById('heroCountLabel');
  if(label)label.textContent=`${heroes.length} heroes loaded • portraits enabled`;
  return true;
}

// app.js starts its async hero load before this extension runs. Poll briefly and
// repaint as soon as the roster exists. tournament-formats.js also calls
// renderAll(), so the synchronous heroImg override already applies immediately.
let portraitAttempts=0;
const portraitTimer=setInterval(()=>{
  portraitAttempts++;
  if(forcePortraitRefresh()||portraitAttempts>=60)clearInterval(portraitTimer);
},200);
window.addEventListener('load',()=>setTimeout(forcePortraitRefresh,400));
