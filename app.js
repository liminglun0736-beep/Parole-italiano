const PAGE_BASE=new URL('.',document.currentScript?.src || globalThis.location?.href || 'https://localhost/').pathname;
const $=id=>document.getElementById(id),KEY=PAGE_BASE==='/'?'parola-v1':'parola-v1:'+PAGE_BASE,intervals=[10/1440,1,2,4,7,15,30,60],day=()=>PlanCore.dateKey();
let state={progress:{},custom:[],daily:{}},level='all',current=null,flipped=false,limit=100;
const store=ParolaStore.create(KEY);
let ready=false,busy=false,dirty=false,saveVersion=0;
const levelName=l=>l==='ungraded'?'未分级':l==='all'?'全部等级':l;
const copyState=s=>({...JSON.parse(JSON.stringify({...s,custom:undefined})),custom:s.custom});
const id=PlanCore.wordId,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let words=[];function rebuild(){words=[...new Map([...SEED,...DICTIONARY_SEED,...state.custom].map(w=>[id(w),w])).values()];$('sourceSummary').textContent=`已收录 ${words.length.toLocaleString()} 个词条与表达；支持 A1–B2 与未分级词库。导入词库仅保存到当前浏览器。`}
function toast(t){$('toast').textContent=t;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',3500)}
function storageMessage(text){$('storageStatus').textContent=text}
function save(next=state){dirty=true;const version=++saveVersion;storageMessage('正在保存到当前浏览器…');return store.save(next).then(()=>{if(version===saveVersion){dirty=false;storageMessage('')}}).catch(error=>{storageMessage('保存失败：'+error.message+'。请保持页面打开并导出备份。');throw error})}
async function mutate(action){if(!ready||busy)return null;busy=true;const previous=state;state=copyState(state);try{const result=action();await save();return {value:result}}catch(e){state=previous;dirty=false;toast('未保存，本次操作已撤回：'+e.message);return null}finally{busy=false}}

function stats(){renderDaily();const ps=Object.values(state.progress);$('due').textContent=words.filter(w=>state.progress[id(w)]?.due<=Date.now()).length;$('seen').textContent=words.filter(w=>state.progress[id(w)]).length;$('today').textContent=state.daily[day()]||0;$('total').textContent=`共 ${words.length} 个词条与表达`;$('master').innerHTML=ps.filter(p=>p.stage>=5).length+'<small> 词</small>'}
function pick(){
  if(!ready||busy)return;
  const daily=PlanCore.metrics(state,words),smart=$('mode').value==='smart';
  const scope=smart?daily.day.settings.level:level;
  const pool=words.filter(w=>scope==='all'||w.level===scope),now=Date.now();let items=pool;
  if(smart){const due=pool.filter(w=>state.progress[id(w)]?.due<=now);items=due.length?due:daily.newDone<daily.newTarget?pool.filter(w=>!state.progress[id(w)]):[]}
  if(items.length>1)items=items.filter(w=>id(w)!==id(current||{}));
  if(!items.length){current=null;$('word').textContent=pool.length?'今天，做得很好。':'这个等级还没有词条';$('badge').textContent=levelName(scope);$('unit').textContent='UN PASSO AVANTI';$('hint').hidden=false;$('hint').textContent=pool.length?'新词任务已完成，暂时没有到期词。可稍后复习，或切换随机模式继续练习。':'在「我的词库」查看范围或导入词条。';$('answer').hidden=true;$('editMeaning').hidden=true;$('dictLink').hidden=true;$('reveal').hidden=true;$('ratings').hidden=true;$('speak').disabled=true;stats();return}
  const weighted=items.map(w=>{const p=state.progress[id(w)];return {w,v:1+Math.min(8,p?.lapses||0)+(p&&p.due<=now?3:0)}});let r=Math.random()*weighted.reduce((a,x)=>a+x.v,0);current=weighted.find(x=>(r-=x.v)<0)?.w||items[0];flipped=false;
  $('editMeaning').hidden=true;$('dictLink').hidden=true;$('word').textContent=current.word;$('badge').textContent=levelName(current.level)+' · '+current.book;$('unit').textContent=current.unit?(/^\d+$/.test(current.unit)?'第 '+current.unit+' 单元':current.unit):'词汇练习';$('hint').textContent='先在心里回想，再揭开答案';$('hint').hidden=false;$('answer').textContent=current.meaning||'此词暂无释义，可编辑补充。';$('answer').hidden=true;$('reveal').hidden=false;$('ratings').hidden=true;$('speak').disabled=false;stats();
}
function reveal(){if(!ready||busy||!current)return;flipped=true;const sourceUrl=safeUrl(current.dictionaryUrl)||safeUrl(current.source);$('dictLink').href=sourceUrl;$('dictLink').textContent=current.book.includes('Espresso')?'教材来源 ↗':'词典来源 ↗';$('dictLink').hidden=!sourceUrl;$('editMeaning').hidden=false;$('hint').hidden=true;$('answer').hidden=false;$('reveal').hidden=true;$('ratings').hidden=false;const p=state.progress[id(current)]||{stage:0};document.querySelectorAll('[data-grade] small').forEach((el,g)=>{const s=nextStage(p.stage,g),minutes=g===0?10:Math.round(intervals[s]*1440*(g===1?.5:1));el.textContent=minutes<60?minutes+' 分钟':minutes<1440?Math.round(minutes/60)+' 小时':Math.round(minutes/1440)+' 天'})}
function nextStage(stage,g){return g===0?0:g===1?Math.max(1,stage-1):Math.min(7,stage+(g===3?2:1))}
async function grade(g){
  if(!ready||busy||!current||!flipped)return;
  const result=await mutate(()=>{
    const now=Date.now();PlanCore.ensureDay(state,words,now);
    const key=id(current),isNew=!state.progress[key],p=state.progress[key]||{stage:0,lapses:0,reviews:0};
    p.stage=nextStage(p.stage,g);p.due=now+(g===0?600000:intervals[p.stage]*86400000*(g===1?.5:1));p.lapses+=g===0?1:0;p.reviews++;state.progress[key]=p;
    state.daily[day()]=(state.daily[day()]||0)+1;
    return PlanCore.record(state,words,current,isNew,now);
  });
  if(result?.value)toast('今日计划完成，打卡成功！');
  stats();if(result)pick();
}

function view(v){document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==v);document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));if(v==='library')library();if(v==='plan'){syncSettings();renderCalendar()}}
function library(){const q=$('search').value.toLowerCase(),l=$('libLevel').value,filtered=words.filter(w=>(l==='all'||w.level===l)&&[w.word,w.meaning,w.book,w.unit].join(' ').toLowerCase().includes(q));$('count').textContent=`共 ${filtered.length} 个词条 · 当前显示 ${Math.min(limit,filtered.length)} 个`;$('rows').innerHTML=filtered.slice(0,limit).map(w=>{const p=state.progress[id(w)];return `<tr><td>${esc(w.word)}<small>${esc(w.book)}</small>${safeUrl(w.dictionaryUrl||w.source)?`<a class="source-link" href="${esc(safeUrl(w.dictionaryUrl||w.source))}" target="_blank" rel="noopener">查看来源 ↗</a>`:''}</td><td><div class="definition-preview">${esc(w.meaning||'待补充')}</div></td><td>${esc(levelName(w.level))} · ${esc(w.unit||'—')}</td><td>${p?(p.due<=Date.now()?'等待复习':new Date(p.due).toLocaleDateString('zh-CN')+' 复习'):'尚未学习'}</td></tr>`}).join('');$('more').hidden=limit>=filtered.length}
function csv(text){let rows=[],row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}if(quoted)throw Error('CSV 引号未闭合');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);const head=rows.shift()?.map(x=>x.trim().replace(/^\uFEFF/,''));if(!head?.includes('word')||!head.includes('meaning')||!head.includes('level'))throw Error('CSV 需要 word、meaning、level 表头');return rows.map(r=>Object.fromEntries(head.map((k,i)=>[k,r[i]||''])))}
function validate(arr,maximum=30000){
  if(!Array.isArray(arr)||!arr.length)throw Error('未找到词条数组');if(arr.length>maximum)throw Error(`此文件最多支持 ${maximum.toLocaleString()} 个词条`);
  return arr.map((w,i)=>{
    if(!w||typeof w.word!=='string'||!w.word.trim()||typeof w.meaning!=='string'||!['A1','A2','B1','B2','ungraded'].includes(w.level))throw Error(`第 ${i+1} 条缺少单词、释义或有效等级（含 ungraded）`);
    const item={word:w.word.trim(),meaning:w.meaning,level:w.level};
    for(const field of ['unit','book','source','translation','dictionaryUrl','referenceEnglish','pos','ipa','license'])item[field]=String(w[field]??'');
    item.book=item.book||'自选教材';item.source=item.source||'用户导入';item.translation=item.translation||'用户提供释义';return item;
  });
}

function prepareImport(data){
  const next=copyState(state);let arr;
  if(data.format==='parola-v1'||data.format==='parola-v2'){
    arr=validate(data.words,500000);
    if(!data.progress||typeof data.progress!=='object'||Array.isArray(data.progress))throw Error('备份格式无效');
    for(const p of Object.values(data.progress))if(!p||!Number.isInteger(p.stage)||p.stage<0||p.stage>7||!Number.isFinite(p.due)||!Number.isInteger(p.lapses)||p.lapses<0||!Number.isInteger(p.reviews)||p.reviews<0)throw Error('复习记录格式无效');
    next.progress={...next.progress,...data.progress};
    for(const [k,v]of Object.entries(data.daily||{}))if(/^\d{4}-\d{2}-\d{2}$/.test(k)&&Number.isInteger(v)&&v>=0)next.daily[k]=Math.max(next.daily[k]||0,v);
    if(data.format==='parola-v2'){
      if(!PlanCore.validSettings(data.settings))throw Error('每日目标格式无效');
      next.settings={...data.settings};
      const restored=PlanCore.validateDays(data.studyDays);
      for(const [k,d]of Object.entries(restored)){const old=next.studyDays[k];next.studyDays[k]=old?{...d,newIds:[...new Set([...old.newIds,...d.newIds])],reviewedIds:[...new Set([...old.reviewedIds,...d.reviewedIds])],dueAtStart:[...new Set([...old.dueAtStart,...d.dueAtStart])],attempts:Math.max(old.attempts,d.attempts),checkedAt:old.checkedAt||d.checkedAt}:d}
    }
  }else arr=validate(data);
  next.custom=[...new Map([...next.custom,...arr].map(w=>[id(w),w])).values()];
  return {state:next,count:arr.length};
}
$('doImport').onclick=async()=>{
  if(!ready||busy)return;busy=true;$('doImport').disabled=true;$('importStatus').textContent='正在读取、校验并保存词库，请勿关闭页面…';
  try{
    const file=$('file').files[0];if(file&&file.size>268435456)throw Error('完整备份请小于 256 MB');const text=file?await file.text():$('paste').value;
    const bytes=new Blob([text]).size;if(bytes>268435456)throw Error('完整备份请小于 256 MB');
    const data=/^[\s\uFEFF]*[\[{]/.test(text)?JSON.parse(text.replace(/^\uFEFF/,'')):csv(text);
    const backup=data?.format==='parola-v1'||data?.format==='parola-v2';if(!backup&&bytes>20000000)throw Error('普通词表请按每批 20 MB 以内导入');
    const result=prepareImport(data);await save(result.state);
    state=result.state;level=state.settings.level;rebuild();busy=false;syncSettings();stats();library();pick();$('importDialog').close();toast(`已保存 ${result.count.toLocaleString()} 个词条，记录已合并。`)
  }catch(e){dirty=false;$('importStatus').textContent='导入未完成：'+e.message+'；原词库和进度未改变。'}finally{busy=false;$('doImport').disabled=false}
};

$('backup').onclick=()=>{if(!ready)return;const blob=new Blob([JSON.stringify({format:'parola-v2',words,progress:state.progress,daily:state.daily,settings:state.settings,studyDays:state.studyDays},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='parola-'+day()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('importBtn').onclick=()=>{if(!ready||busy)return;$('importStatus').textContent='';$('importDialog').showModal()};$('closeImport').onclick=()=>$('importDialog').close();document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>view(b.dataset.view));$('libraryLink').onclick=()=>view('library');$('planLink').onclick=e=>{e.preventDefault();view('plan')};$('levels').onclick=e=>{if(!ready||busy)return;const b=e.target.closest('[data-level]');if(!b)return;level=b.dataset.level;if($('mode').value==='smart'){toast('间隔复习跟随每日计划。可在「记忆计划」调整范围，或切换随机模式自由选级。');level=PlanCore.ensureDay(state,words).settings.level}renderFilterState();pick()};$('mode').onchange=()=>{if(!ready||busy)return;renderFilterState();pick()};$('reveal').onclick=reveal;document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>grade(+b.dataset.grade));$('speak').onclick=()=>{if(!current)return;if(!('speechSynthesis'in window)){toast('当前浏览器不支持朗读');return}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(current.word);u.lang='it-IT';u.rate=.85;speechSynthesis.speak(u)};document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName)||$('importDialog').open||$('learn').hidden)return;if(e.code==='Space'||e.key==='Enter'){e.preventDefault();reveal()}else if(/^[1-4]$/.test(e.key))grade(+e.key-1)});$('search').oninput=()=>{limit=100;library()};$('libLevel').onchange=()=>{limit=100;library()};$('more').onclick=()=>{limit+=100;library()};$('date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});$('timeline').innerHTML=['10 分钟','1 天','2 天','4 天','7 天','15 天','30 天','60 天'].map(x=>'<span>'+x+'</span>').join('');$('sources').innerHTML=[...SOURCES.filter(x=>['A1','A2'].includes(x.level)),...DICTIONARY_SOURCES].map(s=>`<article><strong>${esc(s.book)} · ${esc(s.level)}</strong><br>${esc(s.status)}<br><a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">查看来源与说明 ↗</a></article>`).join('');


$('editMeaning').onclick=async()=>{if(!ready||busy||!current)return;const meaning=prompt('编辑中文参考释义（保存到当前浏览器）',current.meaning);if(meaning===null)return;const edited={...current,meaning:meaning.trim()};const result=await mutate(()=>{state.custom=[...state.custom.filter(w=>id(w)!==id(edited)),edited]});if(result){current=edited;rebuild();$('answer').textContent=current.meaning||'暂无释义'}};


function safeUrl(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
let calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1,12);
let activeDate=day();
function renderFilterState(){const active=$('mode').value==='smart'?PlanCore.ensureDay(state,words).settings.level:level;document.querySelectorAll('[data-level]').forEach(b=>b.classList.toggle('chosen',b.dataset.level===active))}
function renderDaily(){
  const m=PlanCore.metrics(state,words),d=m.day;
  $('dailyScope').textContent=levelName(d.settings.level)+' · 每天 '+d.settings.newGoal+' 个新词';
  $('dailyCounts').textContent=`新词 ${m.newDone} / ${m.newTarget}　复习 ${m.reviewDone} / ${m.reviewTarget}`;
  $('dailyPercent').textContent=m.percent+'%';$('dailyBar').value=m.percent;
  $('dailyRemaining').textContent=d.checkedAt?'今日已打卡，继续练习也会保存进度。':m.total?`还需 ${Math.max(0,m.newTarget-m.newDone)} 个新词、${m.reviewTarget-m.reviewDone} 个到期旧词。`:'暂无计划任务；在计划等级内随机练习一次即可打卡。';
  $('checkIn').textContent=d.checkedAt?'✓ 今日已打卡':m.complete?'立即打卡':'完成计划后打卡';$('checkIn').disabled=!!d.checkedAt;
  $('streak').innerHTML=PlanCore.streak(state)+' <small>天</small>';$('checkinTotal').innerHTML=Object.values(state.studyDays).filter(d=>d.checkedAt).length+' <small>天</small>';
  if(!$('plan').hidden)renderCalendar();
}
function syncSettings(){$('newGoal').value=state.settings.newGoal;$('planLevel').value=state.settings.level;estimate()}
function estimate(){const n=Number($('newGoal').value),l=$('planLevel').value,pool=words.filter(w=>l==='all'||w.level===l),remaining=pool.filter(w=>!state.progress[id(w)]).length;document.querySelectorAll('[data-goal]').forEach(b=>b.classList.toggle('selected',+b.dataset.goal===n));$('planEstimate').textContent=n>=5&&n<=200?`此范围还有 ${remaining} 个新词；按每天 ${n} 个，约 ${Math.ceil(remaining/n)} 天完成初次学习（另需持续复习）。`:'请输入 5–200 之间的整数。'}
function renderCalendar(){const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),offset=(new Date(y,m,1).getDay()+6)%7,count=new Date(y,m+1,0).getDate(),today=day();$('calendarTitle').textContent=`${y} 年 ${m+1} 月`;let html='<span></span>'.repeat(offset);for(let n=1;n<=count;n++){const key=PlanCore.dateKey(new Date(y,m,n,12)),checked=state.studyDays[key]?.checkedAt;html+=`<span class="${checked?'checked ':''}${key===today?'is-today ':''}${key>today?'future':''}" title="${key} ${checked?'已打卡':'未打卡'}" aria-label="${key} ${checked?'已打卡':'未打卡'}">${n}</span>`}$('calendar').innerHTML=html;}
$('planForm').onsubmit=async e=>{e.preventDefault();const result=await mutate(()=>{const settings={newGoal:Number($('newGoal').value),level:$('planLevel').value};const applies=PlanCore.changeSettings(state,settings,words);return {applies,checked:PlanCore.check(state,words)}});if(result){level=PlanCore.ensureDay(state,words).settings.level;renderFilterState();stats();pick();$('planStatus').textContent=result.value.applies==='tomorrow'?'已保存，明天起生效；今日打卡已保留。':'已保存，今日计划已更新。';if(result.value.checked)toast('今日计划完成，打卡成功！')}else $('planStatus').textContent='设置未保存，请检查输入或本地存储状态。'};
$('editPlan').onclick=()=>view('plan');$('checkIn').onclick=async()=>{const result=await mutate(()=>PlanCore.check(state,words));if(result){stats();toast(result.value?'打卡成功！':'完成今日新词和复习任务后，会自动打卡。')}};

$('newGoal').oninput=estimate;$('planLevel').onchange=estimate;document.querySelectorAll('[data-goal]').forEach(b=>b.onclick=()=>{$('newGoal').value=b.dataset.goal;estimate()});
$('prevMonth').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1,12);renderCalendar()};$('nextMonth').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1,12);renderCalendar()};
async function refreshDay(){if(!ready||busy)return;if(day()!==activeDate){const result=await mutate(()=>{PlanCore.ensureDay(state,words)});if(!result)return;activeDate=day();level=state.settings.level;renderFilterState();syncSettings();pick();$('date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}else {stats();if(!current&&words.some(w=>state.progress[id(w)]?.due<=Date.now()))pick()}}
setInterval(refreshDay,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDay()});
globalThis.addEventListener?.('beforeunload',e=>{if(store.pending()||dirty){e.preventDefault();e.returnValue=''}});
const appReady=(async()=>{
  document.body?.setAttribute('data-loading','true');
  try{
    const loaded=await store.load();if(loaded)state=loaded;
    PlanCore.migrate(state);level=state.settings.level;rebuild();PlanCore.ensureDay(state,words);await save();
    ready=true;syncSettings();renderFilterState();stats();pick();
    $('sourceSummary').textContent=`已收录 ${words.length.toLocaleString()} 个词条与表达；支持 A1–B2 与未分级词库。导入词库仅保存到当前浏览器。`;
  }catch(e){storageMessage('本地数据加载失败，原数据已保留：'+e.message+'。请关闭其他页面或检查浏览器存储设置后刷新。')}
  finally{document.body?.setAttribute('data-loading',ready?'false':'true')}
})();
