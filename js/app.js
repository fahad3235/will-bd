// Will BD - DOM rendering + event wiring only.
// Every rule lives in logic.js. All strings come from STR (js/i18n.js).
// Pure ASCII file: the Bengali toggle label below is written with \u escapes.
'use strict';

var STORE_KEY = 'will-bd:data';
var LANG_KEY = 'will-bd:lang';

var store = createStore();
var lang = 'en';
var editingBenId = null;
var editingAssetId = null;
var quiz = { active: false, idx: 0, answers: [], answered: false, done: false };

function $(id) { return document.getElementById(id); }

function t(key) {
  var s = STR[lang][key];
  return (s === undefined || s === null) ? key : s;
}

function fmtNum(n) {
  return lang === 'bn' ? toBnDigits(String(n)) : String(n);
}

function fmtTemplate(key, vars) {
  var s = t(key);
  Object.keys(vars).forEach(function (k) {
    s = s.split('{' + k + '}').join(vars[k]);
  });
  return s;
}

function showError(el, key) {
  if (!el) return;
  if (key) { el.textContent = t(key); el.hidden = false; }
  else { el.textContent = ''; el.hidden = true; }
}

function showOk(el, key) {
  if (!el) return;
  if (key) { el.textContent = t(key); el.hidden = false; }
  else { el.textContent = ''; el.hidden = true; }
}

var ERROR_KEYS = {
  nameEmpty: 'errNameEmpty',
  nameTooLong: 'errNameLong',
  addressTooLong: 'errAddressLong',
  nidInvalid: 'errNid',
  badRelation: 'errBadRelation',
  shareInvalid: 'errShare',
  shareSumExceeded: 'errShareSum',
  tooManyBeneficiaries: 'errTooManyBen',
  phoneInvalid: 'errPhone',
  witness1Empty: 'errWitness1',
  witness2Empty: 'errWitness2',
  witness1TooLong: 'errWitnessLong',
  witness2TooLong: 'errWitnessLong',
  assetDescEmpty: 'errAssetDescEmpty',
  assetDescTooLong: 'errAssetDescLong',
  assetValueInvalid: 'errAssetValue',
  badAssetType: 'errAssetType',
  wishesTooLong: 'errWishesLong',
  estateInvalid: 'errEstateValue'
};

function save() {
  try {
    localStorage.setItem(STORE_KEY, exportJSON(store));
  } catch (e) { /* storage full or unavailable: keep running in memory */ }
}

function load() {
  var raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
  if (raw) {
    var res = importJSON(raw);
    if (res.ok) { store = res.store; }
    else { showError($('loadError'), 'errLoad'); }
  }
  var savedLang = null;
  try { savedLang = localStorage.getItem(LANG_KEY); } catch (e) { savedLang = null; }
  if (savedLang === 'en' || savedLang === 'bn') lang = savedLang;
}

function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
  });
  $('appTitle').textContent = t('appTitle');
  // Toggle shows the OTHER language's name.
  $('langBtn').textContent = lang === 'en' ? '\u09AC\u09BE\u0982\u09B2\u09BE' : 'English';
}

function relationLabel(rel) {
  var map = {
    spouse: 'relSpouse', child: 'relChild', parent: 'relParent',
    sibling: 'relSibling', friend: 'relFriend', other: 'relOther'
  };
  return t(map[rel] || 'relOther');
}

function assetTypeLabel(type) {
  var map = {
    land: 'assetTypeLand', house: 'assetTypeHouse', bank: 'assetTypeBank',
    gold: 'assetTypeGold', business: 'assetTypeBusiness',
    vehicle: 'assetTypeVehicle', other: 'assetTypeOther'
  };
  return t(map[type] || 'assetTypeOther');
}

function fillSelect(select, items, labelFn, selectedValue) {
  select.textContent = '';
  items.forEach(function (it) {
    var opt = document.createElement('option');
    opt.value = it;
    opt.textContent = labelFn(it);
    select.appendChild(opt);
  });
  if (selectedValue && items.indexOf(selectedValue) !== -1) select.value = selectedValue;
}

function fillRelationSelects() {
  fillSelect($('benRelationSelect'), RELATIONS, relationLabel, $('benRelationSelect').value || 'spouse');
  fillSelect($('execRelationSelect'), RELATIONS, relationLabel, $('execRelationSelect').value || 'spouse');
}

function fillAssetTypeSelect() {
  fillSelect($('assetTypeSelect'), ASSET_TYPES, assetTypeLabel, $('assetTypeSelect').value || 'land');
}

// --- forms (fill from store) ---
function fillTestatorForm() {
  $('testatorNameInput').value = store.testator.name || '';
  $('testatorAddressInput').value = store.testator.address || '';
  $('testatorNidInput').value = store.testator.nid || '';
}

function fillExecutorForm() {
  $('execNameInput').value = store.executor.name || '';
  $('execRelationSelect').value = store.executor.relation || 'spouse';
  $('execPhoneInput').value = store.executor.phone || '';
}

function fillWitnessForm() {
  $('witness1Input').value = (store.witnesses[0] && store.witnesses[0].name) || '';
  $('witness2Input').value = (store.witnesses[1] && store.witnesses[1].name) || '';
}

function fillGuardianForm() {
  $('guardianNameInput').value = (store.guardian && store.guardian.name) || '';
}

function fillWishesForm() {
  $('wishesInput').value = store.wishes || '';
  updateWishesCount();
}

function updateWishesCount() {
  $('wishesCount').textContent = fmtNum($('wishesInput').value.length) + ' / ' +
    fmtNum(500) + ' ' + t('charsLabel');
}

// --- dashboard ---
function renderDashboard() {
  var s = stats(store);
  $('statAssets').textContent = formatMoney(s.totalAssets, lang);
  $('statBeneficiaries').textContent = fmtNum(s.beneficiaryCount);
  $('statChecklist').textContent = fmtNum(s.checklistPct) + '%';
  $('statOutline').textContent = s.outlineComplete ? t('complete') : t('incomplete');
}

// --- beneficiaries ---
function renderBeneficiaries() {
  var list = $('benList');
  list.textContent = '';
  store.beneficiaries.forEach(function (b) {
    var li = document.createElement('li');
    li.className = 'ben-row';
    var info = document.createElement('span');
    info.className = 'ben-info';
    info.textContent = fmtTemplate('outBen', {
      name: b.name,
      relation: relationLabel(b.relation),
      share: fmtNum(b.share)
    });
    li.appendChild(info);
    var spacer = document.createElement('span');
    spacer.className = 'spacer';
    li.appendChild(spacer);
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-small';
    editBtn.textContent = t('edit');
    editBtn.addEventListener('click', function () {
      editingBenId = b.id;
      $('benNameInput').value = b.name;
      $('benRelationSelect').value = b.relation;
      $('benShareInput').value = String(b.share);
      $('addBenBtn').textContent = t('save');
      $('benCancelBtn').hidden = false;
      $('benNameInput').focus();
    });
    li.appendChild(editBtn);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-small';
    btn.textContent = t('remove');
    btn.addEventListener('click', function () {
      if (btn.getAttribute('data-armed') === '1') {
        removeBeneficiary(store, b.id);
        if (editingBenId === b.id) resetBenForm();
        save();
        render();
      } else {
        btn.setAttribute('data-armed', '1');
        btn.textContent = t('sureQ');
        btn.classList.add('btn-armed');
        setTimeout(function () {
          if (btn.isConnected) {
            btn.removeAttribute('data-armed');
            btn.textContent = t('remove');
            btn.classList.remove('btn-armed');
          }
        }, 3000);
      }
    });
    li.appendChild(btn);
    list.appendChild(li);
  });
  $('benEmpty').hidden = store.beneficiaries.length > 0;
}

function resetBenForm() {
  editingBenId = null;
  $('benNameInput').value = '';
  $('benShareInput').value = '';
  $('benRelationSelect').value = 'spouse';
  $('addBenBtn').textContent = t('addBeneficiary');
  $('benCancelBtn').hidden = true;
  showError($('benError'), null);
}

// --- outline ---
function renderOutline() {
  var parts = outlineParts(store);
  var box = $('outlineLines');
  box.textContent = '';
  function addLine(text) {
    var p = document.createElement('p');
    p.className = 'outline-line';
    p.textContent = text;
    box.appendChild(p);
  }
  var missingEl = $('outlineMissing');
  if (parts.complete) {
    missingEl.hidden = true;
    missingEl.textContent = '';
  } else {
    var names = parts.missing.map(function (m) {
      if (m === 'testator') return t('missingTestator');
      if (m === 'beneficiary') return t('missingBeneficiary');
      if (m === 'executor') return t('missingExecutor');
      return t('missingWitnesses');
    });
    missingEl.textContent = t('outlineNotReady') + ' ' + t('missingLabel') + names.join(', ') + '.';
    missingEl.hidden = false;
  }
  addLine(fmtTemplate('outTestator', { name: parts.testator.name || t('outNone') }));
  if (parts.testator.address) {
    addLine(fmtTemplate('outAddress', { address: parts.testator.address }));
  }
  if (parts.testator.nid) {
    addLine(fmtTemplate('outNid', { nid: parts.testator.nid }));
  }
  parts.beneficiaries.forEach(function (b) {
    addLine(fmtTemplate('outBen', {
      name: b.name,
      relation: relationLabel(b.relation),
      share: fmtNum(b.share)
    }));
  });
  if (parts.executor.name) {
    addLine(fmtTemplate('outExecutor', {
      name: parts.executor.name,
      relation: relationLabel(parts.executor.relation)
    }));
    if (parts.executor.phone) {
      addLine(fmtTemplate('outExecutorPhone', { phone: parts.executor.phone }));
    }
  }
  if (parts.witnesses[0].name && parts.witnesses[1].name) {
    addLine(fmtTemplate('outWitnesses', { a: parts.witnesses[0].name, b: parts.witnesses[1].name }));
  }
  if (parts.guardian.name) {
    addLine(fmtTemplate('outGuardian', { name: parts.guardian.name }));
  }
  if (parts.wishes) {
    addLine(fmtTemplate('outWishes', { text: parts.wishes }));
  }
  addLine(fmtTemplate('outTotalAssets', { amount: formatMoney(parts.totalAssets, lang) }));
  addLine(fmtTemplate('outShares', { n: fmtNum(parts.sharesTotal) }));
  if (parts.sharesLeft > 0) {
    addLine(fmtTemplate('outSharesLeft', { n: fmtNum(parts.sharesLeft) }));
  }
}

// --- assets ---
function renderAssets() {
  var list = $('assetList');
  list.textContent = '';
  store.assets.forEach(function (a) {
    var li = document.createElement('li');
    li.className = 'asset-row';
    var info = document.createElement('span');
    info.className = 'asset-info';
    info.textContent = assetTypeLabel(a.type) + ' - ' + a.description;
    li.appendChild(info);
    var val = document.createElement('span');
    val.className = 'asset-value';
    val.textContent = formatMoney(a.value, lang);
    li.appendChild(val);
    var spacer = document.createElement('span');
    spacer.className = 'spacer';
    li.appendChild(spacer);
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-small';
    editBtn.textContent = t('edit');
    editBtn.addEventListener('click', function () {
      editingAssetId = a.id;
      $('assetTypeSelect').value = a.type;
      $('assetDescInput').value = a.description;
      $('assetValueInput').value = String(a.value);
      $('addAssetBtn').textContent = t('save');
      $('assetCancelBtn').hidden = false;
      $('assetDescInput').focus();
    });
    li.appendChild(editBtn);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-small';
    btn.textContent = t('remove');
    btn.addEventListener('click', function () {
      if (btn.getAttribute('data-armed') === '1') {
        removeAsset(store, a.id);
        if (editingAssetId === a.id) resetAssetForm();
        save();
        render();
      } else {
        btn.setAttribute('data-armed', '1');
        btn.textContent = t('sureQ');
        btn.classList.add('btn-armed');
        setTimeout(function () {
          if (btn.isConnected) {
            btn.removeAttribute('data-armed');
            btn.textContent = t('remove');
            btn.classList.remove('btn-armed');
          }
        }, 3000);
      }
    });
    li.appendChild(btn);
    list.appendChild(li);
  });
  $('assetsEmpty').hidden = store.assets.length > 0;
  $('assetTotal').textContent = formatMoney(totalAssets(store), lang);
}

function resetAssetForm() {
  editingAssetId = null;
  $('assetTypeSelect').value = 'land';
  $('assetDescInput').value = '';
  $('assetValueInput').value = '';
  $('addAssetBtn').textContent = t('addAsset');
  $('assetCancelBtn').hidden = true;
  showError($('assetError'), null);
}

// --- checklists ---
function renderChecklists() {
  var p = checklistProgress(store);
  renderChecklist('before', $('beforeList'));
  renderChecklist('signing', $('signingList'));
  $('beforePct').textContent = fmtTemplate('overallProgress', { n: fmtNum(p.before.pct) });
  $('signingPct').textContent = fmtTemplate('overallProgress', { n: fmtNum(p.signing.pct) });
  $('overallPct').textContent = fmtTemplate('overallProgress', { n: fmtNum(p.overall.pct) });
}

function renderChecklist(listName, ul) {
  ul.textContent = '';
  var keyMap = {
    before: {
      nid: 'clBeforeNid', deed: 'clBeforeDeed', bank: 'clBeforeBank',
      nominee: 'clBeforeNominee', debts: 'clBeforeDebts', previous: 'clBeforePrevious'
    },
    signing: {
      witnesses: 'clSigningWitnesses', signPages: 'clSigningSignPages',
      date: 'clSigningDate', safePlace: 'clSigningSafePlace', copyExecutor: 'clSigningCopyExecutor'
    }
  };
  CHECKLIST_ITEMS[listName].forEach(function (itemId) {
    var li = document.createElement('li');
    li.className = 'check-row';
    var label = document.createElement('label');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!store.checklists[listName][itemId];
    cb.addEventListener('change', function () {
      toggleChecklist(store, listName, itemId);
      save();
      render();
    });
    label.appendChild(cb);
    var span = document.createElement('span');
    span.textContent = t(keyMap[listName][itemId]);
    label.appendChild(span);
    li.appendChild(label);
    ul.appendChild(li);
  });
}

// --- quiz ---
function renderQuiz() {
  var startBtn = $('quizStartBtn');
  var box = $('quizBox');
  var result = $('quizResult');
  var bestLine = $('quizBestLine');
  if (store.quiz.best === null && store.quiz.last === null) {
    bestLine.textContent = t('quizNotStarted');
  } else {
    bestLine.textContent = fmtTemplate('quizBest', { a: fmtNum(store.quiz.best), b: fmtNum(10) });
  }
  if (!quiz.active) {
    startBtn.hidden = false;
    box.hidden = true;
    result.hidden = quiz.done ? false : true;
    $('quizRestartBtn').hidden = !quiz.done;
    if (quiz.done) {
      var res = scoreQuiz(quiz.answers);
      result.textContent = t('quizDone') + ' ' +
        fmtTemplate('quizScore', { a: fmtNum(res.score), b: fmtNum(res.total) });
    }
    return;
  }
  startBtn.hidden = true;
  box.hidden = false;
  result.hidden = true;
  var q = STR[lang].quiz[quiz.idx];
  $('quizQof').textContent = fmtTemplate('quizQof', { a: fmtNum(quiz.idx + 1), b: fmtNum(10) });
  $('quizQuestion').textContent = q.q;
  var opts = $('quizOptions');
  opts.textContent = '';
  q.options.forEach(function (optText, oi) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn quiz-option';
    btn.textContent = optText;
    btn.disabled = quiz.answered;
    if (quiz.answered) {
      if (oi === QUIZ_ANSWERS[quiz.idx]) btn.classList.add('quiz-correct-opt');
      else if (oi === quiz.answers[quiz.idx]) btn.classList.add('quiz-wrong-opt');
    }
    btn.addEventListener('click', function () {
      if (quiz.answered) return;
      quiz.answers[quiz.idx] = oi;
      quiz.answered = true;
      var fb = $('quizFeedback');
      var correct = oi === QUIZ_ANSWERS[quiz.idx];
      fb.textContent = (correct ? t('quizCorrect') : t('quizWrong')) + ' ' + t('quizWhy') + q.why;
      fb.hidden = false;
      $('quizNextBtn').hidden = false;
      renderQuiz();
    });
    opts.appendChild(btn);
  });
  $('quizFeedback').hidden = !quiz.answered;
  if (quiz.answered) {
    var fb2 = $('quizFeedback');
    var correct2 = quiz.answers[quiz.idx] === QUIZ_ANSWERS[quiz.idx];
    fb2.textContent = (correct2 ? t('quizCorrect') : t('quizWrong')) + ' ' + t('quizWhy') + q.why;
    fb2.hidden = false;
  }
  $('quizNextBtn').hidden = !quiz.answered;
  $('quizNextBtn').textContent = quiz.idx === 9 ? t('quizFinish') : t('quizNext');
}

function finishQuiz() {
  var res = scoreQuiz(quiz.answers);
  if (res.ok) {
    recordQuizScore(store, res.score);
    save();
  }
  quiz.active = false;
  quiz.done = true;
  render();
}

function render() {
  applyI18n();
  fillRelationSelects();
  fillAssetTypeSelect();
  renderDashboard();
  renderBeneficiaries();
  renderOutline();
  renderAssets();
  renderChecklists();
  renderQuiz();
}

function bindEvents() {
  $('langBtn').addEventListener('click', function () {
    lang = lang === 'en' ? 'bn' : 'en';
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
    render();
  });

  $('testatorForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    showError($('testatorError'), null);
    showOk($('testatorSaved'), null);
    var res = setTestator(store,
      $('testatorNameInput').value,
      $('testatorAddressInput').value,
      $('testatorNidInput').value);
    if (!res.ok) {
      showError($('testatorError'), ERROR_KEYS[res.error] || 'errNameEmpty');
      return;
    }
    save();
    showOk($('testatorSaved'), 'testatorSaved');
    render();
  });

  $('benForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    showError($('benError'), null);
    var name = $('benNameInput').value;
    var relation = $('benRelationSelect').value;
    var shareRaw = $('benShareInput').value.trim();
    var share = shareRaw === '' ? NaN : parseInt(shareRaw, 10);
    var res;
    if (editingBenId) {
      res = updateBeneficiary(store, editingBenId, name, relation, share);
    } else {
      res = addBeneficiary(store, name, relation, share);
    }
    if (!res.ok) {
      showError($('benError'), ERROR_KEYS[res.error] || 'errNameEmpty');
      return;
    }
    resetBenForm();
    save();
    render();
  });

  $('benCancelBtn').addEventListener('click', function () {
    resetBenForm();
    render();
  });

  $('executorForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    showError($('execError'), null);
    showOk($('execSaved'), null);
    var res = setExecutor(store,
      $('execNameInput').value,
      $('execRelationSelect').value,
      $('execPhoneInput').value);
    if (!res.ok) {
      showError($('execError'), ERROR_KEYS[res.error] || 'errNameEmpty');
      return;
    }
    save();
    showOk($('execSaved'), 'executorSaved');
    render();
  });

  $('witnessForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    showError($('witnessError'), null);
    showOk($('witnessSaved'), null);
    var res = setWitnesses(store, $('witness1Input').value, $('witness2Input').value);
    if (!res.ok) {
      showError($('witnessError'), ERROR_KEYS[res.error] || 'errWitness1');
      return;
    }
    save();
    showOk($('witnessSaved'), 'witnessesSaved');
    render();
  });

  $('guardianForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    showError($('guardianError'), null);
    showOk($('guardianSaved'), null);
    var res = setGuardian(store, $('guardianNameInput').value);
    if (!res.ok) {
      showError($('guardianError'), ERROR_KEYS[res.error] || 'errGuardianLong');
      return;
    }
    save();
    showOk($('guardianSaved'), 'guardianSaved');
    render();
  });

  $('wishesForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    showError($('wishesError'), null);
    showOk($('wishesSaved'), null);
    var res = setWishes(store, $('wishesInput').value);
    if (!res.ok) {
      showError($('wishesError'), ERROR_KEYS[res.error] || 'errWishesLong');
      return;
    }
    save();
    showOk($('wishesSaved'), 'wishesSaved');
    render();
  });

  $('wishesInput').addEventListener('input', updateWishesCount);

  $('printBtn').addEventListener('click', function () {
    window.print();
  });

  $('calcForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    $('calcBtn').click();
  });

  $('calcBtn').addEventListener('click', function () {
    showError($('calcError'), null);
    $('calcResult').hidden = true;
    $('calcRule').hidden = true;
    var raw = $('estateInput').value.trim();
    var val = raw === '' ? NaN : parseInt(raw, 10);
    var res = oneThird(val);
    if (!res.ok) {
      showError($('calcError'), ERROR_KEYS[res.error] || 'errEstateValue');
      return;
    }
    $('calcResult').textContent = fmtTemplate('calcResult', { amount: formatMoney(res.maxBequest, lang) });
    $('calcResult').hidden = false;
    $('calcRule').textContent = fmtTemplate('calcRule', {
      estate: formatMoney(val, lang),
      amount: formatMoney(res.maxBequest, lang)
    });
    $('calcRule').hidden = false;
  });

  $('assetForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    showError($('assetError'), null);
    var type = $('assetTypeSelect').value;
    var desc = $('assetDescInput').value;
    var valRaw = $('assetValueInput').value.trim();
    var val = valRaw === '' ? NaN : parseInt(valRaw, 10);
    var res;
    if (editingAssetId) {
      res = updateAsset(store, editingAssetId, type, desc, val);
    } else {
      res = addAsset(store, type, desc, val);
    }
    if (!res.ok) {
      showError($('assetError'), ERROR_KEYS[res.error] || 'errAssetDescEmpty');
      return;
    }
    resetAssetForm();
    save();
    render();
  });

  $('assetCancelBtn').addEventListener('click', function () {
    resetAssetForm();
    render();
  });

  $('quizStartBtn').addEventListener('click', function () {
    quiz = { active: true, idx: 0, answers: [], answered: false, done: false };
    render();
  });

  $('quizRestartBtn').addEventListener('click', function () {
    quiz = { active: true, idx: 0, answers: [], answered: false, done: false };
    render();
  });

  $('quizNextBtn').addEventListener('click', function () {
    if (!quiz.answered) return;
    if (quiz.idx === 9) {
      finishQuiz();
      return;
    }
    quiz.idx++;
    quiz.answered = false;
    render();
  });

  $('demoBtn').addEventListener('click', function () {
    store = demoData();
    editingBenId = null;
    editingAssetId = null;
    quiz = { active: false, idx: 0, answers: [], answered: false, done: false };
    save();
    fillTestatorForm();
    fillExecutorForm();
    fillWitnessForm();
    fillGuardianForm();
    fillWishesForm();
    var msg = $('dataMsg');
    msg.textContent = t('demoLoaded');
    msg.style.color = '';
    render();
  });

  $('exportBtn').addEventListener('click', function () {
    var json = exportJSON(store);
    window.__willExported = json;
    try {
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'will-bd.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) { /* download unavailable: JSON is still in window.__willExported */ }
    var msg = $('dataMsg');
    msg.textContent = t('exported');
    msg.style.color = '';
  });

  $('importBtn').addEventListener('click', function () {
    $('importFile').click();
  });

  $('importFile').addEventListener('change', function () {
    var file = $('importFile').files && $('importFile').files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var res = importJSON(String(reader.result));
      var msg = $('dataMsg');
      if (!res.ok) {
        msg.textContent = t('errBadImport');
        msg.style.color = '#b91c1c';
        $('importFile').value = '';
        return;
      }
      store = res.store;
      editingBenId = null;
      editingAssetId = null;
      quiz = { active: false, idx: 0, answers: [], answered: false, done: false };
      save();
      fillTestatorForm();
      fillExecutorForm();
      fillWitnessForm();
      fillGuardianForm();
      fillWishesForm();
      msg.textContent = t('imported');
      msg.style.color = '';
      $('importFile').value = '';
      render();
    };
    reader.readAsText(file);
  });

  $('eraseBtn').addEventListener('click', function () {
    $('eraseBox').hidden = !$('eraseBox').hidden;
    showError($('eraseError'), null);
  });

  $('eraseConfirmBtn').addEventListener('click', function () {
    if ($('eraseInput').value !== 'DELETE') {
      showError($('eraseError'), 'errErase');
      return;
    }
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    store = createStore();
    editingBenId = null;
    editingAssetId = null;
    quiz = { active: false, idx: 0, answers: [], answered: false, done: false };
    $('eraseInput').value = '';
    $('eraseBox').hidden = true;
    showError($('eraseError'), null);
    fillTestatorForm();
    fillExecutorForm();
    fillWitnessForm();
    fillGuardianForm();
    fillWishesForm();
    var msg = $('dataMsg');
    msg.textContent = t('erased');
    msg.style.color = '';
    render();
  });
}

load();
fillTestatorForm();
fillExecutorForm();
fillWitnessForm();
fillGuardianForm();
fillWishesForm();
bindEvents();
render();
