const PAGE_BASE=new URL('.',document.currentScript?.src || globalThis.location?.href || 'https://localhost/').pathname;
const $=id=>document.getElementById(id),KEY=PAGE_BASE==='/'?'parola-v1':'parola-v1:'+PAGE_BASE,intervals=[10/1440,1,2,4,7,15,30,60],day=()=>PlanCore.dateKey();
let state={progress:{},custom:[],daily:{}},level='all',current=null,flipped=false,limit=100;
try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.progress&&Array.isArray(s.custom)&&s.daily)state=s}catch(e){}
PlanCore.migrate(state);
level=state.settings.level;
const id=PlanCore.wordId,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let words=[];function rebuild(){words=[...new Map([...SEED,...DICTIONARY_SEED,...state.custom].map(w=>[id(w),w])).values()]}
function toast(t){$('toast').textContent=t;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',3500)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){toast('浏览器无法保存，请导出备份以免丢失进度。')}}
function stats(){renderDaily();const ps=Object.values(state.progress);$('due').textContent=words.filter(w=>state.progress[id(w)]?.due<=Date.now()).length;$('seen').textContent=words.filter(w=>state.progress[id(w)]).length;$('today').textContent=state.daily[day()]||0;$('total').textContent=`共 ${words.length} 个词条与表达`;$('master').innerHTML=ps.filter(p=>p.stage>=5).length+'<small> 词</small>'}
function pick(){
  const daily=PlanCore.metrics(state,words),smart=$('mode').value==='smart';
  const scope=smart?daily.day.settings.level:level;
  const pool=words.filter(w=>scope==='all'||w.level===scope),now=Date.now();let items=pool;
  if(smart){const due=pool.filter(w=>state.progress[id(w)]?.due<=now);items=due.length?due:daily.newDone<daily.newTarget?pool.filter(w=>!state.progress[id(w)]):[]}
  if(items.length>1)items=items.filter(w=>id(w)!==id(current||{}));
  if(!items.length){current=null;$('word').textContent=pool.length?'今天，做得很好。':'这个等级还没有词条';$('badge').textContent=scope==='all'?'A1–B2':scope;$('unit').textContent='UN PASSO AVANTI';$('hint').hidden=false;$('hint').textContent=pool.length?'新词任务已完成，暂时没有到期词。可稍后复习，或切换随机模式继续练习。':'在「我的词库」查看范围或导入词条。';$('answer').hidden=true;$('editMeaning').hidden=true;$('dictLink').hidden=true;$('reveal').hidden=true;$('ratings').hidden=true;$('speak').disabled=true;stats();save();return}
  const weighted=items.map(w=>{const p=state.progress[id(w)];return {w,v:1+Math.min(8,p?.lapses||0)+(p&&p.due<=now?3:0)}});let r=Math.random()*weighted.reduce((a,x)=>a+x.v,0);current=weighted.find(x=>(r-=x.v)<0)?.w||items[0];flipped=false;
  $('editMeaning').hidden=true;$('dictLink').hidden=true;$('word').textContent=current.word;$('badge').textContent=current.level+' · '+current.book;$('unit').textContent=current.unit?(/^\d+$/.test(current.unit)?'第 '+current.unit+' 单元':current.unit):'词汇练习';$('hint').textContent='先在心里回想，再揭开答案';$('hint').hidden=false;$('answer').textContent=current.meaning||'此词暂无释义，可编辑补充。';$('answer').hidden=true;$('reveal').hidden=false;$('ratings').hidden=true;$('speak').disabled=false;stats();save();
}
function reveal(){if(!current)return;flipped=true;$('dictLink').href=safeUrl(current.dictionaryUrl)||safeUrl(current.source)||'https://en.wiktionary.org/wiki/'+encodeURIComponent(current.word)+'#Italian';$('dictLink').textContent=current.book.includes('Espresso')?'教材来源 ↗':'词典来源 ↗';$('dictLink').hidden=false;$('editMeaning').hidden=false;$('hint').hidden=true;$('answer').hidden=false;$('reveal').hidden=true;$('ratings').hidden=false;const p=state.progress[id(current)]||{stage:0};document.querySelectorAll('[data-grade] small').forEach((el,g)=>{const s=nextStage(p.stage,g),minutes=g===0?10:Math.round(intervals[s]*1440*(g===1?.5:1));el.textContent=minutes<60?minutes+' 分钟':minutes<1440?Math.round(minutes/60)+' 小时':Math.round(minutes/1440)+' 天'})}
function nextStage(stage,g){return g===0?0:g===1?Math.max(1,stage-1):Math.min(7,stage+(g===3?2:1))}
function grade(g){
  if(!current||!flipped)return;
  const now=Date.now();PlanCore.ensureDay(state,words,now);
  const key=id(current),isNew=!state.progress[key],p=state.progress[key]||{stage:0,lapses:0,reviews:0};
  p.stage=nextStage(p.stage,g);p.due=now+(g===0?600000:intervals[p.stage]*86400000*(g===1?.5:1));p.lapses+=g===0?1:0;p.reviews++;state.progress[key]=p;
  state.daily[day()]=(state.daily[day()]||0)+1;
  if(PlanCore.record(state,words,current,isNew,now))toast('今日计划完成，打卡成功！');
  save();stats();pick();
}
function view(v){document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==v);document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));if(v==='library')library();if(v==='plan'){syncSettings();renderCalendar()}}
function library(){const q=$('search').value.toLowerCase(),l=$('libLevel').value,filtered=words.filter(w=>(l==='all'||w.level===l)&&[w.word,w.meaning,w.book,w.unit].join(' ').toLowerCase().includes(q));$('count').textContent=`共 ${filtered.length} 个词条 · 当前显示 ${Math.min(limit,filtered.length)} 个`;$('rows').innerHTML=filtered.slice(0,limit).map(w=>{const p=state.progress[id(w)];return `<tr><td>${esc(w.word)}<small>${esc(w.book)}</small>${safeUrl(w.dictionaryUrl||w.source)?`<a class="source-link" href="${esc(safeUrl(w.dictionaryUrl||w.source))}" target="_blank" rel="noopener">查看来源 ↗</a>`:''}</td><td>${esc(w.meaning||'待补充')}</td><td>${esc(w.level)} · ${esc(w.unit||'—')}</td><td>${p?(p.due<=Date.now()?'等待复习':new Date(p.due).toLocaleDateString('zh-CN')+' 复习'):'尚未学习'}</td></tr>`}).join('');$('more').hidden=limit>=filtered.length}
function csv(text){let rows=[],row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}if(quoted)throw Error('CSV 引号未闭合');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);const head=rows.shift()?.map(x=>x.trim().replace(/^\uFEFF/,''));if(!head?.includes('word')||!head.includes('meaning')||!head.includes('level'))throw Error('CSV 需要 word、meaning、level 表头');return rows.map(r=>Object.fromEntries(head.map((k,i)=>[k,r[i]||''])))}
function validate(arr){if(!Array.isArray(arr)||!arr.length)throw Error('未找到词条数组');if(arr.length>30000)throw Error('单次最多导入 30000 个词条');return arr.map((w,i)=>{if(typeof w.word!=='string'||!w.word.trim()||typeof w.meaning!=='string'||!['A1','A2','B1','B2'].includes(w.level))throw Error(`第 ${i+1} 条缺少单词、释义或有效等级`);return {word:w.word.trim().slice(0,300),meaning:w.meaning.slice(0,2000),level:w.level,unit:String(w.unit||'').slice(0,100),book:String(w.book||'自选教材').slice(0,120),source:String(w.source||'用户导入').slice(0,1000),translation:String(w.translation||'用户提供释义').slice(0,500),dictionaryUrl:String(w.dictionaryUrl||'').slice(0,1000),referenceEnglish:String(w.referenceEnglish||'').slice(0,2000),pos:String(w.pos||'').slice(0,100),ipa:String(w.ipa||'').slice(0,200),license:String(w.license||'').slice(0,200)}})}
function prepareImport(data){
  const next=JSON.parse(JSON.stringify(state));let arr;
  if(data.format==='parola-v1'||data.format==='parola-v2'){
    arr=validate(data.words);
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
$('doImport').onclick=async()=>{try{
  const file=$('file').files[0];if(file&&file.size>20000000)throw Error('文件请小于 20 MB');const text=file?await file.text():$('paste').value;
  const data=/^[\s\uFEFF]*[\[{]/.test(text)?JSON.parse(text.replace(/^\uFEFF/,'')):csv(text),result=prepareImport(data);
  state=result.state;level=state.settings.level;rebuild();syncSettings();save();stats();library();pick();$('importDialog').close();toast(`已导入 ${result.count} 个词条，进度和打卡记录已合并。`)
}catch(e){$('importStatus').textContent=e.message}};

$('backup').onclick=()=>{const blob=new Blob([JSON.stringify({format:'parola-v2',words,progress:state.progress,daily:state.daily,settings:state.settings,studyDays:state.studyDays},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='parola-'+day()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('importBtn').onclick=()=>{$('importStatus').textContent='';$('importDialog').showModal()};$('closeImport').onclick=()=>$('importDialog').close();document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>view(b.dataset.view));$('libraryLink').onclick=()=>view('library');$('planLink').onclick=e=>{e.preventDefault();view('plan')};$('levels').onclick=e=>{const b=e.target.closest('[data-level]');if(!b)return;level=b.dataset.level;if($('mode').value==='smart'){toast('间隔复习跟随每日计划。可在「记忆计划」调整范围，或切换随机模式自由选级。');level=PlanCore.ensureDay(state,words).settings.level}renderFilterState();pick()};$('mode').onchange=()=>{renderFilterState();pick()};$('reveal').onclick=reveal;document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>grade(+b.dataset.grade));$('speak').onclick=()=>{if(!current)return;if(!('speechSynthesis'in window)){toast('当前浏览器不支持朗读');return}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(current.word);u.lang='it-IT';u.rate=.85;speechSynthesis.speak(u)};document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName)||$('importDialog').open||$('learn').hidden)return;if(e.code==='Space'||e.key==='Enter'){e.preventDefault();reveal()}else if(/^[1-4]$/.test(e.key))grade(+e.key-1)});$('search').oninput=()=>{limit=100;library()};$('libLevel').onchange=()=>{limit=100;library()};$('more').onclick=()=>{limit+=100;library()};$('date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});$('timeline').innerHTML=['10 分钟','1 天','2 天','4 天','7 天','15 天','30 天','60 天'].map(x=>'<span>'+x+'</span>').join('');$('sources').innerHTML=[...SOURCES.filter(x=>['A1','A2'].includes(x.level)),...DICTIONARY_SOURCES].map(s=>`<article><strong>${esc(s.book)} · ${esc(s.level)}</strong><br>${esc(s.status)}<br><a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">查看来源与说明 ↗</a></article>`).join('');


$('editMeaning').onclick=()=>{if(!current)return;const meaning=prompt('编辑中文参考释义（保存到当前浏览器）',current.meaning);if(meaning===null)return;current={...current,meaning:meaning.trim()};state.custom=[...state.custom.filter(w=>id(w)!==id(current)),current];rebuild();save();$('answer').textContent=current.meaning||'暂无释义'};

function safeUrl(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
let calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1,12);
let activeDate=day();
function renderFilterState(){const active=$('mode').value==='smart'?PlanCore.ensureDay(state,words).settings.level:level;document.querySelectorAll('[data-level]').forEach(b=>b.classList.toggle('chosen',b.dataset.level===active))}
function renderDaily(){
  const m=PlanCore.metrics(state,words),d=m.day;
  $('dailyScope').textContent=(d.settings.level==='all'?'A1–B2 全部等级':d.settings.level)+' · 每天 '+d.settings.newGoal+' 个新词';
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
$('planForm').onsubmit=e=>{e.preventDefault();try{const settings={newGoal:Number($('newGoal').value),level:$('planLevel').value};const applies=PlanCore.changeSettings(state,settings,words);level=PlanCore.ensureDay(state,words).settings.level;if(PlanCore.check(state,words))toast('今日计划完成，打卡成功！');save();renderFilterState();stats();pick();$('planStatus').textContent=applies==='tomorrow'?'已保存，明天起生效；今日打卡已保留。':'已保存，今日计划已更新，已学记录继续保留。'}catch(e){$('planStatus').textContent=e.message}};
$('editPlan').onclick=()=>view('plan');$('checkIn').onclick=()=>{if(PlanCore.check(state,words)){save();stats();toast('打卡成功！')}else toast('完成今日新词和复习任务后，会自动打卡。')};
$('newGoal').oninput=estimate;$('planLevel').onchange=estimate;document.querySelectorAll('[data-goal]').forEach(b=>b.onclick=()=>{$('newGoal').value=b.dataset.goal;estimate()});
$('prevMonth').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1,12);renderCalendar()};$('nextMonth').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1,12);renderCalendar()};
function refreshDay(){if(day()!==activeDate){activeDate=day();PlanCore.ensureDay(state,words);level=state.settings.level;renderFilterState();syncSettings();pick();save();$('date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}else {stats();if(!current&&words.some(w=>state.progress[id(w)]?.due<=Date.now()))pick()}}
setInterval(refreshDay,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDay()});
rebuild();PlanCore.ensureDay(state,words);syncSettings();renderFilterState();stats();pick();save();
$('sourceSummary').textContent=`已收录 ${words.length.toLocaleString()} 个词条与表达，覆盖 A1–B2。教材词表与开放词典相结合；中文为参考释义，词典词的等级为学习建议。`;
