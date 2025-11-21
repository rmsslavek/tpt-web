import { db } from '../storage.js';

export function LoginView(){
  return `
  <section class="panel" style="max-width:600px;margin:0 auto">
    <h2>Prijava</h2>
    <form id="loginForm">
      <div class="row"><label>Korisničko ime</label><input name="handle" required /></div>
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
      function showLoginError(){
        const existing=document.querySelector('.modal-overlay');
        if(existing) existing.remove();
        const overlay=document.createElement('div');
        overlay.className='modal-overlay';
        overlay.innerHTML=\`
          <div class="modal">
            <h3>Neispravni podaci za prijavu</h3>
            <p>Uneli ste pogrešno korisničko ime ili lozinku. Proverite podatke ili kreirajte novi nalog ako još uvek nemate registrovan pristup.</p>
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
      f.addEventListener('submit', (e)=>{
        e.preventDefault();
        const data = Object.fromEntries(new FormData(f).entries());
        const users = JSON.parse(localStorage.getItem('ca_users')||'[]');
        const u = users.find(x=>x.handle.toLowerCase()===data.handle.toLowerCase() && x.password===data.password);
        if(!u){ showLoginError(); return; }
        localStorage.setItem('ca_session', JSON.stringify({ handle: u.handle }));
        window.dispatchEvent(new Event('ca:session'));
        location.hash = '#/';
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
      <div class="row"><label>Korisničko ime</label><input name="handle" required pattern="[A-Za-z0-9_]{3,20}" title="3-20 znakova, slova/cifre/_" /></div>
      <div class="row"><label>Lozinka</label><input name="password" type="password" required minlength="4" /></div>
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
        if(users.some(u=>u.handle.toLowerCase()===data.handle.toLowerCase())){ alert('Korisničko ime zauzeto'); return; }
        users.push({ handle:data.handle, password:data.password, rating:1500, country:data.country||'', org:data.org||'' });
        localStorage.setItem('ca_users', JSON.stringify(users));
        localStorage.setItem('ca_session', JSON.stringify({ handle: data.handle }));
        window.dispatchEvent(new Event('ca:session'));
        location.hash = '#/';
      });
    })();
  </script>`;
}
