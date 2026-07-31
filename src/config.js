require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,

  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    appSecret: process.env.WHATSAPP_APP_SECRET,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0'
  },

  kacyberPay: {
    appId: process.env.KACYBERPAY_APP_ID,
    apiKey: process.env.KACYBERPAY_API_KEY
  },

 
  wifiVoucherApi: {
    merchantId: process.env.WIFI_VOUCHER_MERCHANT_ID || null,
    baseUrl:
      process.env.WIFI_VOUCHER_ENV === 'production'
        ? 'https://kacyberpay.com'
        : 'https://sandbox.kacyber.africa'
  },

 
  admin: {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD
  },

  business: {
    name: process.env.BUSINESS_NAME || 'UNIFI WiFi',
    supportPhone: process.env.SUPPORT_PHONE || '+256700000000',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com'
  },

  packages: [
    { id: '1', label: '3 Hours', productCode: 'WIFI_3H', durationHours: 3, price: 1000 },
    { id: '2', label: '16 Hours', productCode: 'WIFI_16H', durationHours: 16, price: 1500 },
    { id: '3', label: '1 Month', productCode: 'WIFI_30D', durationHours: 744, price: 28000 }
  ],

  // ── Preset airtime top-up amounts shown in the "Buy Airtime" list ──
  airtimeAmounts: [
    { id: 'airtime_500', amount: 500 },
    { id: 'airtime_1000', amount: 1000 },
    { id: 'airtime_2000', amount: 2000 },
    { id: 'airtime_5000', amount: 5000 },
    { id: 'airtime_10000', amount: 10000 }
  ],

  // ── Data bundle catalogue shown in the "Buy Data" list ──
  // network is resolved from the recipient's phone number at purchase time,
  // so bundles here aren't telco-specific.
  dataBundles: [
    { id: 'data_1', label: '100MB - Daily', quantity: 100, unit: 'MB', validity: 'Day', price: 500 },
    { id: 'data_2', label: '250MB - Daily', quantity: 250, unit: 'MB', validity: 'Day', price: 1000 },
    { id: 'data_3', label: '1GB - Daily', quantity: 1, unit: 'GB', validity: 'Day', price: 2500 },
    { id: 'data_4', label: '2GB - Weekly', quantity: 2, unit: 'GB', validity: 'Week', price: 6000 },
    { id: 'data_5', label: '5GB - Monthly', quantity: 5, unit: 'GB', validity: 'Month', price: 15000 }
  ],

  paymentTimeoutMs: 5 * 60 * 1000,
  sessionTtlMs: 5 * 60 * 1000
};
