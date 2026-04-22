(function () {
  "use strict";

  function syncLoginHref(loginNavEl) {
    if (!loginNavEl) {
      return;
    }
    const next = window.location.pathname + (window.location.search || "");
    loginNavEl.href = "/login?next=" + encodeURIComponent(next || "/");
  }

  /** Home hub only: hide the other role’s card when signed in; guests don’t see the clinician card. */
  function applyHubWorkspaceCards() {
    const u = window.ClinicApp.getUser();
    document.querySelectorAll("[data-hub-workspace]").forEach((el) => {
      const ws = el.getAttribute("data-hub-workspace");
      let hide = false;
      if (!u && ws === "doctor") {
        hide = true;
      }
      if (u && u.role === "patient" && ws === "doctor") {
        hide = true;
      }
      if (u && u.role === "doctor" && ws === "patient") {
        hide = true;
      }
      el.hidden = hide;
    });
  }

  function refresh() {
    const navAuth = document.getElementById("navAuth");
    const loginNav = document.getElementById("loginNav");
    const logoutBtn = document.getElementById("logoutBtn");
    if (!navAuth || !loginNav || !logoutBtn) {
      return;
    }
    syncLoginHref(loginNav);
    const u = window.ClinicApp.getUser();
    if (u) {
      navAuth.textContent = `${u.email} · ${u.role}`;
      loginNav.style.display = "none";
      logoutBtn.style.display = "inline-block";
    } else {
      navAuth.textContent = "";
      loginNav.style.display = "inline";
      logoutBtn.style.display = "none";
    }
    applyHubWorkspaceCards();
  }

  function bindLogout(onAfterLogout) {
    const logoutBtn = document.getElementById("logoutBtn");
    if (!logoutBtn) {
      return;
    }
    logoutBtn.addEventListener("click", () => {
      window.ClinicApp.clearSession();
      const path = window.location.pathname + (window.location.search || "");
      if (typeof onAfterLogout === "function") {
        onAfterLogout();
      }
      if (path.startsWith("/login")) {
        window.location.assign("/login");
        return;
      }
      window.location.assign("/login?next=" + encodeURIComponent(path || "/"));
    });
  }

  window.ClinicNav = {
    refresh,
    bindLogout,
  };
})();
