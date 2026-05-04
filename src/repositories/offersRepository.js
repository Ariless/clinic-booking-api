const db = require("../db/connection");
const { promoteFromWaitlist } = require("./appointmentsRepository");

function makeError(message, status, errorCode) {
  const err = new Error(message);
  err.status = status;
  err.errorCode = errorCode;
  return err;
}

function getPendingOffersForPatient(patientId) {
  return db
    .prepare(
      `SELECT o.*, s.startTime, s.endTime, d.name AS doctorName, d.specialty AS doctorSpecialty
       FROM waitlist_offers o
       INNER JOIN slots s ON s.id = o.slotId
       INNER JOIN doctors d ON d.id = s.doctorId
       WHERE o.patientId = ? AND o.status = 'pending'
       ORDER BY o.createdAt ASC`
    )
    .all(patientId);
}

function acceptOffer({ offerId, patientId }) {
  return db.transaction(() => {
    const offer = db.prepare("SELECT * FROM waitlist_offers WHERE id = ?").get(offerId);
    if (!offer) throw makeError("Offer not found", 404, "OFFER_NOT_FOUND");
    if (offer.patientId !== patientId) throw makeError("Forbidden", 403, "FORBIDDEN");
    if (offer.status !== "pending") throw makeError("Offer already resolved", 409, "OFFER_ALREADY_RESOLVED");
    if (new Date(offer.expiresAt) < new Date()) {
      db.prepare("UPDATE waitlist_offers SET status = 'expired', updatedAt = ? WHERE id = ?")
        .run(new Date().toISOString(), offerId);
      throw makeError("Offer has expired", 410, "OFFER_EXPIRED");
    }

    const now = new Date().toISOString();

    // Cancel existing appointment and free its slot
    if (offer.existingAppointmentId) {
      const existing = db.prepare("SELECT * FROM appointments WHERE id = ?").get(offer.existingAppointmentId);
      if (existing && ["pending", "confirmed"].includes(existing.status)) {
        db.prepare("UPDATE appointments SET status = 'cancelled', updatedAt = ? WHERE id = ?")
          .run(now, offer.existingAppointmentId);
        db.prepare("UPDATE slots SET isAvailable = 1 WHERE id = ?").run(existing.slotId);
      }
    }

    // Create new appointment on the offered slot
    db.prepare(
      "INSERT INTO appointments (slotId, patientId, status, createdAt, updatedAt, deletedAt) VALUES (?, ?, 'pending', ?, ?, ?)"
    ).run(offer.slotId, patientId, now, now, null);
    db.prepare("UPDATE slots SET isAvailable = 0 WHERE id = ?").run(offer.slotId);

    // Remove waitlist entry for this doctor
    db.prepare(
      "DELETE FROM slot_waitlist WHERE patientId = ? AND doctorId = (SELECT doctorId FROM slots WHERE id = ?)"
    ).run(patientId, offer.slotId);

    // Mark offer accepted
    db.prepare("UPDATE waitlist_offers SET status = 'accepted', updatedAt = ? WHERE id = ?")
      .run(now, offerId);

    return db.prepare("SELECT * FROM waitlist_offers WHERE id = ?").get(offerId);
  })();
}

function declineOffer({ offerId, patientId }) {
  return db.transaction(() => {
    const offer = db.prepare("SELECT * FROM waitlist_offers WHERE id = ?").get(offerId);
    if (!offer) throw makeError("Offer not found", 404, "OFFER_NOT_FOUND");
    if (offer.patientId !== patientId) throw makeError("Forbidden", 403, "FORBIDDEN");
    if (offer.status !== "pending") throw makeError("Offer already resolved", 409, "OFFER_ALREADY_RESOLVED");

    const now = new Date().toISOString();

    // Mark declined — patient stays on waitlist
    db.prepare("UPDATE waitlist_offers SET status = 'declined', updatedAt = ? WHERE id = ?")
      .run(now, offerId);

    // Free the held slot
    db.prepare("UPDATE slots SET isAvailable = 1 WHERE id = ?").run(offer.slotId);

    // Try next eligible patient for this slot
    promoteFromWaitlist(offer.slotId, now);

    return { offerId, status: "declined" };
  })();
}

module.exports = { getPendingOffersForPatient, acceptOffer, declineOffer };
