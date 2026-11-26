/* Gear Locker PWA — the riding gear, with a home.
 *
 * No build step, no dependencies, no account, no server. Gear lives
 * in this device's localStorage and moves as one plain JSON file.
 *
 * Bikes live in the SHARED Pocket Garage roster (the "pocket-garage-
 * bikes" key, via the vendored bike-profile.js — the same b1/b2/b3
 * roster the other apps use). This app never invents a second bike
 * model: a gear item points at a roster key, or at "" for general
 * gear that belongs to no bike in particular (a jacket worn on any
 * bike, shop gear). Add a bike here and it is added to the shared
 * roster; there is no delete-bike here in v1 — roster management
 * belongs to the landing dashboard (Phase 2), so a bike you mistype
 * is removed there, not here.
 *
 * User-entered figures only, stated plainly wherever a number
 * appears: every brand, size, and cost is one the rider typed in.
 * Nothing is invented, and no brand, size, or cost is ever
 * suggested. A gear item with no cost entered has no value in the
 * totals — the summary says how many items are unpriced instead of
 * guessing. Gear is one-offs: there is no quantity field, one item
 * is one record.
 */
'use strict';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */
var STORAGE_KEY = 'gear-locker-v1';
var VERSION = 1;

/* The only gear types the app knows. "Other" covers everything else
 * — rain gear, balaclavas, belts, whatever the rider wears. */
var TYPES = ['Jacket', 'Helmet', 'Gloves', 'Boots', 'Other'];

/* The only condition labels the app knows. These are the app's own
 * locker labels, not facts about an item — an item's condition is
 * picked by the rider from this list. */
var CONDITIONS = ['New', 'Like new', 'Used — good', 'Used — worn', 'Retired'];

/* ------------------------------------------------------------------ */
/* Small pure helpers                                                  */
/* ------------------------------------------------------------------ */
function round2(x) { return Math.round(x * 100) / 100; }

function isDateISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function todayISO() {
  var d = new Date();
  var m = '' + (d.getMonth() + 1);
  var day = '' + d.getDate();
  return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

function fmtMoney(x) {
  if (x === null || x === undefined) return '—';
  return '$' + (Math.round(x * 100) / 100).toFixed(2);
}

function slugify(name) {
  var s = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'bike';
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */
function emptyStore() {
  return { version: VERSION, items: [] };
}

/* A gear item, validated. Throws with a plain message on bad input.
 * name is required (gear with no name is unfindable). type is one of
 * the five labels above, defaulting to 'Other' when not given or
 * unknown. brand and size are free text, trimmed — a size left blank
 * stays blank, never guessed. cost is optional: blank means unknown,
 * and the item carries no value in the totals. bike_key is '' for
 * general gear, or a roster key. condition is one of the five labels
 * above, defaulting to 'New' when not given. date_bought defaults to
 * today when not given. */
function validateGearFields(p) {
  if (!p || typeof p !== 'object') throw new Error('gear must be an object');
  var name = typeof p.name === 'string' ? p.name.trim() : '';
  if (!name) throw new Error('gear needs a name');
  if (typeof p.bike_key !== 'string') throw new Error('gear needs a bike (or none)');
  var type = typeof p.type === 'string' ? p.type.trim() : '';
  if (TYPES.indexOf(type) < 0) type = 'Other';
  var cost = null;
  if (p.cost !== '' && p.cost !== null && p.cost !== undefined) {
    cost = Number(p.cost);
    if (isNaN(cost) || cost < 0) throw new Error('cost must be $0 or more, or left blank');
    cost = round2(cost);
  }
  var date = p.date_bought;
  if (date === '' || date === null || date === undefined) date = todayISO();
  if (!isDateISO(date)) throw new Error('date bought must be a real date (YYYY-MM-DD)');
  var cond = typeof p.condition === 'string' ? p.condition : 'New';
  if (CONDITIONS.indexOf(cond) < 0) cond = 'New';
  return {
    bike_key: p.bike_key,
    name: name,
    type: type,
    brand: typeof p.brand === 'string' ? p.brand.trim() : '',
    size: typeof p.size === 'string' ? p.size.trim() : '',
    cost: cost,
    condition: cond,
    date_bought: date,
    notes: typeof p.notes === 'string' ? p.notes : ''
  };
}

function nextGearId(store) {
  var max = 0;
  store.items.forEach(function (g) {
    var m = /^g(\d+)$/.exec(g.id || '');
    if (m && +m[1] > max) max = +m[1];
  });
  return 'g' + (max + 1);
}

function addGear(store, fields) {
  var g = validateGearFields(fields);
  g.id = nextGearId(store);
  store.items.push(g);
  return g;
}

function updateGear(store, id, fields) {
  for (var i = 0; i < store.items.length; i++) {
    if (store.items[i].id === id) {
      var merged = validateGearFields(Object.assign({}, store.items[i], fields));
      merged.id = id;
      store.items[i] = merged;
      return merged;
    }
  }
  return null;
}

function deleteGear(store, id) {
  for (var i = 0; i < store.items.length; i++) {
    if (store.items[i].id === id) { store.items.splice(i, 1); return true; }
  }
  return false;
}

function getGear(store, id) {
  for (var i = 0; i < store.items.length; i++) {
    if (store.items[i].id === id) return store.items[i];
  }
  return null;
}

/* Same bike + same name + same brand + same type: the same gear
 * typed twice. The sample loader uses this so tapping "Load example
 * data" twice never doubles the locker. */
function hasGear(store, bikeKey, name, brand, type) {
  var n = String(name || '').trim().toLowerCase();
  var b = String(brand || '').trim().toLowerCase();
  var t = String(type || '').trim().toLowerCase();
  return store.items.some(function (g) {
    return g.bike_key === bikeKey &&
      String(g.name).trim().toLowerCase() === n &&
      String(g.brand || '').trim().toLowerCase() === b &&
      String(g.type || '').trim().toLowerCase() === t;
  });
}

/* ------------------------------------------------------------------ */
/* Search / filter                                                     */
/* ------------------------------------------------------------------ */
/* filters: { bikeKey: '' | 'general' | 'b1'..., query: string,
 * type: '' }. bikeKey '' means all bikes (general gear included);
 * 'general' means general gear only. query matches name or brand,
 * case-insensitive, substring. type matches exactly
 * (case-insensitive). Results come back name-sorted for the locker. */
function filterGear(store, filters) {
  filters = filters || {};
  var q = String(filters.query || '').trim().toLowerCase();
  var ty = String(filters.type || '').trim().toLowerCase();
  var bk = filters.bikeKey === undefined ? '' : filters.bikeKey;
  return store.items.filter(function (g) {
    if (bk === 'general') { if (g.bike_key !== '') return false; }
    else if (bk) { if (g.bike_key !== bk) return false; }
    if (ty && String(g.type || '').trim().toLowerCase() !== ty) return false;
    if (q) {
      var hay = (g.name + ' ' + (g.brand || '')).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }).sort(function (a, b) {
    var an = a.name.toLowerCase(), bn = b.name.toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

function typesInUse(store) {
  var seen = {};
  var out = [];
  store.items.forEach(function (g) {
    var t = String(g.type || '').trim();
    if (t && !seen[t.toLowerCase()]) { seen[t.toLowerCase()] = true; out.push(t); }
  });
  return out.sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; });
}

/* ------------------------------------------------------------------ */
/* Totals — the locker at a glance                                     */
/* ------------------------------------------------------------------ */
/* Value counts priced items only: gear with no cost entered has no
 * value, and the summary says how many items are unpriced instead of
 * guessing. items is distinct records; totalValue is the costs added
 * up. */
function gearStats(store, bikeKey) {
  var items = bikeKey === undefined || bikeKey === '' || bikeKey === null
    ? store.items
    : (bikeKey === 'general'
      ? store.items.filter(function (g) { return g.bike_key === ''; })
      : store.items.filter(function (g) { return g.bike_key === bikeKey; }));
  var stats = {
    bike_key: bikeKey === undefined ? '' : bikeKey,
    items: items.length, totalValue: 0,
    pricedItems: 0, unpricedItems: 0
  };
  items.forEach(function (g) {
    if (g.cost !== null && g.cost !== undefined) {
      stats.totalValue = round2(stats.totalValue + g.cost);
      stats.pricedItems++;
    } else {
      stats.unpricedItems++;
    }
  });
  return stats;
}

function allGearStats(store) {
  return gearStats(store, '');
}

function typeCounts(store, bikeKey) {
  var items = bikeKey === undefined || bikeKey === '' || bikeKey === null
    ? store.items
    : (bikeKey === 'general'
      ? store.items.filter(function (g) { return g.bike_key === ''; })
      : store.items.filter(function (g) { return g.bike_key === bikeKey; }));
  var counts = {};
  items.forEach(function (g) {
    var t = String(g.type || '').trim() || 'Other';
    counts[t] = (counts[t] || 0) + 1;
  });
  return Object.keys(counts).sort(function (a, b) {
    if (counts[b] !== counts[a]) return counts[b] - counts[a];
    return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
  }).map(function (t) { return { type: t, items: counts[t] }; });
}

/* ------------------------------------------------------------------ */
/* Import / export                                                     */
/* ------------------------------------------------------------------ */
function validateImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('import must be a JSON object');
  if (!Array.isArray(data.items)) throw new Error('import needs an items array');
  var out = emptyStore();
  data.items.forEach(function (raw) {
    if (!raw || typeof raw !== 'object') throw new Error('each item must be an object');
    var g = validateGearFields(raw);
    /* Ids are re-minted on import in sequence, so a file that was
     * edited by hand with duplicate or missing ids still loads. */
    g.id = nextGearId(out);
    out.items.push(g);
  });
  return out;
}

function bikeGearExport(store, bikeKey) {
  var stats = gearStats(store, bikeKey);
  var list = (bikeKey === 'general'
    ? store.items.filter(function (g) { return g.bike_key === ''; })
    : store.items.filter(function (g) { return g.bike_key === bikeKey; }))
    .slice().sort(function (a, b) {
      var an = a.name.toLowerCase(), bn = b.name.toLowerCase();
      if (an !== bn) return an < bn ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });
  return {
    app: 'gear-locker', version: VERSION, bike_key: bikeKey,
    exported: todayISO(), stats: stats,
    items: list.map(function (g) {
      return {
        id: g.id, name: g.name, type: g.type, brand: g.brand,
        size: g.size, cost: g.cost, condition: g.condition,
        date_bought: g.date_bought, notes: g.notes
      };
    })
  };
}

function bikeGearText(store, bikeKey, bikeName) {
  var exp = bikeGearExport(store, bikeKey);
  var s = exp.stats;
  var lines = [];
  lines.push('Gear locker — ' + (bikeName || bikeKey));
  lines.push('Exported ' + exp.exported);
  lines.push('');
  lines.push(s.items + ' item' + (s.items === 1 ? '' : 's') + ' — value ' +
    fmtMoney(s.totalValue) + ' (' + s.pricedItems + ' priced' +
    (s.unpricedItems ? ', ' + s.unpricedItems + ' without a price' : '') + ')');
  lines.push('');
  exp.items.forEach(function (g) {
    lines.push(g.name +
      (g.brand ? ' [' + g.brand + ']' : '') +
      ' — ' + g.type +
      (g.size ? ' — size ' + g.size : '') +
      (g.cost !== null ? ' — ' + fmtMoney(g.cost) : ' — no price entered') +
      ' — ' + g.condition +
      (g.notes ? ' — ' + g.notes : ''));
  });
  lines.push('');
  lines.push('Every brand, size, and cost here is one the rider typed in. ' +
    'Gear with no price entered has no value in the totals.');
  return lines.join('\n') + '\n';
}

function exportFilename(bikeName, ext) {
  return 'gear-locker-' + slugify(bikeName) + '-gear.' + ext;
}

/* ------------------------------------------------------------------ */
/* Sample data — example gear only. Four of the six items are the
 * rider's own documented gear (Icon Upstate Mesh CE jacket, Icon
 * Nighthawk gloves, Chippewa 27899 engineer boots, the Cal Leather
 * jacket — names, brands, and sizes from his own record, not
 * invented); the other two are generic examples. ALL sample prices
 * are example prices only, and the Cal Leather jacket carries no
 * price at all — it was his father's, so it shows as unpriced in the
 * totals instead of a guessed number. Totals are computed by the
 * same code the app runs on real gear.                         */
/* ------------------------------------------------------------------ */
function sampleStore() {
  var s = emptyStore();
  var rows = [
    { bike_key: 'b1', name: 'Upstate Mesh CE jacket', type: 'Jacket', brand: 'Icon', size: '52 Regular', cost: 179.99, condition: 'Used — good', date_bought: '2026-10-15', notes: 'Hot-weather riding' },
    { bike_key: 'b1', name: 'Nighthawk gloves', type: 'Gloves', brand: 'Icon', size: '', cost: 39.99, condition: 'Used — good', date_bought: '2026-10-15', notes: '' },
    { bike_key: 'b1', name: '27899 engineer boots', type: 'Boots', brand: 'Chippewa', size: '10D', cost: 249.99, condition: 'Used — good', date_bought: '2026-09-20', notes: 'Steel-toe' },
    { bike_key: '', name: 'Cal Leather jacket', type: 'Jacket', brand: 'Cal Leather', size: '', cost: null, condition: 'Used — good', date_bought: '2026-11-01', notes: "Dad's, LAPD-style double-rider, believed 1950s/60s horsehide" },
    { bike_key: 'b2', name: 'Full-face helmet', type: 'Helmet', brand: '', size: '', cost: 129.99, condition: 'New', date_bought: '2026-11-05', notes: '' },
    { bike_key: 'b3', name: 'Leather work gloves', type: 'Gloves', brand: '', size: '', cost: 14.99, condition: 'Used — worn', date_bought: '2026-11-08', notes: '' }
  ];
  rows.forEach(function (r) { addGear(s, r); });
  return s;
}

/* ------------------------------------------------------------------ */
/* DOM layer — browser only. The pure logic above runs in Node tests. */
/* ------------------------------------------------------------------ */
if (typeof document !== 'undefined') {
  var BikeProfile = (typeof window !== 'undefined' && window.PG_BikeProfile) ? window.PG_BikeProfile : null;
  var SWUpdate = (typeof window !== 'undefined' && window.PG_SWUpdate) ? window.PG_SWUpdate : null;

  var storage = (function () {
    try {
      if (typeof localStorage !== 'undefined') { localStorage.getItem('__gear_locker_probe__'); return localStorage; }
    } catch (e) { /* private mode / blocked storage: memory only */ }
    var mem = {};
    return {
      getItem: function (k) { return mem.hasOwnProperty(k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; }
    };
  })();

  var profile = BikeProfile ? BikeProfile.create(storage) : null;
  var store = emptyStore();
  var editingId = null;

  function loadStore() {
    try {
      var raw = storage.getItem(STORAGE_KEY);
      if (raw) store = validateImport(JSON.parse(raw));
    } catch (e) { store = emptyStore(); }
  }
  function saveStore() {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch (e) { /* quota: keep the in-memory copy */ }
  }

  function bikes() {
    if (!profile) return [];
    try { return profile.listBikes(); } catch (e) { return []; }
  }
  function bikeName(key) {
    if (key === '' || key === null || key === undefined) return 'General (no bike)';
    var b = null;
    try { b = profile ? profile.getBike(key) : null; } catch (e) { b = null; }
    return b ? b.name : key;
  }

  function el(id) { return document.getElementById(id); }
  function toast(msg) {
    var t = el('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function fillBikeSelects() {
    var lockerSel = el('locker-bike');
    if (lockerSel) {
      var keep = lockerSel.value;
      lockerSel.innerHTML = '<option value="">All bikes</option><option value="general">General (no bike) only</option>' +
        bikes().map(function (b) {
          return '<option value="' + escapeHtml(b.key) + '">' + escapeHtml(b.name) + '</option>';
        }).join('');
      if (keep) lockerSel.value = keep;
    }
    var formSel = el('g-bike');
    if (formSel) {
      var keepF = formSel.value;
      formSel.innerHTML = '<option value="">General (no bike)</option>' +
        bikes().map(function (b) {
          return '<option value="' + escapeHtml(b.key) + '">' + escapeHtml(b.name) + '</option>';
        }).join('');
      if (keepF) formSel.value = keepF;
    }
    var summarySel = el('summary-bike');
    if (summarySel) {
      var keepS = summarySel.value;
      summarySel.innerHTML = '<option value="">All bikes</option><option value="general">General (no bike)</option>' +
        bikes().map(function (b) {
          return '<option value="' + escapeHtml(b.key) + '">' + escapeHtml(b.name) + '</option>';
        }).join('');
      if (keepS) summarySel.value = keepS;
    }
    var exportSel = el('export-bike');
    if (exportSel) {
      var keepE = exportSel.value;
      exportSel.innerHTML = '<option value="general">General (no bike)</option>' +
        bikes().map(function (b) {
          return '<option value="' + escapeHtml(b.key) + '">' + escapeHtml(b.name) + '</option>';
        }).join('');
      if (keepE) exportSel.value = keepE;
    }
  }

  function fillTypeSelect() {
    var sel = el('locker-type');
    if (!sel) return;
    var keep = sel.value;
    var tys = typesInUse(store);
    sel.innerHTML = '<option value="">All types</option>' +
      tys.map(function (t) { return '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>'; }).join('');
    if (keep) sel.value = keep;
  }

  function renderLocker() {
    var bk = el('locker-bike').value;
    var q = el('locker-search').value;
    var ty = el('locker-type').value;
    var rows = filterGear(store, { bikeKey: bk, query: q, type: ty });
    var html = '';
    if (!store.items.length) {
      html = '<p class="muted">No gear in the locker yet. Add the first piece below — a name is all it takes, the rest is optional.</p>';
    } else if (!rows.length) {
      html = '<p class="muted">Nothing matches that search. Clear the search or the filters and the locker comes back.</p>';
    } else {
      html = '<table><thead><tr><th>Gear</th><th>Bike</th><th>Size</th><th class="num">Cost</th><th></th></tr></thead><tbody>';
      rows.forEach(function (g) {
        html += '<tr><td><b>' + escapeHtml(g.name) + '</b>' +
          (g.brand ? '<br><span class="muted">' + escapeHtml(g.brand) + '</span>' : '') +
          '<br><span class="badge">' + escapeHtml(g.type) + '</span>' +
          '<br><span class="muted">' + escapeHtml(g.condition) + '</span>' +
          (g.notes ? '<br><span class="muted">' + escapeHtml(g.notes) + '</span>' : '') +
          '</td><td>' + escapeHtml(bikeName(g.bike_key)) + '</td>' +
          '<td>' + escapeHtml(g.size || '—') + '</td>' +
          '<td class="num">' + fmtMoney(g.cost) + '</td>' +
          '<td><button class="mini" data-edit="' + g.id + '">Edit</button> ' +
          '<button class="mini danger" data-del="' + g.id + '">Delete</button></td></tr>';
      });
      html += '</tbody></table>';
      var st = gearStats(store, bk === 'general' ? 'general' : (bk || ''));
      html += '<p class="muted">' + rows.length + ' item' + (rows.length === 1 ? '' : 's') + ' shown — value ' + fmtMoney(st.totalValue) +
        (st.unpricedItems ? ' (' + st.unpricedItems + ' item' + (st.unpricedItems === 1 ? '' : 's') + ' without a price)' : '') + '.</p>';
    }
    el('gear-list').innerHTML = html;
    el('gear-list').querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (deleteGear(store, btn.getAttribute('data-del'))) { saveStore(); renderAll(); toast('Gear deleted.'); }
      });
    });
    el('gear-list').querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { startEdit(btn.getAttribute('data-edit')); });
    });
  }

  function renderSummary() {
    var key = el('summary-bike').value;
    var html = '';
    var showCard = function (label, s) {
      var h = '<div class="card"><h3>' + escapeHtml(label) + '</h3>' +
        '<p>' + s.items + ' item' + (s.items === 1 ? '' : 's') + ' — value ' +
        fmtMoney(s.totalValue) + ' (' + s.pricedItems + ' priced' +
        (s.unpricedItems ? ', ' + s.unpricedItems + ' without a price' : '') + ')</p>';
      var tys = typeCounts(store, s.bike_key);
      if (tys.length) {
        h += '<p class="muted">' + tys.map(function (t) { return escapeHtml(t.type) + ' ' + t.items; }).join(' · ') + '</p>';
      }
      return h + '</div>';
    };
    if (!key) {
      html += showCard('All bikes', allGearStats(store));
      bikes().forEach(function (b) {
        var s = gearStats(store, b.key);
        if (!s.items) return;
        html += showCard(b.name, s);
      });
      var g = gearStats(store, 'general');
      if (g.items) html += showCard('General (no bike)', g);
      if (!allGearStats(store).items) html += '<p class="muted">No gear yet. Add a piece on the Locker tab and the numbers start here.</p>';
    } else if (key === 'general') {
      html += showCard('General (no bike)', gearStats(store, 'general'));
    } else {
      html += showCard(bikeName(key), gearStats(store, key));
    }
    el('summary-cards').innerHTML = html;
  }

  function renderBikes() {
    var list = bikes();
    var html = '';
    if (!list.length) {
      html = '<p class="muted">No bikes yet. The shared roster starts with the 1995 Fat Boy, the 1990 Softail, and the 1947 Knucklehead — add yours below.</p>';
    } else {
      html = '<ul class="bike-list">';
      list.forEach(function (b) {
        var s = gearStats(store, b.key);
        html += '<li><b>' + escapeHtml(b.name) + '</b>' +
          (b.year ? ' (' + escapeHtml(String(b.year)) + ')' : '') +
          (b.model ? ' — ' + escapeHtml(b.model) : '') +
          '<br><span class="muted">' + s.items + ' item' + (s.items === 1 ? '' : 's') +
          (s.items ? ' — value ' + fmtMoney(s.totalValue) : '') + '</span></li>';
      });
      html += '</ul>';
    }
    el('bikes-list').innerHTML = html;
  }

  function renderData() {
    var total = allGearStats(store);
    el('data-counts').textContent = total.items + ' items — value ' + fmtMoney(total.totalValue) +
      (total.unpricedItems ? ' (' + total.unpricedItems + ' without a price)' : '') +
      ' — ' + bikes().length + ' bikes on the shared roster.';
  }

  function renderAll() {
    fillBikeSelects();
    fillTypeSelect();
    renderLocker();
    renderSummary();
    renderBikes();
    renderData();
  }

  function showView(name) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    document.querySelectorAll('.navbtn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === name); });
  }

  function resetForm() {
    editingId = null;
    el('gear-form').reset();
    el('g-date').value = todayISO();
    el('gear-submit').textContent = 'Add gear';
    el('gear-cancel').style.display = 'none';
    el('form-heading').textContent = 'Add gear';
  }

  function startEdit(id) {
    var g = getGear(store, id);
    if (!g) return;
    editingId = id;
    el('g-name').value = g.name;
    el('g-type').value = g.type;
    el('g-brand').value = g.brand || '';
    el('g-size').value = g.size || '';
    el('g-bike').value = g.bike_key || '';
    el('g-cost').value = (g.cost === null || g.cost === undefined) ? '' : g.cost;
    el('g-condition').value = g.condition;
    el('g-date').value = g.date_bought;
    el('g-notes').value = g.notes || '';
    el('gear-submit').textContent = 'Save changes';
    el('gear-cancel').style.display = '';
    el('form-heading').textContent = 'Edit gear';
    document.getElementById('view-locker').scrollIntoView();
    el('g-name').focus();
  }

  document.querySelectorAll('.navbtn').forEach(function (b) {
    b.addEventListener('click', function () { showView(b.getAttribute('data-view')); });
  });

  el('locker-bike').addEventListener('change', renderLocker);
  el('locker-type').addEventListener('change', renderLocker);
  el('locker-search').addEventListener('input', renderLocker);

  el('gear-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var fields = {
      bike_key: el('g-bike').value,
      name: el('g-name').value,
      type: el('g-type').value,
      brand: el('g-brand').value,
      size: el('g-size').value,
      cost: el('g-cost').value,
      condition: el('g-condition').value,
      date_bought: el('g-date').value,
      notes: el('g-notes').value
    };
    try {
      if (editingId) {
        updateGear(store, editingId, fields);
        toast('Gear updated.');
      } else {
        var g = addGear(store, fields);
        toast('Gear added — ' + g.name + '.');
      }
      saveStore();
      resetForm();
      renderAll();
    } catch (err) { toast(err.message); }
  });
  el('gear-cancel').addEventListener('click', function () { resetForm(); });

  el('bike-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!profile) { toast('Bike roster unavailable on this device.'); return; }
    var name = el('bike-name').value.trim();
    if (!name) { toast('Give the bike a name.'); return; }
    var year = el('bike-year').value.trim();
    var key = profile.addBike({
      name: name,
      year: year ? parseInt(year, 10) : null,
      model: el('bike-model').value.trim(),
      carb: '',
      notes: el('bike-notes').value.trim()
    });
    el('bike-form').reset();
    renderAll();
    toast('Bike added to the shared roster (' + key + ').');
  });

  el('export-btn').addEventListener('click', function () {
    download('gear-locker-backup.json', JSON.stringify(store, null, 2));
    toast('Backup downloaded.');
  });
  el('copy-export-btn').addEventListener('click', function () {
    var done = function () { toast('Backup copied.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(JSON.stringify(store, null, 2)).then(done, function () { toast('Copy failed — use Download instead.'); });
    } else { toast('Clipboard unavailable — use Download instead.'); }
  });
  el('export-json-btn').addEventListener('click', function () {
    var key = el('export-bike').value;
    download(exportFilename(bikeName(key), 'json'), JSON.stringify(bikeGearExport(store, key), null, 2));
  });
  el('export-text-btn').addEventListener('click', function () {
    var key = el('export-bike').value;
    download(exportFilename(bikeName(key), 'txt'), bikeGearText(store, key, bikeName(key)), 'text/plain');
  });
  el('copy-text-btn').addEventListener('click', function () {
    var key = el('export-bike').value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(bikeGearText(store, key, bikeName(key))).then(function () { toast('Copied.'); }, function () { toast('Copy failed — use Download instead.'); });
    } else { toast('Clipboard unavailable — use Download instead.'); }
  });
  el('import-btn').addEventListener('click', function () {
    var file = el('import-file').files && el('import-file').files[0];
    var text = el('import-text').value.trim();
    var apply = function (raw) {
      try {
        var next = validateImport(JSON.parse(raw));
        store = next;
        saveStore();
        renderAll();
        toast('Imported ' + next.items.length + ' items. (Replaces the old locker.)');
      } catch (err) { toast('Import failed: ' + err.message); }
    };
    if (file) {
      var reader = new FileReader();
      reader.onload = function () { apply(String(reader.result)); };
      reader.readAsText(file);
    } else if (text) {
      apply(text);
    } else {
      toast('Pick a file or paste JSON first.');
    }
  });
  el('sample-btn').addEventListener('click', function () {
    var sample = sampleStore();
    var added = 0;
    sample.items.forEach(function (g) {
      if (hasGear(store, g.bike_key, g.name, g.brand, g.type)) return; /* already there: tapping twice never doubles the locker */
      try { addGear(store, g); added++; } catch (e) { /* a sample row that collides with existing data is skipped, not forced */ }
    });
    saveStore();
    renderAll();
    toast(added ? 'Example gear loaded in the locker.' : 'Example gear is already in the locker.');
  });
  el('clear-btn').addEventListener('click', function () {
    if (!window.confirm('Delete all gear-locker gear? The shared bike roster is NOT touched — only this app\u2019s gear goes.')) return;
    store = emptyStore();
    saveStore();
    resetForm();
    renderAll();
    toast('Gear locker cleared. Bikes are untouched.');
  });

  loadStore();
  el('g-date').value = todayISO();
  renderAll();
  if (SWUpdate) SWUpdate.init({ container: document.body });
}

if (typeof module !== 'undefined' && module.exports) {
  var BikeProfileModule = null;
  try { BikeProfileModule = require('./bike-profile.js'); } catch (e) { BikeProfileModule = null; }
  module.exports = {
    STORAGE_KEY: STORAGE_KEY, VERSION: VERSION,
    TYPES: TYPES, CONDITIONS: CONDITIONS,
    round2: round2, isDateISO: isDateISO, todayISO: todayISO,
    fmtMoney: fmtMoney, slugify: slugify, escapeHtml: escapeHtml,
    emptyStore: emptyStore, validateGearFields: validateGearFields,
    nextGearId: nextGearId, addGear: addGear, updateGear: updateGear,
    deleteGear: deleteGear, getGear: getGear, hasGear: hasGear,
    filterGear: filterGear, typesInUse: typesInUse,
    gearStats: gearStats, allGearStats: allGearStats,
    typeCounts: typeCounts,
    validateImport: validateImport,
    bikeGearExport: bikeGearExport, bikeGearText: bikeGearText,
    exportFilename: exportFilename, sampleStore: sampleStore,
    BikeProfile: BikeProfileModule
  };
}
