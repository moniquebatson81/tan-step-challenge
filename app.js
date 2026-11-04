import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification, sendPasswordResetEmail, reload } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { getFirestore, doc, collection, collectionGroup, getDoc, getDocs, addDoc, setDoc, deleteDoc, writeBatch, onSnapshot, runTransaction, serverTimestamp, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
const number = (n) => Number(n || 0).toLocaleString('en-US');
const pad = (v) => String(v).padStart(2, '0');
const ymd = (date) => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const today = () => ymd(new Date());
const mondayOf = (date) => { const d = new Date(date.getFullYear(),date.getMonth(),date.getDate()); d.setDate(d.getDate() - ((d.getDay()+6)%7));return d; };
const isoDate = (s) => new Date(`${s}T12:00:00`);
const pretty = (s) => isoDate(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const initials = (name) => String(name||'?').split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase();
const state = { demo: new URLSearchParams(location.search).has('demo'), user:null, fullName:'', displayName:'', myEntries:[], scores:[], messages:[], admin:false, tab:'home', unsubs:[], chatUnsub:null, lastPost:0, registering:false };

function status(id, message, kind='') { const e = $(id); e.textContent = message; e.className = `status ${kind}`.trim(); }
function showScreen(screen) { ['auth','verify','main'].forEach(x => $(`${x}-screen`).hidden = x !== screen); $('sign-out').hidden = screen === 'auth' || state.demo; }
function cleanListeners() { state.unsubs.forEach(fn => fn()); state.unsubs=[]; if(state.chatUnsub){state.chatUnsub();state.chatUnsub=null;} }
function errorMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'This email already has an account. Try signing in.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/invalid-credential': 'Email or password not recognized.',
    'auth/wrong-password': 'Email or password not recognized.',
    'auth/weak-password': 'Choose a stronger password.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/unauthorized-domain': 'This website domain needs to be added to Firebase Authentication settings.',
    'permission-denied': 'Access denied. Check that Firestore rules are published and your email is verified.',
    'failed-precondition': 'Database setup is incomplete. TAN staff should check Firestore configuration.'
  };
  return messages[error?.code] || messages[String(error?.code||'').replace('firestore/','')] || String(error?.message||'Something went wrong. Please try again.');
}

function setAuthMode(mode) {
  const register = mode === 'register';
  $('login-form').hidden=register;$('register-form').hidden=!register;
  $('show-login').classList.toggle('active',!register);$('show-register').classList.toggle('active',register);
  $('auth-heading').textContent=register ? 'Join the challenge!' : 'Welcome back!';
  status('auth-status','');
}
$('show-login').addEventListener('click',()=>setAuthMode('login'));
$('show-register').addEventListener('click',()=>setAuthMode('register'));
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();status('auth-status','Signing in…');
  try { await signInWithEmailAndPassword(auth,$('login-email').value.trim(),$('login-password').value);status('auth-status',''); }
  catch(e){status('auth-status',errorMessage(e),'error');}
});
$('register-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const fullName=$('register-name').value.trim().replace(/\s+/g,' ');
  const displayName=$('register-display').value.trim().replace(/\s+/g,' ');
  const email=$('register-email').value.trim().toLowerCase();
  const password=$('register-password').value;
  if(fullName.length<2 || fullName.length>80 || displayName.length<2 || displayName.length>30 || !/^[\p{L}\p{N} .'-]+$/u.test(displayName)) {
    status('auth-status','Enter a full name and a 2–30 character display name using letters, numbers, spaces, apostrophes, periods, or hyphens.','error');return;
  }
  if(password.length<8){status('auth-status','Please choose at least eight characters for your password.','error');return;}
  state.registering=true;status('auth-status','Creating your account…');
  try {
    const result=await createUserWithEmailAndPassword(auth,email,password);
    const uid=result.user.uid;
    const batch=writeBatch(db);
    batch.set(doc(db,'users',uid),{uid,fullName,displayName,email,createdAt:serverTimestamp()});
    batch.set(doc(db,'leaderboard',uid),{uid,displayName,totalSteps:0,daysLogged:0,lastChangedDate:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    await batch.commit();
    await sendEmailVerification(result.user);
    state.registering=false;showScreen('verify');status('verify-status','Verification email sent. Check your inbox and spam folder.','ok');
  } catch(e) {state.registering=false;status('auth-status',errorMessage(e),'error');}
});
$('reset-password').addEventListener('click',async ()=>{
  const email=$('login-email').value.trim();
  if(!email){status('auth-status','Enter your email in the box above, then select Forgot password.','error');return;}
  try{await sendPasswordResetEmail(auth,email);status('auth-status','If an account exists for that email, a reset link is on its way.','ok');}
  catch(e){status('auth-status',errorMessage(e),'error');}
});
$('verify-resend').addEventListener('click',async()=>{
  if(!auth.currentUser)return;
  try{await sendEmailVerification(auth.currentUser);status('verify-status','Another verification email was sent.','ok');}
  catch(e){status('verify-status',errorMessage(e),'error');}
});
$('verify-check').addEventListener('click',async()=>{
  if(!auth.currentUser)return;
  try{await reload(auth.currentUser);await auth.currentUser.getIdToken(true);if(auth.currentUser.emailVerified){await loadAccount(auth.currentUser);}else{status('verify-status','Your email is not verified yet. Open the link in your inbox, then try again.','error');}}
  catch(e){status('verify-status',errorMessage(e),'error');}
});
$('sign-out').addEventListener('click',async()=>{cleanListeners();await signOut(auth);});

onAuthStateChanged(auth, async user=>{
  if(state.demo)return;
  cleanListeners();state.user=user;
  if(!user){showScreen('auth');return;}
  if(state.registering)return;
  if(!user.emailVerified){showScreen('verify');return;}
  try{await loadAccount(user);}catch(e){showScreen('verify');status('verify-status',`Account setup couldn't finish: ${errorMessage(e)}`,'error');}
});

async function loadAccount(user) {
  cleanListeners();state.user=user;
  const userSnap=await getDoc(doc(db,'users',user.uid));
  if(!userSnap.exists()) throw new Error('Profile not found. Please contact TAN staff; your account may have been created before the database was enabled.');
  const profile=userSnap.data();state.fullName=profile.fullName;state.displayName=profile.displayName;
  state.admin=(await getDoc(doc(db,'admins',user.uid))).exists();
  $('admin-tab').hidden=!state.admin;
  $('greeting-name').textContent=profile.fullName.split(' ')[0];
  showScreen('main');switchTab('home');
  state.unsubs.push(onSnapshot(collection(db,'leaderboard'),snap=>{
    state.scores=snap.docs.map(d=>({uid:d.id,...d.data()})).sort((a,b)=>(b.totalSteps||0)-(a.totalSteps||0)||a.displayName.localeCompare(b.displayName));
    drawOverview();drawLeaders();drawProgress();
  },e=>status('global-status',errorMessage(e),'error')));
  state.unsubs.push(onSnapshot(collection(db,'stepLogs',user.uid,'days'),snap=>{
    state.myEntries=snap.docs.map(d=>({date:d.id,...d.data()})).sort((a,b)=>b.date.localeCompare(a.date));
    drawOverview();drawProgress();drawWeek();drawHistory();
  },e=>status('global-status',errorMessage(e),'error')));
}

function switchTab(tab) {
  if(tab==='admin'&&!state.admin&&!state.demo)return;
  state.tab=tab;
  document.querySelectorAll('.page').forEach(e=>e.hidden=e.id!==`page-${tab}`);
  document.querySelectorAll('[data-tab]').forEach(e=>e.classList.toggle('active',e.dataset.tab===tab));
  if(state.chatUnsub){state.chatUnsub();state.chatUnsub=null;}
  if(tab==='chat'&&!state.demo) {
    state.chatUnsub=onSnapshot(query(collection(db,'messages'),orderBy('createdAt','desc'),limit(40)),snap=>{
      state.messages=snap.docs.map(d=>({id:d.id,...d.data()})).reverse();drawMessages();
    },e=>status('chat-status',errorMessage(e),'error'));
  }
  if(tab==='chat')drawMessages();
  if(tab==='admin'&&!state.demo)refreshReports();
  if(tab==='log')drawWeek();
  scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-tab]').forEach(e=>e.addEventListener('click',()=>switchTab(e.dataset.tab)));
document.querySelectorAll('[data-goto]').forEach(e=>e.addEventListener('click',()=>switchTab(e.dataset.goto)));

function myScore(){return state.scores.find(s=>s.uid===state.user?.uid)||{totalSteps:0,daysLogged:0};}
function myRank(){const idx=state.scores.findIndex(s=>s.uid===state.user?.uid);return idx<0?'—':`#${idx+1}`;}
function drawOverview(){
  $('home-total').textContent=number(myScore().totalSteps);
  $('home-days').textContent=number(myScore().daysLogged);
  $('home-rank').textContent=myRank();
}
function leaderRow(person,index){
  const row=document.createElement('div');row.className='leader-row'+(person.uid===state.user?.uid?' is-me':'');
  const rank=document.createElement('span');rank.className='leader-place'+(index<3?' medal':'');rank.textContent=index<3?['🥇','🥈','🥉'][index]:`#${index+1}`;
  const avatar=document.createElement('span');avatar.className='leader-initial';avatar.textContent=initials(person.displayName);
  const name=document.createElement('span');name.className='leader-name';name.textContent=person.displayName+(person.uid===state.user?.uid?' (you)':'');
  const count=document.createElement('span');count.className='leader-steps';count.textContent=`${number(person.totalSteps)} steps`;
  row.append(rank,avatar,name,count);return row;
}
function drawLeaders(){
  for(const [id,max] of [['home-leaders',4],['full-leaders',10]]) {
    const el=$(id);el.replaceChildren();
    if(!state.scores.length){el.append(emptyNode('The leaderboard will appear after participants register.'));continue;}
    state.scores.slice(0,max).forEach((score,i)=>el.append(leaderRow(score,i)));
  }
  $('personal-rank').textContent=myRank();
  $('rank-summary').textContent=`You have ${number(myScore().totalSteps)} logged steps. Keep moving at your own pace!`;
}
function emptyNode(text){const p=document.createElement('p');p.className='empty';p.textContent=text;return p;}

function drawWeek(){
  const parent=$('week-fields');if(!parent)return;
  const start=mondayOf(isoDate($('week-picker').value||today()));
  const names=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const current=today();parent.replaceChildren();
  for(let i=0;i<7;i++) {
    const d=new Date(start);d.setDate(d.getDate()+i);const date=ymd(d);const entry=state.myEntries.find(e=>e.date===date);
    const card=document.createElement('label');card.className='day-box'+(date>current?' future':'');
    const label=document.createElement('strong');label.textContent=names[i];
    const sub=document.createElement('small');sub.textContent=d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    const input=document.createElement('input');input.type='number';input.min='0';input.max='100000';input.step='1';input.inputMode='numeric';input.placeholder='Steps';input.dataset.date=date;input.setAttribute('aria-label',`Steps for ${names[i]}, ${pretty(date)}`);input.disabled=date>current;input.value=entry?entry.steps:'';
    card.append(label,sub,input);parent.append(card);
  }
}
$('week-picker').value=ymd(mondayOf(new Date()));
$('week-picker').max=today();
$('week-picker').addEventListener('change',drawWeek);
$('save-week').addEventListener('click',async()=>{
  const fields=[...document.querySelectorAll('#week-fields input')];
  const filled=fields.filter(el=>el.value.trim()!=='');
  if(!filled.length){status('steps-status','Enter steps for at least one day.','error');return;}
  for(const el of filled) {
    const n=Number(el.value);
    if(!Number.isInteger(n)||n<0||n>100000||el.dataset.date>today()) {
      status('steps-status','Use whole numbers between 0 and 100,000, and do not submit future dates.','error');return;
    }
  }
  const changed=filled.filter(el=>Number(state.myEntries.find(e=>e.date===el.dataset.date)?.steps)!==Number(el.value)||!state.myEntries.some(e=>e.date===el.dataset.date));
  if(!changed.length){status('steps-status','Nothing new to save. Your entries are already up to date.','ok');return;}
  const button=$('save-week');button.disabled=true;status('steps-status',`Saving ${changed.length} day(s)…`);
  let saved=0;
  try {
    for(const el of changed) {
      const date=el.dataset.date, steps=Number(el.value);
      if(state.demo){
        state.myEntries=state.myEntries.filter(e=>e.date!==date);
        state.myEntries.push({date,steps});state.myEntries.sort((a,b)=>b.date.localeCompare(a.date));
        const my=state.scores.find(s=>s.uid===state.user.uid);my.totalSteps=state.myEntries.reduce((total,e)=>total+Number(e.steps),0);my.daysLogged=state.myEntries.length;
        state.scores.sort((a,b)=>b.totalSteps-a.totalSteps);saved++;continue;
      }
      const uid=state.user.uid;
      const stepRef=doc(db,'stepLogs',uid,'days',date),leaderRef=doc(db,'leaderboard',uid);
      await runTransaction(db,async tx=>{
        const old=await tx.get(stepRef),leader=await tx.get(leaderRef);
        if(!leader.exists())throw new Error('Leaderboard profile not found.');
        const previous=old.exists()?Number(old.data().steps):0;
        if(old.exists()&&previous===steps)return;
        const base=leader.data();
        tx.set(stepRef,{uid,date,steps,createdAt:old.exists()?old.data().createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
        tx.update(leaderRef,{totalSteps:Number(base.totalSteps)+steps-previous,daysLogged:Number(base.daysLogged)+(old.exists()?0:1),lastChangedDate:date,updatedAt:serverTimestamp()});
      });saved++;
    }
    if(state.demo){drawOverview();drawLeaders();drawProgress();drawHistory();drawWeek();}
    status('steps-status',`Saved ${saved} day(s)! You showed up, and that counts. 🎉`,'ok');
  }catch(e){status('steps-status',`${saved} day(s) saved. ${errorMessage(e)}`,'error');}
  finally{button.disabled=false;}
});
function drawHistory(){
  const el=$('history-list');el.replaceChildren();
  if(!state.myEntries.length){el.append(emptyNode('No entries yet. Log your first day above!'));return;}
  for(const entry of state.myEntries.slice(0,14)) {
    const row=document.createElement('div');row.className='history-row';
    const date=document.createElement('span');date.textContent=pretty(entry.date);
    const steps=document.createElement('strong');steps.textContent=`${number(entry.steps)} steps`;
    row.append(date,steps);el.append(row);
  }
}
function drawProgress(){
  $('progress-total').textContent=number(myScore().totalSteps);
  $('progress-days').textContent=number(myScore().daysLogged);
  $('progress-best').textContent=state.myEntries.length?number(Math.max(...state.myEntries.map(e=>Number(e.steps)))):'—';
  const container=$('progress-bars');container.replaceChildren();
  const entries=state.myEntries.slice(0,12);if(!entries.length){container.append(emptyNode('Your daily progress will appear after you log steps.'));return;}
  const max=Math.max(1,...entries.map(e=>Number(e.steps)));
  for(const entry of entries) {
    const row=document.createElement('div');row.className='progress-row';
    const date=document.createElement('span');date.textContent=pretty(entry.date).replace(/, \d{4}$/,'');
    const track=document.createElement('div');track.className='progress-track';
    const fill=document.createElement('div');fill.className='progress-fill';fill.style.width=`${Math.max(0,Number(entry.steps)/max*100)}%`;track.append(fill);
    const steps=document.createElement('span');steps.className='progress-amount';steps.textContent=number(entry.steps);row.append(date,track,steps);container.append(row);
  }
}

function drawMessages(){
  const wrap=$('chat-list');wrap.replaceChildren();
  if(!state.messages.length){wrap.append(emptyNode('Be the first to encourage the community!'));return;}
  for(const message of state.messages) {
    const item=document.createElement('div');item.className='message'+(message.uid===state.user?.uid?' mine':'');
    const avatar=document.createElement('div');avatar.className='message-avatar';avatar.textContent=initials(message.displayName);
    const body=document.createElement('div');body.className='message-body';
    const meta=document.createElement('div');meta.className='message-meta';
    const author=document.createElement('strong');author.textContent=message.displayName;
    const time=document.createElement('small');time.textContent=message.createdAt?.toDate?.().toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})||'Just now';meta.append(author,time);
    const text=document.createElement('div');text.className='message-content';text.textContent=message.text;
    const actions=document.createElement('div');actions.className='message-actions';
    if(!state.demo&&message.uid!==state.user?.uid){const report=document.createElement('button');report.textContent='Report';report.addEventListener('click',()=>reportMessage(message));actions.append(report);}
    if(!state.demo&&(state.admin||message.uid===state.user?.uid)){
      const del=document.createElement('button');del.textContent=state.admin?'Remove message':'Delete my message';del.addEventListener('click',()=>removeMessage(message.id));actions.append(del);
    }
    body.append(meta,text,actions);item.append(avatar,body);wrap.append(item);
  }
  wrap.scrollTop=wrap.scrollHeight;
}
$('chat-text').addEventListener('input',()=>{$('chat-count').textContent=$('chat-text').value.length;});
$('chat-form').addEventListener('submit',async event=>{
  event.preventDefault();const content=$('chat-text').value.trim();
  if(!content||content.length>300)return;
  if(Date.now()-state.lastPost<10000){status('chat-status','Give it a few seconds before posting again.','error');return;}
  const send=event.currentTarget.querySelector('button[type=submit]');send.disabled=true;
  try{
    if(state.demo){state.messages.push({id:`demo-${Date.now()}`,uid:state.user.uid,displayName:state.displayName,text:content,createdAt:{toDate:()=>new Date()}});drawMessages();}
    else await addDoc(collection(db,'messages'),{uid:state.user.uid,displayName:state.displayName,text:content,createdAt:serverTimestamp()});
    $('chat-text').value='';$('chat-count').textContent='0';state.lastPost=Date.now();status('chat-status','Message posted!','ok');
  }catch(e){status('chat-status',errorMessage(e),'error');}finally{send.disabled=false;}
});
async function reportMessage(message){
  if(!confirm('Report this message to TAN staff for review?'))return;
  try{await setDoc(doc(db,'reports',`${state.user.uid}_${message.id}`),{reporterUid:state.user.uid,messageId:message.id,messageUid:message.uid,messageText:message.text.slice(0,300),createdAt:serverTimestamp()});status('chat-status','Thank you. TAN staff can review this report.','ok');}
  catch(e){status('chat-status',errorMessage(e),'error');}
}
async function removeMessage(messageId){
  if(!confirm('Remove this message from the community chat?'))return;
  try{await deleteDoc(doc(db,'messages',messageId));status('chat-status','Message removed.','ok');if(state.admin)refreshReports();}
  catch(e){status('chat-status',errorMessage(e),'error');}
}

function csvCell(value){
  let s=String(value??'');
  // Prevent CSV formula injection when an exported field is opened as a spreadsheet.
  if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
$('export-csv').addEventListener('click',async()=>{
  if(!state.admin||state.demo)return;
  const button=$('export-csv');button.disabled=true;status('admin-status','Preparing export…');
  try{
    const [userSnap,entriesSnap]=await Promise.all([getDocs(collection(db,'users')),getDocs(collectionGroup(db,'days'))]);
    const users=new Map(userSnap.docs.map(d=>[d.id,d.data()]));
    const rows=[['Participant ID','Full name','Display name','Email','Date','Steps','Last modified']];
    entriesSnap.forEach(d=>{
      const entry=d.data(),uid=d.ref.parent.parent?.id||entry.uid,u=users.get(uid)||{};
      rows.push([uid,u.fullName||'',u.displayName||'',u.email||'',entry.date,entry.steps,entry.updatedAt?.toDate?.().toISOString()||'']);
    });
    rows.slice(1).sort((a,b)=>a[1].localeCompare(b[1])||a[4].localeCompare(b[4]));
    const output='\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
    const blob=new Blob([output],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`tan-step-challenge-${today()}.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('admin-status',`Export ready: ${rows.length-1} daily entries.`,'ok');
  }catch(e){status('admin-status',errorMessage(e),'error');}finally{button.disabled=false;}
});
$('refresh-reports').addEventListener('click',refreshReports);
async function refreshReports(){
  if(!state.admin||state.demo)return;
  const wrap=$('reports-list');wrap.replaceChildren(emptyNode('Loading reports…'));
  try{
    const snap=await getDocs(query(collection(db,'reports'),orderBy('createdAt','desc'),limit(60)));
    wrap.replaceChildren();if(snap.empty){wrap.append(emptyNode('No reported messages.'));return;}
    for(const record of snap.docs){
      const r=record.data(),card=document.createElement('div');card.className='report-card';
      const title=document.createElement('strong');title.textContent=`Reported message: ${r.messageId}`;
      const content=document.createElement('p');content.textContent=r.messageText;
      const btn=document.createElement('button');btn.className='btn btn-outline';btn.textContent='Remove reported message';
      btn.addEventListener('click',async()=>{try{await deleteDoc(doc(db,'messages',r.messageId));await deleteDoc(record.ref);refreshReports();}catch(e){status('admin-status',errorMessage(e),'error');}});
      card.append(title,content,btn);wrap.append(card);
    }
  }catch(e){wrap.replaceChildren(emptyNode(errorMessage(e)));}
}

// Safe design preview: fictional users and local-only changes. Not connected to Firestore.
if(state.demo){
  state.user={uid:'preview-user'};state.fullName='Alex Participant';state.displayName='Alex P.';
  state.scores=[
    {uid:'c1',displayName:'Jordan M.',totalSteps:143250,daysLogged:17},
    {uid:'c2',displayName:'Sam R.',totalSteps:128640,daysLogged:17},
    {uid:'c3',displayName:'Taylor B.',totalSteps:122890,daysLogged:16},
    {uid:'preview-user',displayName:'Alex P.',totalSteps:118450,daysLogged:14},
    {uid:'c4',displayName:'Morgan T.',totalSteps:104200,daysLogged:15},
    {uid:'c5',displayName:'Chris L.',totalSteps:96870,daysLogged:13},
    {uid:'c6',displayName:'Jamie K.',totalSteps:91250,daysLogged:13},
    {uid:'c7',displayName:'Robin A.',totalSteps:87690,daysLogged:13},
    {uid:'c8',displayName:'Drew F.',totalSteps:83500,daysLogged:12},
    {uid:'c9',displayName:'Casey D.',totalSteps:79210,daysLogged:11}
  ];
  const dates=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return ymd(d)});
  state.myEntries=dates.map((date,i)=>({date,steps:[8240,10200,7640,8900,9500,8600,7100,8940,9300,7980,8960,9960,10450,7680][i]}));
  state.scores.find(s=>s.uid===state.user.uid).totalSteps=state.myEntries.reduce((sum,e)=>sum+e.steps,0);
  state.messages=[
    {id:'demo1',uid:'c1',displayName:'Jordan M.',text:'I finally hit 10,000 steps yesterday! 🎉',createdAt:{toDate:()=>new Date(Date.now()-3600000)}},
    {id:'demo2',uid:'c2',displayName:'Sam R.',text:'YES!! You inspired me to take a walk at lunch.',createdAt:{toDate:()=>new Date(Date.now()-3000000)}},
    {id:'demo3',uid:'c3',displayName:'Taylor B.',text:'Reminder: a ten-minute walk still counts. We got this! 💙',createdAt:{toDate:()=>new Date(Date.now()-1800000)}}
  ];
  $('greeting-name').textContent='Alex';$('demo-banner').hidden=false;
  showScreen('main');drawOverview();drawLeaders();drawProgress();drawWeek();drawHistory();drawMessages();switchTab('home');
}
