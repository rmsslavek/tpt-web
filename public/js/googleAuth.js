import { GOOGLE_CLIENT_ID } from './config.js';
import { auth, GoogleAuthProvider, signInWithCredential } from './firebaseClient.js';
import { recordUserAccess } from './storage.js';

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
    if(existing.disabled){
      return { blocked:true, handle: existing.handle };
    }
    localStorage.setItem('ca_session', JSON.stringify({ handle: existing.handle }));
    return { handle: existing.handle, blocked:false };
  }
  const user = { handle, password: '', rating: 1500, country: profile.locale || '', org: profile.hd || '', googleSub: profile.sub, email: profile.email||'', disabled:false };
  users.push(user);
  localStorage.setItem('ca_users', JSON.stringify(users));
  localStorage.setItem('ca_session', JSON.stringify({ handle }));
  return { handle, blocked:false };
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
  container.classList.add('google-btn-wrap');
  try{
    await ensureGisReady();
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (resp)=>{
        const payload = decodeJwt(resp.credential);
        if(!payload){ alert('Neuspesno citanje Google tokena'); return; }
        try{
          const cred = GoogleAuthProvider.credential(resp.credential);
          await signInWithCredential(auth, cred);
        }catch(err){
          console.warn('Firebase Auth Google sign-in failed', err);
          alert('Prijava nije uspela (Firebase Auth).');
          return;
        }
        const result = upsertLocalUserFromGoogle(payload);
        if(!result || result.blocked){
          alert('Ovaj nalog je deaktiviran od strane administratora.');
          return;
        }
        window.dispatchEvent(new Event('ca:session'));
        recordUserAccess(result.handle).catch(()=>{});
        location.hash = '#/';
      },
      auto_select: false,
      ux_mode: 'popup'
    });
    window.google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      width: 260,
      text: 'continue_with'
    });
    // Pre-stilizuj dugme da lici na nasa .btn
    const btn = container.querySelector('div[role=button], button');
    if(btn){
      btn.classList.add('google-btn-custom');
      btn.removeAttribute('style');
    }
  }catch(e){
    container.innerHTML = '<div class="muted">Google prijava nije dostupna.</div>';
  }
}

// Izvezimo globalni helper da ga inline skripta iz LoginView moze pozvati
export function renderGoogleButtonInto(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  initAndRender(el);
}

// Pristup kroz window radi inline skripti
window.renderGoogleButtonInto = renderGoogleButtonInto;

