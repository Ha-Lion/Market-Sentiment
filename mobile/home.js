/* PSD_MOBILE_DESKTOP_GUARD */
if (window.matchMedia("(max-width: 768px)").matches) {
(function () {
  "use strict";

  function setupMobileLab() {
    const header =
      document.querySelector(".psd-shared-header") ||
      document.querySelector(".header");

    if (!header) {
      setTimeout(setupMobileLab, 150);
      return;
    }

    if (header.querySelector(".psd-mobile-menu-button")) return;

    const brand =
      header.querySelector(".brand") ||
      header.firstElementChild;

    if (!brand) return;

    const button = document.createElement("button");

    button.type = "button";
    button.className = "psd-mobile-menu-button";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open navigation menu");
    button.textContent = "☰ Menu";

    brand.appendChild(button);

    button.addEventListener("click", function () {
      const open =
        header.classList.toggle("psd-mobile-menu-open");

      button.setAttribute(
        "aria-expanded",
        open ? "true" : "false"
      );

      button.textContent =
        open ? "✕ Close" : "☰ Menu";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      setupMobileLab
    );
  } else {
    setupMobileLab();
  }

  setTimeout(setupMobileLab, 400);
  setTimeout(setupMobileLab, 1000);
})();

/* =========================================================
   MOBILE HOMEPAGE DOM ORDER — LAB ONLY
   ========================================================= */

(function () {
  "use strict";

  function findSectionByHeading(container, text) {
    return Array.from(container.children).find(function (el) {
      if (!el.classList.contains("section")) return false;

      const heading = el.querySelector("h2");
      return heading && heading.textContent.trim() === text;
    });
  }

  function arrangeMobileHomepage() {

    if (!window.matchMedia("(max-width: 768px)").matches) return;

    const homeLayout = document.querySelector(".home-layout");
    if (!homeLayout) return;

    const content = Array.from(homeLayout.children).find(function (el) {
      return el.tagName === "DIV";
    });

    if (!content) return;

    const hero = content.querySelector(":scope > .hero");

    const marketDirection =
      document.querySelector(".instrument-rail");

    const marketFocus =
      findSectionByHeading(content, "Market Focus Today");

    const dailyBrief =
      findSectionByHeading(content, "Daily Public Sentiment Brief");

    if (!hero || !marketDirection || !marketFocus || !dailyBrief) return;

    marketDirection.classList.add("mobile-order-market-direction");
    marketFocus.classList.add("mobile-order-market-focus");
    dailyBrief.classList.add("mobile-order-daily-brief");

    /*
      Move Market Direction into the mobile content column.
      The visual sequence is then controlled by mobile-only CSS order.
    */
    if (marketDirection.parentElement !== content) {
      content.appendChild(marketDirection);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrangeMobileHomepage);
  } else {
    arrangeMobileHomepage();
  }

  setTimeout(arrangeMobileHomepage, 300);
  setTimeout(arrangeMobileHomepage, 900);

})();

/* =========================================================
   TRUE SEPARATE MOBILE MENU — LAB ONLY
   ========================================================= */

(function () {
  "use strict";

  function buildRealMobileMenu() {

    const header = document.querySelector(".psd-shared-header");
    if (!header) {
      setTimeout(buildRealMobileMenu, 150);
      return;
    }

    const menuButton = header.querySelector(".psd-mobile-menu-button");
    const desktopNav = header.querySelector(".nav");

    if (!menuButton || !desktopNav) {
      setTimeout(buildRealMobileMenu, 150);
      return;
    }

    if (header.querySelector(".psd-mobile-menu-panel")) return;

    const panel = document.createElement("div");
    panel.className = "psd-mobile-menu-panel";
    panel.setAttribute("aria-label", "Mobile navigation");

    const seen = new Set();

    desktopNav.querySelectorAll("a").forEach(function(link) {

      if (
        link.closest(".psd-bottom-promos") ||
        link.closest(".psd-ribbon-social-wrap")
      ) return;

      const href = link.getAttribute("href") || "";
      const text = link.textContent.trim();

      if (!href || !text) return;

      const key = href + "|" + text;
      if (seen.has(key)) return;
      seen.add(key);

      const clone = document.createElement("a");
      clone.href = href;
      clone.textContent = text;

      if (link.target) clone.target = link.target;
      if (link.rel) clone.rel = link.rel;

      panel.appendChild(clone);
    });

    const originalTheme =
      desktopNav.querySelector("#psd-ribbon-theme-toggle");

    if (originalTheme) {
      const themeButton = document.createElement("button");
      themeButton.type = "button";
      themeButton.textContent = originalTheme.textContent.trim();

      themeButton.addEventListener("click", function () {
        originalTheme.click();

        setTimeout(function () {
          themeButton.textContent =
            originalTheme.textContent.trim();
        }, 50);
      });

      panel.appendChild(themeButton);
    }

    header.appendChild(panel);

    const oldButton = menuButton.cloneNode(true);
    menuButton.replaceWith(oldButton);

    oldButton.addEventListener("click", function () {
      const open = panel.classList.toggle("open");

      oldButton.setAttribute(
        "aria-expanded",
        open ? "true" : "false"
      );

      oldButton.textContent =
        open ? "✕ Close" : "☰ Menu";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      buildRealMobileMenu
    );
  } else {
    buildRealMobileMenu();
  }

  setTimeout(buildRealMobileMenu, 400);
  setTimeout(buildRealMobileMenu, 1000);

})();

}
