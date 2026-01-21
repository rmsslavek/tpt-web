import { db } from '../storage.js';

export function LoginView(){
  return `
  <section class="panel" style="max-width:600px;margin:0 auto">
    <h2>Prijava</h2>
    <form id="loginForm">
      <div class="row"><label>Korisnicko ime</label><input name="handle" required /></div>
      <div class="row"><label>Lozinka</label><input name="password" type="password" required /></div>
      <div class="row"><label></label><button class="btn primary" type="submit">Prijavi se</button></div>
    </form>
    <div style="margin:1rem 0;text-align:center" class="muted">ili</div>
    <div style="display:flex;justify-content:center">
      <div id="gBtn"></div>
    </div>
    <p class="muted">Nemate nalog? <a href="#/register">Registrujte se</a></p>
  </section>
  <script>
    (function(){
      function showLoginError(message){
        const existing=document.querySelector('.modal-overlay');
        if(existing) existing.remove();
        const overlay=document.createElement('div');
        overlay.className='modal-overlay';
        overlay.innerHTML=\`
          <div class="modal">
            <h3>Prijava nije uspela</h3>
            <p>\${message || 'Uneli ste pogresno korisnicko ime ili lozinku. Proverite podatke ili kreirajte novi nalog ako jos uvek nemate registrovan pristup.'}</p>
            <div class="actions">
              <button type="button" class="btn ghost" data-close>U redu</button>
              <a class="btn primary" href="#/register">Registruj se</a>
            </div>
          </div>\`;
        overlay.addEventListener('click',(ev)=>{ if(ev.target===overlay) overlay.remove(); });
        overlay.querySelector('[data-close]').addEventListener('click', ()=> overlay.remove());
        document.body.appendChild(overlay);
      }
      const f=document.getElementById('loginForm');
      f.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const data = Object.fromEntries(new FormData(f).entries());
        const users = JSON.parse(localStorage.getItem('ca_users')||'[]');
        const u = users.find(x=>x.handle.toLowerCase()===data.handle.toLowerCase() && x.password===data.password);
        if(!u){ showLoginError(); return; }
        if(u.disabled){ showLoginError('Ovaj nalog je deaktiviran od strane administratora.'); return; }
        const allowLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        const isSlavek = (u.handle||'').toLowerCase() === 'slavek';
        const defaultSlavekEmail = 'slavisa.radovic+slavek@gmail.com';
        const finalizeSession = async ()=>{
          localStorage.setItem('ca_session', JSON.stringify({ handle: u.handle }));
          try{ await window.recordUserAccess?.(u.handle); }catch(_){}
          window.dispatchEvent(new Event('ca:session'));
          location.hash = '#/';
        };
        const tools = window.__authTools || {};
        if(!tools.auth || !tools.signInWithEmailAndPassword || !tools.createUserWithEmailAndPassword){
          if(allowLocal){
            console.warn('Firebase Auth nije dostupan, koristim lokalnu prijavu.');
            await finalizeSession();
            return;
          }
          showLoginError('Firebase Auth nije dostupan. Pokusajte ponovo.');
          return;
        }
        if(!(u.email||'').trim()){
          if(isSlavek){
            const email = defaultSlavekEmail;
            try{
              await tools.createUserWithEmailAndPassword(tools.auth, email, data.password);
            }catch(errCreate){
              showLoginError('Ne mogu da kreiram Firebase nalog: ' + (errCreate?.message||'greska'));
              return;
            }
            u.email = email;
            localStorage.setItem('ca_users', JSON.stringify(users));
            await finalizeSession();
            return;
          }
          if(allowLocal){
            await finalizeSession();
            return;
          }
          const entered = window.prompt('Unesite email za ovaj nalog (obavezno za prijavu):', '');
          const email = (entered||'').trim();
          if(!email){ return; }
          if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)){
            showLoginError('Email nije ispravan format.');
            return;
          }
          try{
            await tools.createUserWithEmailAndPassword(tools.auth, email, data.password);
          }catch(errCreate){
            showLoginError('Ne mogu da kreiram Firebase nalog: ' + (errCreate?.message||'greska'));
            return;
          }
          u.email = email;
          localStorage.setItem('ca_users', JSON.stringify(users));
          localStorage.setItem('ca_session', JSON.stringify({ handle: u.handle }));
          try{ await window.recordUserAccess?.(u.handle); }catch(_){}
          window.dispatchEvent(new Event('ca:session'));
          location.hash = '#/';
          return;
        }
        try{
          await tools.signInWithEmailAndPassword(tools.auth, u.email, data.password);
        }catch(err){
          const code = err && err.code ? String(err.code) : '';
          if(code === 'auth/user-not-found'){
            try{
              await tools.createUserWithEmailAndPassword(tools.auth, u.email, data.password);
            }catch(errCreate){
              if(allowLocal){
                console.warn('Firebase Auth nalog nije napravljen, koristim lokalnu prijavu.', errCreate);
                await finalizeSession();
                return;
              }
              showLoginError('Ne mogu da kreiram Firebase nalog: ' + (errCreate?.message||'greska'));
              return;
            }
          }else{
            if(allowLocal){
              console.warn('Firebase Auth prijava nije uspela, koristim lokalnu prijavu.', err);
              await finalizeSession();
              return;
            }
            showLoginError('Prijava nije uspela (Firebase Auth).');
            return;
          }
        }
        await finalizeSession();
      });
      // Google dugme
      if(window.renderGoogleButtonInto){ window.renderGoogleButtonInto('gBtn'); }
    })();
  </script>`;
}

export function RegisterView(){
  return `
  <section class="panel" style="max-width:700px;margin:0 auto">
    <h2>Registracija</h2>
    <form id="regForm">
      <div class="row"><label>Korisnicko ime</label><input name="handle" required pattern="[A-Za-z0-9_]{3,20}" title="3-20 znakova, slova/cifre/_" /></div>
      <div class="row"><label>Lozinka</label><input name="password" type="password" required minlength="4" /></div>
      <div class="row"><label>Email</label><input name="email" type="email" required /></div>
      <div class="row"><label>Zemlja</label><input name="country" /></div>
      <div class="row"><label>Organizacija</label><input name="org" /></div>
      <div class="row"><label></label><button class="btn primary" type="submit">Kreiraj nalog</button></div>
    </form>
  </section>
  <script>
    (function(){
      const f=document.getElementById('regForm');
      f.addEventListener('submit', (e)=>{
        e.preventDefault();
        const data = Object.fromEntries(new FormData(f).entries());
        const users = JSON.parse(localStorage.getItem('ca_users')||'[]');
        if(users.some(u=>u.handle.toLowerCase()===data.handle.toLowerCase())){ alert('Korisnicko ime zauzeto'); return; }
        if(!(data.email||'').trim()){ alert('Email je obavezan'); return; }
        const email = (data.email||'').trim();
        const tools = window.__authTools || {};
        if(!tools.auth || !tools.createUserWithEmailAndPassword){
          alert('Firebase Auth nije dostupan. Pokusajte ponovo.');
          return;
        }
        tools.createUserWithEmailAndPassword(tools.auth, email, data.password)
          .then(()=>{
            users.push({ handle:data.handle, password:data.password, rating:1500, country:data.country||'', org:data.org||'', email, disabled:false });
            localStorage.setItem('ca_users', JSON.stringify(users));
            localStorage.setItem('ca_session', JSON.stringify({ handle: data.handle }));
            try{ window.recordUserAccess?.(data.handle); }catch(_){}
            window.dispatchEvent(new Event('ca:session'));
            location.hash = '#/';
          })
          .catch((err)=>{
            alert('Registracija nije uspela (Firebase Auth): ' + (err?.message||'greska'));
          });
      });
    })();
  </script>`;
}

