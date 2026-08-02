(function(){
  "use strict";

  if(window.PSDAuthModal) return;

  const client = window.psdSupabase;
  if(!client) return;

  let overlay = null;
  let lastFocusedElement = null;

  function escapeHtml(value){
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function redirectUrl(path){
    return new URL(path, window.location.href).href;
  }

  function setStatus(message, type){
    const status = overlay && overlay.querySelector("#psd-modal-status");
    if(!status) return;
    status.textContent = message || "";
    status.className = "psd-status" + (type ? " " + type : "");
  }

  function setBusy(form, busy){
    if(!form) return;
    form.querySelectorAll("button,input").forEach(function(element){
      element.disabled = busy;
    });
  }

  function showPanel(panelId){
    if(!overlay) return;

    overlay.querySelectorAll(".auth-panel").forEach(function(panel){
      panel.hidden = panel.id !== panelId;
    });

    overlay.querySelectorAll(".auth-tab").forEach(function(tab){
      const selected = tab.dataset.panel === panelId;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });

    setStatus("");
    const firstInput = overlay.querySelector("#" + panelId + " input");
    if(firstInput) window.setTimeout(function(){ firstInput.focus(); }, 20);
  }

  function close(){
    if(!overlay) return;
    document.body.classList.remove("psd-auth-modal-open");
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
    overlay = null;

    if(lastFocusedElement && typeof lastFocusedElement.focus === "function"){
      lastFocusedElement.focus();
    }
  }

  function onKeyDown(event){
    if(event.key === "Escape") close();
  }

  function createMarkup(){
    return `
      <div class="psd-auth-modal-backdrop" data-psd-auth-close="true"></div>
      <section class="psd-auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="psd-auth-modal-title">
        <button class="psd-auth-modal-close" type="button" aria-label="Close sign-in popup">×</button>

        <div class="psd-auth-modal-badge">Free Account</div>
        <h2 id="psd-auth-modal-title">Sign In to Public Sentiment Dash</h2>
        <p class="psd-auth-modal-intro">Save your market preferences, watchlist, and future alerts across the website and mobile app.</p>

        <div class="auth-tabs" role="tablist" aria-label="Account actions">
          <button class="auth-tab active" type="button" role="tab" aria-selected="true" data-panel="psd-modal-signin">Sign In</button>
          <button class="auth-tab" type="button" role="tab" aria-selected="false" data-panel="psd-modal-signup">Create Account</button>
          <button class="auth-tab" type="button" role="tab" aria-selected="false" data-panel="psd-modal-reset">Reset Password</button>
        </div>

        <section id="psd-modal-signin" class="auth-panel">
          <form id="psd-modal-signin-form" class="psd-form">
            <div class="psd-field">
              <label for="psd-modal-signin-email">Email</label>
              <input class="psd-input" id="psd-modal-signin-email" type="email" autocomplete="email" required>
            </div>
            <div class="psd-field">
              <label for="psd-modal-signin-password">Password</label>
              <input class="psd-input" id="psd-modal-signin-password" type="password" autocomplete="current-password" minlength="8" required>
            </div>
            <button class="psd-button" type="submit">Sign In</button>
          </form>
        </section>

        <section id="psd-modal-signup" class="auth-panel" hidden>
          <form id="psd-modal-signup-form" class="psd-form">
            <div class="psd-field">
              <label for="psd-modal-signup-name">Display name</label>
              <input class="psd-input" id="psd-modal-signup-name" type="text" autocomplete="name" maxlength="80">
            </div>
            <div class="psd-field">
              <label for="psd-modal-signup-email">Email</label>
              <input class="psd-input" id="psd-modal-signup-email" type="email" autocomplete="email" required>
            </div>
            <div class="psd-field">
              <label for="psd-modal-signup-password">Password</label>
              <input class="psd-input" id="psd-modal-signup-password" type="password" autocomplete="new-password" minlength="8" required>
            </div>
            <label class="checkbox-row">
              <input id="psd-modal-signup-agree" type="checkbox" required>
              <span>I agree to the <a href="terms.html">Terms</a> and <a href="privacy.html">Privacy Policy</a>.</span>
            </label>
            <button class="psd-button" type="submit">Create Free Account</button>
          </form>
        </section>

        <section id="psd-modal-reset" class="auth-panel" hidden>
          <form id="psd-modal-reset-form" class="psd-form">
            <div class="psd-field">
              <label for="psd-modal-reset-email">Email</label>
              <input class="psd-input" id="psd-modal-reset-email" type="email" autocomplete="email" required>
            </div>
            <button class="psd-button" type="submit">Send Reset Email</button>
          </form>
        </section>

        <div id="psd-modal-status" class="psd-status" role="status" aria-live="polite"></div>

        <div class="psd-auth-modal-links">
          <a href="privacy.html">Privacy</a>
          <a href="terms.html">Terms</a>
          <a href="disclaimer.html">Disclaimer</a>
        </div>
        <p class="psd-help psd-auth-modal-note">Email confirmation is required for a new account.</p>
      </section>
    `;
  }

  function bindEvents(){
    const closeButton = overlay.querySelector(".psd-auth-modal-close");
    const backdrop = overlay.querySelector(".psd-auth-modal-backdrop");

    closeButton.addEventListener("click", close);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", onKeyDown);

    overlay.querySelectorAll(".auth-tab").forEach(function(tab){
      tab.addEventListener("click", function(){
        showPanel(tab.dataset.panel);
      });
    });

    const signInForm = overlay.querySelector("#psd-modal-signin-form");
    signInForm.addEventListener("submit", async function(event){
      event.preventDefault();
      setBusy(signInForm, true);
      setStatus("Signing in…");

      const email = overlay.querySelector("#psd-modal-signin-email").value.trim();
      const password = overlay.querySelector("#psd-modal-signin-password").value;

      const result = await client.auth.signInWithPassword({
        email: email,
        password: password
      });

      setBusy(signInForm, false);
      if(result.error){
        setStatus(result.error.message, "error");
        return;
      }

      setStatus("Signed in. Opening your account…", "success");
      window.setTimeout(function(){
        window.location.href = "account.html";
      }, 450);
    });

    const signUpForm = overlay.querySelector("#psd-modal-signup-form");
    signUpForm.addEventListener("submit", async function(event){
      event.preventDefault();
      setBusy(signUpForm, true);
      setStatus("Creating your account…");

      const displayName = overlay.querySelector("#psd-modal-signup-name").value.trim();
      const email = overlay.querySelector("#psd-modal-signup-email").value.trim();
      const password = overlay.querySelector("#psd-modal-signup-password").value;

      const result = await client.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { display_name: displayName || null },
          emailRedirectTo: redirectUrl("auth.html?confirmed=1")
        }
      });

      setBusy(signUpForm, false);
      if(result.error){
        setStatus(result.error.message, "error");
        return;
      }

      signUpForm.reset();
      setStatus("Account created. Check your email to confirm it.", "success");
    });

    const resetForm = overlay.querySelector("#psd-modal-reset-form");
    resetForm.addEventListener("submit", async function(event){
      event.preventDefault();
      setBusy(resetForm, true);
      setStatus("Sending reset email…");

      const email = overlay.querySelector("#psd-modal-reset-email").value.trim();
      const result = await client.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl("auth.html?recovery=1")
      });

      setBusy(resetForm, false);
      if(result.error){
        setStatus(result.error.message, "error");
        return;
      }

      resetForm.reset();
      setStatus("Password reset email sent.", "success");
    });
  }

  function open(initialPanel){
    if(overlay) return;

    lastFocusedElement = document.activeElement;
    overlay = document.createElement("div");
    overlay.className = "psd-auth-modal";
    overlay.innerHTML = createMarkup();
    document.body.appendChild(overlay);
    document.body.classList.add("psd-auth-modal-open");

    bindEvents();
    showPanel(initialPanel || "psd-modal-signin");
    overlay.querySelector(".psd-auth-modal-close").focus();
  }

  window.PSDAuthModal = {
    open: open,
    close: close
  };
})();
