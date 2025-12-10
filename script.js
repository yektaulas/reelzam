(function () {
  const apiBase = 'https://api.frankfurter.app';

  // Elements
  const $ = (id) => document.getElementById(id);

  const DEFAULT_INFLATION = 31.07;
  const AMOUNT_RED_CLASS = 'amount-red';
  const AMOUNT_GREEN_CLASS = 'amount-green';
  const footerYearEl = $('footerYear');
  const menuToggle = $('menuToggle');
  const navDrawer = $('navDrawer');
  const navOverlay = $('navOverlay');
  const drawerClose = $('drawerClose');
  const currentSalaryInput = $('currentSalary');
  const proposedSalaryInput = $('proposedSalary');
  const inflationInput = $('inflation');
  const rateStatus = $('rateStatus');
  const eurTryNowValue = $('eurTryNowValue');
  const eurTryLastValue = $('eurTryLastValue');
  const eurTryChangeText = $('eurTryChangeText');
  const usdTryNowValue = $('usdTryNowValue');
  const usdTryLastValue = $('usdTryLastValue');
  const usdTryChangeText = $('usdTryChangeText');
  const calculateBtn = $('calculateBtn');
  const calcError = $('calcError');
  const inflationNominalCell = $('inflationNominalCell');
  const inflationRealCell = $('inflationRealCell');
  const inflationBadgeCell = $('inflationBadgeCell');
  const inflationAmountCell = $('inflationAmountCell');
  const inflationHelperCell = $('inflationHelperCell');
  const usdNominalCell = $('usdNominalCell');
  const usdRealCell = $('usdRealCell');
  const usdBadgeCell = $('usdBadgeCell');
  const usdAmountCell = $('usdAmountCell');
  const usdHelperCell = $('usdHelperCell');
  const eurNominalCell = $('eurNominalCell');
  const eurRealCell = $('eurRealCell');
  const eurBadgeCell = $('eurBadgeCell');
  const eurAmountCell = $('eurAmountCell');
  const eurHelperCell = $('eurHelperCell');

  if (footerYearEl) {
    footerYearEl.textContent = new Date().getFullYear();
  }

  function setNavState(open) {
    if (!menuToggle || !navDrawer || !navOverlay) return;
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    navDrawer.classList.toggle('open', open);
    navOverlay.classList.toggle('active', open);
    navOverlay.hidden = !open;
    const navElement = menuToggle.closest('.site-nav');
    if (navElement) navElement.classList.toggle('open', open);
  }

  function toggleNav() {
    const isOpen = navDrawer?.classList.contains('open');
    setNavState(!isOpen);
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', toggleNav);
  }

  if (drawerClose) {
    drawerClose.addEventListener('click', () => setNavState(false));
  }

  if (navOverlay) {
    navOverlay.addEventListener('click', () => setNavState(false));
  }

  if (navDrawer) {
    navDrawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setNavState(false));
    });
  }

  if (inflationInput) {
    inflationInput.value = DEFAULT_INFLATION.toFixed(2);
  }
  if (inflationHelperCell) {
    inflationHelperCell.innerHTML = `<span class="diff-text">TÜİK enflasyonu %${DEFAULT_INFLATION.toFixed(
      2
    )}</span>`;
  }

  // Formatting helpers for salary inputs (thousands separator with dots)
  function sanitizeToDigits(s) {
    return (s || '').toString().replace(/\D/g, '');
  }

  function formatWithDots(digits) {
    if (!digits) return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function bindThousandInput(el) {
    // initialize dataset.raw and formatted display
    el.dataset.raw = sanitizeToDigits(el.value);
    el.value = formatWithDots(el.dataset.raw);

    el.addEventListener('input', function (e) {
      const raw = sanitizeToDigits(el.value);
      el.dataset.raw = raw;
      el.value = formatWithDots(raw);
      // move caret to end for simplicity
      try {
        el.setSelectionRange(el.value.length, el.value.length);
      } catch (err) {
        /* ignore */
      }
    });

    el.addEventListener('paste', function (e) {
      e.preventDefault();
      const text =
        (e.clipboardData || window.clipboardData).getData('text') || '';
      const raw = sanitizeToDigits(text);
      el.dataset.raw = raw;
      el.value = formatWithDots(raw);
    });
  }

  function getNumberFromFormattedInput(el) {
    const raw = el.dataset.raw || sanitizeToDigits(el.value);
    return raw ? Number(raw) : NaN;
  }

  // FX data state
  let eurNow = null;
  let usdNow = null;
  let eurLastAvg = null;
  let usdLastAvg = null;
  const STORAGE_KEY = 'fx_rates_v1';

  // Save rates to sessionStorage so they persist while the tab is open
  function saveRatesToSession() {
    try {
      const payload = {
        eurNow,
        usdNow,
        eurLastAvg,
        usdLastAvg,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Session storage not available', e);
    }
  }

  // Load rates from sessionStorage if present
  function loadRatesFromSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw);
      if (
        typeof p.eurNow === 'number' &&
        typeof p.usdNow === 'number' &&
        typeof p.eurLastAvg === 'number' &&
        typeof p.usdLastAvg === 'number'
      ) {
        eurNow = p.eurNow;
        usdNow = p.usdNow;
        eurLastAvg = p.eurLastAvg;
        usdLastAvg = p.usdLastAvg;
        return true;
      }
    } catch (e) {
      console.warn('Failed to parse session rates', e);
    }
    return false;
  }

  function clearSessionRates() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function formatPercent(v) {
    if (!isFinite(v)) return '–';
    return (
      v.toLocaleString('tr-TR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }) + ' %'
    );
  }

  const UNIT_TEXT_MAP = {
    TRY: '₺',
    USD: '$',
    EUR: '€',
  };

  function formatAmountValue(value) {
    if (!isFinite(value)) return null;
    return value.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function getUnitText(unit) {
    return UNIT_TEXT_MAP[unit] || unit || '';
  }

  function setAmountCell(cell, prevValue, newValue, unit, context = 'fx') {
    if (!cell) return;
    cell.classList.remove(AMOUNT_RED_CLASS, AMOUNT_GREEN_CLASS);
    const prevText = formatAmountValue(prevValue);
    const newText = formatAmountValue(newValue);
    if (!prevText || !newText) {
      cell.textContent = '–';
      return;
    }
    const unitText = getUnitText(unit);
    const sentence =
      context === 'inflation'
        ? `${prevText} ${unitText} → ${newText} ${unitText}.`
        : `${prevText} ${unitText} → ${newText} ${unitText}.`;
    const className =
      newValue > prevValue ? AMOUNT_GREEN_CLASS : AMOUNT_RED_CLASS;
    cell.classList.add(className);
    cell.innerHTML = sentence;
  }

  function setRateStatus(text, type) {
    rateStatus.textContent = text;
    rateStatus.classList.remove('error', 'ok');
    if (type === 'error') rateStatus.classList.add('error');
    if (type === 'ok') rateStatus.classList.add('ok');
  }

  function formatChangeText(_label, diff) {
    // Return HTML that includes an arrow and a colored percent span
    // so the rate cards keep the up/down arrow and coloring.
    // If diff >= 0, FX rose -> TRY lost value (red/down).
    // If diff < 0, FX fell -> TRY gained value (green/up).
    const absVal = Math.abs(diff).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const isTryGained = diff < 0; // true => show green/up
    const arrow = isTryGained ? '↑' : '↓';
    const cls = isTryGained ? 'up' : 'down';
    // Wrap the whole sentence so its color follows the up/down class
    if (diff >= 0) {
      return `<span class="${cls}">${arrow} TL son 12 ayda %${absVal} değer kaybetti</span>`;
    }
    return `<span class="${cls}">${arrow} TL son 12 ayda %${absVal} değer kazandı</span>`;
  }

  async function fetchRates() {
    try {
      setRateStatus('Kurlar çekiliyor...', '');

      const now = new Date();
      // Use the last 12 months: from (today - 1 year) to today
      const end = now.toISOString().slice(0, 10);
      const startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 1);
      const start = startDate.toISOString().slice(0, 10);

      // Güncel EUR->TRY,USD
      const latestResp = await fetch(`${apiBase}/latest?from=EUR&to=TRY,USD`);
      if (!latestResp.ok) throw new Error('Latest fetch failed');
      const latestData = await latestResp.json();

      const eurTryLatest = latestData.rates?.TRY;
      const eurUsdLatest = latestData.rates?.USD;

      if (!eurTryLatest || !eurUsdLatest) {
        throw new Error('Eksik EUR verisi');
      }

      const usdTryLatest = eurTryLatest / eurUsdLatest;

      // Son 12 ay zaman serisi EUR->TRY,USD
      const histResp = await fetch(
        `${apiBase}/${start}..${end}?from=EUR&to=TRY,USD`
      );
      if (!histResp.ok) throw new Error('History fetch failed');
      const histData = await histResp.json();

      const rates = histData.rates || {};
      const days = Object.keys(rates);

      const eurTryList = [];
      const usdTryList = [];

      for (const d of days) {
        const r = rates[d];
        if (!r) continue;
        const eurTry = r.TRY;
        const eurUsd = r.USD;
        if (typeof eurTry === 'number' && typeof eurUsd === 'number') {
          eurTryList.push(eurTry);
          usdTryList.push(eurTry / eurUsd);
        }
      }

      if (!eurTryList.length || !usdTryList.length) {
        throw new Error('Yeterli tarihsel veri yok');
      }

      const avg = (arr) => arr.reduce((sum, v) => sum + v, 0) / arr.length;

      eurNow = eurTryLatest;
      usdNow = usdTryLatest;
      eurLastAvg = avg(eurTryList);
      usdLastAvg = avg(usdTryList);

      // Ekrana yaz
      const eurUsdCross = eurTryLatest / usdTryLatest;
      eurTryNowValue.textContent = eurTryLatest.toFixed(4);
      eurTryLastValue.textContent = eurLastAvg.toFixed(4);
      const eurDiffPct = ((eurTryLatest - eurLastAvg) / eurLastAvg) * 100;
      eurTryChangeText.innerHTML = formatChangeText('artış', eurDiffPct);

      usdTryNowValue.textContent = usdTryLatest.toFixed(4);
      usdTryLastValue.textContent = usdLastAvg.toFixed(4);
      const usdDiffPct = ((usdTryLatest - usdLastAvg) / usdLastAvg) * 100;
      usdTryChangeText.innerHTML = formatChangeText('artış', usdDiffPct);

      // Persist to session storage
      saveRatesToSession();

      return true;
    } catch (err) {
      console.error(err);
      setRateStatus(
        'Kurlar yüklenemedi. Tekrar dene veya farklı bir zamanda açmayı dene.',
        'error'
      );
      return false;
    }
  }

  // If session has rates, populate the UI from them and return true.
  // Otherwise return false.
  function populateFromSessionIfAvailable() {
    if (!loadRatesFromSession()) return false;
    const eurUsdCross = eurNow / usdNow;
    eurTryNowValue.textContent = (eurNow || 0).toFixed(4);
    eurTryLastValue.textContent = (eurLastAvg || 0).toFixed(4);
    const eurDiffPct = ((eurNow - eurLastAvg) / eurLastAvg) * 100;
    eurTryChangeText.innerHTML = formatChangeText('artış', eurDiffPct);

    usdTryNowValue.textContent = (usdNow || 0).toFixed(4);
    usdTryLastValue.textContent = (usdLastAvg || 0).toFixed(4);
    const usdDiffPct = ((usdNow - usdLastAvg) / usdLastAvg) * 100;
    usdTryChangeText.innerHTML = formatChangeText('artış', usdDiffPct);
    return true;
  }

  function setDiffCell(metricLabel, realPercent) {
    // Reel zamın kendisi (ör: +3.3, -4.2)
    const isUp = realPercent >= 0;
    const absVal = Math.abs(realPercent).toLocaleString('tr-TR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });

    const badgeClass = isUp ? 'badge-up' : 'badge-down';
    const arrow = isUp ? '↑' : '↓';
    const moreOrLess = isUp ? 'daha fazla' : 'daha az';

    const labelText =
      metricLabel === 'Enflasyon'
        ? 'Enflasyona göre alım gücün'
        : metricLabel === 'USD'
        ? 'Dolar paritesine göre alım gücün'
        : 'Euro paritesine göre alım gücün';

    const mainText = `
              <span class="${badgeClass}">
                <span>${arrow}</span>
                <span>%${absVal}</span>
              </span>
            `;

    const helperText = `
              <span class="diff-text">
                ${labelText}
                <strong class="${
                  isUp ? 'up' : 'down'
                }">%${absVal}</strong> ${moreOrLess}
              </span>
            `;

    // pick target cells by metric
    if (metricLabel === 'Enflasyon') {
      if (inflationBadgeCell) inflationBadgeCell.innerHTML = mainText;
      if (inflationHelperCell) inflationHelperCell.innerHTML = helperText;
    } else if (metricLabel === 'USD') {
      if (usdBadgeCell) usdBadgeCell.innerHTML = mainText;
      if (usdHelperCell) usdHelperCell.innerHTML = helperText;
    } else {
      if (eurBadgeCell) eurBadgeCell.innerHTML = mainText;
      if (eurHelperCell) eurHelperCell.innerHTML = helperText;
    }
  }

  function clearDiffCell(metricLabel, msg) {
    const helper = `<span class="diff-text">${msg}</span>`;
    if (metricLabel === 'Enflasyon') {
      if (inflationBadgeCell) inflationBadgeCell.innerHTML = '–';
      if (inflationHelperCell) inflationHelperCell.innerHTML = helper;
    } else if (metricLabel === 'USD') {
      if (usdBadgeCell) usdBadgeCell.innerHTML = '–';
      if (usdHelperCell) usdHelperCell.innerHTML = helper;
    } else {
      if (eurBadgeCell) eurBadgeCell.innerHTML = '–';
      if (eurHelperCell) eurHelperCell.innerHTML = helper;
    }
  }

  function calculate() {
    calcError.textContent = '';
    const currentSalary = getNumberFromFormattedInput(currentSalaryInput);
    const proposedSalary = getNumberFromFormattedInput(proposedSalaryInput);
    const inflation = parseFloat(inflationInput.value);

    if (
      !isFinite(currentSalary) ||
      !isFinite(proposedSalary) ||
      currentSalary <= 0 ||
      proposedSalary <= 0
    ) {
      calcError.textContent =
        'Lütfen geçerli bir mevcut maaş ve teklif edilen maaş gir.';
      return;
    }

    if (
      !isFinite(eurNow) ||
      !isFinite(usdNow) ||
      !isFinite(eurLastAvg) ||
      !isFinite(usdLastAvg)
    ) {
      calcError.textContent =
        'Hesaplama için kur bilgisi gerekiyor. Lütfen tekrar deneyin.';
      return;
    }

    const nominalRaise =
      ((proposedSalary - currentSalary) / currentSalary) * 100;

    setAmountCell(
      inflationAmountCell,
      currentSalary,
      proposedSalary,
      'TRY',
      'inflation'
    );

    // Enflasyon satırı
    inflationNominalCell.textContent = formatPercent(nominalRaise);

    if (isFinite(inflation)) {
      const realRaiseInflation = nominalRaise - inflation;
      inflationRealCell.textContent = formatPercent(realRaiseInflation);
      setDiffCell('Enflasyon', realRaiseInflation);
    } else {
      inflationRealCell.textContent = '–';
      clearDiffCell(
        'Enflasyon',
        'Enflasyon girilmediği için reel fark hesaplanamadı.'
      );
    }

    // USD satırı
    const usdCurrentOld = currentSalary / usdLastAvg;
    const usdOfferNow = proposedSalary / usdNow;
    const realRaiseUsd = ((usdOfferNow - usdCurrentOld) / usdCurrentOld) * 100;

    usdNominalCell.textContent = formatPercent(nominalRaise);
    usdRealCell.textContent = formatPercent(realRaiseUsd);

    usdNominalCell.textContent = formatPercent(nominalRaise);
    usdRealCell.textContent = formatPercent(realRaiseUsd);
    setAmountCell(usdAmountCell, usdCurrentOld, usdOfferNow, 'USD');
    setDiffCell('USD', realRaiseUsd);

    // EUR satırı
    const eurCurrentOld = currentSalary / eurLastAvg;
    const eurOfferNow = proposedSalary / eurNow;
    const realRaiseEur = ((eurOfferNow - eurCurrentOld) / eurCurrentOld) * 100;

    eurNominalCell.textContent = formatPercent(nominalRaise);
    eurRealCell.textContent = formatPercent(realRaiseEur);

    eurNominalCell.textContent = formatPercent(nominalRaise);
    eurRealCell.textContent = formatPercent(realRaiseEur);
    setAmountCell(eurAmountCell, eurCurrentOld, eurOfferNow, 'EUR');
    setDiffCell('EUR', realRaiseEur);
  }

  // On load, try to populate UI from session cache so users keep data
  // when they refresh or navigate within the tab.
  populateFromSessionIfAvailable();

  // Bind formatting behavior to salary inputs
  bindThousandInput(currentSalaryInput);
  bindThousandInput(proposedSalaryInput);

  // Spinner helper
  const spinnerHtml =
    '<span class="spinner" aria-hidden="true"></span><span>Yükleniyor</span>';

  // Ensure rates are available: try session first, otherwise fetch.
  async function ensureRates() {
    // Try to populate from session cache
    if (populateFromSessionIfAvailable()) return true;

    // Not present in session -> fetch
    const ok = await fetchRates();
    return ok;
  }

  // When user clicks "Hesapla", ensure rates are available (from session
  // or API), then run calculation. Show spinner and disable controls while running.
  calculateBtn.addEventListener('click', async function () {
    calcError.textContent = '';

    const originalContent = calculateBtn.innerHTML;
    try {
      calculateBtn.disabled = true;
      calculateBtn.innerHTML = spinnerHtml;

      const ok = await ensureRates();
      if (!ok) {
        calcError.textContent = 'Kurlar yüklenemedi, hesaplama yapılamıyor.';
        return;
      }

      calculate();
    } finally {
      calculateBtn.disabled = false;
      calculateBtn.innerHTML = originalContent;
    }
  });

  // Disclaimer modal behavior
  const disclaimerBtn = $('disclaimerBtn');
  const disclaimerOverlay = $('disclaimerOverlay');
  const disclaimerClose = $('disclaimerClose');

  function openDisclaimer() {
    if (!disclaimerOverlay) return;
    disclaimerOverlay.classList.add('open');
    disclaimerOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeDisclaimer() {
    if (!disclaimerOverlay) return;
    disclaimerOverlay.classList.remove('open');
    disclaimerOverlay.setAttribute('aria-hidden', 'true');
  }

  if (disclaimerBtn) disclaimerBtn.addEventListener('click', openDisclaimer);
  if (disclaimerClose)
    disclaimerClose.addEventListener('click', closeDisclaimer);
  // Close on ESC
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      closeDisclaimer();
      setNavState(false);
    }
  });
})();

document.querySelectorAll('.buttonTrigger').forEach(attachMenuEvent);

// Menu Open and Close function
function attachMenuEvent(menuButton) {
  menuButton.addEventListener('click', function (e) {
    e.preventDefault();
    this.parentElement.classList.toggle('active');
    this.classList.toggle('active');
  });
}
