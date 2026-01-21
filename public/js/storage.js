import {
  firestore,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from './firebaseClient.js';

const LS = {
  users: 'ca_users',
  problems: 'ca_problems',
  contests: 'ca_contests',
  submissions: 'ca_submissions',
  submissionsBackup: 'ca_submissions_backup',
  session: 'ca_session',
  tests: 'ca_tests',
  homeworks: 'ca_homeworks',
};

const COLLECTIONS = {
  users: 'users',
  problems: 'problems',
  contests: 'contests',
  submissions: 'submissions',
  tests: 'tests',
  sessions: 'sessions',
  homeworks: 'homeworks',
};

const state = {
  users: [],
  problems: [],
  contests: [],
  submissions: [],
  tests: [],
  homeworks: [],
};

let bridgeInstalled = false;
let seedDone = false;
let currentSessionHandle = null;
let lastFetchedCounts = null;
let firestoreOnline = true;
let cachedIp = null;

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (e) {
    return fallback;
  }
}

function readJson(key, fallback) {
  return safeParse(localStorage.getItem(key), fallback);
}

function loadLocalState(){
  state.users = withDefaultSystemUsers(readJson(LS.users, fallbacks.users));
  state.problems = (readJson(LS.problems, fallbacks.problems) || []).map(normalizeProblem);
  state.contests = readJson(LS.contests, fallbacks.contests || []);
  const localSubs = readJson(LS.submissions, []);
  state.submissions = localSubs.length ? localSubs : readJson(LS.submissionsBackup, []);
  state.tests = withDefaultTests(readJson(LS.tests, fallbacks.tests || []), fallbacks.tests);
  state.homeworks = (readJson(LS.homeworks, fallbacks.homeworks || []) || []).map(normalizeHomework);
}

async function fetchClientIp(){
  if (cachedIp) return cachedIp;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 2500) : null;
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller ? controller.signal : undefined,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`ipify status ${res.status}`);
    const data = await res.json();
    const ip = data && typeof data.ip === 'string' ? data.ip : null;
    if (ip) {
      cachedIp = ip;
      return ip;
    }
  } catch (err) {
    // Fallback below.
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
  return cachedIp || '127.0.0.1';
}

function normalizeProblem(p){
  return { ...p, tests: Array.isArray(p.tests) ? p.tests : [] };
}

function normalizeHomework(hw){
  return {
    id: hw.id,
    title: hw.title || '',
    creator: hw.creator || '',
    assignedHandle: hw.assignedHandle || '',
    assignedHandles: Array.isArray(hw.assignedHandles) ? hw.assignedHandles : (hw.assignedHandle ? [hw.assignedHandle] : []),
    problems: Array.isArray(hw.problems) ? hw.problems : [],
    tests: Array.isArray(hw.tests) ? hw.tests : [],
    dueAt: typeof hw.dueAt === 'number' ? hw.dueAt : (hw.dueAt ? Number(hw.dueAt) : null),
    createdAt: hw.createdAt || Date.now(),
  };
}

async function fetchCollection(name) {
  const snap = await getDocs(collection(firestore, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function replaceCollection(name, items, idField) {
  const snap = await getDocs(collection(firestore, name));
  const existing = new Set(snap.docs.map((d) => d.id));
  const incoming = new Set();
  await Promise.all(
    (items || []).map(async (item) => {
      const genId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.floor(Math.random()*1000));
      const id = String(item[idField] || item.id || genId);
      incoming.add(id);
      await setDoc(doc(firestore, name, id), { ...item, id });
    })
  );
  const toDelete = [...existing].filter((id) => !incoming.has(id));
  await Promise.all(toDelete.map((id) => deleteDoc(doc(firestore, name, id))));
}

async function seedIfEmpty() {
  const tasks = [];
  const F = fallbacks;
  const fetched = lastFetchedCounts || {};
  const isEmpty = (key, stateCount) => (typeof fetched[key] === 'number' ? fetched[key] === 0 : stateCount === 0);
  if (isEmpty('problems', state.problems.length)) tasks.push(replaceCollection(COLLECTIONS.problems, F.problems, 'id'));
  if (isEmpty('contests', state.contests.length)) tasks.push(replaceCollection(COLLECTIONS.contests, F.contests, 'id'));
  if (isEmpty('users', state.users.length)) tasks.push(replaceCollection(COLLECTIONS.users, withDefaultSystemUsers(F.users), 'handle'));
  if (isEmpty('tests', state.tests.length)) tasks.push(replaceCollection(COLLECTIONS.tests, withDefaultTests([], F.tests), 'id'));
  if (isEmpty('submissions', state.submissions.length)) tasks.push(replaceCollection(COLLECTIONS.submissions, [], 'id'));
  if (isEmpty('homeworks', state.homeworks.length)) tasks.push(replaceCollection(COLLECTIONS.homeworks, F.homeworks || [], 'id'));
  if (tasks.length) {
    await Promise.all(tasks);
    await loadFromFirestore();
  }
}

async function loadFromFirestore() {
  const [users, problems, contests, submissions, tests] = await Promise.all([
    fetchCollection(COLLECTIONS.users),
    fetchCollection(COLLECTIONS.problems),
    fetchCollection(COLLECTIONS.contests),
    fetchCollection(COLLECTIONS.submissions),
    fetchCollection(COLLECTIONS.tests),
  ]);
  const localSubs = readJson(LS.submissions, []);
  const backupSubs = readJson(LS.submissionsBackup, []);
  const localMerged = localSubs.length ? localSubs : backupSubs;
  lastFetchedCounts = {
    users: users.length,
    problems: problems.length,
    contests: contests.length,
    submissions: submissions.length,
    tests: tests.length,
  };
  state.users = withDefaultSystemUsers(users);
  state.problems = problems.map(normalizeProblem);
  state.contests = contests;
  state.submissions = mergeSubmissions(submissions, localMerged);
  state.tests = withDefaultTests(tests, fallbacks.tests);

  localStorage.setItem(LS.users, JSON.stringify(state.users));
  localStorage.setItem(LS.problems, JSON.stringify(state.problems));
  localStorage.setItem(LS.contests, JSON.stringify(state.contests));
  localStorage.setItem(LS.submissions, JSON.stringify(state.submissions));
  localStorage.setItem(LS.submissionsBackup, JSON.stringify(state.submissions));
  localStorage.setItem(LS.tests, JSON.stringify(state.tests));
}

function installStorageBridge() {
  if (bridgeInstalled) return;
  bridgeInstalled = true;
  const originalSet = localStorage.setItem.bind(localStorage);
  const originalRemove = localStorage.removeItem.bind(localStorage);
  localStorage.setItem = (key, value) => {
    originalSet(key, value);
    void mirrorSet(key, value);
  };
  localStorage.removeItem = (key) => {
    originalRemove(key);
    void mirrorRemove(key);
  };
}

async function mirrorSet(key, value) {
  if (key === LS.users) {
    state.users = withDefaultSystemUsers(safeParse(value, []));
    if (!firestoreOnline) return;
    return replaceCollection(COLLECTIONS.users, state.users, 'handle');
  }
  if (key === LS.problems) {
    state.problems = safeParse(value, []);
    if (!firestoreOnline) return;
    return replaceCollection(COLLECTIONS.problems, state.problems, 'id');
  }
  if (key === LS.contests) {
    state.contests = safeParse(value, []);
    if (!firestoreOnline) return;
    return replaceCollection(COLLECTIONS.contests, state.contests, 'id');
  }
  if (key === LS.submissions) {
    state.submissions = safeParse(value, []);
    return;
  }
  if (key === LS.tests) {
    state.tests = withDefaultTests(safeParse(value, []), fallbacks.tests);
    if (!firestoreOnline) return;
    return replaceCollection(COLLECTIONS.tests, state.tests, 'id');
  }
  if (key === LS.session) {
    const sess = safeParse(value, null);
    currentSessionHandle = sess?.handle || null;
    if (!firestoreOnline) return;
    if (sess?.handle) {
      await setDoc(doc(firestore, COLLECTIONS.sessions, sess.handle), {
        handle: sess.handle,
        updatedAt: serverTimestamp(),
      });
    }
  }
}

async function mirrorRemove(key) {
  if (key === LS.session) {
    if (currentSessionHandle && firestoreOnline) {
      await deleteDoc(doc(firestore, COLLECTIONS.sessions, currentSessionHandle)).catch(() => {});
    }
    currentSessionHandle = null;
  }
}

export async function ensureSeed() {
  if (seedDone) return;
  try{
    await loadFromFirestore();
    await seedIfEmpty();
  }catch(err){
    console.warn('Firestore init failed, using local data only', err);
    firestoreOnline = false;
    loadLocalState();
  }
  const storedSession = safeParse(localStorage.getItem(LS.session), null);
  currentSessionHandle = storedSession?.handle || null;
  installStorageBridge();
  if (storedSession) void mirrorSet(LS.session, JSON.stringify(storedSession));
  if (state.submissions?.length) {
    void mirrorSet(LS.submissions, JSON.stringify(state.submissions));
  }
  seedDone = true;
}

export async function recordUserAccess(handle){
  if(!handle) return;
  const idx = state.users.findIndex(u=> (u.handle||'').toLowerCase() === String(handle).toLowerCase());
  if(idx<0) return;
  const now = Date.now();
  const ip = (await fetchClientIp()) || '127.0.0.1';
  const updated = { ...state.users[idx] };
  if(!updated.firstSeen) updated.firstSeen = now;
  updated.lastSeen = now;
  updated.lastIp = ip;
  state.users[idx] = updated;
  db.saveUsers(state.users);
}

export async function persistSubmission(submission){
  if (!firestoreOnline || !submission?.id) return;
  try{
    await setDoc(doc(firestore, COLLECTIONS.submissions, submission.id), submission);
  }catch(err){
    console.warn('Submission sync failed', err);
  }
}

export function setUserDisabled(handle, disabled){
  const idx = state.users.findIndex(u=> (u.handle||'').toLowerCase() === String(handle).toLowerCase());
  if(idx<0) return false;
  state.users[idx] = { ...state.users[idx], disabled: !!disabled };
  db.saveUsers(state.users);
  return true;
}

if (typeof window !== 'undefined') {
  window.recordUserAccess = recordUserAccess;
  window.setUserDisabled = setUserDisabled;
  window.setUserProfessor = setUserProfessor;
}

export const db = {
  users() { return state.users; },
  saveUsers(v){ localStorage.setItem(LS.users, JSON.stringify(v)); },

  problems() { return state.problems; },
  saveProblems(v){ localStorage.setItem(LS.problems, JSON.stringify(v)); },

  contests() { return state.contests; },
  saveContests(v){ localStorage.setItem(LS.contests, JSON.stringify(v)); },

  submissions(){
    if (!state.submissions?.length) {
      const stored = readJson(LS.submissions, []);
      const backup = readJson(LS.submissionsBackup, []);
      const merged = stored?.length ? stored : backup;
      if (merged?.length) state.submissions = merged;
    }
    return state.submissions;
  },
  saveSubmissions(v){
    state.submissions = Array.isArray(v) ? v : [];
    try{
      localStorage.setItem(LS.submissions, JSON.stringify(state.submissions));
      localStorage.setItem(LS.submissionsBackup, JSON.stringify(state.submissions));
    }catch(err){
      console.warn('localStorage submissions write failed, saving lean copy', err);
      const lean = state.submissions.map(stripSubmissionSource);
      try{
        localStorage.setItem(LS.submissions, JSON.stringify(lean));
        localStorage.setItem(LS.submissionsBackup, JSON.stringify(lean));
      }catch(err2){
        console.warn('localStorage lean submissions write failed', err2);
      }
    }
  },

  session(){ return currentSessionHandle ? { handle: currentSessionHandle } : null; },
  saveSession(v){ localStorage.setItem(LS.session, JSON.stringify(v)); },

  tests(){ return state.tests; },
  saveTests(v){ localStorage.setItem(LS.tests, JSON.stringify(v)); },

  homeworks(){ return state.homeworks; },
  saveHomeworks(v){ localStorage.setItem(LS.homeworks, JSON.stringify(v)); },
};

export function currentUser(){ return findUser(db.session()?.handle || ''); }
export function requireAuth(){ if(!currentUser()) location.hash = '#/login'; }

export function findUser(handle){ return state.users.find(u=>u.handle.toLowerCase()===handle.toLowerCase()); }
export function isAdminHandle(handle){ const u = findUser(handle||''); return !!u?.isAdmin; }
export function isProfessorHandle(handle){ const u = findUser(handle||''); return !!u?.isProfessor || !!u?.isAdmin || !!u?.isOwner; }

function withDefaultSystemUsers(list){
  const users = Array.isArray(list) ? [...list] : [];
  const defaults = [
    {
      handle:'slavek',
      password:'NikolaJokic-2025',
      rating:5000,
      country:'RS',
      org:'CodeArena',
      email:'slavisa.radovic+slavek@gmail.com',
      isAdmin:true,
      isProfessor:true,
      isOwner:true,
      hidden:true,
      disabled:false
    },
    {
      handle:'gost',
      password:'613858',
      rating:1200,
      country:'RS',
      org:'',
      email:'',
      isAdmin:false,
      isProfessor:false,
      hidden:true,
      disabled:false
    }
  ];

  defaults.forEach(template=>{
    const idx = users.findIndex(u=>u.handle?.toLowerCase()===template.handle.toLowerCase());
    if(idx>=0){
      users[idx] = { ...users[idx], ...template };
    }else{
      users.push(template);
    }
  });
  // ensure admin implies professor
  return users.map(u=> ({ ...u, isProfessor: u.isProfessor || u.isAdmin || u.isOwner || false }));
}

export function setUserProfessor(handle, val){
  const users = db.users();
  const idx = users.findIndex(u=>u.handle.toLowerCase()===handle.toLowerCase());
  if(idx===-1) return false;
  users[idx] = { ...users[idx], isProfessor: !!val || !!users[idx].isAdmin };
  db.saveUsers(users);
  return users;
}

function withDefaultTests(list, defaults){
  const tests = Array.isArray(list) ? [...list] : [];
  (defaults || []).forEach(t=>{
    if(!tests.some(x=>x.id === t.id)){
      tests.push(t);
    }
  });
  return tests;
}

function mergeSubmissions(remote, local) {
  const merged = [];
  const byId = new Map();
  const add = (s) => {
    if (!s || !s.id) return;
    if (!byId.has(s.id)) {
      byId.set(s.id, s);
      merged.push(s);
    }
  };
  (Array.isArray(remote) ? remote : []).forEach(add);
  (Array.isArray(local) ? local : []).forEach(add);
  return merged;
}

function stripSubmissionSource(s){
  if (!s || typeof s !== 'object') return s;
  const { source, ...rest } = s;
  return rest;
}

const fallbacks = {
  problems: [
    {
      id: 'A100',
      title: 'Zbir dva broja',
      difficulty: 800,
      tags: ['bazicno', 'string', 'aritmetika'],
      timeLimit: 1000,
      memoryLimit: 256,
      statement: '<p>Data su dva broja u jednoj liniji, razdvojena razmakom. Ispisite njihov zbir.</p><p><b>Ulaz:</b> jedna linija sa dva cela broja.</p><p><b>Izlaz:</b> jedan ceo broj - zbir.</p>',
      samples: [
        { input: '2 3\n', output: '5\n' },
        { input: '-10 7\n', output: '-3\n' }
      ],
      tests: [
        { id: 'T1', in: '2 3\n', out: '5\n' },
        { id: 'T2', in: '-10 7\n', out: '-3\n' },
        { id: 'T3', in: '0 0\n', out: '0\n' }
      ]
    },
    {
      id: 'B101',
      title: 'Brojanje reci',
      difficulty: 900,
      tags: ['parsiranje', 'string'],
      timeLimit: 1000,
      memoryLimit: 256,
      statement: '<p>Dato je vise linija teksta. Prebrojite koliko reci sadrzi tekst. Rec je niz znakova razdvojen razmakom.</p>',
      samples: [
        { input: 'hello world\n', output: '2\n' },
        { input: '  a   bb  ccc \n', output: '3\n' }
      ],
      tests: [
        { id: 'T1', in: 'hello world\n', out: '2\n' },
        { id: 'T2', in: '  a   bb  ccc \n', out: '3\n' },
        { id: 'T3', in: 'jedan dva tri\ncetiri\n', out: '4\n' }
      ]
    },
    {
      id: 'C102',
      title: 'Najveci broj',
      difficulty: 1000,
      tags: ['sortiranje'],
      timeLimit: 2000,
      memoryLimit: 256,
      statement: '<p>Data je lista celih brojeva. Ipisite najveci.</p>',
      samples: [
        { input: '5\n1 9 3 9 5\n', output: '9\n' },
        { input: '3\n-1 -5 -3\n', output: '-1\n' }
      ],
      tests: [
        { id: 'T1', in: '5\n1 9 3 9 5\n', out: '9\n' },
        { id: 'T2', in: '3\n-1 -5 -3\n', out: '-1\n' },
        { id: 'T3', in: '4\n100 2 3 4\n', out: '100\n' }
      ]
    },
  ],
  contests: [
    { id: 'CA-R1', title: 'CodeArena Round #1', startTime: '2025-11-01T12:00:00.000Z', durationMinutes: 120, problems: ['A100', 'B101', 'C102'] }
  ],
  users: [
    { handle: 'tourist_demo', password: 'demo', rating: 3800, country: 'RU', org: '-', email: 'tourist@example.com', isAdmin: false, disabled:false },
    { handle: 'benq_demo', password: 'demo', rating: 3600, country: 'US', org: '-', email: 'benq@example.com', isAdmin: false, disabled:false },
    { handle: 'newbie', password: '1234', rating: 800, country: 'RS', org: '-', email: 'newbie@example.com', isAdmin: false, disabled:false },
    { handle: 'site_owner', password: 'owner', rating: 5000, country: 'RS', org: 'CodeArena', email: 'owner@codearena.local', isAdmin: false, isOwner: false, disabled:false },
    { handle: 'slavek', password: 'NikolaJokic-2025', rating: 5000, country: 'RS', org: 'CodeArena', email: 'slavisa.radovic+slavek@gmail.com', isAdmin: true, isOwner: true, hidden: true, disabled:false },
    { handle: 'gost', password: '613858', rating: 1200, country: 'RS', org: '', email: '', isAdmin: false, hidden: true, disabled:false }
  ],
  tests: [
    {
      id: 'demo-quiz',
      title: 'Demo kviz',
      durationSeconds: 90,
      authorHandle: 'site_owner',
      authorEmail: 'owner@codearena.local',
      questions: [
        { text: 'Koja je slozenost merge sorta?', options: ['O(n)', 'O(n log n)', 'O(log n)', 'O(n^2)'], answer: 1 },
        { text: 'Koja JS metoda dodaje element na kraj niza?', options: ['shift', 'unshift', 'push', 'pop'], answer: 2 },
        { text: 'Koliko bitova ima jedan bajt?', options: ['4', '8', '16', '32'], answer: 1 }
      ]
    },
    {
      id: 'osnovni-test',
      title: 'Osnovni test',
      durationSeconds: 120,
      questions: [
        { text: 'Koliko bajtova je potrebno za jedan long long', options: ['1', '2', '4', '8'], answer: 3 },
        { text: 'Koja je vremenska slozenost binarne pretrage', options: ['log(n)', 'nlog(n)', '2n', 'sqrt(n)'], answer: 0 },
        { text: 'Koja je memorijska slozenost segmentnog stabla', options: ['n', '2n', 'log(n)', 'nlog(n)'], answer: 1 }
      ],
      authorHandle: 'slavek',
      authorEmail: 'owner@codearena.local'
    }
  ]
  ,
  homeworks:[]
};

