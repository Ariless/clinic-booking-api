(function () {
  "use strict";

  document.documentElement.dataset.workspace = "patient";

  /**
   * Doctor accounts must not stay on patient pages.
   * @returns {boolean} false if redirect was triggered
   */
  function guardDoctorRedirect() {
    const u = window.ClinicApp.getUser();
    if (u && u.role === "doctor") {
      window.location.replace("/doctor");
      return false;
    }
    return true;
  }

  function setActiveNav(active) {
    document.querySelectorAll("[data-patient-nav]").forEach((a) => {
      const isActive = a.getAttribute("data-patient-nav") === active;
      if (isActive) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }

  window.ClinicPatientShell = {
    guardDoctorRedirect,
    setActiveNav,
  };
})();
