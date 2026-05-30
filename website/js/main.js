document.addEventListener('DOMContentLoaded', () => {
  const iconPaths = {
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'bar-chart-2': '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    'bell-ring': '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M2 8c0-2 .8-3.8 2.1-5.1"/><path d="M22 8c0-2-.8-3.8-2.1-5.1"/>',
    'book-open': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1 1-1h5a3 3 0 0 1 3 3V6a3 3 0 0 0-3-3H4a1 1 0 0 0-1 1z"/><path d="M21 18a1 1 0 0 0-1-1h-5a3 3 0 0 0-3 3V6a3 3 0 0 1 3-3h5a1 1 0 0 1 1 1z"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    'file-spreadsheet': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9v8"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20"/><path d="M12 2a15.3 15.3 0 0 0 0 20"/>',
    'help-circle': '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.8 1c-.5 1-1.5 1.5-2.1 2.2-.5.5-.8 1-.8 1.8"/><path d="M12 17h.01"/>',
    languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 0 0 0 20h1.5a2.5 2.5 0 0 0 0-5H12a2 2 0 0 1 0-4h1a9 9 0 0 0 9-9.5A10 10 0 0 0 12 2z"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    'plus-circle': '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>',
    'refresh-cw': '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8"/><path d="M21 3v5h-5"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
    'shield-check': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
    smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/>',
    'volume-2': '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/>'
  };

  document.querySelectorAll('[data-lucide]').forEach((node) => {
    const name = node.getAttribute('data-lucide');
    const path = iconPaths[name] || iconPaths.sparkles;
    node.outerHTML = `<svg class="icon ${node.className || ''}" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  });

  const header = document.querySelector('header');
  const navLinks = document.querySelector('.nav-links');
  const menuBtn = document.querySelector('.menu-btn');

  const setHeaderState = () => {
    header?.classList.toggle('scrolled', window.scrollY > 50);
  };
  setHeaderState();
  window.addEventListener('scroll', setHeaderState, { passive: true });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const targetSelector = anchor.getAttribute('href');
      if (!targetSelector || targetSelector === '#') return;

      const target = document.querySelector(targetSelector);
      if (!target) return;

      event.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight || 0);
      window.scrollTo({ top, behavior: 'smooth' });
      closeMobileMenu();
    });
  });

  function closeMobileMenu() {
    navLinks?.classList.remove('mobile-active');
    navLinks?.removeAttribute('style');
    menuBtn?.setAttribute('aria-expanded', 'false');
  }

  if (menuBtn && navLinks) {
    menuBtn.setAttribute('role', 'button');
    menuBtn.setAttribute('tabindex', '0');
    menuBtn.setAttribute('aria-label', 'Open menu');
    menuBtn.setAttribute('aria-expanded', 'false');

    const toggleMenu = () => {
      const isOpen = navLinks.classList.toggle('mobile-active');
      menuBtn.setAttribute('aria-expanded', String(isOpen));
    };

    menuBtn.addEventListener('click', toggleMenu);
    menuBtn.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleMenu();
      }
    });
  }

  const showcase = document.querySelector('.showcase-scroll');
  const screens = document.querySelectorAll('.mock-screen-content');
  const steps = document.querySelectorAll('.scroll-step');
  const showcasePhone = document.querySelector('.showcase-phone');
  const hasGsapScroll = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  let activeScreenIndex = -1;
  let ticking = false;

  const activateScreen = (index) => {
    if (index < 0 || index >= screens.length || index === activeScreenIndex) return;
    activeScreenIndex = index;

    screens.forEach((screen, screenIndex) => {
      const isActive = screenIndex === index;
      screen.classList.toggle('active', isActive);

      if (hasGsapScroll) {
        gsap.to(screen, {
          visibility: isActive ? 'visible' : 'hidden',
          opacity: 1,
          x: isActive ? 0 : '100%',
          y: 0,
          scale: 1,
          duration: 0.42,
          ease: 'power3.out',
          overwrite: true
        });
      }
    });

    steps.forEach((step, stepIndex) => {
      const isActive = stepIndex === index;
      step.classList.toggle('active', isActive);

      if (hasGsapScroll) {
        gsap.to(step, {
          opacity: isActive ? 1 : 0.46,
          x: isActive && window.innerWidth > 1024 ? 12 : 0,
          y: isActive && window.innerWidth <= 1024 ? -6 : 0,
          duration: 0.4,
          ease: 'power2.out',
          overwrite: true
        });

        gsap.fromTo(
          step.querySelectorAll('.scroll-step-num, .scroll-step-title, .scroll-step-desc, .step-tag'),
          { y: isActive ? 10 : 0 },
          { y: 0, duration: 0.45, stagger: 0.035, ease: 'power3.out', overwrite: true }
        );
      }
    });

    if (showcasePhone) {
      if (!hasGsapScroll) {
        showcasePhone.classList.remove('screen-bump');
        void showcasePhone.offsetWidth;
        showcasePhone.classList.add('screen-bump');
      }
    }
  };

  if (steps.length && screens.length) {
    if (hasGsapScroll) {
      gsap.registerPlugin(ScrollTrigger);

      gsap.set(screens, { visibility: 'hidden', opacity: 1, x: '100%', y: 0, scale: 1 });
      gsap.set(screens[0], { visibility: 'visible', opacity: 1, x: 0, y: 0, scale: 1 });
      gsap.set(steps, { opacity: 0.46, x: 0, y: 0 });
      gsap.set(steps[0], { opacity: 1, x: window.innerWidth > 1024 ? 12 : 0 });

      activateScreen(0);

      if (showcase && showcasePhone && window.innerWidth > 1024) {
        ScrollTrigger.create({
          trigger: showcase,
          start: 'top top',
          end: 'bottom bottom',
          pin: '.scroll-visual-container',
          scrub: true,
          anticipatePin: 1
        });
      }

      steps.forEach((step, index) => {
        ScrollTrigger.create({
          trigger: step,
          start: window.innerWidth <= 1024 ? 'top 68%' : 'top 52%',
          end: window.innerWidth <= 1024 ? 'bottom 42%' : 'bottom 52%',
          onEnter: () => activateScreen(index),
          onEnterBack: () => activateScreen(index)
        });
      });

      window.addEventListener('load', () => ScrollTrigger.refresh());
    } else {
      activateScreen(0);

      const updateShowcaseScreen = () => {
        ticking = false;

        if (!showcase) return;

        const viewportAnchor = window.innerWidth <= 1024
          ? window.innerHeight * 0.72
          : window.innerHeight * 0.45;
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;

        steps.forEach((step, index) => {
          const rect = step.getBoundingClientRect();
          const stepCenter = rect.top + rect.height / 2;
          const distance = Math.abs(stepCenter - viewportAnchor);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        });

        activateScreen(closestIndex);
      };

      const queueShowcaseUpdate = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(updateShowcaseScreen);
      };

      updateShowcaseScreen();
      window.addEventListener('scroll', queueShowcaseUpdate, { passive: true });
      window.addEventListener('resize', queueShowcaseUpdate);
    }
  }

  const tabBtns = document.querySelectorAll('.guide-tab-btn');
  const panels = document.querySelectorAll('.guide-content-panel');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetPanel = document.getElementById(btn.dataset.target);
      if (!targetPanel) return;

      tabBtns.forEach((tab) => tab.classList.toggle('active', tab === btn));
      panels.forEach((panel) => {
        panel.classList.toggle('active', panel === targetPanel);
        panel.style.visibility = panel === targetPanel ? 'visible' : 'hidden';
      });
    });
  });

  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!question || !answer) return;

    question.addEventListener('click', () => {
      const willOpen = !item.classList.contains('active');

      faqItems.forEach((other) => {
        if (other !== item) {
          other.classList.remove('active');
          const otherAnswer = other.querySelector('.faq-answer');
          if (otherAnswer) otherAnswer.style.height = '0px';
        }
      });

      item.classList.toggle('active', willOpen);
      answer.style.height = willOpen ? `${answer.scrollHeight}px` : '0px';
    });
  });

  document.querySelectorAll('.feature-card').forEach((card) => {
    card.addEventListener('mousemove', (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
    });
  });
});
