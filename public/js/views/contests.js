import { db } from '../storage.js';

export function ContestsView(){
  const contests = db.contests();
  return `
  <section class="panel">
    <h2>Takmičenja</h2>
    <table class="table">
      <thead><tr><th>Oznaka</th><th>Naziv</th><th>Početak</th><th>Trajanje</th><th></th></tr></thead>
      <tbody>
        ${contests.map(c=>`<tr>
          <td>${c.id}</td>
          <td><a href="#/contest/${c.id}">${c.title}</a></td>
          <td>${new Date(c.startTime).toLocaleString()}</td>
          <td>${c.durationMinutes} min</td>
          <td><a class="btn" href="#/contest/${c.id}">Detalji</a></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </section>`;
}


