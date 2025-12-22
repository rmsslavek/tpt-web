import { HomeView } from './views/home.js';
import { ProblemsView } from './views/problems.js';
import { ProblemView } from './views/problem.js';
import { ContestsView } from './views/contests.js';
import { ContestView } from './views/contest.js';
import { SubmissionsView } from './views/submissions.js';
import { ProfileView } from './views/profile.js';
import { LoginView, RegisterView } from './views/auth.js';
import { RanklistView } from './views/ranklist.js';
import { TestsListView, TestCreateView, TestRunView, TestEditView, initTestRunPage } from './views/tests.js';
import { AdminAccountsView } from './views/admin.js';
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
  { path: /^#\/tests\/run\/([\w-]+)\/?$/, view: TestRunView, init: initTestRunPage },
  { path: /^#\/admin\/accounts\/?$/, view: AdminAccountsView },
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
  const errors = [];
  root.querySelectorAll('script').forEach((old, idx) => {
    const type = (old.getAttribute('type') || '').toLowerCase();
    // Preskoči non-JS skripte (npr. application/json) da ne bismo dobili SyntaxError
    const isJsType = !type || type === 'text/javascript' || type === 'application/javascript' || type === 'module';
    if (!isJsType) return;
    const code = old.textContent || '';
    try {
      // Skip module skripte (CSP ih blokira za blob/import); neće se izvršiti
      if (type === 'module') return;
      const s = document.createElement('script');
      [...old.attributes].forEach(attr => s.setAttribute(attr.name, attr.value));
      s.textContent = code;
      // Umetni globalno (body ili head) da izbegnemo DOM Exception na insertBefore
      const target = document.body || document.head || old.parentNode;
      if (target) {
        target.appendChild(s);
      } else {
        // Fallback na eval
        try { (new Function(code))(); } catch(errExec){ console.error('[router] inline script eval fallback error', errExec); }
      }
      old.remove();
    } catch (errOuter) {
      const info = { index: idx, type, message: errOuter?.message || String(errOuter), textPreview: code.slice(0,120) };
      errors.push(info);
      console.error('[router] inline script error (outer)', info, errOuter);
    }
  });
  if (errors.length) {
    window.__inlineScriptErrors = errors;
  } else {
    window.__inlineScriptErrors = [];
  }
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
      if (typeof r.init === 'function') {
        try { await r.init({ root: viewEl(), params }); } catch(err){ console.error('init handler error', err); }
      }
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

