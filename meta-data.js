window.MLBB_META={
  updated:'2026-10-01T07:30:00+08:00',
  methodology:'STRICT WEEK 6+ ONLY MODEL. MPL PH and MPL ID data from before Week 6 are excluded from all draft scoring, recommendations, bans, picks, trends, response analysis, and combined meta calculations. Each league is evaluated independently from its latest completed competitive week back to Week 6 only. The newest completed week receives the highest weight and older eligible weeks progressively less weight. Current Asian Games data remains a separate current-event signal. If verified Week 6+ data are unavailable, the system must show INSUFFICIENT DATA instead of using pre-Week-6 or full-season totals.',
  sources:[
    {name:'MPL Philippines S18 official schedule/results',kind:'Official / schedule',url:'https://ph-mpl.com/schedule',note:'Only games played during Week 6 and later are eligible for the model. Pre-Week-6 matches are excluded.'},
    {name:'MPL Indonesia S18 official schedule/results',kind:'Official / schedule',url:'https://id-mpl.com/id/schedule',note:'Only games played during Week 6 and later are eligible for the model. Pre-Week-6 matches and full-season aggregates containing earlier weeks are not used for scoring.'},
    {name:'Asian Games 2026 current results',kind:'Current tournament',url:'https://mldb.gg/',note:'Current completed Asian Games draft results are used as a separate current-event signal.'},
    {name:'Asian Games group-stage hero report',kind:'Current tournament analysis',url:'https://tirto.id/jadwal-playoff-mlbb-asian-games-2026-bracket-link-live-streaming-hDnm',note:'Current-event hero signals are kept separate from MPL week-by-week weighting.'}
  ],
  weekRecency:{
    minEligibleWeek:6,
    excludeBeforeWeek:6,
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
  idSeason18:{},
  asianGames:{
    Nolan:{pick:9,wr:55.56},Uranus:{pick:8,wr:37.5},Atlas:{pick:7,wr:71.43},Esmeralda:{pick:7,wr:71.43},Aulus:{signal:78},Eudora:{signal:82},Obsidia:{signal:78},Belerick:{signal:80},Hirara:{signal:83},Claude:{signal:80},Barats:{signal:76},Carmilla:{signal:76}
  },
  phWeek6PriorityInference:{
    Hirara:92,Gloo:88,Lylia:84,Eudora:84,Freya:82,Paquito:86,Barats:80,Belerick:78,Atlas:78,Nolan:77,Obsidia:76,Carmilla:75,Minotaur:74,Aulus:73,Zhuxin:72
  },
  phWeek6Observed:{
    Hirara:92,Gloo:88,Lylia:84,Eudora:84,Freya:82,Paquito:86,Barats:80,Belerick:78,Atlas:78,Nolan:77,Obsidia:76,Carmilla:75,Minotaur:74,Aulus:73,Zhuxin:72
  },
  recencyComposite:{}
};