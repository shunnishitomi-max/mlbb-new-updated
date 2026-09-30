const HERO_IMAGE_INDEX='https://raw.githubusercontent.com/Ceplin03/database-mlbb.Mobile-Legends-Bang-Bang/master/hero.json';
const HERO_IMAGE_BASE='https://raw.githubusercontent.com/Ceplin03/database-mlbb.Mobile-Legends-Bang-Bang/master/images-hero/';

let heroPortraitMap=null;
let heroPortraitHydrating=false;

async function getHeroPortraitMap(){
  if(heroPortraitMap)return heroPortraitMap;
  const r=await fetch(HERO_IMAGE_INDEX,{cache:'force-cache'});
  if(!r.ok)throw new Error('image index unavailable');
  const data=await r.json();
  heroPortraitMap=new Map((Array.isArray(data)?data:[]).map(x=>[
    String(x.name_hero||'').trim().toLowerCase(),
    x['images-hero']?HERO_IMAGE_BASE+encodeURIComponent(x['images-hero']).replace(/%2F/g,'/'):''
  ]));
  return heroPortraitMap;
}

async function hydrateHeroImages(){
  if(heroPortraitHydrating)return;
  if(!Array.isArray(heroes)||!heroes.length)return false;
  heroPortraitHydrating=true;
  try{
    const imageMap=await getHeroPortraitMap();
    let updated=0;
    for(const hero of heroes){
      const mapped=imageMap.get(String(hero.name||'').trim().toLowerCase());
      if(mapped){hero.icon_url=mapped;updated++}
    }
    renderAll();
    const label=document.getElementById('heroCountLabel');
    if(label)label.textContent=`${heroes.length} heroes loaded • ${updated} portraits mapped`;
    return updated>0;
  }catch(err){
    console.warn('Hero portrait hydration failed',err);
    return false;
  }finally{
    heroPortraitHydrating=false;
  }
}

function repairBrokenHeroImage(img,heroName){
  if(!img||img.dataset.repaired==='1')return;
  img.dataset.repaired='1';
  const card=img.closest('.hero-face,.rec-face,.drawer-face,.ban-token');
  if(card){
    img.remove();
    card.textContent=(heroName||'?').charAt(0).toUpperCase();
  }
}

const originalHeroImg=heroImg;
heroImg=function(hero,cls=''){
  if(hero?.icon_url){
    const safeName=String(hero.name||'').replace(/'/g,'&#39;');
    return `<img class="${cls}" src="${esc(hero.icon_url)}" alt="${esc(hero.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="repairBrokenHeroImage(this,'${safeName}')">`;
  }
  return esc(hero?.name?.[0]||'?');
};

// app.js begins loading heroes before this extension is evaluated. Wait until the
// roster actually exists, then apply the portrait map. This fixes the race that
// previously caused hydration to run while heroes was still an empty array.
let portraitAttempts=0;
const portraitTimer=setInterval(async()=>{
  portraitAttempts++;
  if(Array.isArray(heroes)&&heroes.length){
    clearInterval(portraitTimer);
    await hydrateHeroImages();
  }else if(portraitAttempts>=50){
    clearInterval(portraitTimer);
  }
},200);

window.addEventListener('load',()=>setTimeout(hydrateHeroImages,300));
