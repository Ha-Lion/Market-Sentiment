/* PSD_MOBILE_DESKTOP_GUARD */
if (window.matchMedia("(max-width: 768px)").matches) {
(function () {
  "use strict";

  function installFinalMenu() {

    const header =
      document.querySelector(".psd-shared-header");

    if (!header) {
      setTimeout(installFinalMenu, 100);
      return;
    }

    const originalButton =
      header.querySelector(".psd-mobile-menu-button");

    const desktopNav =
      header.querySelector(".nav");

    if (!originalButton || !desktopNav) {
      setTimeout(installFinalMenu, 100);
      return;
    }

    if (header.querySelector(".psd-final-mobile-menu")) {
      return;
    }

    /* Never allow old ribbon-open state */
    header.classList.remove("psd-mobile-menu-open");

    /*
      Replace the old button so none of the previous
      mobile-lab click handlers remain attached.
    */
    const button =
      originalButton.cloneNode(true);

    originalButton.replaceWith(button);

    button.textContent = "☰ Menu";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open navigation menu");


    /* Build independent mobile menu */
    const menu =
      document.createElement("div");

    menu.className = "psd-final-mobile-menu";
    menu.setAttribute("aria-label", "Mobile navigation");

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

        if (!href || !text) return;

        const key =
          href + "|" + text;

        if (seen.has(key)) return;

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


    /* Reuse production dark-mode behavior */
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


    /*
      CRITICAL FIX:
      The inherited Menu button sits inside the Home anchor.
      Prevent that parent link from navigating.
    */
    button.addEventListener(
      "click",
      function (event) {

        event.preventDefault();
        event.stopPropagation();

        header.classList.remove(
          "psd-mobile-menu-open"
        );

        const open =
          menu.classList.toggle("open");

        button.setAttribute(
          "aria-expanded",
          open ? "true" : "false"
        );

        button.textContent =
          open ? "✕ Close" : "☰ Menu";
      }
    );


    /*
      Extra protection against the parent Home anchor.
    */
    button.addEventListener(
      "pointerdown",
      function (event) {
        event.stopPropagation();
      }
    );
  }


  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      installFinalMenu
    );

  } else {

    installFinalMenu();
  }

  setTimeout(installFinalMenu, 300);
  setTimeout(installFinalMenu, 800);
  setTimeout(installFinalMenu, 1400);

})();

}
