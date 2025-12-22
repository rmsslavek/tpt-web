import { db } from '../storage.js';

export function HomeView(){
  const problems = db.problems().slice(0,5);
  const contests = db.contests().slice(0,3);
  return `
  <section class="grid hero-grid">
    <div class="panel hero-panel">
      <div class="hero-inner">
        <div class="hero-copy">
          <p class="eyebrow">CodeArena demo</p>
          <h2>Dobrodošli u CodeArena</h2>
          <p class="muted">Lokalni demo klon osnovnih funkcionalnosti platforme za takmičenja iz programiranja. Nije povezan sa Codeforces i koristi lokalno čuvanje podataka.</p>
          <div class="muted hero-test">
            <button class="btn ghost" id="testFirestoreBtn" type="button">Test Firestore upis</button>
            <span id="testFirestoreStatus" class="hero-test-status"></span>
          </div>
        </div>
        <div class="hero-actions">
          <a class="term-btn primary" href="#/problemset" data-text="open problemset" data-after="Spremno">
            <canvas class="bits"></canvas>
            <div class="line">
              <span class="prompt">$</span>
              <span class="output">open problemset</span>
              <span class="caret" aria-hidden="true"></span>
            </div>
            <div class="subline"></div>
          </a>
          <a class="term-btn" href="#/contests" data-text="open contests" data-after="Učitano">
            <canvas class="bits"></canvas>
            <div class="line">
              <span class="prompt">$</span>
              <span class="output">open contests</span>
              <span class="caret" aria-hidden="true"></span>
            </div>
            <div class="subline"></div>
          </a>
          <a class="term-btn" href="#/tests" data-text="open tests" data-after="Prikazano">
            <canvas class="bits"></canvas>
            <div class="line">
              <span class="prompt">$</span>
              <span class="output">open tests</span>
              <span class="caret" aria-hidden="true"></span>
            </div>
            <div class="subline"></div>
          </a>
        </div>
      </div>
      <script type="module">
        import { firestore, collection, addDoc, serverTimestamp } from './js/firebaseClient.js';
        const btn = document.getElementById('testFirestoreBtn');
        const statusEl = document.getElementById('testFirestoreStatus');
        const setStatus = (text, tone='muted') => {
          if (!statusEl) return;
          statusEl.textContent = text;
          statusEl.style.color = tone === 'ok' ? '#6ddf6d' : (tone === 'err' ? '#ff7b7b' : 'inherit');
        };
        if (btn) {
          btn.addEventListener('click', async () => {
            setStatus('⌛ upisujem...');
            try {
              const ref = await addDoc(collection(firestore, 'test'), {
                msg: 'pozdrav sa emulatora',
                t: Date.now(),
                createdAt: serverTimestamp(),
              });
              setStatus('✅ upisano u test/' + ref.id, 'ok');
              console.info('[diag] Firestore test write ok', ref.id);
            } catch (err) {
              console.error('Firestore test write fail', err);
              setStatus('❌ greska: ' + (err?.message || err), 'err');
            }
          });
        }
      </script>
    </div>
    <div class="panel news-panel">
      <h3>Uskoro počinje</h3>
      <ul>
        ${contests.map(c=>`<li><a href="#/contest/${c.id}">${c.title}</a> <span class="muted">• ${new Date(c.startTime).toLocaleString()}</span></li>`).join('')}
      </ul>
    </div>
  </section>
  <section class="panel" style="margin-top:1rem">
    <h3>Popularni zadaci</h3>
    <table class="table">
      <thead><tr><th>Šifra</th><th>Naziv</th><th>Težina</th><th>Tagovi</th></tr></thead>
      <tbody>
        ${problems.map(p=>`<tr>
          <td>${p.id}</td>
          <td><a href="#/problem/${p.id}">${p.title}</a></td>
          <td>${p.difficulty}</td>
          <td class="muted">${p.tags.join(', ')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </section>`;
}

