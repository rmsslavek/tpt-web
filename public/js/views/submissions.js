import { db } from '../storage.js';

export function SubmissionsView(){
  const subs = db.submissions();
  return `
  <section class="panel">
    <h2>Predaje</h2>
    <table class="table">
      <thead><tr><th>ID</th><th>Vreme</th><th>Autor</th><th>Zadatak</th><th>Jezik</th><th>Rezultat</th><th>Dužina</th></tr></thead>
      <tbody>
        ${subs.map(s=>`<tr>
          <td>${s.id}</td>
          <td>${new Date(s.time).toLocaleString()}</td>
          <td><a href="#/profile/${s.handle}">${s.handle}</a></td>
          <td><a href="#/problem/${s.problemId}">${s.problemId}</a></td>
          <td>${s.lang}</td>
          <td class="status ${cls(s.verdict)}">${s.verdictText}</td>
          <td>${s.length}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </section>`;
}

function cls(v){
  if(v==='AC') return 'ac';
  if(v==='WA'||v==='RE') return 'wa';
  return 'pd';
}


