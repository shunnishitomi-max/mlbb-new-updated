window.MLBB_META={
  updated:'2026-10-01T06:15:00+08:00',
  methodology:'Recency-first coaching model. MPL PH Week 6+, MPL ID Week 6+, and the live Asian Games main event receive the highest weight. Full-season data is used only as a stabilizing baseline when exact Week 6+ counts are unavailable. Composite priority is analytical inference, not an official percentage.',
  sources:[
    {name:'MPL Philippines S18 Week 6 schedule/results',kind:'Official / schedule',url:'https://ph-mpl.com/schedule',note:'Week 6 completed Sep 25–27. Recent draft signals are taken only from publicly verified match pages; no invented Week 6 aggregate counts.'},
    {name:'MPL Indonesia S18 official statistics',kind:'Official league statistics',url:'https://id-mpl.com/id/statistics',note:'Current-season hero pick/ban totals provide a stable baseline; recency weighting favors Week 6 onward.'},
    {name:'MLBBHub MPL ID Season 18 stats',kind:'Independent structured dataset',url:'https://mlbbhub.com/mpl/id/stats',note:'As of Sep 23, Freya 109 P+B, Paquito 106, Atlas 104, Hirara 103, Melissa 87, Uranus 86, Marcel 85, Belerick 82.'},
    {name:'Asian Games 2026 current results',kind:'Current tournament',url:'https://mldb.gg/',note:'Main event is active Sep 29–Oct 1. Completed group/playoff results are used when published.'},
    {name:'Asian Games group-stage hero report',kind:'Current tournament analysis',url:'https://tirto.id/jadwal-playoff-mlbb-asian-games-2026-bracket-link-live-streaming-hDnm',note:'After 14 group-stage games: Nolan 9 picks (55.56% WR), Uranus 8 picks; Atlas and Esmeralda were reported at 71.43% WR from 7 picks.'}
  ],
  idSeason18:{
    Freya:{pick:8,ban:101,wr:63},Paquito:{pick:60,ban:46,wr:50},Atlas:{pick:22,ban:82,wr:59},Hirara:{pick:72,ban:31,wr:54},Melissa:{pick:34,ban:53,wr:53},Uranus:{pick:45,ban:41,wr:49},Marcel:{pick:13,ban:72,wr:54},Belerick:{pick:63,ban:19,wr:49},Fanny:{pick:0,ban:63,wr:null},Claude:{pick:47,ban:0,wr:null}
  },
  asianGames:{
    Nolan:{pick:9,wr:55.56},Uranus:{pick:8,wr:37.5},Atlas:{pick:7,wr:71.43},Esmeralda:{pick:7,wr:71.43},Aulus:{signal:78},Eudora:{signal:82},Obsidia:{signal:78},Belerick:{signal:80},Hirara:{signal:83},Claude:{signal:80},Barats:{signal:76},Carmilla:{signal:76}
  },
  phWeek6Observed:{
    Hirara:92,Gloo:88,Lylia:84,Eudora:84,Freya:82,Paquito:86,Barats:80,Belerick:78,Atlas:78,Nolan:77,Obsidia:76,Carmilla:75,Minotaur:74,Aulus:73,Zhuxin:72
  },
  recencyComposite:{
    Freya:97,Atlas:96,Hirara:95,Paquito:94,Marcel:92,Belerick:91,Uranus:90,Fanny:88,Melissa:87,Nolan:86,Gloo:85,Eudora:84,Barats:84,Esmeralda:83,Obsidia:82,Claude:82,Aulus:81,Carmilla:80,Lylia:79,Minotaur:79,Zhuxin:78,Zetian:77,Selena:76,Rafaela:75,Masha:74,Suyou:73,Sora:72,Mathilda:72,Harith:71,Valentina:70
  }
};