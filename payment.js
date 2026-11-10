async function mockPayment(amount, orderId, fail = false) {
  await new Promise((r) => setTimeout(r, 300));
  if (fail) return { status: "failed" };
  return { status: "success", payment_id: "test_" + orderId + "_" + Date.now() };
}
module.exports = { mockPayment };
