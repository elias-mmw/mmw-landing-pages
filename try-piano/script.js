const heroMedia=document.querySelector('.hero-media');const clearHeroPreview=()=>heroMedia?.classList.add('is-loaded');const finishHero=()=>{if(!heroMedia)return;if(typeof heroMedia.decode==='function')heroMedia.decode().then(clearHeroPreview,clearHeroPreview);else clearHeroPreview()};if(heroMedia?.complete&&heroMedia.naturalWidth)finishHero();else heroMedia?.addEventListener('load',finishHero,{once:true});

const menuButton=document.querySelector('.menu-button');const mobileNav=document.querySelector('.mobile-nav');const closeMobileMenu=()=>{mobileNav?.classList.remove('open');menuButton?.setAttribute('aria-expanded','false')};menuButton?.addEventListener('click',()=>{const open=mobileNav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open))});mobileNav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMobileMenu));document.addEventListener('click',event=>{if(!mobileNav?.classList.contains('open'))return;if(menuButton?.contains(event.target)||mobileNav.contains(event.target))return;closeMobileMenu()});document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMobileMenu()});

const headerStartFree=document.querySelector('.header-start-free');const heroStartFree=document.querySelector('.hero-start-free');
if(headerStartFree&&heroStartFree&&'IntersectionObserver'in window){
  const phoneHeader=window.matchMedia('(max-width: 767px)');
  const syncHeaderStartFree=()=>{
    if(!phoneHeader.matches){headerStartFree.classList.remove('is-visible');return}
    const heroButton=heroStartFree.getBoundingClientRect();
    const visible=heroButton.bottom>56&&heroButton.top<window.innerHeight;
    headerStartFree.classList.toggle('is-visible',!visible);
  };
  const heroButtonObserver=new IntersectionObserver(syncHeaderStartFree,{rootMargin:'-56px 0px 0px 0px',threshold:0});
  heroButtonObserver.observe(heroStartFree);
  window.addEventListener('scroll',syncHeaderStartFree,{passive:true});
  window.addEventListener('resize',syncHeaderStartFree);
  phoneHeader.addEventListener('change',syncHeaderStartFree);
  syncHeaderStartFree();
}

document.querySelector('.site-header .brand')?.addEventListener('click',event=>{event.preventDefault();closeMobileMenu();window.scrollTo({top:0,left:0,behavior:'smooth'});if(location.hash)history.replaceState(null,'',location.pathname+location.search)});

const plans={yearly:{name:'Yearly membership',price:'10',copy:'Billed $120/year · less\u00a0than\u00a033¢\u00a0a\u00a0day',items:['Piano, drums, singing & ukulele, all included','Short lessons, built-in practice & rewards kids love','Parent progress dashboard','Cancel before day 7 and pay nothing'],button:'Start My Free Week'},monthly:{name:'Monthly membership',price:'16',copy:'Billed monthly after your free week',items:['Piano, drums, singing & ukulele, all included','Short lessons, built-in practice & rewards kids love','Parent progress dashboard','Cancel before day 7 and pay nothing'],button:'Start My Free Week'}};document.querySelectorAll('[data-plan]').forEach(button=>button.addEventListener('click',()=>{const previousPlan=document.querySelector('.plan-toggle [data-plan].active')?.dataset.plan;document.querySelectorAll('[data-plan]').forEach(b=>{const selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected))});const plan=plans[button.dataset.plan];document.querySelector('.price-card').classList.toggle('is-yearly',button.dataset.plan==='yearly');document.querySelector('.price-card').classList.toggle('is-monthly',button.dataset.plan==='monthly');document.querySelector('#plan-name').textContent=plan.name;document.querySelector('#price-number').textContent=plan.price;document.querySelector('#billing-copy').textContent=plan.copy;document.querySelectorAll('.price-card [data-yearly-only]').forEach(el=>{el.hidden=button.dataset.plan!=='yearly'});document.querySelectorAll('.price-card [data-monthly-only]').forEach(el=>{el.hidden=button.dataset.plan!=='monthly'});document.querySelector('.price-card > .check-list').replaceChildren(...plan.items.map(item=>{const li=document.createElement('li');li.textContent=item;return li}));document.querySelector('.price-cta').firstChild.textContent=plan.button+' ';if(previousPlan!==button.dataset.plan){if(typeof fbq === 'function')fbq('trackCustom','SelectPlan',{plan:button.dataset.plan,value:button.dataset.plan==='yearly'?120:16,currency:'USD'})}}));

let pricingViewed=false;
if('IntersectionObserver'in window){
  const pricingViewObserver=new IntersectionObserver(entries=>{
    if(!pricingViewed&&entries.some(entry=>entry.intersectionRatio>=.4)){
      pricingViewed=true;
      const currentPlan=document.querySelector('.plan-toggle [data-plan].active')?.dataset.plan||'yearly';
      if(typeof fbq === 'function')fbq('trackCustom','ViewPricing',{plan_shown:currentPlan});
      pricingViewObserver.disconnect();
    }
  },{threshold:.4});
  const pricingSection=document.querySelector('#plans');
  if(pricingSection)pricingViewObserver.observe(pricingSection);
}

document.querySelector('.monthly-yearly-link')?.addEventListener('click',event=>{event.preventDefault();document.querySelector('[data-plan="yearly"]')?.click();document.querySelector('.price-card')?.scrollIntoView({block:'center',behavior:'smooth'})});

const checkoutModal=document.querySelector('.checkout-modal');
const checkoutFrames={yearly:checkoutModal?.querySelector('[data-checkout-plan="yearly"]'),monthly:checkoutModal?.querySelector('[data-checkout-plan="monthly"]')};
const checkoutUrls={yearly:'https://app.mymusicworkshop.com/signup?plan=yearly-membership&iframe=true',monthly:'https://app.mymusicworkshop.com/signup?plan=monthly-membership&iframe=true'};
const checkoutLoading=checkoutModal?.querySelector('.checkout-loading');
const checkoutSlow=checkoutModal?.querySelector('.checkout-slow');
const checkoutSlowLink=checkoutSlow?.querySelector('a');
const checkoutLoaded={yearly:false,monthly:false};
let checkoutSlowTimer;
const selectedCheckoutPlan=()=>document.querySelector('.plan-toggle [data-plan].active')?.dataset.plan||'yearly';
const showCheckoutPlan=plan=>{
  if(!checkoutModal?.open)return;
  Object.entries(checkoutFrames).forEach(([name,frame])=>{if(frame)frame.hidden=name!==plan||!checkoutLoaded[name]});
  if(checkoutLoading)checkoutLoading.hidden=checkoutLoaded[plan];
  if(checkoutSlow)checkoutSlow.hidden=true;
  if(checkoutSlowLink)checkoutSlowLink.href=checkoutUrls[plan];
  clearTimeout(checkoutSlowTimer);
  if(!checkoutLoaded[plan])checkoutSlowTimer=setTimeout(()=>{
    if(checkoutModal.open&&!checkoutLoaded[plan]&&selectedCheckoutPlan()===plan&&checkoutSlow)checkoutSlow.hidden=false;
  },12000);
};
const loadCheckoutPlan=plan=>{
  const frame=checkoutFrames[plan];
  if(!frame||frame.hasAttribute('src'))return;
  frame.addEventListener('load',()=>{
    checkoutLoaded[plan]=true;
    if(checkoutModal?.open&&selectedCheckoutPlan()===plan)showCheckoutPlan(plan);
  },{once:true});
  frame.setAttribute('src',checkoutUrls[plan]);
};
if('IntersectionObserver'in window){
  const pricingObserver=new IntersectionObserver(entries=>{
    if(entries.some(entry=>entry.isIntersecting)){
      loadCheckoutPlan(selectedCheckoutPlan());
      pricingObserver.disconnect();
    }
  },{rootMargin:'800px 0px'});
  const pricingSection=document.querySelector('#plans');
  if(pricingSection)pricingObserver.observe(pricingSection);
}
document.querySelectorAll('a[href="#pricing-toggle"]').forEach(link=>link.addEventListener('click',()=>loadCheckoutPlan(selectedCheckoutPlan())));
const priceCta=document.querySelector('.price-cta');
['pointerenter','focus','touchstart'].forEach(type=>priceCta?.addEventListener(type,()=>loadCheckoutPlan(selectedCheckoutPlan()),{passive:true}));
document.querySelectorAll('[data-plan]').forEach(button=>button.addEventListener('click',()=>loadCheckoutPlan(button.dataset.plan)));
const closeCheckout=()=>checkoutModal?.close();
const initiatedCheckoutPlans=new Set();
priceCta?.addEventListener('click',event=>{
  event.preventDefault();
  if(!checkoutModal)return;
  const plan=selectedCheckoutPlan();
  loadCheckoutPlan(plan);
  checkoutModal.showModal();
  document.body.classList.add('checkout-open');
  showCheckoutPlan(plan);
  if(!initiatedCheckoutPlans.has(plan)){
    initiatedCheckoutPlans.add(plan);
    if(typeof fbq === 'function')fbq('track','InitiateCheckout',{content_name:plan==='yearly'?'Yearly membership':'Monthly membership',value:plan==='yearly'?120:16,currency:'USD',num_items:1});
  }
});
document.querySelector('.checkout-modal-close')?.addEventListener('click',closeCheckout);
checkoutModal?.addEventListener('cancel',event=>event.preventDefault());
checkoutModal?.addEventListener('close',()=>{clearTimeout(checkoutSlowTimer);document.body.classList.remove('checkout-open')});

document.querySelectorAll('.accordion button').forEach(button=>button.addEventListener('click',()=>{const article=button.closest('article');const opening=!article.classList.contains('open');document.querySelectorAll('.accordion article').forEach(item=>{item.classList.remove('open');item.querySelector('button').setAttribute('aria-expanded','false');item.querySelector('button span').textContent='+'});if(opening){article.classList.add('open');button.setAttribute('aria-expanded','true');button.querySelector('span').textContent='−'}}));

document.querySelectorAll('.instrument').forEach(button=>button.addEventListener('click',()=>{const next=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(next))}));

const founderBioModal=document.querySelector('.founder-bio-modal');const founderBioOpen=document.querySelector('.founder-bio-open');const founderBioImages=[...founderBioModal?.querySelectorAll('img')||[]];let founderBioReady;const preloadFounderBio=()=>founderBioReady||(founderBioReady=Promise.all(founderBioImages.map(image=>image.complete&&image.naturalWidth?Promise.resolve():new Promise(resolve=>{const preload=new Image;preload.onload=preload.onerror=resolve;preload.src=image.currentSrc||image.src}))));['pointerenter','focus','touchstart'].forEach(type=>founderBioOpen?.addEventListener(type,preloadFounderBio,{once:true,passive:true}));founderBioOpen?.addEventListener('click',async()=>{await preloadFounderBio();founderBioModal?.showModal()});document.querySelector('.founder-bio-close')?.addEventListener('click',()=>founderBioModal?.close());founderBioModal?.addEventListener('click',event=>{if(event.target===founderBioModal)founderBioModal.close()});

const modal=document.querySelector('.demo-modal');const demoVideo=modal?.querySelector('.demo-video');const demoPlaceholder=modal?.querySelector('.demo-placeholder');document.querySelectorAll('.lesson-card').forEach(card=>card.addEventListener('click',()=>{const video=card.dataset.video;if(video){demoPlaceholder.hidden=true;demoVideo.hidden=false;if(demoVideo.src!==new URL(video,location.href).href){demoVideo.src=video;demoVideo.load()}modal.showModal();demoVideo.play().catch(()=>{})}else{demoVideo.hidden=true;demoPlaceholder.hidden=false;modal.querySelector('h3').textContent=card.dataset.demo;modal.showModal()}}));const closeDemo=()=>{demoVideo?.pause();modal?.close()};document.querySelector('.modal-close')?.addEventListener('click',closeDemo);modal?.addEventListener('click',event=>{if(event.target===modal)closeDemo()});

const rewardLightbox=document.querySelector('.reward-lightbox');const rewardLightboxImage=rewardLightbox?.querySelector('img');document.querySelectorAll('.reward-image-trigger').forEach(trigger=>trigger.addEventListener('click',()=>{const image=trigger.querySelector('img');if(!image||!rewardLightbox||!rewardLightboxImage)return;rewardLightboxImage.src=image.currentSrc||image.src;rewardLightboxImage.alt=image.alt;rewardLightbox.showModal()}));const closeRewardLightbox=()=>rewardLightbox?.close();document.querySelector('.reward-lightbox-close')?.addEventListener('click',closeRewardLightbox);rewardLightbox?.addEventListener('click',event=>{if(event.target===rewardLightbox)closeRewardLightbox()});rewardLightbox?.addEventListener('close',()=>{if(rewardLightboxImage){rewardLightboxImage.src='';rewardLightboxImage.alt=''}});

const schoolLogoCarousel=document.querySelector('.school-logo-carousel');if(schoolLogoCarousel){let dragging=false;let dragStartX=0;let dragStartScroll=0;const finishLogoDrag=event=>{if(!dragging)return;dragging=false;schoolLogoCarousel.classList.remove('is-dragging');if(schoolLogoCarousel.hasPointerCapture?.(event.pointerId))schoolLogoCarousel.releasePointerCapture(event.pointerId)};schoolLogoCarousel.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0)return;dragging=true;dragStartX=event.clientX;dragStartScroll=schoolLogoCarousel.scrollLeft;schoolLogoCarousel.classList.add('is-dragging');schoolLogoCarousel.setPointerCapture?.(event.pointerId)});schoolLogoCarousel.addEventListener('pointermove',event=>{if(!dragging)return;event.preventDefault();schoolLogoCarousel.scrollLeft=dragStartScroll-(event.clientX-dragStartX)});schoolLogoCarousel.addEventListener('pointerup',finishLogoDrag);schoolLogoCarousel.addEventListener('pointercancel',finishLogoDrag)}
