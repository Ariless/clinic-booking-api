(function () {
  "use strict";

  /**
   * @param {Array<{id?:number,name?:string,specialty?:string}>} doctors
   * @returns {string[]}
   */
  function listSpecialties(doctors) {
    const set = new Set();
    for (const d of doctors || []) {
      if (d && d.specialty != null && String(d.specialty).trim()) {
        set.add(String(d.specialty).trim());
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  /**
   * @param {Array<{id?:number,name?:string,specialty?:string}>} doctors
   * @param {string} specialty
   */
  function doctorsForSpecialty(doctors, specialty) {
    if (!specialty) {
      return [];
    }
    return (doctors || [])
      .filter((d) => d && String(d.specialty) === specialty)
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
  }

  /**
   * @param {Array<{id?:number,name?:string,specialty?:string}>} doctors
   * @param {number|string} id
   */
  function findDoctorById(doctors, id) {
    const n = Number(id);
    if (!Number.isInteger(n) || n < 1) {
      return null;
    }
    return (doctors || []).find((d) => Number(d.id) === n) || null;
  }

  window.ClinicDirectoryBySpecialty = {
    listSpecialties,
    doctorsForSpecialty,
    findDoctorById,
  };
})();
