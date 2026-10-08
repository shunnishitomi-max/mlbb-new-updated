// Canonical professional match store used by the dynamic draft-intelligence engine.
// Only VERIFIED completed matches belong here. Never reconstruct missing fields.
// MPL PH / MPL ID: Week 6 through the latest completed match only.
// Asian Games: completed 2026 main-event matches only.
window.MLBB_COMPETITIVE_MATCH_DATA=window.MLBB_COMPETITIVE_MATCH_DATA||{
  updated:'2026-10-08T19:37:00+08:00',
  methodology:'Verified completed professional matches only. Missing fields remain null/unavailable and lower model confidence. Team/player identity is preserved for provenance but is not used for opponent-specific scouting in recommendation scoring.',
  eligibility:{
    'MPL PH':{minWeek:6},
    'MPL ID':{minWeek:6},
    'Asian Games 2026':{completedOnly:true}
  },
  schema:{
    id:'stable match-game identifier',
    competition:'MPL PH | MPL ID | Asian Games 2026',
    seasonOrTournament:'season/tournament name',
    weekOrStage:'week number or tournament stage',
    week:'numeric week when applicable',
    matchDate:'ISO date/time when verified',
    patch:'game patch when verified',
    teams:{blue:'team name',red:'team name'},
    gameNumber:'series game number',
    winnerSide:'Blue | Red when verified',
    actions:[
      {side:'Blue | Red',type:'ban | pick',slot:'1-5',hero:'hero name',player:'player name when pick and verified',actualRole:'EXP | JUNGLE | MID | GOLD | ROAM when pick and verified'}
    ]
  },
  competitions:{
    'MPL PH':[],
    'MPL ID':[],
    'Asian Games 2026':[]
  },
  // Verified series results without complete map drafts are kept OUT of hero-level scoring.
  // Promote a series to competitions only after every map's sides, actions and roles are verified.
  seriesResultsAwaitingDraftVerification:{
    'MPL PH':[],
    'MPL ID':[
      {
        id:'mpl-id-s18-w8-2026-10-08-evos-dewa',
        competition:'MPL ID',seasonOrTournament:'Season 18',week:8,
        matchDate:'2026-10-08',teams:['EVOS','Dewa United Esports'],
        seriesScore:{EVOS:2,'Dewa United Esports':1},
        gameWinners:['Dewa United Esports','EVOS','EVOS'],
        draftVerification:'PENDING',
        unavailableFields:['exact picks','all bans','chronological draft positions','blue/red sides','player-to-hero assignments','actual roles','flex-role usage'],
        eligibleForHeroStatistics:false,
        sources:[
          'https://www.topik.id/evos-tumbangkan-dewa-united-2-1-di-week-8-mpl-id-season-18-rrq-hoshi-makin-tertekan-di-klasemen',
          'https://bo3.gg/mlbb/teams/evos/matches'
        ]
      }
    ]
  },
  notes:[
    'Do not add Weeks 1-5 MPL data.',
    'Do not infer player, role, result, patch, date, or action order when it cannot be verified.',
    'Team and player fields are retained for provenance only; the live coach remains team-neutral.',
    'Combined calculations are produced dynamically with competition, recency, patch and sample-confidence weighting rather than raw-total merging.'
  ]
};