// Verified chronological draft-sequence dataset.
// Populate only from match-level Week 6+ MPL PH / MPL ID drafts and current Asian Games drafts.
// Team and player identities are intentionally omitted from the scoring schema.
// Never add reconstructed or assumed actions as professional evidence.
window.MLBB_SEQUENCE_DATA=window.MLBB_SEQUENCE_DATA||{
  updated:'2026-10-01T13:46:00+08:00',
  methodology:'Chronological, team-neutral draft actions only. MPL PH and MPL ID matches before Week 6 are excluded. Asian Games uses the current main-event window. Conditional frequencies require observed match-level sequences; missing samples must be labeled INSUFFICIENT DATA.',
  minEligibleWeek:6,
  matches:[],
  notes:[
    'Each match record should contain competition, week or stage/date, and actions in exact draft order.',
    'Action format: {side:"Blue"|"Red", type:"ban"|"pick", hero:"Hero Name"}.',
    'Team names, player names, comfort pools and opponent-specific tendencies are not used by the sequence model.',
    'Transcript-derived strategic examples are methodology references only and are excluded from professional frequency calculations unless independently verified as chronological match data.'
  ]
};