// Token Radar's dark dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, five filters, a per-protocol detail drawer with the model's own inputs
// and the protocol's farm plan, and the live-token comparison. No network: every byte it shows is
// in data.js. Rows are compact arrays: [rank, slug, name, cat, chains, nChains, tvl, g7d, age,
// implied]. The page re-derives the multipliers from those figures, the calibration table and the
// model constants, so it recomputes every row's implied value exactly.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', cat: 'all', ch: 'all', scope: 'all', band: 'all', tab: 'pre', sort: 'implied', dir: -1, selected: null };
  var MC = DATA.mc; // [growthW, growthLo, growthHi, matLo, matRange, matDays, unknownAge, breadthStep, breadthMax, minSample, multLo, multHi]
  var FLOOR = DATA.fl;

  function usd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function ageFmt(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(d)) + 'd';
  }
  // The model in four functions: the page re-derives every multiplier from the raw figures plus
  // the calibration table and the model constants, and checks the number board.json carries, so the
  // page's code and the board's data are visibly the same arithmetic.
  function round4(n) { return Math.round(n * 1e4) / 1e4; }
  function catMult(r) { var hit = DATA.cal[r[3]]; return hit ? hit[0] : DATA.gm; }
  function growthMult(r) { var g = Math.min(MC[2], Math.max(MC[1], r[7] === null ? 0 : r[7])); return round4(1 + (g / 100) * MC[0]); }
  function maturityMult(r) { var a = r[8] === null ? MC[6] : r[8]; return round4(MC[3] + (Math.min(Math.max(a, 0), MC[5]) / MC[5]) * MC[4]); }
  function breadthMult(r) { return round4(1 + Math.min(Math.max(r[5] - 1, 0), MC[8]) * MC[7]); }
  function impliedOf(r) { return Math.max(1, Math.round(r[6] * catMult(r) * growthMult(r) * maturityMult(r) * breadthMult(r))); }
  function catName(r) { return DATA.cats[r[3]] || 'Other'; }
  function chainNames(r) { return r[4].map(function (i) { return DATA.ch[i]; }); }
  function isWatchlist(r) { return r[6] >= FLOOR; }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function capitalFor(r) {
    if (r[6] >= 2e9) return 300;
    if (r[6] >= 5e8) return 200;
    if (r[6] >= 1e8) return 100;
    return 50;
  }
  function holdFor(age) {
    if (age === null || age === undefined) return 45;
    if (age < 90) return 90;
    if (age < 365) return 60;
    return 30;
  }
  function actionFor(r, capital, chain) {
    var c = catName(r).toLowerCase(), n = r[2];
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + n + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + n + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + n + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + n + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('option') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + n + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + n + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('basis trading') >= 0) return 'Deposit $' + capital + ' into a ' + n + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + n + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + n + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('payment') >= 0) return 'Route $' + capital + ' of payments through ' + n + ' on ' + chain + ' and keep the account active.';
    if (c.indexOf('governance') >= 0) return 'Deposit $' + capital + " into " + n + "'s governance vault on " + chain + ' and vote once.';
    if (c.indexOf('chain') >= 0) return 'Use $' + capital + ' of ' + n + "'s gas token on " + chain + ' and make one transaction a week.';
    if (c.indexOf('cedefi') >= 0 || c.indexOf('aggregator') >= 0 || c.indexOf('index') >= 0) return 'Deposit $' + capital + ' into ' + n + ' on ' + chain + ' and keep the position open.';
    return 'Deposit $' + capital + ' of USDC into ' + n + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(s) {
    var t = s[0] + ' Cost: ' + s[1] + '. Time: ' + s[2] + '.';
    if (t.length > 600) t = t.slice(0, 596) + '...';
    if (t.length < 20) t = t + ' Hold the position and check the protocol\'s own page.';
    return t;
  }
  function farmSteps(r) {
    var chains = chainNames(r), capital = capitalFor(r), hold = holdFor(r[8]);
    var multi = r[5] > 1;
    var steps = [
      ['Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', 'under $3 of gas for the first transaction', '5 minutes'],
      [actionFor(r, capital, chains[0] || 'its main chain'), '$' + capital + ' of capital and about $' + (capital >= 200 ? 8 : 4) + ' of gas', '15 minutes to set up'],
      multi
        ? ['Repeat a smaller position of $' + Math.max(25, Math.round(capital / 2)) + ' on ' + (chains[1] || 'its second chain') + ' so the activity is counted on more than one chain.', 'about $4 of gas', '10 minutes']
        : ['Open the protocol\'s own points or rewards page and confirm the wallet is being tracked before you commit more.', 'nothing to check', '10 minutes'],
      ['Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', 'about $2 of gas a week', '10 minutes a week'],
      ['Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', 'the $' + capital + ' stays in the position', hold + ' days'],
      ['When a claim opens, use only the link the protocol itself publishes, and never pay a fee to claim.', 'no fee to check; gas to claim only', '10 minutes'],
      ['Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', 'nothing but the log', '5 minutes']
    ];
    return steps.map(stepText);
  }

  function readHash() {
    var h = window.location.hash.replace(/^#/, '');
    if (!h) return;
    var p = new URLSearchParams(h);
    if (p.get('q')) state.q = p.get('q');
    if (p.get('cat')) state.cat = p.get('cat');
    if (p.get('ch')) state.ch = p.get('ch');
    if (p.get('scope')) state.scope = p.get('scope');
    if (p.get('band')) state.band = p.get('band');
    if (p.get('tab')) state.tab = p.get('tab');
    if (p.get('p')) state.selected = p.get('p');
  }
  function writeHash() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.cat !== 'all') p.set('cat', state.cat);
    if (state.ch !== 'all') p.set('ch', state.ch);
    if (state.scope !== 'all') p.set('scope', state.scope);
    if (state.band !== 'all') p.set('band', state.band);
    if (state.tab !== 'pre') p.set('tab', state.tab);
    if (state.selected) p.set('p', state.selected);
    var next = p.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function bandOf(r) {
    if (r[9] >= 1e8) return '100m';
    if (r[9] >= 1e7) return '10m';
    if (r[9] >= 1e6) return '1m';
    return 'sub1m';
  }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.cat !== 'all' && String(r[3]) !== state.cat) return false;
      if (state.ch !== 'all' && r[4].indexOf(+state.ch) < 0) return false;
      if (state.scope === 'watchlist' && !isWatchlist(r)) return false;
      if (state.scope === 'early' && isWatchlist(r)) return false;
      if (state.band !== 'all' && bandOf(r) !== state.band) return false;
      if (!q) return true;
      var hay = [r[2], r[1], catName(r), chainNames(r).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sorted(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a[2].toLowerCase(); bv = b[2].toLowerCase(); }
      else if (key === 'tvl') { av = a[6]; bv = b[6]; }
      else if (key === 'growth') { av = a[7] === null ? -Infinity : a[7]; bv = b[7] === null ? -Infinity : b[7]; }
      else if (key === 'age') { av = a[8] === null ? Infinity : a[8]; bv = b[8] === null ? Infinity : b[8]; }
      else { av = a[9]; bv = b[9]; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.a }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.mv + ' model' })
      ));
  }
  function lede() {
    var top = DATA.rows.slice(0, 10), max = top[0] ? top[0][9] : 1;
    var sweep = el('div', { class: 'sweep' }, top.map(function (r) {
      return el('div', { class: 'sweep-row' },
        el('span', { class: 'nm', text: '#' + r[0] + ' ' + r[2] }),
        el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r[9] / max) * 100)) + '%' })),
        el('span', { class: 'vl', text: usd(r[9]) }));
    }));
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.wl + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(FLOOR / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.es + ' pre-token protocols below that floor. Implied value is a model, not a promise.' }),
        sweep,
        el('p', { class: 'sweep-note', text: 'Top ten by implied value. The first ten rows hold ' + Math.round(100 * top.reduce(function (s, r) { return s + r[9]; }, 0) / DATA.rows.reduce(function (s, r) { return s + r[9]; }, 0)) + '% of the board\u2019s total implied value.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.wl + ' / ' + DATA.wl })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.bs) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.es) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.ls) })),
        el('div', { class: 'fact' }, el('span', { text: 'Top implied value' }), el('b', { text: usd(DATA.rows[0] ? DATA.rows[0][9] : 0) }))
      ));
  }
  function selectField(id, label, opts, cur, onChange) {
    var s = el('select', { id: id, 'aria-label': label }, opts.map(function (o) {
      return el('option', { value: o[0], text: o[1], selected: o[0] === cur ? 'selected' : null });
    }));
    s.addEventListener('change', function () { onChange(s.value); writeHash(); render(); });
    return el('div', { class: 'field' }, el('label', { for: id, text: label }), s);
  }
  function controls() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r[3]; }))).sort(function (a, b) { return a - b; });
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r[4]); }, []))).sort(function (a, b) { return a - b; });
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      selectField('cat', 'Category', [['all', 'All categories']].concat(cats.map(function (i) { return [String(i), DATA.cats[i]]; })), state.cat, function (v) { state.cat = v; }),
      selectField('ch', 'Chain', [['all', 'All chains']].concat(chains.map(function (i) { return [String(i), DATA.ch[i]]; })), state.ch, function (v) { state.ch = v; }),
      selectField('scope', 'Scope', [['all', 'Watchlist + early'], ['watchlist', 'Watchlist only'], ['early', 'Early only']], state.scope, function (v) { state.scope = v; }),
      selectField('band', 'Implied value', [['all', 'Any value'], ['100m', '\u2265 $100M'], ['10m', '$10M \u2013 $100M'], ['1m', '$1M \u2013 $10M'], ['sub1m', '< $1M']], state.band, function (v) { state.band = v; }),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre' ? filtered().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }
  function sortHead(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label, state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null));
  }
  function boardTable() {
    var list = sorted(filtered());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another filter to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.cat = 'all'; state.ch = 'all'; state.scope = 'all'; state.band = 'all'; writeHash(); render(); } })));
    }
    var max = list[0][9] || 1, tbody = el('tbody');
    list.forEach(function (r) {
      var g = r[7] === null ? 'n/a' : pct(r[7]);
      var gc = r[7] === null ? '' : r[7] >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r[1] ? 'true' : 'false', tabindex: '0',
        onclick: function () { openDetail(r[1]); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r[1]); } }
      },
        el('td', { class: 'num', text: String(r[0]) }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r[2] }),
          el('span', { class: 'sub', text: catName(r) + ' on ' + (chainNames(r).slice(0, 2).join(', ') || 'an unnamed chain') + (r[5] > 2 ? ' +' + (r[5] - 2) + ' more' : '') }))),
        el('td', { class: 'num', text: usd(r[6]) }),
        el('td', { class: 'num ' + gc, text: g }),
        el('td', { class: 'num', text: ageFmt(r[8]) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r[9] / max) * 100)) + '%' })),
          el('span', { class: 'num', text: usd(r[9]) }))),
        el('td', null, el('span', { class: 'tag' + (isWatchlist(r) ? ' hot' : ''), text: isWatchlist(r) ? 'Watchlist' : 'Early' })));
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
        el('thead', null, el('tr', null,
          sortHead('implied', 'Rank'), sortHead('name', 'Protocol'), sortHead('tvl', 'TVL'), sortHead('growth', '7d'),
          sortHead('age', 'Age'), sortHead('implied', 'Implied value'), el('th', { scope: 'col', text: 'Scope' }))),
        tbody)));
  }
  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r[1] }),
          el('span', { class: 'sub', text: (DATA.cats[r[2]] || 'Other') + ' on ' + (r[3].map(function (i) { return DATA.ch[i]; }).slice(0, 2).join(', ') || 'an unnamed chain') + (r[4] > 2 ? ' +' + (r[4] - 2) + ' more' : '') }))),
        el('td', { class: 'num', text: usd(r[5]) }),
        el('td', { class: 'num ' + (r[7] !== null && r[7] >= 0 ? 'pos' : 'neg'), text: pct(r[7]) }),
        el('td', { class: 'num', text: usd(r[6]) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { class: 'sub', text: 'Tokens that already trade: their market cap is a fact, not a model. They are set aside from the pre-token ranking, and their market-cap-to-TVL ratios calibrate the model above.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
        tbody)));
  }
  function modelPanel() {
    var calRows = DATA.cats.map(function (c, i) {
      var hit = DATA.cal[i];
      return el('tr', null,
        el('td', { text: c }),
        el('td', { class: 'num', text: hit ? String(hit[1]) : '0' }),
        el('td', { class: 'num', text: hit ? hit[0].toFixed(4) : 'fallback ' + DATA.gm.toFixed(4) }));
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked. The category multiple is not a guess: it is the median market-cap-to-TVL ratio of the live-token protocols in that category, read off this same snapshot.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x catMult x (1 + clamp(change_7d, ' + MC[1] + ', ' + MC[2] + ') / 100 x ' + MC[0] + ') x (' + MC[3] + ' + min(age_days, ' + MC[5] + ') / ' + MC[5] + ' x ' + MC[4] + ') x (1 + min(chains - 1, ' + MC[8] + ') x ' + MC[7] + ') )'),
      el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + MC[6] + ' days. Chain breadth adds up to ' + Math.round(MC[7] * MC[8] * 100) + '% for protocols deployed on many chains. A category with fewer than ' + MC[9] + ' live protocols falls back to the global median, ' + DATA.gm.toFixed(4) + '; every multiple is clamped to [' + MC[10] + ', ' + MC[11] + ']. Protocols whose token records no market cap are left out of the medians.' }),
      el('table', { class: 'cal' },
        el('thead', null, el('tr', null, el('th', { text: 'Category' }), el('th', { text: 'Live sampled' }), el('th', { text: 'Multiple used' }))),
        el('tbody', null, calRows)),
      el('p', { class: 'sub', text: 'The early radar is every pre-token protocol below the watchlist floor, by TVL, and the live-token protocols are set aside with their market caps shown.' }));
  }
  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });
  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r[1] === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row[0] + ' of ' + DATA.bs + ' \u00b7 ' + (isWatchlist(row) ? 'Watchlist' : 'Early') }),
        el('h2', { id: 'detail-title', text: row[2] }),
        el('p', { class: 'sub', text: catName(row) + ' on ' + (chainNames(row).join(', ') || 'an unnamed chain') + (row[5] > 4 ? ' +' + (row[5] - 4) + ' more' : '') })),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: usd(row[6]) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: pct(row[7]) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: ageFmt(row[8]) })),
        el('div', null, el('span', { text: 'Chains' }), el('b', { class: 'num', text: String(row[5]) })),
        el('div', null, el('span', { text: 'Category multiple' }), el('b', { class: 'num', text: String(catMult(row)) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(growthMult(row)) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(maturityMult(row)) })),
        el('div', null, el('span', { text: 'Breadth multiplier' }), el('b', { class: 'num', text: String(breadthMult(row)) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: usd(row[9]) }))),
      el('p', { class: 'sub', text: 'Model ' + DATA.mv + ': the same function scores every protocol. The page recomputes this row as ' + usd(recomputed) + (recomputed === row[9] ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))));
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
  }
  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre' ? boardTable() : liveTable());
    if (state.tab === 'pre') shell.appendChild(modelPanel());
    shell.appendChild(el('footer', { class: 'foot' },
      el('p', { text: 'Snapshot frozen 2026-11-14 from the DefiLlama protocol index. A protocol on this board records no token; that is what its record says, not proof it has none.' }),
      el('p', { text: 'Implied value is this entry\u2019s own claim about what a token would be worth if the protocol\u2019s record stayed as it is. It does not predict whether or when a token is issued.' })));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }
  readHash();
  render();
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.open) dialog.close(); });
})();
