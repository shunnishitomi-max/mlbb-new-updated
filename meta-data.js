window.MLBB_META={
  updated:'2026-10-01T07:00:00+08:00',
  methodology:'Week-by-week recency model. MPL PH and MPL ID are evaluated independently from the latest completed competitive week back to Week 6. The latest completed week receives the highest weight, with progressively lower weights for older weeks. Current Asian Games data remains a separate current-event signal. Exact weekly statistics are never fabricated; when a verified weekly hero breakdown is unavailable, the site explicitly falls back to a lower-confidence season baseline.',
  sources:[
    {name:'MPL Philippines S18 official schedule/results',kind:'Official / schedule',url:'https://ph-mpl.com/schedule',note:'As of Oct 1, 2026, Week 6 is the latest completed week. Week 7 begins Oct 2. The weekly model updates only from completed weeks.'},
    {name:'MPL Indonesia S18 official schedule/results',kind:'Official / schedule',url:'https://id-mpl.com/id/schedule',note:'As of Oct 1, 2026, Week 6 is the latest completed week. Week 7 begins Oct 2. The weekly model is calculated separately from MPL PH.'},
    {name:'MPL Indonesia S18 official statistics',kind:'Official league statistics',url:'https://id-mpl.com/id/statistics',note:'Current-season hero pick/ban totals are used only as a stabilizing baseline when an exact weekly hero breakdown is unavailable.'},
    {name:'MLBBHub MPL ID Season 18 stats',kind:'Independent structured dataset',url:'https://mlbbhub.com/mpl/id/stats',note:'Season-level structured totals are treated as supporting baseline data, not as a substitute for verified weekly counts.'},
    {name:'Asian Games 2026 current results',kind:'Current tournament',url:'https://mldb.gg/',note:'Current completed Asian Games draft results remain highly relevant in Combined mode.'},
    {name:'Asian Games group-stage hero report',kind:'Current tournament analysis',url:'https://tirto.id/jadwal-playoff-mlbb-asian-games-2026-bracket-link-live-streaming-hDnm',note:'Current-event hero signals are used separately from MPL weekly weighting.'}
  ],
  weekRecency:{
    weights:[1.00,0.85,0.70,0.55,0.40,0.25,0.15,0.10],
    leagues:{
      'MPL PH':{
        latestCompletedWeek:6,
        asOf:'2026-10-01',
        nextWeek:7,
        nextWeekStarts:'2026-10-02',
        weeklyPriority:{
          6:{Hirara:92,Gloo:88,Lylia:84,Eudora:84,Freya:82,Paquito:86,Barats:80,Belerick:78,Atlas:78,Nolan:77,Obsidia:76,Carmilla:75,Minotaur:74,Aulus:73,Zhuxin:72}
        },
        weeklyStats:{6:{}},
        dataQuality:{6:'ANALYTICAL INFERENCE'}
      },
      'MPL ID':{
        latestCompletedWeek:6,
        asOf:'2026-10-01',
        nextWeek:7,
        nextWeekStarts:'2026-10-02',
        weeklyPriority:{6:{}},
        weeklyStats:{6:{}},
        dataQuality:{6:'INSUFFICIENT DATA'}
      }
    }
  },
  idSeason18:{
    Freya:{pick:8,ban:101,wr:63},Paquito:{pick:60,ban:46,wr:50},Atlas:{pick:22,ban:82,wr:59},Hirara:{pick:72,ban:31,wr:54},Melissa:{pick:34,ban:53,wr:53},Uranus:{pick:45,ban:41,wr:49},Marcel:{pick:13,ban:72,wr:54},Belerick:{pick:63,ban:19,wr:49},Fanny:{pick:0,ban:63,wr:null},Claude:{pick:47,ban:0,wr:null}
  },
  asianGames:{
    Nolan:{pick:9,wr:55.56},Uranus:{pick:8,wr:37.5},Atlas:{pick:7,wr:71.43},Esmeralda:{pick:7,wr:71.43},Aulus:{signal:78},Eudora:{signal:82},Obsidia:{signal:78},Belerick:{signal:80},Hirara:{signal:83},Claude:{signal:80},Barats:{signal:76},Carmilla:{signal:76}
  },
  phWeek6PriorityInference:{
    Hirara:92,Gloo:88,Lylia:84,Eudora:84,Freya:82,Paquito:86,Barats:80,Belerick:78,Atlas:78,Nolan:77,Obsidia:76,Carmilla:75,Minotaur:74,Aulus:73,Zhuxin:72
  },
  phWeek6Observed:{
    Hirara:92,Gloo:88,Lylia:84,Eudora:84,Freya:82,Paquito:86,Barats:80,Belerick:78,Atlas:78,Nolan:77,Obsidia:76,Carmilla:75,Minotaur:74,Aulus:73,Zhuxin:72
  },
  recencyComposite:{
    Freya:97,Atlas:96,Hirara:95,Paquito:94,Marcel:92,Belerick:91,Uranus:90,Fanny:88,Melissa:87,Nolan:86,Gloo:85,Eudora:84,Barats:84,Esmeralda:83,Obsidia:82,Claude:82,Aulus:81,Carmilla:80,Lylia:79,Minotaur:79,Zhuxin:78,Zetian:77,Selena:76,Rafaela:75,Masha:74,Suyou:73,Sora:72,Mathilda:72,Harith:71,Valentina:70
  }
};