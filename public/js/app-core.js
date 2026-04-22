(function () {
  "use strict";

  const TOKEN_KEY = "clinic_demo_jwt";
  const REFRESH_KEY = "clinic_demo_refresh";
  const USER_KEY = "clinic_demo_user";

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function getRefreshToken() {
    return sessionStorage.getItem(REFRESH_KEY);
  }

  function getUser() {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  /**
   * @param {string} token
   * @param {object} user
   * @param {string} [refreshToken] — omit to leave stored refresh unchanged; pass empty string to clear
   */
  function setSession(token, user, refreshToken) {
    if (token && user) {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      clearSession();
      return;
    }
    if (refreshToken !== undefined) {
      if (refreshToken) {
        sessionStorage.setItem(REFRESH_KEY, refreshToken);
      } else {
        sessionStorage.removeItem(REFRESH_KEY);
      }
    }
  }

  async function tryRefresh() {
    const rt = getRefreshToken();
    if (!rt) {
      return false;
    }
    try {
      const res = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      });
      const text = await res.text();
      let body;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      if (!res.ok || !body || typeof body !== "object" || !body.token || !body.user) {
        clearSession();
        return false;
      }
      setSession(body.token, body.user, body.refreshToken);
      return true;
    } catch {
      clearSession();
      return false;
    }
  }

  function postLoginPath(user) {
    if (!user) {
      return "/";
    }
    if (user.role === "patient") {
      return "/patient";
    }
    if (user.role === "doctor") {
      return "/doctor";
    }
    return "/";
  }

  function safeNextFromSearch(searchString) {
    const raw = new URLSearchParams(searchString).get("next");
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
      return raw;
    }
    return null;
  }

  function resolveAfterLoginUrl(user, searchString) {
    const explicit = safeNextFromSearch(searchString);
    if (explicit) {
      return explicit;
    }
    return postLoginPath(user);
  }

  /** Blur focus if it sits inside `container` (avoids jump-to-top when that subtree is removed). */
  function blurActiveWithin(container) {
    if (!container) {
      return;
    }
    const ae = document.activeElement;
    if (ae && typeof ae.blur === "function" && container.contains(ae)) {
      ae.blur();
    }
  }

  /** Restore vertical scroll after list/DOM updates (call from `requestAnimationFrame` timing). */
  function restoreScrollY(prevY) {
    if (typeof prevY !== "number" || Number.isNaN(prevY)) {
      return;
    }
    window.requestAnimationFrame(() => {
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo(0, Math.min(Math.max(0, prevY), maxY));
    });
  }

  async function api(path, options = {}) {
    const { headers: optionHeaders, _skipRefresh, ...rest } = options;
    const headers = { Accept: "application/json", ...(optionHeaders || {}) };
    const t = getToken();
    if (t && !headers.Authorization) {
      headers.Authorization = `Bearer ${t}`;
    }
    const res = await fetch(path, {
      ...rest,
      headers,
    });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok && res.status === 401 && !_skipRefresh && getRefreshToken()) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        return api(path, { ...options, _skipRefresh: true });
      }
    }
    if (!res.ok) {
      const err = new Error(res.statusText);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  window.ClinicApp = {
    TOKEN_KEY,
    REFRESH_KEY,
    USER_KEY,
    getToken,
    getRefreshToken,
    getUser,
    setSession,
    clearSession,
    safeNextFromSearch,
    resolveAfterLoginUrl,
    tryRefresh,
    blurActiveWithin,
    restoreScrollY,
    api,
  };
})();
