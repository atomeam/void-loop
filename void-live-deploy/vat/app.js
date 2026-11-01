import { mountRelated } from '/lib/toolkit.js';
import { compute, money, rateText } from '/lib/vat.js';

const $ = (id) => document.getElementById(id);
const stateKey = 'a2m.void.vat.v1';
const rates = [22, 20, 18, 10, 5, 0];

function fmt(value, lang) {
  return Number(value).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const L = lang === 'en' ? 'en' : 'ru';
  document.documentElement.lang = L;
  const dict = L === 'en' ? {
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
    copy: 'Copy link'
  } : {
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
    copy: 'Скопировать ссылку'
  };

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
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ru';
  $('#vatValue').textContent = (lang === 'ru' ? 'НДС: ' : 'VAT: ') + fmt(result.vat, lang);
  $('#baseValue').textContent = (lang === 'ru' ? 'Основа: ' : 'Base: ') + fmt(result.net, lang);
  $('#grossValue').textContent = (lang === 'ru' ? 'Итог: ' : 'Total: ') + fmt(result.gross, lang);
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
mountRelated(document.getElementById('related'), '/vat/', [
  { label: 'Calculator', href: () => '/calculator/' },
  { label: 'Unit converter', href: () => '/convert/' },
  { label: 'Base converter', href: () => '/base-converter/' },
]);
