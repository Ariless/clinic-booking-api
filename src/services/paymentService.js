const env = require("../config/env");

function charge({ paymentMethod }) {
  if (env.PAYMENT_MODE === "mock_fail") {
    return { success: false, errorCode: "CARD_DECLINED", message: "Your card was declined" };
  }
  return { success: true, transactionId: `mock_${Date.now()}_${paymentMethod}` };
}

module.exports = { charge };
