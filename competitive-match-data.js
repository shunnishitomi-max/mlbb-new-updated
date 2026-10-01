// Canonical professional match store used by the dynamic draft-intelligence engine.
// Only VERIFIED completed matches belong here. Never reconstruct missing fields.
// MPL PH / MPL ID: Week 6 through the latest completed match only.
// Asian Games: completed 2026 main-event matches only.
window.MLBB_COMPETITIVE_MATCH_DATA=window.MLBB_COMPETITIVE_MATCH_DATA||{
  updated:'2026-10-01T13:46:00+08:00',
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
  notes:[
    'Do not add Weeks 1-5 MPL data.',
    'Do not infer player, role, result, patch, date, or action order when it cannot be verified.',
    'Team and player fields are retained for provenance only; the live coach remains team-neutral.',
    'Combined calculations are produced dynamically with competition, recency, patch and sample-confidence weighting rather than raw-total merging.'
  ]
};