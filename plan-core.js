/* Local calendar dates; no UTC day boundaries. */
const PlanCore = (() => {
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const previousDate = key => { const [y,m,d]=key.split('-').map(Number); return dateKey(new Date(y,m-1,d-1,12)); };
  const wordId = w => [w.book,w.level,w.word].join('|');
  const defaults = {newGoal:20,level:'A1'};
  const validSettings = s => s && Number.isInteger(s.newGoal) && s.newGoal>=5 && s.newGoal<=200 && ['all','A1','A2','B1','B2'].includes(s.level);
  function migrate(state) {
    state.settings=validSettings(state.settings)?state.settings:{...defaults};
    state.studyDays=state.studyDays && typeof state.studyDays==='object'&&!Array.isArray(state.studyDays)?state.studyDays:{};
    return state;
  }
  function ensureDay(state,words,now=Date.now()) {
    const key=dateKey(new Date(now));
    if(!state.studyDays[key]) state.studyDays[key]={newIds:[],reviewedIds:[],dueAtStart:words.filter(w=>state.progress[wordId(w)]?.due<=now).map(wordId),attempts:0,settings:{...state.settings},checkedAt:null};
    return state.studyDays[key];
  }
  function metrics(state,words,now=Date.now()) {
    const d=ensureDay(state,words,now), scope=words.filter(w=>d.settings.level==='all'||w.level===d.settings.level),ids=new Set(scope.map(wordId));
    const newDone=d.newIds.filter(k=>ids.has(k)).length;
    const newTarget=Math.min(d.settings.newGoal,scope.filter(w=>!state.progress[wordId(w)]).length+newDone);
    const reviewIds=d.dueAtStart.filter(k=>ids.has(k)),reviewDone=reviewIds.filter(k=>d.reviewedIds.includes(k)).length;
    const total=newTarget+reviewIds.length,done=Math.min(newDone,newTarget)+reviewDone;
    return {newDone,newTarget,reviewDone,reviewTarget:reviewIds.length,done,total,percent:total?Math.min(100,Math.round(done/total*100)):0,complete:newDone>=newTarget&&reviewDone>=reviewIds.length&&[...d.newIds,...d.reviewedIds].some(k=>ids.has(k)),scope,day:d};
  }
  function record(state,words,w,isNew,now=Date.now()) {
    const d=ensureDay(state,words,now),key=wordId(w);d.attempts++;
    if(isNew&&!d.newIds.includes(key))d.newIds.push(key);
    if(!isNew&&!d.reviewedIds.includes(key))d.reviewedIds.push(key);
    return check(state,words,now);
  }
  function check(state,words,now=Date.now()) {const m=metrics(state,words,now);if(m.complete&&!m.day.checkedAt){m.day.checkedAt=now;return true}return false}
  function changeSettings(state,settings,words,now=Date.now()) {if(!validSettings(settings))throw Error('每天新词数量须为 5–200 个');state.settings={...settings};const d=ensureDay(state,words,now);if(!d.checkedAt)d.settings={...settings};return d.checkedAt?'tomorrow':'today'}
  function streak(state,now=Date.now()) {let k=dateKey(new Date(now)),n=0;if(!state.studyDays[k]?.checkedAt)k=previousDate(k);while(state.studyDays[k]?.checkedAt){n++;k=previousDate(k)}return n}
  function validateDays(days) {
    if(!days||typeof days!=='object'||Array.isArray(days))throw Error('打卡备份格式无效');
    const clean={};for(const [k,d] of Object.entries(days)){const [y,m,n]=k.split('-').map(Number);if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||dateKey(new Date(y,m-1,n,12))!==k||!d||!validSettings(d.settings)||!Number.isInteger(d.attempts)||d.attempts<0||!(d.checkedAt===null||(Number.isFinite(d.checkedAt)&&d.checkedAt>0)))throw Error('每日计划记录无效');
      for(const field of ['newIds','reviewedIds','dueAtStart'])if(!Array.isArray(d[field])||d[field].some(x=>typeof x!=='string')||d[field].length>30000)throw Error('每日词条记录无效');
      clean[k]={...d,newIds:[...new Set(d.newIds)],reviewedIds:[...new Set(d.reviewedIds)],dueAtStart:[...new Set(d.dueAtStart)]};
    }return clean;
  }
  return {dateKey,previousDate,wordId,validSettings,migrate,ensureDay,metrics,record,check,changeSettings,streak,validateDays};
})();
