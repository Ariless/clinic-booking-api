// Valid transitions: which statuses a given status can move to
const TRANSITIONS = {
  pending:   ["confirmed", "rejected", "cancelled"],
  confirmed: ["cancelled"],
  cancelled: [],
  rejected:  [],
};

function isValidTransition(fromStatus, toStatus) {
  return (TRANSITIONS[fromStatus] ?? []).includes(toStatus);
}

module.exports = { isValidTransition, TRANSITIONS };
