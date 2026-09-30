const HERO_IMAGE_INDEX='https://raw.githubusercontent.com/Ceplin03/database-mlbb.Mobile-Legends-Bang-Bang/master/hero.json';
const HERO_IMAGE_BASE='https://raw.githubusercontent.com/Ceplin03/database-mlbb.Mobile-Legends-Bang-Bang/master/images-hero/';

async function hydrateHeroImages(){
  try{
    const r=await fetch(HERO_IMAGE_INDEX,{cache:'force-cache'});
    if(!r.ok)throw new Error('image index unavailable');
    const data=await r.json();
    const imageMap=new Map((Array.isArray(data)?data:[]).map(x=>[
      String(x.name_hero||'').toLowerCase(),
      x['images-hero']?HERO_IMAGE_BASE+encodeURIComponent(x['images-hero']).replace(/%2F/g,'/'):''
    ]));
    let updated=0;
    for(const hero of heroes){
      const mapped=imageMap.get(String(hero.name||'').toLowerCase());
      if(mapped){hero.icon_url=mapped;updated++}
    }
    renderAll();
    const label=document.getElementById('heroCountLabel');
    if(label)label.textContent=`${heroes.length} heroes loaded • ${updated} portraits mapped`;
  }catch(err){
    console.warn('Hero portrait hydration failed',err);
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
    return `<img class="${cls}" src="${esc(hero.icon_url)}" alt="${esc(hero.name)}" loading="lazy" onerror="repairBrokenHeroImage(this,'${esc(hero.name).replace(/'/g,"&#39;")}')">`;
  }
  return esc(hero?.name?.[0]||'?');
};

setTimeout(hydrateHeroImages,50);
