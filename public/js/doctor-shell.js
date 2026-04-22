(function () {
  "use strict";

  document.documentElement.dataset.workspace = "doctor";

  /**
   * Doctor workspace: only signed-in doctors. Patients and guests are sent away.
   * @returns {boolean} false if redirect was triggered
   */
  function guardDoctorWorkspace() {
    const u = window.ClinicApp.getUser();
    const t = window.ClinicApp.getToken();
    if (u && u.role === "patient") {
      window.location.replace("/patient");
      return false;
    }
    if (!t || !u || u.role !== "doctor") {
      const path = window.location.pathname + (window.location.search || "");
      window.location.replace("/login?next=" + encodeURIComponent(path || "/doctor"));
      return false;
    }
    return true;
  }

  function setActiveNav(active) {
    document.querySelectorAll("[data-doctor-nav]").forEach((a) => {
      const isActive = a.getAttribute("data-doctor-nav") === active;
      if (isActive) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }

  window.ClinicDoctorShell = {
    guardDoctorWorkspace,
    setActiveNav,
  };
})();
