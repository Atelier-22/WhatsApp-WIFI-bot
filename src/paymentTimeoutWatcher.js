const config = require('./config');
const messages = require('./messages');
const whatsappClient = require('./whatsappClient');
const { STATES, getSessionsByState, resetSession } = require('./sessionStore');

const SWEEP_INTERVAL_MS = 30 * 1000;

// ── Finds sessions stuck waiting on a payment past the timeout ──
// and sends the customer a heads-up instead of leaving them hanging.
async function sweep() {
  const stale = getSessionsByState(STATES.AWAITING_PAYMENT).filter(
    (session) => Date.now() - session.updatedAt > config.paymentTimeoutMs
  );

  for (const session of stale) {
    resetSession(session.userId);
    await whatsappClient.sendMessage(session.userId, messages.paymentTimeoutMessage());
  }
}

function start() {
  setInterval(sweep, SWEEP_INTERVAL_MS);
}

module.exports = { start };
