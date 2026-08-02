(function () {
  "use strict";

  if (window.PSDAuthModal) return;

  const client = window.psdSupabase;
  if (!client) return;

  let overlay = null;
  let lastFocusedElement = null;

  function setStatus(message, type) {
    const status = overlay && overlay.querySelector("#psd-modal-status");
    if (!status) return;
    status.textContent = message || "";
    status.className = "psd-status" + (type ? " " + type : "");
  }

  function setBusy(form, busy) {
    if (!form) return;
    form.querySelectorAll("button,input").forEach(function (element) {
      element.disabled = busy;
    });
  }

  function redirectUrl(path) {
    return new URL(path, window.location.href).href;
  }

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 30);
  }

  async function signInWithIdentifier(identifier, password) {
    const value = String(identifier || "").trim().toLowerCase();

    if (value.includes("@")) {
      return client.auth.signInWithPassword({
        email: value,
        password: password
      });
    }

    const config = window.PSDSupabaseConfig;
    const response = await fetch(
      config.url + "/functions/v1/username-or-email-login",
      {
        method: "POST",
        headers: {
          "apikey": config.anonKey,
          "Authorization": "Bearer " + config.anonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          identifier: value,
          password: password
        })
      }
    );

    const payload = await response.json().catch(function () {
      return {};
    });

    if (!response.ok || !payload.access_token || !payload.refresh_token) {
      return {
        data: null,
        error: new Error(payload.error || "Invalid username/email or password.")
      };
    }

    return client.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token
    });
  }

  function showRememberToast(remembered) {
    const existing = document.getElementById("psd-remember-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "psd-remember-toast";
    toast.className = "psd-remember-toast";
    toast.innerHTML = remembered
      ? '<span>Signed in and remembered on this device.</span><button type="button">Use session only</button>'
      : '<span>Signed in for this browser session only.</span>';

    document.body.appendChild(toast);

    const button = toast.querySelector("button");
    if (button) {
      button.addEventListener("click", function () {
        if (window.PSDAuthStorage) {
          window.PSDAuthStorage.useSessionOnly();
        }
        toast.innerHTML = "<span>Changed to session-only sign-in.</span>";
      });
    }

    window.setTimeout(function () {
      toast.remove();
    }, 4000);
  }

  function showPanel(panelId) {
    if (!overlay) return;

    overlay.querySelectorAll(".auth-panel").forEach(function (panel) {
      panel.hidden = panel.id !== panelId;
    });

    overlay.querySelectorAll(".auth-tab").forEach(function (tab) {
      const selected = tab.dataset.panel === panelId;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });

    setStatus("");
    const firstInput = overlay.querySelector("#" + panelId + " input");
    if (firstInput) {
      window.setTimeout(function () {
        firstInput.focus();
      }, 20);
    }
  }

  function close() {
    if (!overlay) return;
    document.body.classList.remove("psd-auth-modal-open");
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
    overlay = null;

    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  function onKeyDown(event) {
    if (event.key === "Escape") close();
  }

  function createMarkup() {
    const rememberChecked =
      !window.PSDAuthStorage ||
      window.PSDAuthStorage.isRemembered();

    return `
      <div class="psd-auth-modal-backdrop"></div>
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
              <label for="psd-modal-signin-identifier">Username or Email</label>
              <input class="psd-input" id="psd-modal-signin-identifier" name="username" type="text" autocomplete="username" required>
            </div>
            <div class="psd-field">
              <label for="psd-modal-signin-password">Password</label>
              <div class="psd-password-wrap">
                <input class="psd-input" id="psd-modal-signin-password" name="password" type="password" autocomplete="current-password" minlength="8" required>
                <button class="psd-password-toggle" type="button" data-password-target="psd-modal-signin-password" aria-label="Show password" title="Show password">👁</button>
              </div>
            </div>
            <label class="checkbox-row">
              <input id="psd-modal-remember" type="checkbox" ${rememberChecked ? "checked" : ""}>
              <span>Remember me on this device</span>
            </label>
            <button class="psd-button" type="submit">Sign In</button>
          </form>
        </section>

        <section id="psd-modal-signup" class="auth-panel" hidden>
          <form id="psd-modal-signup-form" class="psd-form">
            <div class="psd-field">
              <label for="psd-modal-signup-username">Username</label>
              <input class="psd-input" id="psd-modal-signup-username" name="new-username" type="text" autocomplete="username" minlength="3" maxlength="30" pattern="[a-z0-9_]{3,30}" required>
              <span class="psd-help">Use 3–30 lowercase letters, numbers, or underscores.</span>
            </div>
            <div class="psd-field">
              <label for="psd-modal-signup-email">Email</label>
              <input class="psd-input" id="psd-modal-signup-email" name="email" type="email" autocomplete="email" required>
            </div>
            <div class="psd-field">
              <label for="psd-modal-signup-password">Password</label>
              <div class="psd-password-wrap">
                <input class="psd-input" id="psd-modal-signup-password" name="new-password" type="password" autocomplete="new-password" minlength="8" required>
                <button class="psd-password-toggle" type="button" data-password-target="psd-modal-signup-password" aria-label="Show password" title="Show password">👁</button>
              </div>
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

  function bindPasswordToggles() {
    overlay.querySelectorAll(".psd-password-toggle").forEach(function (button) {
      button.addEventListener("click", function () {
        const input = overlay.querySelector("#" + button.dataset.passwordTarget);
        if (!input) return;

        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.textContent = show ? "🙈" : "👁";
        button.setAttribute("aria-label", show ? "Hide password" : "Show password");
        button.setAttribute("title", show ? "Hide password" : "Show password");
        input.focus();
      });
    });
  }

  function bindEvents() {
    overlay.querySelector(".psd-auth-modal-close").addEventListener("click", close);
    overlay.querySelector(".psd-auth-modal-backdrop").addEventListener("click", close);
    document.addEventListener("keydown", onKeyDown);

    overlay.querySelectorAll(".auth-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        showPanel(tab.dataset.panel);
      });
    });

    bindPasswordToggles();

    const usernameInput = overlay.querySelector("#psd-modal-signup-username");
    usernameInput.addEventListener("input", function () {
      usernameInput.value = normalizeUsername(usernameInput.value);
    });

    const signInForm = overlay.querySelector("#psd-modal-signin-form");
    signInForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setBusy(signInForm, true);
      setStatus("Signing in…");

      const identifier = overlay.querySelector("#psd-modal-signin-identifier").value;
      const password = overlay.querySelector("#psd-modal-signin-password").value;
      const remember = overlay.querySelector("#psd-modal-remember").checked;

      if (window.PSDAuthStorage) {
        window.PSDAuthStorage.setRemembered(remember);
      }

      const result = await signInWithIdentifier(identifier, password);
      setBusy(signInForm, false);

      if (result.error) {
        setStatus(result.error.message, "error");
        return;
      }

      close();
      showRememberToast(remember);
    });

    const signUpForm = overlay.querySelector("#psd-modal-signup-form");
    signUpForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setBusy(signUpForm, true);
      setStatus("Creating your account…");

      const username = normalizeUsername(
        overlay.querySelector("#psd-modal-signup-username").value
      );
      const email = overlay.querySelector("#psd-modal-signup-email").value.trim();
      const password = overlay.querySelector("#psd-modal-signup-password").value;

      const availability = await client.rpc("ms_username_available", {
        p_username: username
      });

      if (availability.error || availability.data !== true) {
        setBusy(signUpForm, false);
        setStatus("That username is unavailable. Please choose another.", "error");
        return;
      }

      const result = await client.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            username: username,
            display_name: username
          },
          emailRedirectTo: redirectUrl("auth.html?confirmed=1")
        }
      });

      setBusy(signUpForm, false);
      if (result.error) {
        setStatus(result.error.message, "error");
        return;
      }

      signUpForm.reset();
      setStatus("Account created. Check your email to confirm it.", "success");
    });

    const resetForm = overlay.querySelector("#psd-modal-reset-form");
    resetForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setBusy(resetForm, true);
      setStatus("Sending reset email…");

      const email = overlay.querySelector("#psd-modal-reset-email").value.trim();
      const result = await client.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl("auth.html?recovery=1")
      });

      setBusy(resetForm, false);
      if (result.error) {
        setStatus(result.error.message, "error");
        return;
      }

      resetForm.reset();
      setStatus("Password reset email sent.", "success");
    });
  }

  function open(initialPanel) {
    if (overlay) return;

    lastFocusedElement = document.activeElement;
    overlay = document.createElement("div");
    overlay.className = "psd-auth-modal";
    overlay.innerHTML = createMarkup();
    document.body.appendChild(overlay);
    document.body.classList.add("psd-auth-modal-open");

    bindEvents();
    showPanel(initialPanel || "psd-modal-signin");
  }

  window.PSDAuthToast = {
    show: showRememberToast
  };

  window.PSDAuthModal = {
    open: open,
    close: close
  };
})();
