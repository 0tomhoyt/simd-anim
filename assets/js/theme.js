/* Theme toggle. The inline head script sets <html data-theme> before the
   CSS paints (localStorage "site-theme", else the system preference);
   this file only wires the buttons, keeps the theme-color meta honest,
   and broadcasts "site-theme" so canvas/SVG scenes can redraw. */
(function () {
  "use strict";

  var KEY = "site-theme";
  var META = { light: "#f2efe8", dark: "#161512" };

  function current() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function apply(theme, store) {
    document.documentElement.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", META[theme]);
    document.querySelectorAll(".theme-toggle").forEach(function (btn) {
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    });
    if (store) {
      try {
        localStorage.setItem(KEY, theme);
      } catch (error) {
        /* blocked storage still switches for this view */
      }
    }
    document.dispatchEvent(new CustomEvent("site-theme", { detail: { theme: theme } }));
  }

  document.querySelectorAll(".theme-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      apply(current() === "dark" ? "light" : "dark", true);
    });
  });

  /* sync button state and the meta tag with whatever the boot chose */
  apply(current(), false);

  /* before any manual choice, keep following the OS */
  if (window.matchMedia) {
    try {
      if (!localStorage.getItem(KEY)) {
        var mq = window.matchMedia("(prefers-color-scheme: dark)");
        var onChange = function (e) {
          apply(e.matches ? "dark" : "light", false);
        };
        if (mq.addEventListener) mq.addEventListener("change", onChange);
        else if (mq.addListener) mq.addListener(onChange);
      }
    } catch (error) {
      /* storage blocked: the boot choice stands */
    }
  }
})();
