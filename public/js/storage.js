const LS = {
  users: 'ca_users',
  problems: 'ca_problems',
  contests: 'ca_contests',
  submissions: 'ca_submissions',
  session: 'ca_session',
  tests: 'ca_tests',
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    // ako je localStorage polomljen, kreni od podrazumevanih vrednosti
    localStorage.removeItem(key);
    return fallback;
  }
}

export function ensureSeed() {
  const F = fallbacks;

  const ensure = (key, url, fallback, transform = (v)=>v) => {
    const setVal = (val) => localStorage.setItem(key, JSON.stringify(transform(val)));
    if (localStorage.getItem(key)) return;
    setVal(fallback);
    if (typeof fetch === 'function') {
      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error('Failed to load '+url);
          return r.json();
        })
        .then(data => setVal(data))
        .catch(()=>{ /* fallback already set */ });
    }
  };

  ensure(LS.problems, 'data/problems.json', F.problems);
  ensure(LS.contests, 'data/contests.json', F.contests);
  ensure(LS.users, 'data/users.json', F.users, withDefaultSystemUsers);

  if (!localStorage.getItem(LS.submissions)) {
    localStorage.setItem(LS.submissions, JSON.stringify([]));
  }
  if (!localStorage.getItem(LS.tests)) {
    localStorage.setItem(LS.tests, JSON.stringify(F.tests));
  }

  // Uvek dodaj skrivene sistemske naloge (admin/gost) i kad postoje lokalni korisnici.
  db.saveUsers(withDefaultSystemUsers(db.users()));
  // Uvek ubaci podrazumevane testove ako fale u lokalnoj memoriji.
  db.saveTests(withDefaultTests(db.tests(), F.tests));
  return Promise.resolve();
}

export const db = {
  users() { return readJson(LS.users, []); },
  saveUsers(v){ localStorage.setItem(LS.users, JSON.stringify(v)); },

  problems() { return readJson(LS.problems, []); },
  saveProblems(v){ localStorage.setItem(LS.problems, JSON.stringify(v)); },

  contests() { return readJson(LS.contests, []); },
  saveContests(v){ localStorage.setItem(LS.contests, JSON.stringify(v)); },

  submissions(){ return readJson(LS.submissions, []); },
  saveSubmissions(v){ localStorage.setItem(LS.submissions, JSON.stringify(v)); },

  session(){ return readJson(LS.session, null); },
  saveSession(v){ localStorage.setItem(LS.session, JSON.stringify(v)); },

  tests(){ return readJson(LS.tests, []); },
  saveTests(v){ localStorage.setItem(LS.tests, JSON.stringify(v)); },
};

export function currentUser(){ return db.session(); }
export function requireAuth(){ if(!currentUser()) location.hash = '#/login'; }

export function findUser(handle){ return db.users().find(u=>u.handle.toLowerCase()===handle.toLowerCase()); }
export function isAdminHandle(handle){ const u = findUser(handle||''); return !!u?.isAdmin; }

function withDefaultSystemUsers(list){
  const users = Array.isArray(list) ? [...list] : [];
  const defaults = [
    {
      handle:'slavek',
      password:'NikolaJokic-2025',
      rating:5000,
      country:'RS',
      org:'CodeArena',
      email:'slavisa.radovic@gmail.com',
      isAdmin:true,
      isOwner:true,
      hidden:true
    },
    {
      handle:'gost',
      password:'613858',
      rating:1200,
      country:'RS',
      org:'',
      email:'',
      isAdmin:false,
      hidden:true
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
      ]
    },
  ],
  contests: [
    { id: 'CA-R1', title: 'CodeArena Round #1', startTime: '2025-11-01T12:00:00.000Z', durationMinutes: 120, problems: ['A100', 'B101', 'C102'] }
  ],
  users: [
    { handle: 'tourist_demo', password: 'demo', rating: 3800, country: 'RU', org: '-', email: 'tourist@example.com', isAdmin: false },
    { handle: 'benq_demo', password: 'demo', rating: 3600, country: 'US', org: '-', email: 'benq@example.com', isAdmin: false },
    { handle: 'newbie', password: '1234', rating: 800, country: 'RS', org: '-', email: 'newbie@example.com', isAdmin: false },
    { handle: 'site_owner', password: 'owner', rating: 5000, country: 'RS', org: 'CodeArena', email: 'owner@codearena.local', isAdmin: false, isOwner: false },
    { handle: 'slavek', password: 'NikolaJokic-2025', rating: 5000, country: 'RS', org: 'CodeArena', email: 'slavisa.radovic@gmail.com', isAdmin: true, isOwner: true, hidden: true },
    { handle: 'gost', password: '613858', rating: 1200, country: 'RS', org: '', email: '', isAdmin: false, hidden: true }
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
};
