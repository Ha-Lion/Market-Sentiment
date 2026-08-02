(function () {
  "use strict";

  const client = window.psdSupabase;
  if (!client) return;

  const isAuthPage = /(^|\/)auth\.html$/i.test(window.location.pathname);
  const isAccountPage = /(^|\/)account\.html$/i.test(window.location.pathname);

  function setStatus(element, message, type) {
    if (!element) return;
    element.textContent = message || "";
    element.className = "psd-status" + (type ? " " + type : "");
  }

  function setBusy(form, busy) {
    if (!form) return;
    form.querySelectorAll("button,input,select").forEach(function (element) {
      element.disabled = busy;
    });
  }

  function redirectUrl(path) {
    return new URL(path, window.location.origin + window.location.pathname).href;
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
    const response = await fetch(config.url + "/functions/v1/username-login", {
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
    });

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

  function installPasswordToggles(root) {
    (root || document).querySelectorAll('input[type="password"]').forEach(function (input) {
      if (input.closest(".psd-password-wrap")) return;

      const wrapper = document.createElement("div");
      wrapper.className = "psd-password-wrap";
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const button = document.createElement("button");
      button.className = "psd-password-toggle";
      button.type = "button";
      button.textContent = "👁";
      button.setAttribute("aria-label", "Show password");
      button.setAttribute("title", "Show password");

      button.addEventListener("click", function () {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.textContent = show ? "🙈" : "👁";
        button.setAttribute("aria-label", show ? "Hide password" : "Show password");
        button.setAttribute("title", show ? "Hide password" : "Show password");
        input.focus();
      });

      wrapper.appendChild(button);
    });
  }

  function populateTimezones(select, selectedValue) {
    let zones = [];

    try {
      zones = Intl.supportedValuesOf("timeZone");
    } catch (_error) {
      zones = [
        "UTC",
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "America/Toronto",
        "Europe/London",
        "Europe/Paris",
        "Asia/Jerusalem",
        "Asia/Dubai",
        "Asia/Tokyo",
        "Australia/Sydney"
      ];
    }

    const detected =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const wanted = selectedValue || detected;

    if (!zones.includes("UTC")) zones.unshift("UTC");
    if (!zones.includes(wanted)) zones.unshift(wanted);

    select.textContent = "";
    zones.forEach(function (zone) {
      const option = document.createElement("option");
      option.value = zone;
      option.textContent = zone.replace(/_/g, " ");
      option.selected = zone === wanted;
      select.appendChild(option);
    });
  }

  function showRememberToast(remembered) {
    if (window.PSDAuthToast) {
      window.PSDAuthToast.show(remembered);
    }
  }

  async function initAuthPage() {
    installPasswordToggles(document);

    const status = document.getElementById("auth-status");
    const tabs = Array.from(document.querySelectorAll(".auth-tab"));
    const panels = Array.from(document.querySelectorAll(".auth-panel"));

    function showPanel(panelId) {
      panels.forEach(function (panel) {
        panel.hidden = panel.id !== panelId;
      });
      tabs.forEach(function (tab) {
        tab.classList.toggle("active", tab.dataset.panel === panelId);
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        showPanel(tab.dataset.panel);
        setStatus(status, "");
      });
    });

    const usernameInput = document.getElementById("signup-username");
    usernameInput.addEventListener("input", function () {
      usernameInput.value = normalizeUsername(usernameInput.value);
    });

    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const recoveryRequested =
      params.get("recovery") === "1" ||
      hashParams.get("type") === "recovery";

    if (params.get("confirmed") === "1") {
      setStatus(status, "Email confirmed. You may now sign in.", "success");
    }

    client.auth.onAuthStateChange(function (event) {
      if (event === "PASSWORD_RECOVERY") {
        showPanel("recovery-panel");
        document.getElementById("auth-tabs").hidden = true;
      }
    });

    const sessionResult = await client.auth.getSession();
    if (sessionResult.data.session && !recoveryRequested) {
      window.location.replace("account.html");
      return;
    }

    if (recoveryRequested) {
      showPanel("recovery-panel");
      document.getElementById("auth-tabs").hidden = true;
    }

    const signinForm = document.getElementById("signin-form");
    signinForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setBusy(signinForm, true);
      setStatus(status, "Signing in…");

      const identifier = document.getElementById("signin-identifier").value;
      const password = document.getElementById("signin-password").value;
      const remember = document.getElementById("signin-remember").checked;

      if (window.PSDAuthStorage) {
        window.PSDAuthStorage.setRemembered(remember);
      }

      const result = await signInWithIdentifier(identifier, password);
      setBusy(signinForm, false);

      if (result.error) {
        setStatus(status, result.error.message, "error");
        return;
      }

      sessionStorage.setItem(
        "psd_show_remember_toast",
        remember ? "remembered" : "session"
      );
      window.location.replace("account.html");
    });

    const signupForm = document.getElementById("signup-form");
    signupForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setBusy(signupForm, true);
      setStatus(status, "Creating your account…");

      const username = normalizeUsername(
        document.getElementById("signup-username").value
      );
      const email = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value;

      const availability = await client.rpc("ms_username_available", {
        p_username: username
      });

      if (availability.error || availability.data !== true) {
        setBusy(signupForm, false);
        setStatus(status, "That username is unavailable. Please choose another.", "error");
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

      setBusy(signupForm, false);
      if (result.error) {
        setStatus(status, result.error.message, "error");
        return;
      }

      signupForm.reset();
      setStatus(status, "Account created. Check your email to confirm it.", "success");
    });

    document.getElementById("reset-request-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      const form = event.currentTarget;
      setBusy(form, true);
      setStatus(status, "Sending reset email…");

      const email = document.getElementById("reset-email").value.trim();
      const result = await client.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl("auth.html?recovery=1")
      });

      setBusy(form, false);
      if (result.error) {
        setStatus(status, result.error.message, "error");
        return;
      }

      form.reset();
      setStatus(status, "Password reset email sent.", "success");
    });

    document.getElementById("recovery-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      const form = event.currentTarget;
      setBusy(form, true);
      setStatus(status, "Updating password…");

      const password = document.getElementById("new-password").value;
      const result = await client.auth.updateUser({ password: password });

      setBusy(form, false);
      if (result.error) {
        setStatus(status, result.error.message, "error");
        return;
      }

      setStatus(status, "Password updated. Opening your account…", "success");
      window.setTimeout(function () {
        window.location.replace("account.html");
      }, 650);
    });
  }

  async function initAccountPage() {
    installPasswordToggles(document);

    const status = document.getElementById("account-status");
    const sessionResult = await client.auth.getSession();
    const session = sessionResult.data.session;

    if (!session) {
      window.location.replace("auth.html");
      return;
    }

    const user = session.user;
    document.getElementById("account-email").textContent =
      user.email || "Signed-in user";

    const toastState = sessionStorage.getItem("psd_show_remember_toast");
    if (toastState) {
      sessionStorage.removeItem("psd_show_remember_toast");
      showRememberToast(toastState === "remembered");
    }

    document.getElementById("signout-button").addEventListener("click", async function () {
      await client.auth.signOut();
      window.location.replace("index.html");
    });

    let defaultWatchlistId = null;

    async function loadData() {
      setStatus(status, "Loading your settings…");

      const results = await Promise.all([
        client.from("profiles")
          .select("username,timezone,locale")
          .eq("id", user.id)
          .single(),
        client.from("user_preferences")
          .select("default_timeframe,compact_mode")
          .eq("user_id", user.id)
          .single(),
        client.from("notification_preferences")
          .select("push_enabled,email_enabled,market_alerts,news_alerts")
          .eq("user_id", user.id)
          .single(),
        client.from("watchlists")
          .select("id,name,is_default")
          .eq("user_id", user.id)
          .eq("is_default", true)
          .limit(1)
          .maybeSingle(),
        client.from("account_deletion_requests")
          .select("id,status,scheduled_for")
          .eq("user_id", user.id)
          .in("status", ["pending", "processing"])
          .limit(1)
          .maybeSingle()
      ]);

      const firstError = results.find(function (result) {
        return result.error;
      });

      if (firstError) {
        setStatus(status, firstError.error.message, "error");
        return;
      }

      const profile = results[0].data || {};
      const preferences = results[1].data || {};
      const notifications = results[2].data || {};
      const watchlist = results[3].data;
      const deletion = results[4].data;

      document.getElementById("username").value = profile.username || "";
      populateTimezones(
        document.getElementById("timezone"),
        profile.timezone
      );
      document.getElementById("default-timeframe").value =
        preferences.default_timeframe || "daily";
      document.getElementById("compact-mode").checked =
        Boolean(preferences.compact_mode);
      document.getElementById("push-enabled").checked =
        notifications.push_enabled !== false;
      document.getElementById("email-enabled").checked =
        Boolean(notifications.email_enabled);
      document.getElementById("market-alerts").checked =
        notifications.market_alerts !== false;
      document.getElementById("news-alerts").checked =
        notifications.news_alerts !== false;

      defaultWatchlistId = watchlist ? watchlist.id : null;
      await loadWatchlistItems();
      renderDeletionStatus(deletion);
      setStatus(status, "Account loaded.", "success");
    }

    async function loadWatchlistItems() {
      const list = document.getElementById("watchlist-list");
      list.textContent = "";

      if (!defaultWatchlistId) {
        const created = await client.from("watchlists")
          .insert({
            user_id: user.id,
            name: "My Watchlist",
            is_default: true
          })
          .select("id")
          .single();

        if (created.error) {
          setStatus(status, created.error.message, "error");
          return;
        }
        defaultWatchlistId = created.data.id;
      }

      const result = await client.from("watchlist_items")
        .select("id,instrument,display_order")
        .eq("watchlist_id", defaultWatchlistId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (result.error) {
        setStatus(status, result.error.message, "error");
        return;
      }

      if (!result.data.length) {
        const empty = document.createElement("li");
        empty.className = "psd-help";
        empty.textContent = "Your watchlist is empty.";
        list.appendChild(empty);
        return;
      }

      result.data.forEach(function (item) {
        const row = document.createElement("li");
        row.className = "watchlist-item";

        const name = document.createElement("span");
        name.textContent = item.instrument;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "watchlist-remove";
        remove.textContent = "Remove";
        remove.addEventListener("click", async function () {
          const deletion = await client.from("watchlist_items")
            .delete()
            .eq("id", item.id)
            .eq("watchlist_id", defaultWatchlistId);

          if (deletion.error) {
            setStatus(status, deletion.error.message, "error");
            return;
          }

          await loadWatchlistItems();
          window.dispatchEvent(new CustomEvent("psd-preferences-updated"));
          setStatus(status, "Watchlist updated.", "success");
        });

        row.appendChild(name);
        row.appendChild(remove);
        list.appendChild(row);
      });
    }

    const usernameInput = document.getElementById("username");
    usernameInput.addEventListener("input", function () {
      usernameInput.value = normalizeUsername(usernameInput.value);
    });

    document.getElementById("profile-form").addEventListener("submit", async function (event) {
      event.preventDefault();

      const username = normalizeUsername(usernameInput.value);
      const currentProfile = await client.from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      if (
        !currentProfile.error &&
        currentProfile.data &&
        currentProfile.data.username !== username
      ) {
        const availability = await client.rpc("ms_username_available", {
          p_username: username
        });

        if (availability.error || availability.data !== true) {
          setStatus(status, "That username is unavailable.", "error");
          return;
        }
      }

      const result = await client.from("profiles")
        .update({
          username: username,
          display_name: username,
          timezone: document.getElementById("timezone").value || "UTC"
        })
        .eq("id", user.id);

      if (!result.error) {
        window.dispatchEvent(new CustomEvent("psd-profile-updated"));
      }

      setStatus(
        status,
        result.error ? result.error.message : "Profile saved.",
        result.error ? "error" : "success"
      );
    });

    document.getElementById("preferences-form").addEventListener("submit", async function (event) {
      event.preventDefault();

      const result = await client.from("user_preferences")
        .update({
          theme: "dark",
          default_timeframe: document.getElementById("default-timeframe").value,
          compact_mode: document.getElementById("compact-mode").checked
        })
        .eq("user_id", user.id);

      if (!result.error) {
        window.dispatchEvent(new CustomEvent("psd-preferences-updated"));
      }

      setStatus(
        status,
        result.error ? result.error.message : "Preferences saved.",
        result.error ? "error" : "success"
      );
    });

    document.getElementById("notification-form").addEventListener("submit", async function (event) {
      event.preventDefault();

      const result = await client.from("notification_preferences")
        .update({
          push_enabled: document.getElementById("push-enabled").checked,
          email_enabled: document.getElementById("email-enabled").checked,
          market_alerts: document.getElementById("market-alerts").checked,
          news_alerts: document.getElementById("news-alerts").checked,
          timezone: document.getElementById("timezone").value || "UTC"
        })
        .eq("user_id", user.id);

      setStatus(
        status,
        result.error ? result.error.message : "Notification settings saved.",
        result.error ? "error" : "success"
      );
    });

    document.getElementById("watchlist-form").addEventListener("submit", async function (event) {
      event.preventDefault();

      const input = document.getElementById("watchlist-instrument");
      const instrument = input.value.trim().toUpperCase();
      if (!instrument) return;

      const result = await client.from("watchlist_items")
        .insert({
          watchlist_id: defaultWatchlistId,
          instrument: instrument
        });

      if (result.error) {
        const message =
          result.error.code === "23505"
            ? "That instrument is already in your watchlist."
            : result.error.message;
        setStatus(status, message, "error");
        return;
      }

      input.value = "";
      await loadWatchlistItems();
      window.dispatchEvent(new CustomEvent("psd-preferences-updated"));
      setStatus(status, "Instrument added.", "success");
    });

    document.getElementById("password-form").addEventListener("submit", async function (event) {
      event.preventDefault();

      const form = event.currentTarget;
      const password = document.getElementById("account-new-password").value;
      setBusy(form, true);

      const result = await client.auth.updateUser({
        password: password
      });

      setBusy(form, false);

      if (!result.error) form.reset();

      setStatus(
        status,
        result.error ? result.error.message : "Password changed.",
        result.error ? "error" : "success"
      );
    });

    function renderDeletionStatus(deletion) {
      const requestButton = document.getElementById("request-delete-button");
      const cancelButton = document.getElementById("cancel-delete-button");
      const message = document.getElementById("deletion-status");

      if (deletion) {
        requestButton.classList.add("hidden");
        cancelButton.classList.remove("hidden");
        const date = deletion.scheduled_for
          ? new Date(deletion.scheduled_for).toLocaleString()
          : "soon";
        message.textContent =
          "Deletion is " + deletion.status + " and scheduled for " + date + ".";
      } else {
        requestButton.classList.remove("hidden");
        cancelButton.classList.add("hidden");
        message.textContent = "No deletion request is active.";
      }
    }

    document.getElementById("request-delete-button").addEventListener("click", async function () {
      const confirmed = window.confirm(
        "Request deletion of your account and personalized data?"
      );
      if (!confirmed) return;

      const result = await client.rpc("ms_request_account_deletion", {
        p_reason: null
      });

      if (result.error) {
        setStatus(status, result.error.message, "error");
        return;
      }

      const deletion = await client.from("account_deletion_requests")
        .select("id,status,scheduled_for")
        .eq("user_id", user.id)
        .in("status", ["pending", "processing"])
        .limit(1)
        .maybeSingle();

      renderDeletionStatus(deletion.data);
      setStatus(status, "Account deletion requested.", "success");
    });

    document.getElementById("cancel-delete-button").addEventListener("click", async function () {
      const result = await client.rpc("ms_cancel_account_deletion");

      if (result.error) {
        setStatus(status, result.error.message, "error");
        return;
      }

      renderDeletionStatus(null);
      setStatus(status, "Account deletion canceled.", "success");
    });

    await loadData();
  }

  if (isAuthPage) {
    initAuthPage().catch(function (error) {
      setStatus(
        document.getElementById("auth-status"),
        error.message,
        "error"
      );
    });
  }

  if (isAccountPage) {
    initAccountPage().catch(function (error) {
      setStatus(
        document.getElementById("account-status"),
        error.message,
        "error"
      );
    });
  }
})();
