const base = 'http://127.0.0.1:5001';
const call = async (path, body, token) => { const r = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(45000) }); return {status:r.status,data:await r.json()}; };
/* eslint-env node */
try {
 const email = `homesync-${Date.now()}@example.test`, password = 'HomeSyncTest2026';
 const reg = await call('/api/auth/register', {email,password}); console.log('register',reg.status);
 if(!reg.data.dev_lien) { console.log('BLOCKED: verification email requires SMTP or dev_lien'); process.exit(0); }
 const token = new URL(reg.data.dev_lien).searchParams.get('token');
 console.log('verify-email',(await call('/api/auth/verify-email',{token})).status);
 const login = await call('/api/auth/login',{email,password}); console.log('login',login.status);
 const session = login.data.access_token; if(!session) process.exit(1);
 console.log('me',(await call('/api/auth/me',null,session)).status);
 console.log('likes',(await call('/api/likes',null,session)).status);
 const chat = await call('/api/chat',{message:'Je cherche un appartement à Toulon',sessionId:crypto.randomUUID(),honeypot:'',formTs:Date.now()-10000}, session);
 console.log('chat clarification',chat.status,'missing',JSON.stringify(chat.data.missing || []));
 const results = await call('/api/chat',{message:'Budget 300 000 euros',sessionId:chat.data.sessionId,honeypot:'',formTs:Date.now()-10000},session);
 console.log('chat results', results.status, 'count',results.data.resultats?.count ?? 'none');
 if(results.data.resultats?.search_id){ const full = await call('/api/chat/resultats/'+encodeURIComponent(results.data.resultats.search_id),null,session); console.log('full results',full.status,'annonces',full.data.annonces?.length ?? 0); const a = full.data.annonces?.[0]; if(a){ const r=await fetch(base+'/api/likes/'+encodeURIComponent(a.id_source),{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session}`},body:JSON.stringify({type:'gold'})});console.log('save favorite',r.status);const likes=await call('/api/likes',null,session); console.log('favorite retrieved',likes.status,likes.data.some(x=>x.annonce_id===a.id_source)); } }
 console.log('logout',(await call('/api/auth/logout',{},session)).status);
} catch(e) { console.log('BLOCKED:',e.name,e.message); process.exitCode=1; }
