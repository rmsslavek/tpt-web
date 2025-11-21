import { db } from '../storage.js';

export function ProblemsView(){
  const problems = db.problems();
  return `
  <section class="panel">
    <h2>Zbirka zadataka</h2>
    <div class="grid" style="grid-template-columns:200px 1fr 1fr;align-items:center">
      <input id="q" placeholder="Pretraga (naziv, tag)" />
      <select id="diff">
        <option value="">Sve težine</option>
        ${[800,900,1000,1200,1400,1600].map(d=>`<option value="${d}">${d}</option>`).join('')}
      </select>
      <span class="muted">Klik na naslov otvara zadatak.</span>
    </div>
    <table class="table" id="ptable" style="margin-top:.6rem">
      <thead><tr><th>Šifra</th><th>Naziv</th><th>Težina</th><th>Tagovi</th></tr></thead>
      <tbody>
        ${problems.map(row).join('')}
      </tbody>
    </table>
  </section>
  <script>
    (function(){
      const base = ${JSON.stringify(problems)};
      const q = document.getElementById('q');
      const d = document.getElementById('diff');
      const tbody = document.querySelector('#ptable tbody');
      function apply(){
        const text = (q.value||'').toLowerCase();
        const diff = d.value;
        const filtered = base.filter(p=>{
          const t = [p.title,...p.tags].join(' ').toLowerCase();
          const okText = !text || t.includes(text);
          const okDiff = !diff || String(p.difficulty)===diff;
          return okText && okDiff;
        });
        tbody.innerHTML = filtered.map(${row.toString()}).join('');
      }
      q.addEventListener('input', apply);
      d.addEventListener('change', apply);
    })();
  </script>`;
}

function row(p){
  return `<tr>
    <td>${p.id}</td>
    <td><a href="#/problem/${p.id}">${p.title}</a></td>
    <td>${p.difficulty}</td>
    <td class="muted">${p.tags.join(', ')}</td>
  </tr>`;
}

