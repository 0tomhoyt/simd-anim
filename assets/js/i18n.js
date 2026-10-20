/* Merges assets/js/strings/*.js and applies the active language. */
(function () {
  var STORAGE_KEY = "site-lang";

  var STRINGS = { en: {}, zh: {} };
  (window.simdStringParts || []).forEach(function (part) {
    ["en", "zh"].forEach(function (lang) {
      var pack = part[lang] || {};
      Object.keys(pack).forEach(function (key) {
        STRINGS[lang][key] = pack[key];
      });
    });
  });

  function readLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "zh" || saved === "en") return saved;
    } catch (error) {
      /* fall through to the browser language */
    }
    var nav = navigator.language || (navigator.languages && navigator.languages[0]) || "en";
    return String(nav).toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  }

  function storeLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (error) {
      /* Private mode still switches for this view. */
    }
  }

  var current = "en";

  function apply(lang) {
    current = lang === "zh" ? "zh" : "en";
    var pack = STRINGS[current];
    document.documentElement.lang = current === "zh" ? "zh-Hans" : "en";

    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      if (pack[key] != null) node.textContent = pack[key];
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(function (node) {
      var key = node.getAttribute("data-i18n-aria");
      if (pack[key] != null) node.setAttribute("aria-label", pack[key]);
    });

    document.querySelectorAll("[data-i18n-content]").forEach(function (node) {
      var key = node.getAttribute("data-i18n-content");
      if (pack[key] != null) node.setAttribute("content", pack[key]);
    });

    var titleEl = document.querySelector("title[data-i18n]");
    if (titleEl) {
      var titleKey = titleEl.getAttribute("data-i18n");
      if (pack[titleKey] != null) document.title = pack[titleKey];
    }

    document.querySelectorAll(".lang-switch button").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-lang") === current ? "true" : "false");
    });

    document.dispatchEvent(new CustomEvent("site-lang", { detail: { lang: current } }));
  }

  window.siteI18n = {
    lang: function () {
      return current;
    },
    t: function (key) {
      var pack = STRINGS[current] || STRINGS.en;
      if (pack[key] != null) return pack[key];
      if (STRINGS.en[key] != null) return STRINGS.en[key];
      return key;
    }
  };

  try {
    apply(readLang());
  } finally {
    document.documentElement.classList.remove("i18n-wait");
  }

  document.querySelectorAll(".lang-switch button").forEach(function (button) {
    button.addEventListener("click", function () {
      var lang = button.getAttribute("data-lang");
      if (lang !== "en" && lang !== "zh") return;
      apply(lang);
      storeLang(lang);
    });
  });
})();
