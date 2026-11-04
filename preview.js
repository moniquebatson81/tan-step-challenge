// Completely local design preview; does not connect to Firebase, store accounts or save steps.
const $=id=>document.getElementById(id), fmt=n=>Number(n).toLocaleString('en-US'),
  ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
  parse=s=>new Date(s+'T12:00:00'),
  datestr=s=>parse(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const user='alex', names=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
let people=[['jordan','Jordan M.',143250],['sam','Sam R.',128640],['taylor','Taylor B.',122890],['alex','Alex P.',118450],['morgan','Morgan T.',104200],['chris','Chris L.',96870],['jamie','Jamie K.',91250],['robin','Robin A.',87690],['drew','Drew F.',83500],['casey','Casey D.',79210]];
let entries=Array.from({length:14},(_,i)=>{let d=new Date();d.setDate(d.getDate()-i);return {date:ymd(d),steps:[8240,10200,7640,8900,9500,8600,7100,8940,9300,7980,8960,9960,10450,7680][i]}});
let messages=[['Jordan M.','I finally hit 10,000 steps yesterday! 🎉'],['Sam R.','YES!! You inspired me to take a walk at lunch.'],['Taylor B.','Reminder: a ten-minute walk still counts. We got this! 💙']];
const on=(id,event,fn)=>$(id).addEventListener(event,fn);
function empty(text){const p=document.createElement('p');p.className='empty';p.textContent=text;return p;}
function rank(){return people.findIndex(p=>p[0]===user)+1;}
function init(){
  $('auth-screen').hidden=true;$('main-screen').hidden=false;$('demo-banner').hidden=false;$('greeting-name').textContent='Alex';$('admin-tab').hidden=true;
  const monday=new Date();monday.setDate(monday.getDate()-((monday.getDay()+6)%7));$('week-picker').value=ymd(monday);
  $('week-picker').max=ymd(new Date());
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
  document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.goto)));
  on('week-picker','change',drawWeek);on('save-week','click',save);
  on('chat-text','input',()=>{$('chat-count').textContent=$('chat-text').value.length});
  on('chat-form','submit',ev=>{ev.preventDefault();let text=$('chat-text').value.trim();if(!text)return;messages.push(['Alex P.',text]);$('chat-text').value='';$('chat-count').textContent='0';drawChat();$('chat-status').textContent='Added to this preview only; no message was sent.'});
  render();tab('home');
}
function tab(name){document.querySelectorAll('.page').forEach(e=>e.hidden=e.id!==`page-${name}`);document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));}
function leadRows(id,n){const wrap=$(id);wrap.replaceChildren();people.slice(0,n).forEach(([uid,name,steps],i)=>{
  const row=document.createElement('div');row.className='leader-row'+(uid===user?' is-me':'');
  for(const [cls,text] of [['leader-place',i<3?['🥇','🥈','🥉'][i]:`#${i+1}`],['leader-initial',name.split(' ').map(x=>x[0]).join('')],['leader-name',name+(uid===user?' (you)':'')],['leader-steps',`${fmt(steps)} steps`]]){
    const el=document.createElement('span');el.className=cls;el.textContent=text;row.append(el);
  }wrap.append(row);
});}
function render(){
  let total=entries.reduce((a,e)=>a+e.steps,0);people.find(x=>x[0]===user)[2]=total;people.sort((a,b)=>b[2]-a[2]);
  $('home-total').textContent=fmt(total);$('home-days').textContent=entries.length;$('home-rank').textContent='#'+rank();
  $('progress-total').textContent=fmt(total);$('progress-days').textContent=entries.length;$('progress-best').textContent=fmt(Math.max(...entries.map(x=>x.steps)));
  $('personal-rank').textContent='#'+rank();$('rank-summary').textContent=`You have ${fmt(total)} logged steps. Keep moving at your own pace!`;
  leadRows('home-leaders',4);leadRows('full-leaders',10);
  const history=$('history-list');history.replaceChildren();for(const e of entries.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,14)){
    const row=document.createElement('div');row.className='history-row';row.textContent=datestr(e.date);const v=document.createElement('strong');v.textContent=fmt(e.steps)+' steps';row.append(v);history.append(row);
  }
  const bars=$('progress-bars');bars.replaceChildren();const arr=entries.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12),max=Math.max(...arr.map(e=>e.steps),1);
  for(const e of arr){const row=document.createElement('div');row.className='progress-row';const date=document.createElement('span');date.textContent=datestr(e.date).replace(/, \d{4}$/,'');const track=document.createElement('div');track.className='progress-track';const fill=document.createElement('div');fill.className='progress-fill';fill.style.width=(e.steps/max*100)+'%';track.append(fill);const val=document.createElement('span');val.className='progress-amount';val.textContent=fmt(e.steps);row.append(date,track,val);bars.append(row);}drawWeek();drawChat();
}
function drawWeek(){let d=parse($('week-picker').value||ymd(new Date()));d.setDate(d.getDate()-((d.getDay()+6)%7));const wrap=$('week-fields');wrap.replaceChildren();for(let i=0;i<7;i++){
  const day=new Date(d);day.setDate(day.getDate()+i);const date=ymd(day),old=entries.find(e=>e.date===date),label=document.createElement('label');label.className='day-box';
  const top=document.createElement('strong');top.textContent=names[i];const sub=document.createElement('small');sub.textContent=day.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  const input=document.createElement('input');input.type='number';input.step='1';input.min='0';input.max='100000';input.placeholder='Steps';input.dataset.date=date;input.value=old?old.steps:'';input.disabled=date>ymd(new Date());label.append(top,sub,input);wrap.append(label);
}}
function save(){let count=0;for(const input of document.querySelectorAll('#week-fields input')){if(!input.value||input.disabled)continue;const n=Number(input.value);if(!Number.isInteger(n)||n<0||n>100000){$('steps-status').textContent='Use whole step counts between 0 and 100,000.';return;}entries=entries.filter(e=>e.date!==input.dataset.date);entries.push({date:input.dataset.date,steps:n});count++;}render();$('steps-status').textContent=count?`Preview only: ${count} day(s) changed. Changes won't be saved.`:'Enter at least one day.';}
function drawChat(){const wrap=$('chat-list');wrap.replaceChildren();messages.forEach(([name,text],i)=>{const item=document.createElement('div');item.className='message';const av=document.createElement('div');av.className='message-avatar';av.textContent=name.slice(0,2).toUpperCase();const body=document.createElement('div');body.className='message-body';const meta=document.createElement('div');meta.className='message-meta';const who=document.createElement('strong');who.textContent=name;const when=document.createElement('small');when.textContent=i===messages.length-1?'Just now':'Today';meta.append(who,when);const message=document.createElement('div');message.className='message-content';message.textContent=text;body.append(meta,message);item.append(av,body);wrap.append(item);});}
init();
