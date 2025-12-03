import { HomeView } from './views/home.js';
import { ProblemsView } from './views/problems.js';
import { ProblemView } from './views/problem.js';
import { ContestsView } from './views/contests.js';
import { ContestView } from './views/contest.js';
import { SubmissionsView } from './views/submissions.js';
import { ProfileView } from './views/profile.js';
import { LoginView, RegisterView } from './views/auth.js';
import { RanklistView } from './views/ranklist.js';
import { TestsListView, TestCreateView, TestRunView, TestEditView } from './views/tests.js';
import { initTermButtons } from './termButton.js';

const DEBUG_DUMP_KEY = 'ca_debug_dump';

const routes = [
  { path: /^#\/?$/, view: HomeView },
  { path: /^#\/problemset\/?$/, view: ProblemsView },
  { path: /^#\/problem\/([\w-]+)\/?$/, view: ProblemView },
  { path: /^#\/contests\/?$/, view: ContestsView },
  { path: /^#\/contest\/([\w-]+)\/?$/, view: ContestView },
  { path: /^#\/submissions\/?$/, view: SubmissionsView },
  { path: /^#\/profile\/?([\w-]+)?\/?$/, view: ProfileView },
  { path: /^#\/ranklist\/?$/, view: RanklistView },
  { path: /^#\/login\/?$/, view: LoginView },
  { path: /^#\/register\/?$/, view: RegisterView },
  { path: /^#\/tests\/?$/, view: TestsListView },
  { path: /^#\/tests\/new\/?$/, view: TestCreateView },
  { path: /^#\/tests\/edit\/([\w-]+)\/?$/, view: TestEditView },
  { path: /^#\/tests\/run\/([\w-]+)\/?$/, view: TestRunView },
];

const viewEl = () => document.getElementById('view');

export function navigate(hash) {
  if (location.hash === hash) return render();
  location.hash = hash;
}

export function initRouter() {
  window.addEventListener('hashchange', render);
  if (!location.hash) location.hash = '#/';
  render();
}

function runInlineScripts(root) {
  root.querySelectorAll('script').forEach(old => {
    const s = document.createElement('script');
    [...old.attributes].forEach(attr => s.setAttribute(attr.name, attr.value));
    s.textContent = old.textContent;
    old.replaceWith(s);
  });
}

async function render() {
  // Ako je URL dobio query (npr. iz submit-a), skloni ga da ne bi lomio inline skripte
  if (location.search) {
    history.replaceState(null, '', location.origin + location.pathname + location.hash);
  }
  const h = location.hash || '#/';
  for (const r of routes) {
    const m = h.match(r.path);
    if (m) {
      const params = m.slice(1);
      const html = await r.view({ params });
      viewEl().innerHTML = html;
      runInlineScripts(viewEl());
      attachActions(viewEl());
      initTermButtons(viewEl());
      maybeDumpRender(h, html);
      return;
    }
  }
  viewEl().innerHTML = `<div class="panel">Nepoznata ruta.</div>`;
}

function attachActions(root) {
  root.querySelectorAll('[data-nav]')?.forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.getAttribute('data-nav'));
    });
  });
}

function maybeDumpRender(hash, html) {
  // Omogući dump tako što ćeš u konzoli uraditi localStorage.setItem('ca_debug_dump','1')
  const isOn = localStorage.getItem(DEBUG_DUMP_KEY) === '1';
  if (!isOn) return;
  const text = `hash: ${hash}\n\n${html}`;
  window.__lastRenderHtml = text;
  try { localStorage.setItem('ca_render_dump', text); } catch (_) {}

  let link = document.getElementById('renderDumpLink');
  if (!link) {
    link = document.createElement('a');
    link.id = 'renderDumpLink';
    link.textContent = 'Preuzmi render dump';
    link.style.position = 'fixed';
    link.style.bottom = '8px';
    link.style.right = '8px';
    link.style.zIndex = '9999';
    link.style.background = '#111';
    link.style.color = '#fff';
    link.style.padding = '6px 10px';
    link.style.borderRadius = '4px';
    link.style.fontSize = '12px';
    link.style.textDecoration = 'none';
    document.body.appendChild(link);
  }

  if (link._blobUrl) {
    URL.revokeObjectURL(link._blobUrl);
  }
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = 'render-dump.txt';
  link._blobUrl = url;
}
