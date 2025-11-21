import { db } from '../storage.js';

export function RanklistView(){
  const users = db.users().filter(u=>!u.hidden).sort((a,b)=>b.rating-a.rating);
  return `
  <section class="panel">
    <h2>Rang lista</h2>
    <table class="table">
      <thead><tr><th>Poz</th><th>Korisnik</th><th>Rejting</th><th>Zemlja</th><th>Org</th></tr></thead>
      <tbody>
        ${users.map((u,i)=>`<tr>
          <td>${i+1}</td>
          <td><a href="#/profile/${u.handle}">${u.handle}</a></td>
          <td>${u.rating}</td>
          <td>${u.country||'—'}</td>
          <td>${u.org||'—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </section>`;
}
