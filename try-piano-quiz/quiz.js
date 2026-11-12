/* Quiz pop-up (try-piano-quiz only).
 * Shows a small invitation after 30 seconds, or after 40% scroll once 20 seconds have passed,
 * unless the visitor already opened signup or saw it in the last 7 days.
 * Three questions lead to a short plan whose buttons use the page's own price card and signup window.
 * Opening the quiz starts loading the signup windows in the background, so a plan opens without waiting.
 * Add ?quiz=now to the address to see it after 2 seconds (for checking only).
 */
(function () {
  'use strict';

  var SEEN_KEY = 'mmw_quiz_seen';
  var WEEK = 7 * 24 * 60 * 60 * 1000;
  var preview = /[?&]quiz=now\b/.test(window.location.search);
  var startedAt = Date.now();
  var signupOpened = false;
  var shown = false;
  var answers = {};

  var QUESTIONS = [
    {
      key: 'age',
      text: 'How old is your child?',
      grid: true,
      options: [['4-5', '4–5'], ['6-7', '6–7'], ['8-9', '8–9'], ['10-12', '10–12']]
    },
    {
      key: 'experience',
      text: 'Have they ever played piano before?',
      options: [['not_yet', 'Not yet'], ['a_little', 'A little'], ['lessons_now', 'Yes, they take lessons now']]
    },
    {
      key: 'hope',
      text: 'What would you love piano to give them?',
      options: [
        ['confidence', 'Confidence'],
        ['musical_gift', 'A chance to grow their musical gift'],
        ['chance_i_never_had', 'The chance I never had'],
        ['start_young', 'A great start while they’re young']
      ]
    }
  ];

  var FIRST_STEP = {
    not_yet: 'Day 1: their first three notes, C, D and E, then a Jam Along with the band.',
    a_little: 'They start at Lesson 1 and move at their own pace.',
    lessons_now: 'A fun way to practice between lessons: they play along with the band and earn Rock Stars.'
  };

  var HOPE_LINE = {
    confidence: 'Every lesson ends with a win they can see: a new skill, a quiz they nailed, a Rock Star earned.',
    musical_gift: 'If they’re always humming, tapping or singing, they have a musical gift. This gives it the chance to grow.',
    chance_i_never_had: 'So many parents wish they’d learned as kids. This is your child’s chance, starting from their very first notes.',
    start_young: '4 to 12 is a wonderful age to begin, and Lesson 1 starts from the very first note.'
  };

  function track(event, props) {
    var ph = window.posthog;
    if (!ph || typeof ph.capture !== 'function') return;
    props = props || {};
    props.lp_page = window.location.pathname;
    try { ph.capture(event, props); } catch (err) {}
  }

  function seenRecently() {
    if (preview) return false;
    try {
      var seen = Number(window.localStorage.getItem(SEEN_KEY));
      return seen && Date.now() - seen < WEEK;
    } catch (err) {
      return false;
    }
  }

  function markSeen() {
    if (preview) return;
    try { window.localStorage.setItem(SEEN_KEY, String(Date.now())); } catch (err) {}
  }

  // Loads a plan's signup window in the background (the page's own loader), so it opens without waiting.
  function warmSignup(plan) {
    try {
      if (typeof loadCheckoutPlan === 'function') loadCheckoutPlan(plan);
    } catch (err) {}
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  var panel = el('div', 'mmw-quiz');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Quick piano quiz');
  var closeButton = el('button', 'mmw-quiz__close', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close');
  var body = el('div');
  panel.appendChild(closeButton);
  panel.appendChild(body);
  var currentStep = 'invite';

  function render(nodes) {
    body.replaceChildren.apply(body, nodes);
  }

  function showInvite() {
    currentStep = 'invite';
    var start = el('button', 'mmw-quiz__primary', 'Take the 30-second quiz');
    start.type = 'button';
    start.addEventListener('click', function () {
      track('quiz_opened');
      warmSignup('yearly');
      showQuestion(0);
    });
    render([
      el('p', 'mmw-quiz__title', 'Not sure piano’s right for your child yet?'),
      el('p', 'mmw-quiz__text', 'Answer 3 quick questions and get a starting plan.'),
      start
    ]);
  }

  function showQuestion(index) {
    var question = QUESTIONS[index];
    currentStep = 'question_' + (index + 1);
    if (index === 1) warmSignup('monthly');
    var bar = el('div', 'mmw-quiz__bar');
    var fill = el('span');
    fill.style.width = Math.round(((index + 1) / QUESTIONS.length) * 100) + '%';
    bar.appendChild(fill);
    var list = el('div', 'mmw-quiz__answers' + (question.grid ? ' mmw-quiz__answers--grid' : ''));
    question.options.forEach(function (option) {
      var button = el('button', 'mmw-quiz__answer', option[1]);
      button.type = 'button';
      button.addEventListener('click', function () {
        answers[question.key] = option[0];
        answers[question.key + '_label'] = option[1];
        track('quiz_answered', { question: index + 1, question_key: question.key, answer: option[0] });
        if (index + 1 < QUESTIONS.length) showQuestion(index + 1);
        else showPlan();
      });
      list.appendChild(button);
    });
    var nodes = [el('p', 'mmw-quiz__step', (index + 1) + ' of ' + QUESTIONS.length), bar, el('p', 'mmw-quiz__title', question.text), list];
    if (index > 0) {
      var back = el('button', 'mmw-quiz__link', '← Back');
      back.type = 'button';
      back.addEventListener('click', function () { showQuestion(index - 1); });
      nodes.push(back);
    }
    render(nodes);
    panel.scrollTop = 0;
  }

  function showPlan() {
    currentStep = 'plan';
    track('quiz_completed', { age: answers.age, experience: answers.experience, hope: answers.hope });
    try {
      window.posthog.register({ quiz_completed: true, quiz_age: answers.age, quiz_experience: answers.experience, quiz_hope: answers.hope });
    } catch (err) {}

    var plan = el('ul', 'mmw-quiz__plan');
    plan.appendChild(el('li', '', FIRST_STEP[answers.experience]));
    plan.appendChild(el('li', '', HOPE_LINE[answers.hope]));

    var trust = el('div', 'mmw-quiz__trust');
    var photo = el('img');
    photo.src = 'assets/quiz-elias.webp';
    photo.alt = 'Mr. Elias';
    photo.width = 48;
    photo.height = 48;
    trust.appendChild(photo);
    trust.appendChild(el('p', '', 'Video lessons by Mr. Elias, who has been teaching kids music since 2009.'));

    var checks = el('ul', 'mmw-quiz__checks');
    ['$0 today', 'Cancel anytime in the first 7 days', 'Any keyboard works to start'].forEach(function (text) {
      checks.appendChild(el('li', '', text));
    });

    var plans = el('div', 'mmw-quiz__plans');
    [
      { plan: 'yearly', name: 'Yearly', badge: 'Best value', price: '$10', note: 'Billed $120/year. Save $72 a year.' },
      { plan: 'monthly', name: 'Monthly', price: '$16', note: 'Month to month.' }
    ].forEach(function (option) {
      var card = el('div', 'mmw-quiz__card' + (option.badge ? ' mmw-quiz__card--best' : ''));
      if (option.badge) card.appendChild(el('span', 'mmw-quiz__badge', option.badge));
      card.appendChild(el('p', 'mmw-quiz__card-name', option.name));
      var price = el('p', 'mmw-quiz__card-price', option.price);
      price.appendChild(el('span', '', '/month'));
      card.appendChild(price);
      card.appendChild(el('p', 'mmw-quiz__card-note', option.note));
      var button = el('button', 'mmw-quiz__primary', 'Start my free week');
      button.type = 'button';
      button.addEventListener('click', function () { startSignup(option.plan); });
      card.appendChild(button);
      plans.appendChild(card);
    });

    var retake = el('button', 'mmw-quiz__link mmw-quiz__retake', 'Retake the quiz');
    retake.type = 'button';
    retake.addEventListener('click', function () {
      track('quiz_retaken');
      answers = {};
      showQuestion(0);
    });

    render([
      el('p', 'mmw-quiz__title', 'Here’s how your ' + answers.age_label + ' year old would start'),
      plan,
      trust,
      checks,
      el('p', 'mmw-quiz__invite', 'See how they like it. Their first week is free. Pick a plan for after the free week:'),
      plans,
      retake
    ]);
    panel.scrollTop = 0;
  }

  function startSignup(plan) {
    track('quiz_plan_clicked', { plan: plan, age: answers.age, experience: answers.experience, hope: answers.hope });
    hide();
    var toggle = document.querySelector('.plan-toggle [data-plan="' + plan + '"]');
    if (toggle && !toggle.classList.contains('active')) toggle.click();
    var cta = document.querySelector('.price-cta');
    if (cta) cta.click();
  }

  function hide() {
    panel.classList.remove('is-open');
    document.removeEventListener('keydown', onKey);
  }

  function onKey(event) {
    if (event.key === 'Escape') close();
  }

  function close() {
    track('quiz_closed', { step: currentStep });
    hide();
  }

  closeButton.addEventListener('click', close);

  function anyDialogOpen() {
    return !!document.querySelector('dialog[open]');
  }

  function show() {
    if (shown || signupOpened || seenRecently()) return;
    if (anyDialogOpen()) return;
    shown = true;
    markSeen();
    showInvite();
    document.body.appendChild(panel);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { panel.classList.add('is-open'); });
    });
    document.addEventListener('keydown', onKey);
    track('quiz_invite_shown', { seconds_on_page: Math.round((Date.now() - startedAt) / 1000) });
  }

  var priceCta = document.querySelector('.price-cta');
  if (priceCta) priceCta.addEventListener('click', function () { signupOpened = true; });

  function scrolledShare() {
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - window.innerHeight;
    return scrollable > 0 ? window.scrollY / scrollable : 0;
  }

  function check() {
    if (shown || signupOpened) return;
    var seconds = (Date.now() - startedAt) / 1000;
    if (preview ? seconds >= 2 : seconds >= 30 || (seconds >= 20 && scrolledShare() >= 0.4)) show();
  }

  if (!seenRecently()) {
    var timer = window.setInterval(function () {
      check();
      if (shown || signupOpened) window.clearInterval(timer);
    }, 1000);
    window.addEventListener('scroll', check, { passive: true });
  }
})();
