/* My Music Workshop landing page tracking (PostHog).
 * The same file goes in every page folder; the master copy is shared/lp-tracking.js.
 * Load it in index.html after script.js:  <script src="lp-tracking.js?v=1"></script>
 *
 * Events (all carry lp_page, the page path):
 *   lp_nav_click     menu or logo link tapped          link_text, target
 *   lp_plan_toggle   Monthly/Yearly switch tapped      plan, previous_plan
 *   lp_cta_click     a Start Free button tapped        cta, plan_selected
 *   lp_faq_open      a question opened                 question, faq_type
 *   lp_video_open    a lesson video opened             video
 *   lp_link_click    any other link tapped             link_text, target
 *   lp_section_view  a section stayed on screen 1s     section, section_number
 *   lp_scroll_depth  25/50/75/100% of the page reached depth
 *   lp_page_exit     visitor left or switched away     max_scroll, seconds_on_page,
 *                                                      sections_seen, last_section
 */
(function () {
  'use strict';

  var PAGE = window.location.pathname;
  var startedAt = Date.now();
  var maxScroll = 0;
  var sectionsSeen = [];
  var lastSection = null;
  var exitSent = false;

  function send(event, props, beacon) {
    var ph = window.posthog;
    if (!ph || typeof ph.capture !== 'function') return;
    props = props || {};
    props.lp_page = PAGE;
    try {
      if (beacon) ph.capture(event, props, { send_instantly: true, transport: 'sendBeacon' });
      else ph.capture(event, props);
    } catch (err) {}
  }

  function text(el) {
    return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').replace(/[→⌄+−]/g, '').trim().slice(0, 80);
  }

  function selectedPlan() {
    var active = document.querySelector('.plan-toggle [data-plan].active');
    return active ? active.dataset.plan : null;
  }

  function sectionName(section) {
    if (section.id) return section.id;
    var classes = (section.className || '').split(/\s+/).filter(function (c) { return c && c !== 'section'; });
    return classes[0] || 'section';
  }

  function ctaName(el) {
    if (el.classList.contains('header-start-free')) return 'header';
    if (el.classList.contains('hero-start-free')) return 'hero';
    if (el.classList.contains('price-cta')) return 'price_card';
    if (el.classList.contains('monthly-yearly-link')) return 'switch_to_yearly_link';
    if (el.closest('.closing-cta')) return 'closing';
    var section = el.closest('section');
    return section ? sectionName(section) : 'other';
  }

  // Clicks and taps
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || !target.closest) return;

    var planButton = target.closest('.plan-toggle [data-plan]');
    if (planButton) {
      // Runs before script.js updates the toggle, so the active button is still the previous plan.
      var previous = selectedPlan();
      if (previous !== planButton.dataset.plan) {
        send('lp_plan_toggle', { plan: planButton.dataset.plan, previous_plan: previous });
      }
      return;
    }

    var summary = target.closest('details > summary');
    if (summary) {
      if (!summary.parentElement.open) send('lp_faq_open', { question: text(summary.querySelector('h3') || summary), faq_type: 'top_questions' });
      return;
    }

    var accordionButton = target.closest('.accordion button');
    if (accordionButton) {
      var article = accordionButton.closest('article');
      if (article && !article.classList.contains('open')) send('lp_faq_open', { question: text(accordionButton), faq_type: 'faq' });
      return;
    }

    var lesson = target.closest('.lesson-card');
    if (lesson) {
      send('lp_video_open', { video: lesson.dataset.video || lesson.dataset.demo || text(lesson) });
      return;
    }

    var link = target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href') || '';

    if (link.matches('.price-cta, .hero-start-free, .header-start-free, .monthly-yearly-link') || href === '#pricing-toggle' || href === '#plans') {
      send('lp_cta_click', { cta: ctaName(link), link_text: text(link), plan_selected: selectedPlan() });
      return;
    }

    if (link.closest('.site-header, .mobile-nav, .desktop-nav')) {
      send('lp_nav_click', {
        link_text: link.classList.contains('brand') ? 'logo' : text(link),
        target: href,
        menu: link.closest('.mobile-nav') ? 'mobile' : 'desktop'
      }, href.charAt(0) !== '#');
      return;
    }

    send('lp_link_click', { link_text: text(link), target: href }, href.charAt(0) !== '#');
  }, true);

  // Sections seen: counted once a section stays on screen for 1 second, so
  // sections passed on the way to a menu link don't count.
  if ('IntersectionObserver' in window) {
    var sections = Array.prototype.slice.call(document.querySelectorAll('main section'));
    var timers = [];
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var i = sections.indexOf(entry.target);
        clearTimeout(timers[i]);
        if (!entry.isIntersecting) return;
        timers[i] = setTimeout(function () {
          var name = sectionName(entry.target);
          lastSection = name;
          if (sectionsSeen.indexOf(name) !== -1) return;
          sectionsSeen.push(name);
          send('lp_section_view', { section: name, section_number: i + 1 });
        }, 1000);
      });
    }, { threshold: 0.35 });
    sections.forEach(function (s) { observer.observe(s); });
  }

  // Scroll depth, sent as each mark is reached
  var marks = [25, 50, 75, 100];
  function onScroll() {
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    var pct = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
    if (pct <= maxScroll) return;
    maxScroll = pct;
    while (marks.length && pct >= (marks[0] === 100 ? 98 : marks[0])) {
      send('lp_scroll_depth', { depth: marks.shift() });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // Summary when the visitor leaves or switches away (sent once)
  function onExit() {
    if (exitSent) return;
    exitSent = true;
    send('lp_page_exit', {
      max_scroll: maxScroll,
      seconds_on_page: Math.round((Date.now() - startedAt) / 1000),
      sections_seen: sectionsSeen.length,
      last_section: lastSection,
      plan_selected: selectedPlan()
    }, true);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') onExit();
  });
  window.addEventListener('pagehide', onExit);
})();
