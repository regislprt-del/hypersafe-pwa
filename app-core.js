const CONFIG = window.APP_CONFIG || {};
const TYPES = [
  ['rapid', 'Rapport sexuel rapide'], ['normal', 'Rapport sexuel normal'], ['fell_express', 'Fellation express'],
  ['scenario', 'Soirée scénario sexuel'], ['anal', 'Rapport anal'], ['fell', 'Fellation'], ['scenario_anal', 'Soirée scénario sexuel avec anal']
];
const THRESHOLDS = [
  { max: 12, label: 'Très bon', c: '#22c55e' }, { max: 18, label: 'Bon', c: '#84cc16' },
  { max: 31, label: 'Mauvais', c: '#eab308' }, { max: 43, label: 'Très mauvais', c: '#f97316' },
  { max: 78, label: 'Catastrophique', c: '#ef4444' }
];
let sb, authMode='login', session=null, profile=null, couple=null, anchors=[], events=[], historyLimit=200, realtimeChannel=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=n=>Math.max(0,Math.min(78,n));
const status=n=>THRESHOLDS.find(x=>n<=x.max)||THRESHOLDS.at(-1);
const fmt=n=>(Math.round(Number(n)*10)/10).toLocaleString('fr-FR',{maximumFractionDigits:1});
const localDay=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const typeInfo=k=>TYPES.find(x=>x[0]===k);
function toast(message){const t=$('#toast');t.textContent=message;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),3200)}
function show(id){['#authView','#pairView','#appView'].forEach(x=>$(x).classList.add('hidden'));$(id).classList.remove('hidden')}
function anchorFor(at=new Date()){const ts=new Date(at).getTime();let found=null;for(const a of anchors){if(new Date(a.anchor_at).getTime()<=ts)found=a;else break}return found}
function rateAt(at=new Date()){const when=new Date(at),a=anchorFor(when);if(!a)return null;const aDate=new Date(a.anchor_at);let value=Number(a.score)+Math.max(0,Math.floor((when-aDate)/3600000));for(const e of events){const d=new Date(e.occurred_at);if(d>=aDate&&d<=when)value-=Number(e.impact)}return clamp(value)}
function currentRate(at=new Date()){return rateAt(at)??0} function resultRateForEvent(target){return rateAt(new Date(target.occurred_at))??0}
async function fetchAll(table,coupleId,orderColumn){const pageSize=1000;let from=0,all=[];while(true){const{data,error}=await sb.from(table).select('*').eq('couple_id',coupleId).order(orderColumn,{ascending:true}).range(from,from+pageSize-1);if(error)throw error;const rows=data||[];all=all.concat(rows);if(rows.length<pageSize)break;from+=pageSize}return all}
async function restorePersistentSession(){if(!sb)return false;const{data,error}=await sb.auth.getSession();if(error||!data?.session)return false;const changedUser=!session||session.user?.id!==data.session.user?.id;session=data.session;if(changedUser||!profile)await enterSession();return true}
async function init(){
  if(!CONFIG.SUPABASE_URL||!CONFIG.SUPABASE_ANON_KEY){toast('Configuration Supabase manquante.');show('#authView');return}
  sb=window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY,{auth:{storage:window.localStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const restored=await restorePersistentSession();if(!restored)show('#authView');
  sb.auth.onAuthStateChange(async(_event,nextSession)=>{session=nextSession;if(!nextSession){cleanupRealtime();profile=null;couple=null;anchors=[];events=[];show('#authView')}});
  window.addEventListener('pageshow',()=>restorePersistentSession().catch(()=>{}));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')restorePersistentSession().catch(()=>{})});
  if('serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js?v=8',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{})}
}
async function enterSession(){const{data:p,error}=await sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();if(error)return toast(error.message);profile=p;if(!profile?.couple_id){show('#pairView');return}try{await loadAll();show('#appView');subscribeRealtime();renderAll()}catch(e){toast(e.message||'Erreur de synchronisation')}}
async function loadAll(){ $('#syncBadge').textContent='Synchronisation…';const{data:c,error:coupleError}=await sb.from('couples').select('*').eq('id',profile.couple_id).single();if(coupleError)throw coupleError;const[allAnchors,allEvents]=await Promise.all([fetchAll('anchors',profile.couple_id,'anchor_at'),fetchAll('events',profile.couple_id,'occurred_at')]);couple=c;anchors=allAnchors;events=allEvents;$('#syncBadge').textContent='Synchronisé'}
function applyRealtimePayload(table,payload){if(table==='events'){if(payload.eventType==='INSERT'){if(!events.some(e=>e.id===payload.new.id))events.push(payload.new)}else if(payload.eventType==='UPDATE')events=events.map(e=>e.id===payload.new.id?payload.new:e);else if(payload.eventType==='DELETE')events=events.filter(e=>e.id!==payload.old.id);events.sort((a,b)=>new Date(a.occurred_at)-new Date(b.occurred_at))}if(table==='anchors'&&payload.eventType==='INSERT'){if(!anchors.some(a=>a.id===payload.new.id))anchors.push(payload.new);anchors.sort((a,b)=>new Date(a.anchor_at)-new Date(b.anchor_at))}renderAll()}
function subscribeRealtime(){cleanupRealtime();realtimeChannel=sb.channel(`couple-live-${profile.couple_id}`).on('postgres_changes',{event:'*',schema:'public',table:'events',filter:`couple_id=eq.${profile.couple_id}`},p=>applyRealtimePayload('events',p)).on('postgres_changes',{event:'*',schema:'public',table:'anchors',filter:`couple_id=eq.${profile.couple_id}`},p=>applyRealtimePayload('anchors',p)).subscribe(v=>{if(v==='SUBSCRIBED')$('#syncBadge').textContent='Synchronisé'})}
function cleanupRealtime(){if(realtimeChannel&&sb)sb.removeChannel(realtimeChannel);realtimeChannel=null}
async function createCouple(){const{data,error}=await sb.rpc('create_couple');if(error)return toast(error.message);$('#createdCode').textContent=data;$('#createdCode').classList.remove('hidden');toast('Couple créé. Partagez ce code uniquement avec votre partenaire.');await reloadProfile();await enterSession()}
async function joinCouple(){const code=$('#joinCode').value.trim().toUpperCase();if(!code)return;const{error}=await sb.rpc('join_couple',{p_code:code});if(error)return toast(error.message);toast('Compte rattaché au couple.');await reloadProfile();await enterSession()}
async function reloadProfile(){const{data,error}=await sb.from('profiles').select('*').eq('id',session.user.id).single();if(error)throw error;profile=data}
