/* main.js — v1.3 */
$(document).ready(function () {

  /* ── Theme toggle ── */
  function updateThemeIcon() {
    var isDark = document.documentElement.classList.contains('dark-mode');
    var $icon = $('#theme-icon');
    if (isDark) {
      $icon.removeClass('fa-moon').addClass('fa-sun');
    } else {
      $icon.removeClass('fa-sun').addClass('fa-moon');
    }
  }
  updateThemeIcon();

  $('#theme-toggle').on('click', function () {
    var isDark = document.documentElement.classList.contains('dark-mode');
    if (isDark) {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    }
    updateThemeIcon();
  });

  /* ── Sticky navbar scroll shrink ── */
  var $navbar = $('#main-navbar');
  $(window).on('scroll.navbar', function () {
    if ($(this).scrollTop() > 50) {
      $navbar.addClass('navbar-scrolled');
      $('#back-to-top').fadeIn(300);
    } else {
      $navbar.removeClass('navbar-scrolled');
      $('#back-to-top').fadeOut(300);
    }
  });

  /* ── Back to top ── */
  $('#back-to-top').on('click', function (e) {
    e.preventDefault();
    $('html, body').animate({ scrollTop: 0 }, 550, 'swing');
  });

  /* ── Scroll-reveal (fade-in-up) via IntersectionObserver ── */
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.fade-in-up').forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    /* Fallback: show everything immediately */
    document.querySelectorAll('.fade-in-up').forEach(function (el) {
      el.classList.add('visible');
    });
  }

  /* ── Image carousel (click handlers + keyboard) ── */
  var $radios = $('input[name="radio-buttons"]');

  function getActiveIndex() {
    return $radios.index($radios.filter(':checked'));
  }

  $('.next-slide').on('click', function (e) {
    e.preventDefault();
    $radios.eq((getActiveIndex() + 1) % $radios.length).prop('checked', true);
  });

  $('.prev-slide').on('click', function (e) {
    e.preventDefault();
    $radios.eq((getActiveIndex() - 1 + $radios.length) % $radios.length).prop('checked', true);
  });

  $(document).on('keydown', function (e) {
    if (!$radios.length) return;
    if (e.key === 'ArrowRight') {
      $radios.eq((getActiveIndex() + 1) % $radios.length).prop('checked', true);
    } else if (e.key === 'ArrowLeft') {
      $radios.eq((getActiveIndex() - 1 + $radios.length) % $radios.length).prop('checked', true);
    }
  });

  /* ── Smooth scroll for anchor links ── */
  $('a.scroll, a[href^="#"]').not('[href="#"]').on('click', function (e) {
    var target = $(this.hash);
    if (target.length) {
      e.preventDefault();
      $('html, body').animate({ scrollTop: target.offset().top - 70 }, 600);
    }
  });

});
