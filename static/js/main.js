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
    var totalVenues = parseInt($filterBar.attr('data-total'), 10) || 0;

    function applyReviewFilter(kind) {
      /* A venue reviewed in several years has one row per year, so the
         filter counts DISTINCT venues to match the pill counts. */
      var shownVenues = {};

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
            shownVenues[$row.attr('data-venue') || ''] = true;
            $visible = $visible.add($row);
          }
        });

        $visible.first().addClass('is-first');

        $group.find('.year-tally').text(groupRounds + (groupRounds === 1 ? ' round' : ' rounds'));
        $group.prop('hidden', groupRounds === 0);
      });

      if (kind === 'all') {
        $summary.text(baseSummary);
      } else {
        $summary.text('Showing ' + Object.keys(shownVenues).length + ' of ' + totalVenues + ' venues');
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

  /* ── Research-theme cloud (publications page) ──
     Clicking a theme shows only the papers tagged with it (data-themes on
     each row); clicking it again, or "Show all", restores the full list.
     The choice is kept in the URL (#theme=slug) so a filtered view can be
     shared. Hovering (or focusing) a theme draws arcs to the themes it
     most often shares papers with. Without JS the cloud is still a
     readable overview. */
  var $cloud = $('#theme-cloud');

  if ($cloud.length) {
    var cloudEl = $cloud[0];
    var $pubRows = $('#publications .entry-row[data-themes]');
    var $pubLists = $('#publications .entry-list');
    var $cloudStatus = $cloud.find('.theme-cloud-status');
    var $cloudHint = $cloud.find('.theme-cloud-hint');
    var $words = $cloud.find('.theme-word');
    var wordsBox = $cloud.find('.theme-cloud-words')[0];
    var linkSvg = $cloud.find('.theme-links')[0];
    var baseCloudStatus = $cloudStatus.text();
    var totalPubs = $pubRows.length;
    var canHover = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
    var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* How often each pair of themes tags the same paper. */
    var together = {};
    $pubRows.each(function () {
      var tags = (this.getAttribute('data-themes') || '').split(/\s+/).filter(Boolean);
      tags.forEach(function (a) {
        together[a] = together[a] || {};
        tags.forEach(function (b) {
          if (a !== b) together[a][b] = (together[a][b] || 0) + 1;
        });
      });
    });

    function relatedTo(slug) {
      var m = together[slug] || {};
      return Object.keys(m).sort(function (a, b) { return m[b] - m[a] || (a < b ? -1 : 1); }).slice(0, 5);
    }

    function wordFor(slug) { return $words.filter('[data-theme="' + slug + '"]'); }

    function centreOf(el, box) {
      var r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    }

    function drawLinks(el, slug, related) {
      var box = wordsBox.getBoundingClientRect();
      var from = centreOf(el, box);
      var best = (together[slug] || {})[related[0]] || 1;
      var svg = related.map(function (s, k) {
        var to = centreOf(wordFor(s)[0], box);
        var bend = Math.min(70, 18 + Math.abs(to.x - from.x) * 0.22);
        var cx = (from.x + to.x) / 2;
        var cy = (from.y + to.y) / 2 - (to.y <= from.y ? bend : -bend * 0.6);
        var w = (1 + 2.2 * (together[slug][s] / best)).toFixed(2);
        return '<path pathLength="1" style="--k:' + k + ';stroke-width:' + w + 'px" d="M' +
          from.x.toFixed(1) + ' ' + from.y.toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) +
          ' ' + to.x.toFixed(1) + ' ' + to.y.toFixed(1) + '"/>' +
          '<circle style="--k:' + k + '" r="3" cx="' + to.x.toFixed(1) + '" cy="' + to.y.toFixed(1) + '"/>';
      }).join('');
      linkSvg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
      linkSvg.style.color = getComputedStyle(el).color;
      linkSvg.innerHTML = svg;
    }

    var hoverTimer = null;

    function showConnections(el) {
      clearTimeout(hoverTimer);
      var slug = el.getAttribute('data-theme');
      var related = relatedTo(slug);
      $words.removeClass('is-hot is-related');
      $(el).addClass('is-hot');
      related.forEach(function (s) { wordFor(s).addClass('is-related'); });
      $cloud.addClass('is-hovering');
      drawLinks(el, slug, related);

      var count = el.getAttribute('data-count');
      $cloudHint.empty().append(
        $('<strong>').text(el.getAttribute('data-label')),
        document.createTextNode(' · ' + count + (count === '1' ? ' paper' : ' papers') + ' · ' + el.getAttribute('data-span') +
          (related.length ? ' · often with ' + related.slice(0, 3).map(function (s) {
            return wordFor(s).attr('data-label');
          }).join(', ') : ''))
      );
    }

    function hideConnections() {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () {
        $cloud.removeClass('is-hovering');
        $words.removeClass('is-hot is-related');
        linkSvg.innerHTML = '';
      }, 80);
    }

    if (canHover) {
      $cloud.on('mouseenter', '.theme-word', function () { showConnections(this); });
      $cloud.on('mouseleave', '.theme-word', hideConnections);

      /* Soft spotlight that follows the cursor across the card. */
      if (!reduceMotion) {
        var spotFrame = null;
        cloudEl.addEventListener('pointermove', function (e) {
          if (spotFrame) return;
          spotFrame = requestAnimationFrame(function () {
            var r = cloudEl.getBoundingClientRect();
            cloudEl.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            cloudEl.style.setProperty('--my', (e.clientY - r.top) + 'px');
            spotFrame = null;
          });
        });
      }
    }
    /* Keyboard users get the same connections on focus. */
    $cloud.on('focusin', '.theme-word', function () {
      if (this.matches(':focus-visible')) showConnections(this);
    });
    $cloud.on('focusout', '.theme-word', hideConnections);
    $(window).on('resize.themecloud', function () { linkSvg.innerHTML = ''; });

    function applyTheme(slug, updateUrl) {
      var $word = slug ? $cloud.find('.theme-word[data-theme="' + slug + '"]') : $();
      if (!$word.length) slug = '';

      $cloud.toggleClass('has-selection', !!slug);
      $cloud.find('.theme-word').attr('aria-pressed', 'false');
      $word.attr('aria-pressed', 'true');

      var shown = 0;
      $pubRows.each(function () {
        var match = !slug || (' ' + this.getAttribute('data-themes') + ' ').indexOf(' ' + slug + ' ') !== -1;
        this.hidden = !match;
        this.classList.remove('is-entering');
        if (match) {
          /* Replay the slide-in on the rows that are now shown. */
          if (!reduceMotion && updateUrl) {
            this.style.setProperty('--r', Math.min(shown, 14));
            void this.offsetWidth;
            this.classList.add('is-entering');
          }
          shown++;
        }
      });
      /* Hide a whole section (header + list) when none of its papers match. */
      $pubLists.each(function () {
        var empty = $(this).children('.entry-row').filter(function () { return !this.hidden; }).length === 0;
        this.hidden = empty;
        $(this).prev('.section-header').prop('hidden', empty);
      });

      $cloudStatus.empty();
      if (slug) {
        $cloudStatus.append(
          document.createTextNode('Showing ' + shown + ' of ' + totalPubs + ' publications on '),
          $('<strong>').text($word.attr('data-label')),
          document.createTextNode(' · '),
          $('<button type="button" class="theme-clear">Show all</button>')
        );
      } else {
        $cloudStatus.text(baseCloudStatus);
      }

      if (updateUrl && window.history && history.replaceState) {
        history.replaceState(null, '', slug ? '#theme=' + slug : location.pathname + location.search);
      }
    }

    $cloud.on('click', '.theme-word', function () {
      var slug = $(this).attr('data-theme');
      /* Drop the hover view at once so the filter result is visible. */
      clearTimeout(hoverTimer);
      $cloud.removeClass('is-hovering');
      $words.removeClass('is-hot is-related');
      linkSvg.innerHTML = '';
      applyTheme($(this).attr('aria-pressed') === 'true' ? '' : slug, true);
    });
    $cloud.on('click', '.theme-clear', function () {
      applyTheme('', true);
      $cloud.find('.theme-word').first().trigger('focus');
    });

    var hashTheme = (location.hash.match(/^#theme=([a-z0-9-]+)$/) || [])[1];
    if (hashTheme) applyTheme(hashTheme, false);
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
