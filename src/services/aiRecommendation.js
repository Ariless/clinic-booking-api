const doctorsRepository = require("../repositories/doctorsRepository");

const ALLOWED_SPECIALTIES = [
  "General Practitioner",
  "Cardiologist",
  "Neurologist",
  "Dermatologist",
  "Orthopedist",
  "Pediatrician",
];

function inferSpecialty(symptoms) {
  const s = (symptoms || "").toLowerCase();
  if (/chest|heart|cardio|pressure/.test(s)) {
    return "Cardiologist";
  }
  if (/skin|rash|dermat/.test(s)) {
    return "Dermatologist";
  }
  if (/headache|migraine|nerve|numb/.test(s)) {
    return "Neurologist";
  }
  if (/bone|joint|knee|back pain|ortho/.test(s)) {
    return "Orthopedist";
  }
  if (/child|kid|infant|pediatric/.test(s)) {
    return "Pediatrician";
  }
  if (/cold|flu|fever|checkup|general/.test(s)) {
    return "General Practitioner";
  }
  return null;
}

function recommendDoctors(symptoms) {
  const specialty = inferSpecialty(symptoms);
  if (!specialty || !ALLOWED_SPECIALTIES.includes(specialty)) {
    return { ok: false, reason: "unknown_specialty", specialty: specialty || "unknown" };
  }
  const doctors = doctorsRepository.getBySpecialty(specialty);
  return { ok: true, recommendedSpecialty: specialty, doctors };
}

module.exports = {
  recommendDoctors,
  ALLOWED_SPECIALTIES,
};
