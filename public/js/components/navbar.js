import { currentUser, db } from '../storage.js';
import { auth, signOut } from '../firebaseClient.js';

export function Navbar(root){
  const render = () => {
    const me = currentUser();
    const myHandle = (me?.handle||'').toLowerCase();
    const homeworks = db.homeworks();
    const statuses = JSON.parse(localStorage.getItem('ca_homework_status')||'[]');
    const now = Date.now();
    const pendingHw = me ? homeworks.filter(hw=>{
      const targets = (hw.assignedHandles && hw.assignedHandles.length) ? hw.assignedHandles.map(x=>x.toLowerCase()) : (hw.assignedHandle ? [hw.assignedHandle.toLowerCase()] : []);
      const allowed = !targets.length || targets.includes(myHandle);
      if(!allowed) return false;
      if(hw.dueAt && hw.dueAt < now) return false;
      const st = statuses.find(s=> s.hwId===hw.id && s.handle===me.handle);
      return !st || st.status !== 'done';
    }).length : 0;
    const hwBadge = pendingHw>0 ? ` <span class="badge">${pendingHw}</span>` : '';
    root.innerHTML = `
    <nav class="nav" id="navBar">
      <div class="nav-left">
        <a class="brand" href="#/">
          <img class="brand-logo" src="./css/logo.png" alt="CodeArena logo">
          <span>CodeArena</span>
        </a>
        <button class="nav-toggle icon-btn" id="navToggle" aria-label="Otvori meni">|||</button>
      </div>
      <div class="nav-links" id="navLinks">
        <a href="#/problemset">Zadaci</a>
${me?.isAdmin || me?.isProfessor ? `<a href="#/problems/admin">Novi zadatak</a>` : ''}
${me ? `<a href="#/homeworks">Domaci${hwBadge}</a>` : ''}
        <a href="#/contests">Takmicenja</a>
        <a href="#/tests">Testovi</a>
    ${(me?.isAdmin || me?.isOwner) ? `<a href="#/admin/accounts" title="Upravljanje nalozima">Nalozi</a>` : ''}
        <a href="#/ranklist">Rang lista</a>
        <a href="#/submissions">Predaje</a>
        <span class="spacer"></span>
        ${me ? `
          <span class="user-pill" title="Prijavljen korisnik">
            <span class="user-handle">${me.handle}</span>
            <span class="muted">rating ${me.rating}</span>
          </span>
          <a class="btn ghost" href="#/profile/${me.handle}">Profil</a>
          <button class="btn icon-btn exit-btn" type="button" id="logoutBtn" title="Izadi">
            <span class="exit-icon" aria-hidden="true"></span>
            <span class="exit-label">Izadi</span>
          </button>
        `: `
          <a class="btn ghost" href="#/login">Prijava</a>
          <a class="btn primary" href="#/register">Registracija</a>
        `}
      </div>
    </nav>`;
    const lb = root.querySelector('#logoutBtn');
    if (lb) lb.addEventListener('click', async () => {
      if (!window.confirm('Da li ste sigurni da zelite da izadjete?')) return;
      localStorage.removeItem('ca_session');
      try{ await signOut(auth); }catch(_){}
      window.dispatchEvent(new Event('ca:session'));
      location.hash = '#/';
      window.location.reload();
    });
    const toggle = root.querySelector('#navToggle');
    const nav = root.querySelector('#navBar');
    if (toggle && nav) {
      toggle.addEventListener('click', ()=>{
        nav.classList.toggle('open');
      });
    }
  };
  render();
  window.addEventListener('storage', render);
  window.addEventListener('hashchange', render);
  window.addEventListener('ca:session', render);
}

