const SEEN_TTL_MS = 10 * 60 * 1000;
const seenMessageIds = new Map();

// ── Returns true the first time a message ID is seen, false on repeats ──
// Meta retries webhook deliveries that don't get a fast 200 response,
// so the same message can arrive more than once.
function isFirstDelivery(messageId) {
  if (!messageId) {
    return true;
  }

  const now = Date.now();
  cleanup(now);

  if (seenMessageIds.has(messageId)) {
    return false;
  }

  seenMessageIds.set(messageId, now);
  return true;
}

function cleanup(now) {
  for (const [id, seenAt] of seenMessageIds) {
    if (now - seenAt > SEEN_TTL_MS) {
      seenMessageIds.delete(id);
    }
  }
}

module.exports = {
  isFirstDelivery
};
