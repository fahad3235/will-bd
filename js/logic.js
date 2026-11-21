// Will BD - pure logic. No DOM, no storage, no network.
// All functions are exported for Node tests; the browser loads this file
// as a plain <script> and uses the globals.
'use strict';

var MAX_NAME_LEN = 60;
var MAX_ADDRESS_LEN = 200;
var MAX_WISHES_LEN = 500;
var MAX_DESC_LEN = 120;
var MAX_BENEFICIARIES = 30;
var MAX_ASSETS = 100;
var MAX_MONEY = 999999999;
var RELATIONS = ['spouse', 'child', 'parent', 'sibling', 'friend', 'other'];
var ASSET_TYPES = ['land', 'house', 'bank', 'gold', 'business', 'vehicle', 'other'];
var CHECKLIST_ITEMS = {
  before: ['nid', 'deed', 'bank', 'nominee', 'debts', 'previous'],
  signing: ['witnesses', 'signPages', 'date', 'safePlace', 'copyExecutor']
};
// Correct option index for each of the 10 quiz questions, in order.
// The question text lives in js/i18n.js; only the answer key lives here.
var QUIZ_ANSWERS = [0, 1, 1, 1, 1, 1, 0, 1, 0, 0];
var QUIZ_TOTAL = 10;

var _idCounter = 0;

function createStore() {
  return {
    version: 1,
    testator: { name: '', address: '', nid: '' },
    beneficiaries: [],
    executor: { name: '', relation: '', phone: '' },
    witnesses: [{ name: '' }, { name: '' }],
    guardian: { name: '' },
    wishes: '',
    assets: [],
    checklists: { before: {}, signing: {} },
    quiz: { best: null, last: null }
  };
}

function newId(prefix) {
  _idCounter += 1;
  return prefix + '-' + Date.now().toString(36) + '-' + _idCounter + '-' +
    Math.floor(Math.random() * 46656).toString(36);
}

function isIntInRange(v, min, max) {
  return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= min && v <= max;
}

function isValidNid(s) {
  if (typeof s !== 'string') return false;
  if (s === '') return true; // optional
  return /^\d{10}$/.test(s) || /^\d{13}$/.test(s) || /^\d{17}$/.test(s);
}

function isValidBdPhone(s) {
  if (typeof s !== 'string') return false;
  if (s === '') return true; // optional
  return /^(\+8801[3-9]\d{8}|01[3-9]\d{8})$/.test(s);
}

// --- testator ---
function validateTestator(t) {
  var errors = [];
  if (!t || typeof t !== 'object') return ['testatorInvalid'];
  if (typeof t.name !== 'string' || !t.name.trim()) errors.push('nameEmpty');
  else if (t.name.trim().length > MAX_NAME_LEN) errors.push('nameTooLong');
  if (typeof t.address !== 'string') errors.push('addressInvalid');
  else if (t.address.length > MAX_ADDRESS_LEN) errors.push('addressTooLong');
  if (typeof t.nid !== 'string' || !isValidNid(t.nid.trim())) errors.push('nidInvalid');
  return errors;
}

function setTestator(store, name, address, nid) {
  var t = {
    name: typeof name === 'string' ? name.trim() : '',
    address: typeof address === 'string' ? address.trim() : '',
    nid: typeof nid === 'string' ? nid.trim() : ''
  };
  var errors = validateTestator(t);
  if (errors.length > 0) return { ok: false, error: errors[0], errors: errors };
  store.testator = t;
  return { ok: true };
}

// --- beneficiaries ---
function totalShares(store) {
  var sum = 0;
  for (var i = 0; i < store.beneficiaries.length; i++) sum += store.beneficiaries[i].share;
  return sum;
}

function validateBeneficiary(store, name, relation, share, excludeId) {
  var errors = [];
  var n = typeof name === 'string' ? name.trim() : '';
  if (!n) errors.push('nameEmpty');
  else if (n.length > MAX_NAME_LEN) errors.push('nameTooLong');
  if (RELATIONS.indexOf(relation) === -1) errors.push('badRelation');
  if (!isIntInRange(share, 1, 100)) errors.push('shareInvalid');
  if (errors.length === 0) {
    var others = 0;
    for (var i = 0; i < store.beneficiaries.length; i++) {
      if (excludeId && store.beneficiaries[i].id === excludeId) continue;
      others += store.beneficiaries[i].share;
    }
    if (others + share > 100) errors.push('shareSumExceeded');
  }
  return errors;
}

function addBeneficiary(store, name, relation, share) {
  var errors = validateBeneficiary(store, name, relation, share, null);
  if (errors.length > 0) return { ok: false, error: errors[0], errors: errors };
  if (store.beneficiaries.length >= MAX_BENEFICIARIES) {
    return { ok: false, error: 'tooManyBeneficiaries' };
  }
  var b = {
    id: newId('b'),
    name: name.trim(),
    relation: relation,
    share: share
  };
  store.beneficiaries.push(b);
  return { ok: true, beneficiary: b };
}

function updateBeneficiary(store, id, name, relation, share) {
  var found = null;
  for (var i = 0; i < store.beneficiaries.length; i++) {
    if (store.beneficiaries[i].id === id) { found = store.beneficiaries[i]; break; }
  }
  if (!found) return { ok: false, error: 'notFound' };
  var errors = validateBeneficiary(store, name, relation, share, id);
  if (errors.length > 0) return { ok: false, error: errors[0], errors: errors };
  found.name = name.trim();
  found.relation = relation;
  found.share = share;
  return { ok: true, beneficiary: found };
}

function removeBeneficiary(store, id) {
  var before = store.beneficiaries.length;
  store.beneficiaries = store.beneficiaries.filter(function (b) { return b.id !== id; });
  if (store.beneficiaries.length === before) return { ok: false, error: 'notFound' };
  return { ok: true };
}

// --- executor ---
function validateExecutor(e) {
  var errors = [];
  if (!e || typeof e !== 'object') return ['executorInvalid'];
  if (typeof e.name !== 'string' || !e.name.trim()) errors.push('nameEmpty');
  else if (e.name.trim().length > MAX_NAME_LEN) errors.push('nameTooLong');
  if (typeof e.relation !== 'string' || RELATIONS.indexOf(e.relation) === -1) {
    errors.push('badRelation');
  }
  if (typeof e.phone !== 'string' || !isValidBdPhone(e.phone.trim())) errors.push('phoneInvalid');
  return errors;
}

function setExecutor(store, name, relation, phone) {
  var e = {
    name: typeof name === 'string' ? name.trim() : '',
    relation: typeof relation === 'string' ? relation : '',
    phone: typeof phone === 'string' ? phone.trim() : ''
  };
  var errors = validateExecutor(e);
  if (errors.length > 0) return { ok: false, error: errors[0], errors: errors };
  store.executor = e;
  return { ok: true };
}

// --- witnesses ---
function validateWitnesses(w1, w2) {
  var errors = [];
  var a = typeof w1 === 'string' ? w1.trim() : '';
  var b = typeof w2 === 'string' ? w2.trim() : '';
  if (!a) errors.push('witness1Empty');
  else if (a.length > MAX_NAME_LEN) errors.push('witness1TooLong');
  if (!b) errors.push('witness2Empty');
  else if (b.length > MAX_NAME_LEN) errors.push('witness2TooLong');
  return errors;
}

function setWitnesses(store, w1, w2) {
  var errors = validateWitnesses(w1, w2);
  if (errors.length > 0) return { ok: false, error: errors[0], errors: errors };
  store.witnesses = [{ name: w1.trim() }, { name: w2.trim() }];
  return { ok: true };
}

// --- guardian / wishes ---
function setGuardian(store, name) {
  var n = typeof name === 'string' ? name.trim() : '';
  if (n.length > MAX_NAME_LEN) return { ok: false, error: 'nameTooLong' };
  store.guardian = { name: n };
  return { ok: true };
}

function setWishes(store, text) {
  var w = typeof text === 'string' ? text : '';
  if (w.length > MAX_WISHES_LEN) return { ok: false, error: 'wishesTooLong' };
  store.wishes = w;
  return { ok: true };
}

// --- completeness / outline ---
function completeness(store) {
  var missing = [];
  if (!store.testator || !store.testator.name) missing.push('testator');
  if (!store.beneficiaries || store.beneficiaries.length < 1) missing.push('beneficiary');
  if (!store.executor || !store.executor.name || !store.executor.relation) missing.push('executor');
  var w = store.witnesses || [];
  if (!w[0] || !w[0].name || !w[1] || !w[1].name) missing.push('witnesses');
  return { complete: missing.length === 0, missing: missing };
}

// Structured outline parts; app.js renders them with i18n strings.
function outlineParts(store) {
  var c = completeness(store);
  return {
    complete: c.complete,
    missing: c.missing,
    testator: store.testator,
    beneficiaries: store.beneficiaries.slice(),
    executor: store.executor,
    witnesses: [store.witnesses[0] || { name: '' }, store.witnesses[1] || { name: '' }],
    guardian: store.guardian,
    wishes: store.wishes,
    totalAssets: totalAssets(store),
    sharesTotal: totalShares(store),
    sharesLeft: 100 - totalShares(store)
  };
}

// --- one-third rule ---
// Max bequest to a non-heir under Muslim personal law in Bangladesh:
// one-third of the estate, rounded down to whole taka.
function oneThird(estateValue) {
  if (!isIntInRange(estateValue, 0, MAX_MONEY)) return { ok: false, error: 'estateInvalid' };
  return { ok: true, maxBequest: Math.floor(estateValue / 3) };
}

// --- assets ---
function validateAsset(type, description, value) {
  var errors = [];
  if (ASSET_TYPES.indexOf(type) === -1) errors.push('badAssetType');
  var d = typeof description === 'string' ? description.trim() : '';
  if (!d) errors.push('assetDescEmpty');
  else if (d.length > MAX_DESC_LEN) errors.push('assetDescTooLong');
  if (!isIntInRange(value, 0, MAX_MONEY)) errors.push('assetValueInvalid');
  return errors;
}

function addAsset(store, type, description, value) {
  var errors = validateAsset(type, description, value);
  if (errors.length > 0) return { ok: false, error: errors[0], errors: errors };
  if (store.assets.length >= MAX_ASSETS) return { ok: false, error: 'tooManyAssets' };
  var a = { id: newId('a'), type: type, description: description.trim(), value: value };
  store.assets.push(a);
  return { ok: true, asset: a };
}

function updateAsset(store, id, type, description, value) {
  var found = null;
  for (var i = 0; i < store.assets.length; i++) {
    if (store.assets[i].id === id) { found = store.assets[i]; break; }
  }
  if (!found) return { ok: false, error: 'notFound' };
  var errors = validateAsset(type, description, value);
  if (errors.length > 0) return { ok: false, error: errors[0], errors: errors };
  found.type = type;
  found.description = description.trim();
  found.value = value;
  return { ok: true, asset: found };
}

function removeAsset(store, id) {
  var before = store.assets.length;
  store.assets = store.assets.filter(function (a) { return a.id !== id; });
  if (store.assets.length === before) return { ok: false, error: 'notFound' };
  return { ok: true };
}

function totalAssets(store) {
  var sum = 0;
  for (var i = 0; i < store.assets.length; i++) sum += store.assets[i].value;
  return sum;
}

// --- checklists ---
function toggleChecklist(store, list, itemId) {
  if (CHECKLIST_ITEMS[list] === undefined) return { ok: false, error: 'badList' };
  if (CHECKLIST_ITEMS[list].indexOf(itemId) === -1) return { ok: false, error: 'badChecklistId' };
  var cur = !!store.checklists[list][itemId];
  store.checklists[list][itemId] = !cur;
  return { ok: true, checked: !cur };
}

function checklistProgress(store) {
  var out = { before: null, signing: null, overall: null };
  var totalDone = 0;
  var totalItems = 0;
  ['before', 'signing'].forEach(function (list) {
    var items = CHECKLIST_ITEMS[list];
    var done = 0;
    for (var i = 0; i < items.length; i++) {
      if (store.checklists[list][items[i]]) done++;
    }
    totalDone += done;
    totalItems += items.length;
    out[list] = {
      done: done,
      total: items.length,
      pct: Math.round((done / items.length) * 100)
    };
  });
  out.overall = {
    done: totalDone,
    total: totalItems,
    pct: Math.round((totalDone / totalItems) * 100)
  };
  return out;
}

// --- quiz ---
function scoreQuiz(answers) {
  if (!Array.isArray(answers)) return { ok: false, error: 'badAnswers' };
  var score = 0;
  for (var i = 0; i < QUIZ_TOTAL; i++) {
    if (answers[i] === QUIZ_ANSWERS[i]) score++;
  }
  return { ok: true, score: score, total: QUIZ_TOTAL };
}

function recordQuizScore(store, score) {
  if (!isIntInRange(score, 0, QUIZ_TOTAL)) return { ok: false, error: 'badScore' };
  store.quiz.last = score;
  if (store.quiz.best === null || score > store.quiz.best) store.quiz.best = score;
  return { ok: true };
}

// --- dashboard stats ---
function stats(store) {
  var c = completeness(store);
  var p = checklistProgress(store);
  return {
    totalAssets: totalAssets(store),
    beneficiaryCount: store.beneficiaries.length,
    checklistPct: p.overall.pct,
    outlineComplete: c.complete
  };
}

// --- export / import ---
function exportJSON(store) {
  return JSON.stringify(store);
}

function importJSON(text) {
  var data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: 'badJson' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'notObject' };
  if (data.version !== 1) return { ok: false, error: 'badVersion' };

  // testator
  if (!data.testator || typeof data.testator !== 'object') return { ok: false, error: 'badTestator' };
  if (typeof data.testator.name !== 'string' || data.testator.name.length > MAX_NAME_LEN) {
    return { ok: false, error: 'badTestator' };
  }
  if (typeof data.testator.address !== 'string' || data.testator.address.length > MAX_ADDRESS_LEN) {
    return { ok: false, error: 'badTestator' };
  }
  if (typeof data.testator.nid !== 'string' || !isValidNid(data.testator.nid)) {
    return { ok: false, error: 'badTestator' };
  }

  // beneficiaries
  if (!Array.isArray(data.beneficiaries) || data.beneficiaries.length > MAX_BENEFICIARIES) {
    return { ok: false, error: 'badBeneficiaries' };
  }
  var ids = {};
  var shareSum = 0;
  for (var i = 0; i < data.beneficiaries.length; i++) {
    var b = data.beneficiaries[i];
    if (!b || typeof b !== 'object' || typeof b.id !== 'string' || !b.id) {
      return { ok: false, error: 'badBeneficiaries' };
    }
    if (ids[b.id]) return { ok: false, error: 'duplicateId' };
    ids[b.id] = true;
    if (typeof b.name !== 'string' || !b.name.trim() || b.name.trim().length > MAX_NAME_LEN) {
      return { ok: false, error: 'badBeneficiaries' };
    }
    if (RELATIONS.indexOf(b.relation) === -1) return { ok: false, error: 'badBeneficiaries' };
    if (!isIntInRange(b.share, 1, 100)) return { ok: false, error: 'badBeneficiaries' };
    shareSum += b.share;
  }
  if (shareSum > 100) return { ok: false, error: 'shareSumExceeded' };

  // executor: either both empty, or a valid name + relation
  if (!data.executor || typeof data.executor !== 'object') return { ok: false, error: 'badExecutor' };
  if (typeof data.executor.name !== 'string' || data.executor.name.length > MAX_NAME_LEN) {
    return { ok: false, error: 'badExecutor' };
  }
  if (typeof data.executor.relation !== 'string') return { ok: false, error: 'badExecutor' };
  var execSet = data.executor.name !== '';
  if (execSet && RELATIONS.indexOf(data.executor.relation) === -1) {
    return { ok: false, error: 'badExecutor' };
  }
  if (!execSet && data.executor.relation !== '') return { ok: false, error: 'badExecutor' };
  if (typeof data.executor.phone !== 'string' || !isValidBdPhone(data.executor.phone)) {
    return { ok: false, error: 'badExecutor' };
  }

  // witnesses: exactly two, each a name string
  if (!Array.isArray(data.witnesses) || data.witnesses.length !== 2) {
    return { ok: false, error: 'badWitnesses' };
  }
  for (var w = 0; w < 2; w++) {
    var wit = data.witnesses[w];
    if (!wit || typeof wit !== 'object' || typeof wit.name !== 'string' ||
        wit.name.length > MAX_NAME_LEN) {
      return { ok: false, error: 'badWitnesses' };
    }
  }

  // guardian
  if (!data.guardian || typeof data.guardian !== 'object' ||
      typeof data.guardian.name !== 'string' || data.guardian.name.length > MAX_NAME_LEN) {
    return { ok: false, error: 'badGuardian' };
  }

  // wishes
  if (typeof data.wishes !== 'string' || data.wishes.length > MAX_WISHES_LEN) {
    return { ok: false, error: 'badWishes' };
  }

  // assets
  if (!Array.isArray(data.assets) || data.assets.length > MAX_ASSETS) {
    return { ok: false, error: 'badAssets' };
  }
  for (var a = 0; a < data.assets.length; a++) {
    var as = data.assets[a];
    if (!as || typeof as !== 'object' || typeof as.id !== 'string' || !as.id) {
      return { ok: false, error: 'badAssets' };
    }
    if (ids[as.id]) return { ok: false, error: 'duplicateId' };
    ids[as.id] = true;
    if (ASSET_TYPES.indexOf(as.type) === -1) return { ok: false, error: 'badAssets' };
    if (typeof as.description !== 'string' || !as.description.trim() ||
        as.description.trim().length > MAX_DESC_LEN) {
      return { ok: false, error: 'badAssets' };
    }
    if (!isIntInRange(as.value, 0, MAX_MONEY)) return { ok: false, error: 'badAssets' };
  }

  // checklists: only known item ids, boolean values
  if (!data.checklists || typeof data.checklists !== 'object') return { ok: false, error: 'badChecklists' };
  var lists = ['before', 'signing'];
  for (var l = 0; l < lists.length; l++) {
    var list = lists[l];
    var cl = data.checklists[list];
    if (!cl || typeof cl !== 'object' || Array.isArray(cl)) return { ok: false, error: 'badChecklists' };
    var keys = Object.keys(cl);
    for (var k = 0; k < keys.length; k++) {
      if (CHECKLIST_ITEMS[list].indexOf(keys[k]) === -1) return { ok: false, error: 'badChecklistId' };
      if (cl[keys[k]] !== true && cl[keys[k]] !== false) return { ok: false, error: 'badChecklists' };
    }
  }

  // quiz scores
  if (!data.quiz || typeof data.quiz !== 'object') return { ok: false, error: 'badQuiz' };
  if (data.quiz.best !== null && !isIntInRange(data.quiz.best, 0, QUIZ_TOTAL)) {
    return { ok: false, error: 'badQuiz' };
  }
  if (data.quiz.last !== null && !isIntInRange(data.quiz.last, 0, QUIZ_TOTAL)) {
    return { ok: false, error: 'badQuiz' };
  }

  // Deep copy so the caller's object is never aliased.
  return { ok: true, store: JSON.parse(JSON.stringify(data)) };
}

// --- demo data (never auto-loaded; only via the labelled button) ---
function demoData() {
  var s = createStore();
  s.testator = { name: 'Rahim Uddin', address: 'House 12, Road 5, Dhanmondi, Dhaka', nid: '1234567890' };
  var r1 = addBeneficiary(s, 'Ayesha Begum', 'spouse', 50);
  var r2 = addBeneficiary(s, 'Tanvir Uddin', 'child', 30);
  if (!r1.ok || !r2.ok) return createStore();
  s.executor = { name: 'Kamal Hossain', relation: 'friend', phone: '01712345678' };
  s.witnesses = [{ name: 'Mina Akter' }, { name: 'Arif Chowdhury' }];
  s.guardian = { name: 'Shirin Akter' };
  s.wishes = 'My books should go to the local library.';
  addAsset(s, 'land', 'Land in Gazipur, 5 katha', 500000);
  addAsset(s, 'bank', 'Savings account, Sonali Bank', 200000);
  addAsset(s, 'gold', 'Gold ornaments', 150000);
  s.checklists.before.nid = true;
  s.checklists.before.deed = true;
  return s;
}

// Bengali digits: 0-9 -> U+09E6..U+09EF (written as escapes so this file is pure ASCII).
function toBnDigits(str) {
  var s = String(str);
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c >= '0' && c <= '9') out += String.fromCharCode(0x09E6 + (c.charCodeAt(0) - 48));
    else out += c;
  }
  return out;
}

// Group western digits with commas: 500000 -> "500,000".
function groupDigits(s) {
  var str = String(s);
  var out = '';
  var count = 0;
  for (var i = str.length - 1; i >= 0; i--) {
    out = str.charAt(i) + out;
    count++;
    if (count % 3 === 0 && i !== 0) out = ',' + out;
  }
  return out;
}

// Taka symbol U+09F3, written as an escape so this file stays pure ASCII.
// bn: Bengali digits. en: western digits. The taka symbol is used in both.
function formatMoney(n, lang) {
  if (n === null || n === undefined || n === '') return '';
  var num = groupDigits(String(n));
  if (lang === 'bn') num = toBnDigits(num);
  return '\u09F3' + num;
}

if (typeof module !== 'undefined') {
  module.exports = {
    createStore: createStore,
    newId: newId,
    validateTestator: validateTestator,
    setTestator: setTestator,
    totalShares: totalShares,
    validateBeneficiary: validateBeneficiary,
    addBeneficiary: addBeneficiary,
    updateBeneficiary: updateBeneficiary,
    removeBeneficiary: removeBeneficiary,
    validateExecutor: validateExecutor,
    setExecutor: setExecutor,
    validateWitnesses: validateWitnesses,
    setWitnesses: setWitnesses,
    setGuardian: setGuardian,
    setWishes: setWishes,
    completeness: completeness,
    outlineParts: outlineParts,
    oneThird: oneThird,
    validateAsset: validateAsset,
    addAsset: addAsset,
    updateAsset: updateAsset,
    removeAsset: removeAsset,
    totalAssets: totalAssets,
    toggleChecklist: toggleChecklist,
    checklistProgress: checklistProgress,
    scoreQuiz: scoreQuiz,
    recordQuizScore: recordQuizScore,
    stats: stats,
    exportJSON: exportJSON,
    importJSON: importJSON,
    demoData: demoData,
    toBnDigits: toBnDigits,
    groupDigits: groupDigits,
    formatMoney: formatMoney,
    isValidNid: isValidNid,
    isValidBdPhone: isValidBdPhone,
    RELATIONS: RELATIONS,
    ASSET_TYPES: ASSET_TYPES,
    CHECKLIST_ITEMS: CHECKLIST_ITEMS,
    QUIZ_ANSWERS: QUIZ_ANSWERS,
    QUIZ_TOTAL: QUIZ_TOTAL,
    MAX_MONEY: MAX_MONEY,
    MAX_WISHES_LEN: MAX_WISHES_LEN
  };
}
