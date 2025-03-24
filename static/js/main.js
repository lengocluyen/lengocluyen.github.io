/**
 * Created by fabiomadeira on 25/02/15.
 */
// jQuery for page scrolling feature
jQuery(document).ready(function(e) {
    e(".scroll").click(function(t) {
        t.preventDefault();
        e("html,body").animate({
            scrollTop: e(this.hash).offset().top
        }, 1e3)
    })
});
$(document).ready(function () {
    var currentPath = window.location.pathname;

    $(".navbar-nav li a").each(function () {
      var href = $(this).attr("href");

      if (href && currentPath.indexOf(href.replace('{{ site.url }}', '')) !== -1) {
        $(this).parent().addClass("active");
      }
    });
  });

  $(function () {
    const radios = $('input[name="radio-buttons"]');

    function getActiveIndex() {
      return radios.index(radios.filter(':checked'));
    }

    $('.next-slide').on('click', function (e) {
      e.preventDefault();
      let index = getActiveIndex();
      radios.eq((index + 1) % radios.length).prop('checked', true);
    });

    $('.prev-slide').on('click', function (e) {
      e.preventDefault();
      let index = getActiveIndex();
      radios.eq((index - 1 + radios.length) % radios.length).prop('checked', true);
    });
  });