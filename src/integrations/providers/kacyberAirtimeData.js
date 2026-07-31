const axios = require('axios');
const config = require('../../config');

const BASE_URL = 'https://kacyberpay.com/api/v1';

function headers() {
  return {
    'X-app-id': config.kacyberPay.appId,
    'X-API-Key': config.kacyberPay.apiKey,
    'Content-Type': 'application/json'
  };
}

async function sendAirtime({ externalReferenceID, msisdn, network, amount, currency = 'UGX' }) {
  const response = await axios.post(
    `${BASE_URL}/airtime/send`,
    {
      externalReferenceID,
      Currency: currency,
      recipients: [{ msisdn, network, amount }],
      maxNumRetry: 2
    },
    { headers: headers() }
  );
  return response.data;
}

async function getAirtimeStatus(reference) {
  const response = await axios.get(`${BASE_URL}/airtime/status`, {
    headers: headers(),
    params: { reference, includeDetails: true }
  });
  return response.data;
}

async function getDataProducts(telco) {
  const response = await axios.get(`${BASE_URL}/data-products`, {
    headers: headers(),
    params: telco ? { telco } : undefined
  });
  return response.data;
}

async function purchaseDataBundle({ externalReferenceID, msisdn, network, quantity, unit, validity, currency = 'UGX' }) {
  const response = await axios.post(
    `${BASE_URL}/data/bundles`,
    {
      externalReferenceID,
      Currency: currency,
      recipients: [{ msisdn, network, quantity, unit, validity }]
    },
    { headers: headers() }
  );
  return response.data;
}

async function getDataBundleStatus(reference) {
  const response = await axios.get(`${BASE_URL}/data/bundles/status`, {
    headers: headers(),
    params: { reference, includeDetails: true }
  });
  return response.data;
}

module.exports = {
  sendAirtime,
  getAirtimeStatus,
  getDataProducts,
  purchaseDataBundle,
  getDataBundleStatus
};
