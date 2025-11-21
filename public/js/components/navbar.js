import { currentUser } from '../storage.js';

export function Navbar(root){
  const render = () => {
    const me = currentUser();
    root.innerHTML = `
    <nav class="nav">
      <a class="brand" href="#/">CodeArena</a>
      <a href="#/problemset">Zadaci</a>
      <a href="#/contests">Takmičenja</a>
      <a href="#/tests">Testovi</a>
      <a href="#/ranklist">Rang lista</a>
      <a href="#/submissions">Predaje</a>
      <span class="spacer"></span>
      ${me ? `
        <span class="muted">${me.handle} • rating ${me.rating}</span>
        <a class="btn ghost" href="#/profile/${me.handle}">Profil</a>
        <button class="btn" id="logoutBtn">Odjava</button>
      `: `
        <a class="btn ghost" href="#/login">Prijava</a>
        <a class="btn primary" href="#/register">Registracija</a>
      `}
    </nav>`;
    const lb = root.querySelector('#logoutBtn');
    if (lb) lb.addEventListener('click', () => {
      localStorage.removeItem('ca_session');
      window.dispatchEvent(new Event('ca:session'));
      location.hash = '#/';
    });
  };
  render();
  window.addEventListener('storage', render);
  window.addEventListener('hashchange', render);
  window.addEventListener('ca:session', render);
}
