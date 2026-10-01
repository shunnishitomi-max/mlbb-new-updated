// Deep professional banning layer.
// Team-neutral and Week 6+ only. First-phase bans shape the power-pick/flex pool;
// second-phase bans protect revealed picks, attack remaining roles, break synergy,
// and exploit role scarcity. No opponent/team/player identity is used.
(function(){
  function bdEnemy(side){return side==='Blue'?'Red':'Blue'}
  function bdBanNumber(step){return step?.type==='ban'?sideBans(step.side).length+1:null}
  function bdPhase(){return (picks('Blue').length+picks('Red').length)<6?'FIRST BAN PHASE':'SECOND BAN PHASE'}
  function bdAvailable(exclude=[]){const blocked=new Set([...usedNames(),...exclude]);return