import { db } from '../storage.js';

export function ProfileView({ params }){
  const [handle] = params;
  const h = handle || (JSON.parse(localStorage.getItem('ca_session')||'null')?.handle);
  const user = db.users().find(u=>u.handle.toLowerCase()===(h||'').toLowerCase());
  if(!user) return `<div class="panel">Korisnik nije pronađen.</div>`;
  const subs = db.submissions().filter(s=>s.handle===user.handle);
  const ac = subs.filter(s=>s.verdict==='AC').length;
  return `
  <section class="panel">
    <h2>${user.handle}</h2>
    <p class="muted">Rejting: ${user.rating} • Zemlja: ${user.country||'—'} • Organizacija: ${user.org||'—'}</p>
  </section>
  <section class="panel" style="margin-top:1rem">
    <h3>Statistika</h3>
    <p>Ukupno predaja: ${subs.length} • Prihvaćenih: ${ac}</p>
    <table class="table">
      <thead><tr><th>Vreme</th><th>Zadatak</th><th>Rezultat</th></tr></thead>
      <tbody>
        ${subs.map(s=>`<tr><td>${new Date(s.time).toLocaleString()}</td><td><a href="#/problem/${s.problemId}">${s.problemId}</a></td><td class="status ${s.verdict==='AC'?'ac':'wa'}">${s.verdictText}</td></tr>`).join('')}
      </tbody>
    </table>
  </section>`;
}

