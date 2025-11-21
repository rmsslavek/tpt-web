import { GOOGLE_CLIENT_ID } from './config.js';

// Pomoćne funkcije za dekodiranje JWT i prijavu korisnika u lokalnu sesiju
function decodeJwt(token){
  try{
    const [, payload] = token.split('.');
    const b64 = payload.replace(/-/g,'+').replace(/_/g,'/');
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const str = atob(b64 + pad);
    return JSON.parse(decodeURIComponent(str.split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  }catch(e){ return null; }
}

function upsertLocalUserFromGoogle(profile){
  const users = JSON.parse(localStorage.getItem('ca_users')||'[]');
  const baseHandle = (profile.name || profile.email?.split('@')[0] || 'user').replace(/[^A-Za-z0-9_]/g,'').slice(0,20) || 'user';
  let handle = baseHandle || 'user';
  let idx = 0;
  while(users.some(u=>u.handle.toLowerCase()===handle.toLowerCase())){
    idx++; handle = (baseHandle + idx).slice(0,20);
  }
  const existing = users.find(u=>u.googleSub && u.googleSub===profile.sub);
  if(existing){
    localStorage.setItem('ca_session', JSON.stringify({ handle: existing.handle }));
    return existing.handle;
  }
  const user = { handle, password: '', rating: 1500, country: profile.locale || '', org: profile.hd || '', googleSub: profile.sub, email: profile.email||'' };
  users.push(user);
  localStorage.setItem('ca_users', JSON.stringify(users));
  localStorage.setItem('ca_session', JSON.stringify({ handle }));
  return handle;
}

function ensureGisReady(){
  return new Promise((resolve, reject)=>{
    const start = Date.now();
    const check = ()=>{
      if(window.google && window.google.accounts && window.google.accounts.id){ resolve(); return; }
      if(Date.now()-start>10000){ reject(new Error('Google Identity script nije dostupan.')); return; }
      setTimeout(check, 50);
    };
    check();
  });
}

async function initAndRender(container){
  if(!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith('REPLACE_')){
    container.innerHTML = '<div class="muted">Podesite GOOGLE_CLIENT_ID u js/config.js</div>';
    return;
  }
  try{
    await ensureGisReady();
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp)=>{
        const payload = decodeJwt(resp.credential);
        if(!payload){ alert('Neuspešno čitanje Google tokena'); return; }
        const handle = upsertLocalUserFromGoogle(payload);
        window.dispatchEvent(new Event('ca:session'));
        location.hash = '#/';
      },
      auto_select: false,
      ux_mode: 'popup'
    });
    window.google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      width: 280,
      text: 'continue_with'
    });
  }catch(e){
    container.innerHTML = '<div class="muted">Google prijava nije dostupna.</div>';
  }
}

// Izvezimo globalni helper da ga inline skripta iz LoginView može pozvati
export function renderGoogleButtonInto(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  initAndRender(el);
}

// Pristup kroz window radi inline skripti
window.renderGoogleButtonInto = renderGoogleButtonInto;

