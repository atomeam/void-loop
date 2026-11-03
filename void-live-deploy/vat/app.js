import { mountRelated } from '/lib/toolkit.js';
import { compute, money, rateText } from '/lib/vat.js';

// every call names the element as '#id' (2026-11-03: with getElementById('#rates') null the page stopped at its first line and never mounted its links)
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));
const stateKey = 'a2m.void.vat.v1';
const historyKey = 'a2m.void.vat.history.v1';
const rates = [22, 20, 18, 10, 5, 0];
const MAX_HISTORY = 8;
let historySignature = '';

function fmt(value, lang) {
  return Number(value).toLocaleString(lang === 'ru' ? 'ru-RU' : lang === 'de' ? 'de-DE' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function readHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(historyKey) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (_) {
    return [];
  }
}

function historyLabelFor(entry) {
  const modeLabel = entry.mode === 'add' ? 'add' : 'extract';
  if (entry.lang === 'de') {
    return `${fmt(entry.amount, 'de')} · ${entry.rate}% · ${modeLabel === 'add' ? 'MwSt hinzufügen' : 'MwSt ermitteln'}`;
  }
  if (entry.lang === 'en') {
    return `${fmt(entry.amount, 'en')} · ${entry.rate}% · ${modeLabel === 'add' ? 'add VAT' : 'extract VAT'}`;
  }
  return `${fmt(entry.amount, 'ru')} · ${entry.rate}% · ${modeLabel === 'add' ? 'начислить НДС' : 'выделить НДС'}`;
}

function renderHistory() {
  const list = $('#historyList');
  const history = readHistory();
  const lang = document.documentElement.lang || 'ru';
  const dict = getDict(lang);
  list.innerHTML = '';

  if (!history.length) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = dict.historyEmpty;
    list.appendChild(empty);
    return;
  }

  for (const entry of history) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.width = '100%';
    btn.style.textAlign = 'left';
    btn.style.justifyContent = 'space-between';
    btn.style.display = 'flex';
    btn.style.gap = '10px';
    btn.style.padding = '10px 12px';
    btn.style.borderRadius = '8px';
    btn.style.background = 'rgba(255,255,255,0.02)';
    btn.style.border = '1px solid var(--line)';
    btn.style.color = 'inherit';
    const left = document.createElement('span');
    left.textContent = historyLabelFor(entry);
    const right = document.createElement('small');
    right.textContent = `${fmt(entry.gross, entry.lang)}`;
    btn.appendChild(left);
    btn.appendChild(right);
    btn.addEventListener('click', () => {
      $('#amount').value = String(entry.amount);
      $('#rate').value = String(entry.rate);
      $('#mode').value = entry.mode;
      setLang(entry.lang);
      saveState();
      render();
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function getDict(lang) {
  const L = lang === 'en' ? 'en' : lang === 'de' ? 'de' : 'ru';
  if (L === 'en') {
    return {
      title: 'VAT and tax calculator',
      amount: 'Amount',
      rate: 'VAT rate',
      mode: 'Mode',
      sumMode: 'Total type',
      extract: 'Extract VAT',
      add: 'Add VAT',
      gross: 'Total with VAT',
      net: 'Total without VAT',
      summary: 'Calculated locally on this device.',
      copy: 'Copy link',
      historyTitle: 'Calculation history',
      historyEmpty: 'No calculations yet.',
      footer: 'Only on this device. No network requests, downloads or server-side processing.',
      vat: 'VAT: ',
      base: 'Base: ',
      total: 'Total: ',
    };
  }
  if (L === 'de') {
    return {
      title: 'Mehrwertsteuer- und Steuerrechner',
      amount: 'Betrag',
      rate: 'Mehrwertsteuersatz',
      mode: 'Modus',
      sumMode: 'Summenart',
      extract: 'MwSt ermitteln',
      add: 'MwSt hinzufügen',
      gross: 'Bruttobetrag mit MwSt',
      net: 'Nettobetrag ohne MwSt',
      summary: 'Lokal auf diesem Gerät berechnet.',
      copy: 'Link kopieren',
      historyTitle: 'Rechenhistorie',
      historyEmpty: 'Noch keine Berechnungen.',
      footer: 'Nur auf diesem Gerät. Keine Netzwerkanfragen, Downloads oder serverseitige Verarbeitung.',
      vat: 'MwSt: ',
      base: 'Basis: ',
      total: 'Gesamt: ',
    };
  }
  return {
    title: 'Калькулятор НДС и налогов',
    amount: 'Сумма',
    rate: 'Ставка НДС',
    mode: 'Режим',
    sumMode: 'Тип суммы',
    extract: 'Выделить НДС',
    add: 'Начислить НДС',
    gross: 'Сумма с НДС',
    net: 'Сумма без НДС',
    summary: 'Рассчитано локально на этом устройстве.',
    copy: 'Скопировать ссылку',
    historyTitle: 'История расчётов',
    historyEmpty: 'Пока нет расчётов.',
    footer: 'На этом устройстве только. Никаких сетевых запросов, загрузок и серверной обработки.',
    vat: 'НДС: ',
    base: 'Основа: ',
    total: 'Итог: ',
  };
}

function currentState() {
  const amount = Number($('#amount').value || 0);
  const rate = Number($('#rate').value || 22);
  return {
    amount,
    rate,
    mode: $('#mode').value,
    sumMode: $('#sumMode').value,
    lang: document.documentElement.lang || 'ru',
  };
}

function recordHistory(state, result) {
  if (!result) return;
  const signature = JSON.stringify({ amount: Number(state.amount), rate: Number(state.rate), mode: state.mode, lang: state.lang });
  if (signature === historySignature) return;
  historySignature = signature;

  const entry = {
    key: signature,
    amount: Number(state.amount),
    rate: Number(state.rate),
    mode: state.mode,
    lang: state.lang,
    gross: Number(result.gross),
    vat: Number(result.vat),
    net: Number(result.net),
  };

  const list = readHistory();
  const filtered = list.filter((item) => !(item.key === entry.key && item.lang === entry.lang));
  filtered.unshift(entry);
  const trimmed = filtered.slice(0, MAX_HISTORY);
  try { localStorage.setItem(historyKey, JSON.stringify(trimmed)); } catch (_) {}
  renderHistory();
}

function saveState() {
  const state = currentState();
  try { localStorage.setItem(stateKey, JSON.stringify(state)); } catch (_) {}
  const url = new URL(location.href);
  url.searchParams.set('lang', state.lang);
  url.searchParams.set('sum', String(state.amount));
  url.searchParams.set('rate', String(state.rate));
  url.searchParams.set('mode', state.mode);
  history.replaceState({}, '', url);
}

function setLang(lang) {
  const L = lang === 'en' ? 'en' : lang === 'de' ? 'de' : 'ru';
  document.documentElement.lang = L;
  const dict = getDict(L);

  $('#title').textContent = dict.title;
  $('#amountLabel').textContent = dict.amount;
  $('#rateLabel').textContent = dict.rate;
  $('#modeLabel').textContent = dict.mode;
  $('#sumLabel').textContent = dict.sumMode;
  $('#mode').options[0].textContent = dict.extract;
  $('#mode').options[1].textContent = dict.add;
  $('#sumMode').options[0].textContent = dict.gross;
  $('#sumMode').options[1].textContent = dict.net;
  $('#summary').textContent = dict.summary;
  $('#copyLink').textContent = dict.copy;
  $('#historyTitle').textContent = dict.historyTitle;
  $('#footerNote').textContent = dict.footer;
  renderHistory();
  render();
}

function render() {
  const state = currentState();
  const amount = Number($('#amount').value || 0);
  const rate = Number($('#rate').value || 22);
  const mode = $('#mode').value;
  const result = compute({ amount, rate, mode });
  if (!result) {
    $('#vatValue').textContent = '—';
    $('#baseValue').textContent = '—';
    $('#grossValue').textContent = '—';
    return;
  }
  const lang = document.documentElement.lang === 'en' ? 'en' : document.documentElement.lang === 'de' ? 'de' : 'ru';
  const dict = getDict(lang);
  $('#vatValue').textContent = dict.vat + fmt(result.vat, lang);
  $('#baseValue').textContent = dict.base + fmt(result.net, lang);
  $('#grossValue').textContent = dict.total + fmt(result.gross, lang);
  recordHistory(state, result);
}

function restoreState() {
  const q = new URLSearchParams(location.search);
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(stateKey) || '{}'); } catch (_) {}
  const amount = q.get('sum') || q.get('amount') || saved.amount || 1000;
  const rate = q.get('rate') || saved.rate || 22;
  const mode = q.get('mode') || saved.mode || 'extract';
  const lang = q.get('lang') || saved.lang || 'ru';
  $('#amount').value = amount;
  $('#rate').value = rate;
  $('#mode').value = mode;
  setLang(lang);
}

function buildRateButtons() {
  const box = $('#rates');
  for (const r of rates) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.rate = String(r);
    b.textContent = String(r) + '%';
    b.addEventListener('click', () => {
      $('#rate').value = String(r);
      saveState();
      render();
    });
    box.appendChild(b);
  }
}

function bind() {
  for (const id of ['amount', 'rate', 'mode', 'sumMode']) {
    $(id).addEventListener('input', () => { saveState(); render(); });
    $(id).addEventListener('change', () => { saveState(); render(); });
  }

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      saveState();
      render();
    });
  });

  $('#copyLink').addEventListener('click', async () => {
    const url = new URL(location.href);
    url.searchParams.set('lang', document.documentElement.lang || 'ru');
    url.searchParams.set('sum', $('#amount').value);
    url.searchParams.set('rate', $('#rate').value);
    url.searchParams.set('mode', $('#mode').value);
    try { await navigator.clipboard.writeText(url.toString()); } catch (_) {}
  });
}

buildRateButtons();
restoreState();
bind();
render();
// the hand-off carries this page's sum to the calculator; the related tools themselves come from lib/toolkit.js (RELATED['/vat/'])
mountRelated(document.getElementById('related'), '/vat/', [
  { label: 'Check it in the calculator', href: () => {
    const a = Number($('#amount').value), r = Number($('#rate').value);
    if (!Number.isFinite(a) || !Number.isFinite(r)) return '';
    return '/calculator/?q=' + encodeURIComponent($('#mode').value === 'add' ? a + '*(1+' + r + '/100)' : a + '/(1+' + r + '/100)');
  } },
]);
