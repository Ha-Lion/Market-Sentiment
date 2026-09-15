/* PSD_MOBILE_DESKTOP_GUARD */
if (window.matchMedia("(max-width: 768px)").matches) {

(function () {
  "use strict";

  function buildCleanMobileHeader() {

    if (document.querySelector(".psd-mobile-clean-header")) {
      return;
    }

    const desktopHeader =
      document.querySelector(".psd-shared-header");

    if (!desktopHeader) {
      setTimeout(buildCleanMobileHeader, 100);
      return;
    }

    const desktopNav =
      desktopHeader.querySelector(".nav");

    if (!desktopNav) {
      setTimeout(buildCleanMobileHeader, 100);
      return;
    }


    /* =====================================================
       NEW MOBILE HEADER
       ===================================================== */

    const header =
      document.createElement("header");

    header.className =
      "psd-mobile-clean-header";

    header.innerHTML = `
      <a
        class="psd-mobile-clean-logo-wrap"
        href="index.html"
        aria-label="Home"
      >
        <img
          class="psd-mobile-clean-logo"
          src="logo.png"
          alt="Public Sentiment Dash"
        >
        <span class="psd-mobile-clean-home">
          Home
        </span>
      </a>

      <div class="psd-mobile-clean-ai-banner">
        AI-built public market sentiment website
      </div>

      <button
        class="psd-mobile-clean-menu-button"
        type="button"
        aria-expanded="false"
        aria-label="Open navigation menu"
      >
        ☰ Menu
      </button>

      <div class="psd-mobile-clean-global-line">
        Global market public sentiment dashboard
      </div>
    `;


    /* =====================================================
       CLEAN MOBILE MENU
       ===================================================== */

    const menu =
      document.createElement("nav");

    menu.className =
      "psd-mobile-clean-menu";

    menu.setAttribute(
      "aria-label",
      "Mobile navigation"
    );

    const seen = new Set();

    desktopNav
      .querySelectorAll("a")
      .forEach(function (link) {

        if (
          link.closest(".psd-bottom-promos") ||
          link.closest(".psd-ribbon-social-wrap")
        ) {
          return;
        }

        const href =
          link.getAttribute("href") || "";

        const text =
          link.textContent.trim();

        if (!href || !text) {
          return;
        }

        const key =
          href + "|" + text;

        if (seen.has(key)) {
          return;
        }

        seen.add(key);

        const clone =
          document.createElement("a");

        clone.href = href;
        clone.textContent = text;

        if (link.target) {
          clone.target = link.target;
        }

        if (link.rel) {
          clone.rel = link.rel;
        }

        menu.appendChild(clone);
      });


    /* =====================================================
       DARK MODE — USE EXISTING PRODUCTION FUNCTION
       ===================================================== */

    const desktopTheme =
      desktopNav.querySelector(
        "#psd-ribbon-theme-toggle"
      );

    if (desktopTheme) {

      const themeButton =
        document.createElement("button");

      themeButton.type = "button";

      themeButton.textContent =
        desktopTheme.textContent.trim();

      themeButton.addEventListener(
        "click",
        function (event) {

          event.preventDefault();
          event.stopPropagation();

          desktopTheme.click();

          setTimeout(function () {

            themeButton.textContent =
              desktopTheme.textContent.trim();

          }, 60);
        }
      );

      menu.appendChild(themeButton);
    }


    header.appendChild(menu);

    document.body.insertBefore(
      header,
      document.body.firstChild
    );


    /* =====================================================
       MENU OPEN / CLOSE
       ===================================================== */

    const menuButton =
      header.querySelector(
        ".psd-mobile-clean-menu-button"
      );

    menuButton.addEventListener(
      "click",
      function (event) {

        event.preventDefault();
        event.stopPropagation();

        const open =
          menu.classList.toggle("open");

        menuButton.setAttribute(
          "aria-expanded",
          open ? "true" : "false"
        );

        menuButton.textContent =
          open
            ? "✕ Close"
            : "☰ Menu";
      }
    );
  }


  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      buildCleanMobileHeader
    );

  } else {

    buildCleanMobileHeader();
  }


  /* site-nav.js is generated dynamically */
  setTimeout(buildCleanMobileHeader, 250);
  setTimeout(buildCleanMobileHeader, 700);
  setTimeout(buildCleanMobileHeader, 1200);

})();

}

/* Completely remove obsolete learning banner on mobile */
function psdRemoveMobileLearningBanner(){

  if (!window.matchMedia("(max-width:768px)").matches) {
    return;
  }

  document
    .querySelectorAll(".psd-learning-label")
    .forEach(function(el){
      el.remove();
    });
}

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    psdRemoveMobileLearningBanner
  );

} else {

  psdRemoveMobileLearningBanner();
}

setTimeout(psdRemoveMobileLearningBanner, 250);
setTimeout(psdRemoveMobileLearningBanner, 750);
setTimeout(psdRemoveMobileLearningBanner, 1500);
