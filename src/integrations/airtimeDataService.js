const provider = require('./providers/kacyberAirtimeData');

// ── Sends airtime after a MoMo collection has already succeeded ──
// Throws on failure so the caller can tell the customer support is needed
// (their money was captured but delivery failed — this must not be silently swallowed).
async function sendAirtimeTopUp(phoneNumber, amount, meta = {}) {
  const externalReferenceID = meta.transactionId || `AT-${Date.now()}`;
  const network = apiNetworkFor(meta.network);

  if (!network) {
    throw new Error(`Cannot send airtime to ${phoneNumber} — unrecognized network.`);
  }

  let result;
  try {
    result = await provider.sendAirtime({
      externalReferenceID,
      msisdn: phoneNumber,
      network,
      amount
    });
  } catch (error) {
    const details = error.response ? error.response.data : error.message;
    console.error(`Airtime send failed for ${externalReferenceID} (${phoneNumber}, UGX ${amount})`, details);
    throw error;
  }

  if (!result || result.success === false || result.status === 'FAILED') {
    console.error(`Airtime send returned a non-success result for ${externalReferenceID}`, result);
    throw new Error('Airtime provider reported failure');
  }

  return {
    kacyberReference: result.kacyberReference,
    status: result.status,
    amount
  };
}

// ── Purchases a data bundle after a MoMo collection has already succeeded ──
async function purchaseData(phoneNumber, bundle, meta = {}) {
  const externalReferenceID = meta.transactionId || `DB-${Date.now()}`;
  const network = apiNetworkFor(meta.network);

  if (!network) {
    throw new Error(`Cannot purchase a data bundle for ${phoneNumber} — unrecognized network.`);
  }

  let result;
  try {
    result = await provider.purchaseDataBundle({
      externalReferenceID,
      msisdn: phoneNumber,
      network,
      quantity: bundle.quantity,
      unit: bundle.unit,
      validity: bundle.validity
    });
  } catch (error) {
    const details = error.response ? error.response.data : error.message;
    console.error(`Data bundle purchase failed for ${externalReferenceID} (${phoneNumber}, ${bundle.label})`, details);
    throw error;
  }

  if (!result || result.success === false || result.status === 'FAILED') {
    console.error(`Data bundle purchase returned a non-success result for ${externalReferenceID}`, result);
    throw new Error('Data bundle provider reported failure');
  }

  return {
    kacyberReference: result.kacyberReference,
    status: result.status,
    bundle
  };
}

// ── KaCyber expects 'MTN' or 'AIRTEL' — our internal validators use 'MTN' / 'Airtel' ──
function apiNetworkFor(network) {
  if (network === 'MTN') return 'MTN';
  if (network === 'Airtel') return 'AIRTEL';
  return null;
}

module.exports = {
  sendAirtimeTopUp,
  purchaseData
};
