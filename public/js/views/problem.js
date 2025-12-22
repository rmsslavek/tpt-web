import { db, currentUser } from '../storage.js';

export function ProblemView({ params }) {
  const [id] = params;
  const p = db.problems().find((x) => x.id === id);
  if (!p) return `<div class="panel">Zadatak nije pronađen.</div>`;
  const me = currentUser();
  const isAdmin = !!me?.isAdmin || !!me?.isOwner;
  const sampleTests = (p.samples || []).map((s, idx) => ({
    id: 'S' + idx,
    in: s.input || '',
    out: s.output || '',
    isSample: true,
  }));
  const tests = sampleTests.concat(Array.isArray(p.tests) ? p.tests : []);
  return `
  <section class="grid cols-2">
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:.8rem;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:.6rem">
          <h2 style="margin:0">${p.id}. ${p.title}</h2>
          ${isAdmin ? `<a class="btn ghost" href="#/problemset">Lista problema (admin)</a>` : ''}
        </div>
        <div class="muted">Težina: ${p.difficulty}</div>
      </div>
      <div class="muted">Vremensko ograničenje: ${p.timeLimit} ms • Memorija: ${p.memoryLimit} MB</div>
      <div style="margin-top:.8rem">${p.statement}</div>
      <h3>Primeri</h3>
      ${p.samples
        .map(
          (s) => `
        <div class="grid cols-2">
          <div><label>Ulaz</label><pre>${escapeHtml(s.input)}</pre></div>
          <div><label>Izlaz</label><pre>${escapeHtml(s.output)}</pre></div>
        </div>
      `
        )
        .join('')}
      ${isAdmin ? `
      <div class="panel" style="margin-top:1rem">
        <h3>Test primeri (admin)</h3>
        <div id="testsAdmin"></div>
        <form id="addTestForm" style="display:grid;gap:.5rem;margin-top:.6rem">
          <label>Ulaz<br><textarea name="input" rows="12" required></textarea></label>
          <label>Očekivani izlaz<br><textarea name="output" rows="12" required></textarea></label>
          <button class="btn" type="submit">Dodaj test</button>
        </form>
      </div>
      ` : ''}
    </div>

    <div class="panel">
      <h3>Predaja rešenja</h3>
      ${me ? `
      <p class="muted">C++ Piston API; test primeri se izvršavaju redom do prve greške.</p>
      <form id="submitForm">
        <div class="row">
          <label>Kod</label>
          <textarea name="source" rows="36" placeholder="Unesite C++ kod ovde"></textarea>
        </div>
        <div class="row">
          <label></label>
          <button class="btn primary" type="submit">Pošalji</button>
        </div>
      </form>
      <div id="verdict"></div>
      ` : `<p>Morate biti prijavljeni da biste predali rešenje. <a href="#/login">Prijava</a></p>`}
    </div>
  </section>

  <script id="problemData" type="application/json">${escapeHtml(JSON.stringify({
    problem: p,
    tests,
    isAdmin,
  }))}</script>
  <script type="module" src="./js/problemPage.js"></script>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}



