// Gift checkout front end. The adapter is supplied by the MMW application.
// Without an adapter this page stays a clearly labeled, no-payment preview.
(() => {
  const $ = selector => document.querySelector(selector);
  const screens = [...document.querySelectorAll('.screen')];
  const nav = [...document.querySelectorAll('[data-step]')];
  const adapter = window.MMWGiftCheckoutAdapter || window.MMWGiftPaymentAdapter || null;
  const params = new URLSearchParams(location.search);
  let reviewMode = !adapter && params.get('review') === '1';
  const invitationToken = params.get('invite');
  const previewScenario = params.get('scenario');
  const paymentForm = $('#payment-form');
  const country = $('#country');
  const paymentStatus = $('#payment-status');
  const paypalStatus = $('#paypal-status');
  const studentInput = $('#students');
  const submitButton = $('#payment-submit');
  const defaultInviteUrl = location.origin + location.pathname + '#recipient';
  const money = (value, currency = 'USD') =>
    new Intl.NumberFormat(undefined, {style: 'currency', currency, maximumFractionDigits: 2}).format(value);
  const dateLabel = value => new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'long', day: 'numeric'
  }).format(new Date(value));
  const plusSevenDays = start => {
    const date = new Date(start);
    date.setDate(date.getDate() + 7);
    return date;
  };

  let method = 'card';
  let paypalApproved = false;
  let paypalToken = null;
  let paymentBusy = false;
  let paymentReady = !adapter;
  let recipientBusy = false;
  let quote = null;
  let quoteSequence = 0;
  let quoteTimer = null;
  let completedGift = null;
  let recipientAccepted = false;
  let accountReady = false;

  function message(node, text, error = false) {
    node.textContent = text;
    node.hidden = !text;
    node.classList.toggle('error', error);
  }

  function fieldsValid(ids, errorNode) {
    message(errorNode, '');
    for (const id of ids) {
      const input = $('#' + id);
      const valid = Boolean(input.value.trim()) && input.checkValidity();
      input.setAttribute('aria-invalid', String(!valid));
      if (!valid) {
        message(errorNode, 'Please complete the highlighted fields.', true);
        input.focus();
        input.reportValidity();
        return false;
      }
    }
    return true;
  }

  function showStep(id) {
    if (!reviewMode && id === 'payment' && !accountReady) id = 'giver';
    if (!reviewMode && id === 'share' && !completedGift) id = accountReady ? 'payment' : 'giver';
    screens.forEach(screen => screen.classList.toggle('hidden', screen.id !== id));
    nav.forEach(button => button.setAttribute('aria-current', button.dataset.step === id ? 'step' : 'false'));
    $('#review-screen').value = reviewMode ? id : 'flow';
    $('.layout').classList.toggle('recipient-view', id === 'recipient');
    $('.side-card').hidden = id === 'recipient';
    if (id === 'payment') {
      for (const [source, target] of [['first', 'billing-first'], ['last', 'billing-last']]) {
        if (!$('#' + target).value) $('#' + target).value = $('#' + source).value.trim();
      }
      refreshQuote();
    }
    if (id === 'recipient') loadInvitation();
    history.replaceState(null, '', '#' + id);
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  $('#review-control').hidden = Boolean(adapter);
  $('#review-screen').addEventListener('change', event => {
    const choice = event.target.value;
    reviewMode = choice !== 'flow';
    const url = new URL(location.href);
    if (reviewMode) url.searchParams.set('review', '1');
    else url.searchParams.delete('review');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    showStep(reviewMode ? choice : 'giver');
  });

  document.querySelectorAll('[data-next]').forEach(button =>
    button.addEventListener('click', () => showStep(button.dataset.next)));
  $('#continue-payment').addEventListener('click', () => {
    if (fieldsValid(['first', 'last', 'email', 'password'], $('#giver-error'))) {
      accountReady = true;
      showStep('payment');
    }
  });
  for (const id of ['first', 'last', 'email', 'password', 'recipient-first', 'recipient-last',
    'recipient-email', 'recipient-password', 'existing-email', 'existing-password']) {
    $('#' + id).addEventListener('input', event => {
      event.target.removeAttribute('aria-invalid');
      if (['first', 'last', 'email', 'password'].includes(id) && !completedGift) accountReady = false;
    });
  }

  for (const [code, name] of window.MMW_COUNTRIES || []) {
    if (code === 'US') continue;
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    country.append(option);
  }

  function details() {
    return {
      account: {
        firstName: $('#first').value.trim(),
        lastName: $('#last').value.trim(),
        email: $('#email').value.trim(),
        password: $('#password').value
      },
      billing: {
        firstName: $('#billing-first').value.trim(),
        lastName: $('#billing-last').value.trim(),
        country: country.value,
        postalCode: $('#postal').value.trim(),
        address1: $('#address1').value.trim(),
        city: $('#city').value.trim(),
        region: $('#region').value.trim()
      },
      additionalStudents: Number(studentInput.value),
      coupon: $('#coupon').value.trim()
    };
  }

  function renderStudentCount() {
    const additional = Math.max(0, Math.min(8, Math.trunc(Number(studentInput.value) || 0)));
    studentInput.value = additional;
    const total = additional + 1;
    $('#student-count').textContent = `Full program access for ${total} student${total === 1 ? '' : 's'}`;
    const breakdown = $('#price-breakdown');
    breakdown.hidden = additional === 0;
    breakdown.textContent = additional ?
      `$120 for the first student + ${additional} additional student${additional === 1 ? '' : 's'} at $29/year each` : '';
    $('#remove-student').disabled = additional === 0;
    $('#add-student').disabled = additional === 8;
  }

  function renderQuote() {
    if (!quote) return;
    const first = money(quote.firstChargeAmount, quote.currency);
    const renewal = money(quote.renewalAmount, quote.currency);
    const renewalShort = Number.isInteger(quote.renewalAmount) ?
      new Intl.NumberFormat(undefined, {style: 'currency', currency: quote.currency, maximumFractionDigits: 0}).format(quote.renewalAmount) : renewal;
    $('#annual-price').textContent = quote.firstChargeAmount === quote.renewalAmount ?
      `Then ${renewalShort}/year, automatically renewed unless canceled` :
      `First charge ${first}; renews at ${renewalShort}/year unless canceled`;
    $('#quote-details').hidden = !quote.detailsText;
    $('#quote-details').textContent = quote.detailsText || '';
    $('#first-charge-preview').textContent =
      `Your first charge of ${first} is scheduled for ${dateLabel(quote.firstChargeAt)}.`;
  }

  async function refreshQuote() {
    const sequence = ++quoteSequence;
    quote = null;
    submitButton.disabled = true;
    message($('#quote-status'), 'Calculating your gift total…');
    message($('#coupon-feedback'), '');
    try {
      const input = details();
      let next;
      if (adapter) {
        if (typeof adapter.quote !== 'function') throw new Error('The live pricing service is not available. Please try again later.');
        next = await adapter.quote({
          additionalStudents: input.additionalStudents,
          coupon: input.coupon,
          country: input.billing.country,
          postalCode: input.billing.postalCode
        });
      } else {
        if (input.coupon) throw new Error('Coupon codes cannot be verified in this preview. Remove the code to continue.');
        const firstChargeAt = plusSevenDays(new Date()).toISOString();
        const amount = 120 + input.additionalStudents * 29;
        next = {currency: 'USD', firstChargeAmount: amount, renewalAmount: amount,
          firstChargeAt, trialEndsAt: firstChargeAt, quoteId: 'preview'};
      }
      if (sequence !== quoteSequence) return;
      if (!Number.isFinite(Number(next.firstChargeAmount)) ||
          !Number.isFinite(Number(next.renewalAmount)) ||
          !Number.isFinite(new Date(next.firstChargeAt).getTime()) ||
          !Number.isFinite(new Date(next.trialEndsAt).getTime())) {
        throw new Error('The gift total could not be confirmed. Please try again.');
      }
      quote = next;
      renderQuote();
      message($('#quote-status'), adapter ? 'Gift total and billing date confirmed.' : 'Preview estimate. No charge is made here.');
      if (input.coupon) message($('#coupon-feedback'), next.couponMessage || 'Coupon applied to the total shown above.');
      submitButton.disabled = Boolean(completedGift);
    } catch (error) {
      if (sequence !== quoteSequence) return;
      const text = error?.message || 'The gift total could not be calculated. Please try again.';
      message($('#quote-status'), text, true);
      if (details().coupon) message($('#coupon-feedback'), text, true);
    }
  }

  function queueQuote() {
    clearTimeout(quoteTimer);
    quote = null;
    submitButton.disabled = true;
    message($('#quote-status'), 'Updating your gift total…');
    quoteTimer = setTimeout(refreshQuote, 350);
  }
  function changeStudents(delta) {
    studentInput.value = Math.max(0, Math.min(8, Number(studentInput.value) + delta));
    renderStudentCount();
    queueQuote();
  }
  $('#remove-student').addEventListener('click', () => changeStudents(-1));
  $('#add-student').addEventListener('click', () => changeStudents(1));
  $('#coupon').addEventListener('input', queueQuote);
  country.addEventListener('change', queueQuote);
  $('#postal').addEventListener('change', queueQuote);
  renderStudentCount();
  refreshQuote();

  function safeLink(url) {
    try {
      if (typeof url !== 'string' || !url) return null;
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || (!adapter && parsed.protocol === 'http:')) return parsed.href;
    } catch { /* A malformed link is handled as a recoverable integration error. */ }
    return null;
  }
  function setInvitationUrl(url) {
    const safeUrl = safeLink(url);
    if (!safeUrl) return false;
    $('#invite-link').href = safeUrl;
    $('#share-status').hidden = true;
    $('#share-fallback').hidden = true;
    $('#share-fallback').value = safeUrl;
    $('#copy-link').textContent = 'Copy Invitation Link';
    const body = `Hi,\n\nI got your family a year of music with My Music Workshop! The kids can explore piano, drums, ukulele, singing, and more, all from home.\n\nOpen this invitation to set up your own login and get started:\n\n${safeUrl}\n\nI hope you love it!`;
    $('#email-link').href =
      `mailto:?subject=${encodeURIComponent('A year of music for your family')}&body=${encodeURIComponent(body)}`;
    return true;
  }
  setInvitationUrl(defaultInviteUrl);
  function copyInvitationFallback(url) {
    const input = document.createElement('textarea');
    input.value = url;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.focus();
    input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* Try the modern clipboard API next. */ }
    input.remove();
    return copied;
  }
  $('#copy-link').addEventListener('click', async event => {
    const fallback = $('#share-fallback');
    if (!fallback.hidden) {
      fallback.focus();
      fallback.select();
      return;
    }
    try {
      const url = $('#invite-link').href;
      if (!copyInvitationFallback(url)) {
        if (!navigator.clipboard?.writeText) throw new Error('Copy failed');
        await navigator.clipboard.writeText(url);
      }
      event.currentTarget.textContent = 'Link Copied ✓';
      const status = $('#share-status');
      status.classList.remove('error');
      status.textContent = 'Invitation link copied. Paste it into a message to share.';
      status.hidden = false;
      setTimeout(() => { event.currentTarget.textContent = 'Copy Invitation Link'; }, 2500);
    } catch {
      const status = $('#share-status');
      status.classList.add('error');
      status.textContent = 'Automatic copying is blocked here. Select the link below and copy it, or use the email button.';
      status.hidden = false;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      event.currentTarget.textContent = 'Select Invitation Link';
    }
  });
  $('#share-fallback').addEventListener('click', event => event.currentTarget.select());

  function validateBilling() {
    if (fieldsValid(['billing-first', 'billing-last', 'postal'], paymentStatus)) return true;
    message(paymentStatus, 'Please complete the required billing details.', true);
    return false;
  }
  document.querySelectorAll('[data-method]').forEach(button => button.addEventListener('click', () => {
    method = button.dataset.method;
    paypalApproved = false;
    paypalToken = null;
    message(paypalStatus, 'PayPal has not been authorized yet.');
    message(paymentStatus, '');
    document.querySelectorAll('[data-method]').forEach(option => {
      option.classList.toggle('active', option === button);
      option.setAttribute('aria-pressed', String(option === button));
    });
    $('#card-panel').hidden = method !== 'card';
    $('#paypal-panel').hidden = method !== 'paypal';
  }));
  $('#paypal-demo').addEventListener('click', () => {
    if (!validateBilling()) return;
    paypalApproved = true;
    message(paypalStatus, 'PayPal approval simulated. You can continue the preview.');
    message(paymentStatus, '');
  });
  if (adapter) {
    for (const id of ['card-number', 'card-month', 'card-year', 'card-cvv', 'paypal-button']) {
      $('#' + id).replaceChildren();
    }
    Promise.resolve().then(() => adapter.mount({
      card: {number: '#card-number', month: '#card-month', year: '#card-year', cvv: '#card-cvv'},
      paypal: '#paypal-button', form: paymentForm, validateBilling,
      getGiftDetails: details,
      onPayPalApproved(token) {
        paypalToken = token;
        paypalApproved = true;
        message(paypalStatus, 'PayPal authorized. Complete your gift to continue.');
      },
      onError(error) { message(paymentStatus, error?.message || 'Payment authorization failed. Please try again.', true); }
    })).then(() => { paymentReady = true; })
      .catch(error => message(paymentStatus, error?.message || 'Secure payment fields could not load.', true));
  }

  paymentForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (completedGift) { showStep('share'); return; }
    if (paymentBusy || !validateBilling()) return;
    if (!paymentReady) { message(paymentStatus, 'Secure payment fields are still loading. Please try again.', true); return; }
    if (!quote) { message(paymentStatus, 'Please wait for your gift total to be confirmed.', true); return; }
    if (method === 'paypal' && !paypalApproved) {
      message(paymentStatus, 'Please authorize PayPal before continuing.', true);
      return;
    }
    paymentBusy = true;
    submitButton.disabled = true;
    message(paymentStatus, 'Completing your gift…');
    try {
      const result = adapter ?
        await adapter.complete({method, paypalToken, form: paymentForm, quoteId: quote.quoteId, ...details()}) :
        {success: true, invitationUrl: defaultInviteUrl};
      if (!result?.success) throw new Error(result?.message || 'Signup could not be completed. Please try again.');
      const confirmedQuote = adapter ?
        {currency: result.currency || quote.currency,
          firstChargeAmount: result.firstChargeAmount ?? quote.firstChargeAmount,
          renewalAmount: result.renewalAmount ?? quote.renewalAmount,
          firstChargeAt: result.firstChargeAt || quote.firstChargeAt,
          trialEndsAt: result.trialEndsAt || quote.trialEndsAt} : quote;
      completedGift = {quote: confirmedQuote};
      if (!result.invitationUrl || !setInvitationUrl(result.invitationUrl)) {
        $('.share-box').hidden = true;
        $('.share-followup').hidden = true;
        message($('#invitation-problem'), 'Your gift was created, but the invitation is not available yet. Please check your email or contact support.', true);
      }
      if (adapter) {
        $('#preview-account').hidden = true;
        const accountUrl = safeLink(result.accountUrl);
        if (accountUrl) { $('#giver-account-link').href = accountUrl; $('#giver-account-link').hidden = false; }
      }
      renderQuote();
      message(paymentStatus, '');
      showStep('share');
    } catch (error) {
      message(paymentStatus, error?.message || 'Signup could not be completed. Please try again.', true);
    } finally {
      paymentBusy = false;
      submitButton.disabled = !quote || Boolean(completedGift);
    }
  });

  function invitationState(status, note) {
    const card = $('#invitation-state');
    const entry = $('#recipient-entry');
    const states = {
      expired: ['This invitation has expired', 'Ask the gift purchaser for a new invitation link.'],
      claimed: ['This invitation was already accepted', 'If you accepted this gift, log in to your My Music Workshop account.'],
      invalid: ['This invitation link isn’t valid', 'Check that you opened the full link, or ask the gift purchaser to send it again.'],
      error: ['We couldn’t check this invitation', 'Please try again in a moment.']
    };
    entry.hidden = status !== 'available';
    card.hidden = status === 'available';
    if (status === 'available') return;
    const [heading, body] = states[status] || states.error;
    card.replaceChildren();
    const title = document.createElement('h2');
    const description = document.createElement('p');
    title.textContent = heading;
    description.textContent = note || body;
    card.append(title, description);
    card.classList.toggle('error', status !== 'claimed');
    if (status === 'error') {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'button secondary';
      retry.textContent = 'Try Again';
      retry.addEventListener('click', loadInvitation);
      card.append(retry);
    }
  }
  async function loadInvitation() {
    if (recipientAccepted) {
      $('#recipient-entry').hidden = true;
      $('#invitation-state').hidden = true;
      $('#claimed').hidden = false;
      return;
    }
    if (!adapter) {
      invitationState(['expired', 'claimed', 'invalid'].includes(previewScenario) ? previewScenario : 'available');
      return;
    }
    if (!invitationToken) { invitationState('invalid'); return; }
    const card = $('#invitation-state');
    $('#recipient-entry').hidden = true;
    card.hidden = false;
    card.textContent = 'Checking your invitation…';
    try {
      const result = await adapter.getInvitation({token: invitationToken});
      invitationState(result?.status || 'error', result?.message);
    } catch { invitationState('error'); }
  }
  $('#show-existing').addEventListener('click', () => {
    $('#new-recipient').hidden = true;
    $('#existing-recipient').hidden = false;
    message($('#recipient-error'), '');
  });
  $('#show-new').addEventListener('click', () => {
    $('#new-recipient').hidden = false;
    $('#existing-recipient').hidden = true;
    message($('#recipient-error'), '');
  });
  async function acceptInvitation(mode) {
    if (recipientBusy) return;
    const ids = mode === 'new' ?
      ['recipient-first', 'recipient-last', 'recipient-email', 'recipient-password'] :
      ['existing-email', 'existing-password'];
    if (!fieldsValid(ids, $('#recipient-error'))) return;
    recipientBusy = true;
    const button = mode === 'new' ? $('#claim') : $('#claim-existing');
    button.disabled = true;
    message($('#recipient-error'), 'Accepting your gift…');
    try {
      const account = mode === 'new' ? {
        firstName: $('#recipient-first').value.trim(),
        lastName: $('#recipient-last').value.trim(),
        email: $('#recipient-email').value.trim(),
        password: $('#recipient-password').value
      } : {
        email: $('#existing-email').value.trim(),
        password: $('#existing-password').value
      };
      const result = adapter ?
        await adapter.acceptInvitation({token: invitationToken, mode, account}) :
        {success: true};
      if (!result?.success) {
        if (['claimed', 'expired', 'invalid'].includes(result?.status)) {
          invitationState(result.status, result.message);
          return;
        }
        throw new Error(result?.message || 'We couldn’t accept the invitation. Please try again.');
      }
      message($('#recipient-error'), '');
      recipientAccepted = true;
      $('#recipient-entry').hidden = true;
      $('#invitation-state').hidden = true;
      $('#claimed').hidden = false;
      if (adapter) {
        $('#preview-back-to-giver').hidden = true;
        const accountUrl = safeLink(result.accountUrl);
        if (accountUrl) { $('#recipient-account-link').href = accountUrl; $('#recipient-account-link').hidden = false; }
      }
    } catch (error) {
      message($('#recipient-error'), error?.message || 'We couldn’t accept the invitation. Please try again.', true);
    } finally {
      recipientBusy = false;
      button.disabled = false;
    }
  }
  $('#claim').addEventListener('click', () => acceptInvitation('new'));
  $('#claim-existing').addEventListener('click', () => acceptInvitation('existing'));

  if (['giver', 'payment', 'share', 'recipient'].includes(location.hash.slice(1))) {
    showStep(location.hash.slice(1));
  }
  window.addEventListener('hashchange', () => {
    const requested = location.hash.slice(1);
    if (['giver', 'payment', 'share', 'recipient'].includes(requested)) showStep(requested);
  });
})();
