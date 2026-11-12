/* Quiz pop-up (try-piano-quiz only).
 * Shows a small invitation after 30 seconds, or after 40% scroll once 20 seconds have passed,
 * unless the visitor already opened signup or saw it in the last 7 days.
 * Three questions lead to a personal starting plan (first week, an age tip from Mr. Elias, a 15-second lesson clip matched to experience),
 * then a plans screen whose buttons use the page's own price card and signup window.
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
    not_yet: 'Their first three notes, C, D and E, then a Jam Along with the band.',
    a_little: 'They start at Lesson 1 and move at their own pace.',
    lessons_now: 'A fun way to practice between lessons: they play along with the band and earn Rock Stars.'
  };

  var EXPERIENCE_LABEL = {
    not_yet: 'Brand new to piano',
    a_little: 'Played a little',
    lessons_now: 'Takes lessons now'
  };

  var CLIP = {
    not_yet: { label: 'Peek at Lesson 1', src: 'assets/lesson-1-cde-clip.mp4', poster: 'assets/lesson-1-cde-poster.webp', name: 'Lesson 1' },
    a_little: { label: 'Peek at a Jam Along', src: 'assets/quiz-jam-along-clip.mp4', poster: 'assets/quiz-jam-along-poster.webp', name: 'a Jam Along' },
    lessons_now: { label: 'Peek at what’s ahead: chords with both hands', src: 'assets/quiz-chords-clip.mp4', poster: 'assets/quiz-chords-poster.webp', name: 'a later chord lesson' }
  };

  var AGE_TIP = {
    '4-5': 'Sit with them for the first few lessons and play along. At this age, 10 minutes and lots of high-fives beats a long session.',
    '6-7': 'Pick a regular time, like right after school. Let them show you every new Rock Star. Your excitement is their best motivator.',
    '8-9': 'Let them lead. Kids this age love seeing their progress, so look at it together each week.',
    '10-12': 'Give them ownership: let them choose when to play and which Jam Along to perform for the family.'
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

    var label = el('p', 'mmw-quiz__label', 'Piano starter plan · Age ' + answers.age_label + ' · ' + EXPERIENCE_LABEL[answers.experience]);

    var week = el('ol', 'mmw-quiz__week');
    [
      ['Day 1', FIRST_STEP[answers.experience]],
      ['Day 3', 'Playing along with music, building new skills and earning Rock Stars.'],
      ['Day 7', 'Their first song, and progress they’re proud to show you.']
    ].forEach(function (day) {
      var item = el('li');
      item.appendChild(el('strong', '', day[0]));
      item.appendChild(el('span', '', day[1]));
      week.appendChild(item);
    });

    var hope = el('div', 'mmw-quiz__hope');
    hope.appendChild(el('p', 'mmw-quiz__small', 'You said: ' + answers.hope_label));
    hope.appendChild(el('p', '', HOPE_LINE[answers.hope]));

    var tip = el('div', 'mmw-quiz__trust mmw-quiz__tip');
    tip.appendChild(eliasPhoto());
    var tipText = el('div');
    tipText.appendChild(el('p', 'mmw-quiz__small', 'Mr. Elias’s tip for ' + answers.age_label + ' year olds'));
    tipText.appendChild(el('p', '', AGE_TIP[answers.age]));
    tip.appendChild(tipText);

    var clip = CLIP[answers.experience];
    var peek = el('button', 'mmw-quiz__peek');
    peek.type = 'button';
    peek.setAttribute('aria-label', 'Play a 15-second clip from ' + clip.name);
    var poster = el('img');
    poster.src = clip.poster;
    poster.alt = '';
    peek.appendChild(poster);
    peek.appendChild(el('span', 'mmw-quiz__peek-play', '▶'));
    peek.appendChild(el('span', 'mmw-quiz__peek-label', clip.label));
    peek.addEventListener('click', function () {
      track('quiz_video_played', { clip: clip.src.split('/').pop() });
      var video = el('video', 'mmw-quiz__video');
      video.src = clip.src;
      video.poster = clip.poster;
      video.controls = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      peek.replaceWith(video);
      if (planScreen && planScreen.indexOf(peek) > -1) planScreen[planScreen.indexOf(peek)] = video;
      video.play().catch(function () {});
    });

    var next = el('button', 'mmw-quiz__primary', 'See how to start their free week →');
    next.type = 'button';
    next.addEventListener('click', function () {
      track('quiz_plans_viewed', { age: answers.age, experience: answers.experience, hope: answers.hope });
      showPlans();
    });

    planScreen = [
      el('p', 'mmw-quiz__title', 'Your ' + answers.age_label + ' year old’s starting plan'),
      label,
      el('p', 'mmw-quiz__section', 'Their first week'),
      week,
      hope,
      tip,
      peek,
      next,
      retakeLink()
    ];
    render(planScreen);
    panel.scrollTop = 0;
  }

  function showPlans() {
    currentStep = 'plans';
    var trust = el('div', 'mmw-quiz__trust');
    trust.appendChild(eliasPhoto());
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

    var back = el('button', 'mmw-quiz__link', '← Back to their plan');
    back.type = 'button';
    back.addEventListener('click', function () {
      currentStep = 'plan';
      showPlanAgain();
    });

    render([
      el('p', 'mmw-quiz__title', 'Start their free week'),
      trust,
      checks,
      el('p', 'mmw-quiz__invite', 'See how they like it. Their first week is free. Pick a plan for after the free week:'),
      plans,
      back
    ]);
    panel.scrollTop = 0;
  }

  var planScreen = null;

  function showPlanAgain() {
    if (planScreen) render(planScreen);
    panel.scrollTop = 0;
  }

  function eliasPhoto() {
    var photo = el('img');
    photo.src = 'assets/quiz-elias.webp?v=2';
    photo.alt = 'Mr. Elias';
    photo.width = 56;
    photo.height = 56;
    return photo;
  }

  function retakeLink() {
    var retake = el('button', 'mmw-quiz__link mmw-quiz__retake', 'Retake the quiz');
    retake.type = 'button';
    retake.addEventListener('click', function () {
      track('quiz_retaken');
      answers = {};
      planScreen = null;
      showQuestion(0);
    });
    return retake;
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
