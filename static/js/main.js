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

  /* ── Peer-review filter (services page) ──
     Progressive enhancement: the bar ships with [hidden] so a
     no-JS visitor gets the full list and no dead controls. */
  var $filterBar = $('#review-filter');

  if ($filterBar.length && $('#review-list .entry-row').length) {
    var $reviewList = $('#review-list');
    var $summary = $('#review-summary');
    var baseSummary = $summary.text();
    var totalRounds = parseInt($filterBar.attr('data-total'), 10) || 0;

    function applyReviewFilter(kind) {
      var shownRounds = 0;

      $reviewList.find('.entry-list').each(function () {
        var $group = $(this);
        var groupRounds = 0;
        var $visible = $();

        $group.find('.entry-row').each(function () {
          var $row = $(this);
          var match = kind === 'all' || $row.attr('data-kind') === kind;
          $row.prop('hidden', !match).removeClass('is-first');
          if (match) {
            groupRounds += parseInt($row.attr('data-rounds'), 10) || 1;
            $visible = $visible.add($row);
          }
        });

        $visible.first().addClass('is-first');
        shownRounds += groupRounds;

        $group.find('.year-tally').text(groupRounds + (groupRounds === 1 ? ' round' : ' rounds'));
        $group.prop('hidden', groupRounds === 0);
      });

      if (kind === 'all') {
        $summary.text(baseSummary);
      } else {
        $summary.text('Showing ' + shownRounds + ' of ' + totalRounds + ' rounds');
      }
    }

    $filterBar.on('click', '.filter-pill', function () {
      var $pill = $(this);
      $filterBar.find('.filter-pill').removeClass('is-active').attr('aria-pressed', 'false');
      $pill.addClass('is-active').attr('aria-pressed', 'true');
      applyReviewFilter($pill.attr('data-filter'));
    });

    $reviewList.find('.entry-list').each(function () {
      $(this).find('.entry-row').first().addClass('is-first');
    });
    $filterBar.prop('hidden', false);
  }

  /* ── Scrollspy for the in-page section nav ── */
  var $subnav = $('#service-subnav');

  if ($subnav.length) {
    var $subnavLinks = $subnav.find('a');
    var sections = $subnavLinks.map(function () {
      var $target = $(this.hash);
      return $target.length ? { hash: this.hash, $el: $target } : null;
    }).get();

    var syncSubnav = function () {
      var line = $(window).scrollTop() + 120;
      var current = sections.length ? sections[0].hash : null;

      sections.forEach(function (s) {
        if (s.$el.offset().top <= line) current = s.hash;
      });

      $subnavLinks.removeClass('is-current').filter('[href="' + current + '"]').addClass('is-current');
    };

    if (sections.length) {
      $(window).on('scroll.subnav resize.subnav', syncSubnav);
      syncSubnav();
    }
  }

  /* ── Smooth scroll for anchor links ── */
  $('a.scroll, a[href^="#"]').not('[href="#"]').on('click', function (e) {
    var target = $(this.hash);
    if (target.length) {
      e.preventDefault();
      $('html, body').animate({ scrollTop: target.offset().top - 70 }, 600);
    }
  });

});
