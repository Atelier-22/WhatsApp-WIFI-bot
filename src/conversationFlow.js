const config = require('./config');
const messages = require('./messages');
const validators = require('./validators');
const { STATES, getSession, updateSession, resetSession, findSessionByTransactionId } = require('./sessionStore');
const paymentService = require('./integrations/paymentService');
const voucherService = require('./integrations/voucherService');
const airtimeDataService = require('./integrations/airtimeDataService');

const RESTART_KEYWORDS = ['hello'];
const CANCEL_KEYWORD = 'cancel';

function getPackageById(id) {
  return config.packages.find((pkg) => pkg.id === id);
}

function getAirtimeAmountById(id) {
  return config.airtimeAmounts.find((preset) => preset.id === id);
}

function getDataBundleById(id) {
  return config.dataBundles.find((bundle) => bundle.id === id);
}

// ── Resolves { price, label } for whichever product the session is buying ──
// so the shared select-number / payment / confirmation steps don't need to
// know whether they're handling a voucher, airtime, or a data bundle.
function getProductInfo(session) {
  const { productType } = session.data;

  if (productType === 'airtime') {
    return { price: session.data.amount, label: `Airtime Top-Up (${messages.formatCurrency(session.data.amount)})` };
  }

  if (productType === 'data') {
    const bundle = getDataBundleById(session.data.bundleId);
    return { price: bundle.price, label: bundle.label };
  }

  const pkg = getPackageById(session.data.packageId);
  return { price: pkg.price, label: pkg.label };
}

async function handleIncomingMessage(userId, rawInput) {
  const input = (rawInput || '').trim();
  const lower = input.toLowerCase();

  if (RESTART_KEYWORDS.includes(lower)) {
    resetSession(userId);
    return [messages.welcomeMessage()];
  }

  const session = getSession(userId);

  if (lower === CANCEL_KEYWORD && session.state !== STATES.AWAITING_PAYMENT) {
    resetSession(userId);
    return [messages.cancelledMessage()];
  }

  switch (session.state) {
    case STATES.MAIN_MENU:
      return handleMainMenu(userId, input);

    case STATES.SELECT_PACKAGE:
      return handlePackageSelection(userId, input);

    case STATES.SELECT_AIRTIME_AMOUNT:
      return handleAirtimeAmountSelection(userId, input);

    case STATES.SELECT_DATA_BUNDLE:
      return handleDataBundleSelection(userId, input);

    case STATES.SELECT_NUMBER:
      return handleSelectNumber(userId, input);

    case STATES.ENTER_PHONE:
      return handlePhoneEntry(userId, input);

    case STATES.AWAITING_PAYMENT:
      return handleAwaitingPayment(userId, input);

    case STATES.LOOKUP_ENTER_PHONE:
      return handleLookupPhoneEntry(userId, input);

    case STATES.LOOKUP_SELECT_NUMBER:
      return handleLookupNumberSelection(userId, input);

    case STATES.SUPPORT:
      return handleSupportState(userId, input);

    default:
      resetSession(userId);
      return [messages.welcomeMessage()];
  }
}

function handleMainMenu(userId, input) {
  if (input === 'main_menu') {
    return [messages.welcomeMessage()];
  }

  const options = ['buy_voucher', 'buy_airtime', 'buy_data', 'check_voucher', 'contact_support'];
  if (!validators.isValidMenuSelection(input, options)) {
    return [messages.invalidMenuMessage()];
  }

  if (input === 'buy_voucher') {
    updateSession(userId, { state: STATES.SELECT_PACKAGE, data: { productType: 'voucher' } });
    return [messages.packageListMessage()];
  }

  if (input === 'buy_airtime') {
    updateSession(userId, { state: STATES.SELECT_AIRTIME_AMOUNT, data: { productType: 'airtime' } });
    return [messages.airtimeAmountMessage()];
  }

  if (input === 'buy_data') {
    updateSession(userId, { state: STATES.SELECT_DATA_BUNDLE, data: { productType: 'data' } });
    return [messages.dataBundleMessage()];
  }

  if (input === 'check_voucher') {
    updateSession(userId, { state: STATES.LOOKUP_SELECT_NUMBER });
    return [messages.selectLookupNumberMessage(validators.formatPhoneForDisplay(userId))];
  }

  updateSession(userId, { state: STATES.SUPPORT });
  return [messages.supportMessage()];
}

async function handleLookupNumberSelection(userId, input) {
  if (input === 'lookup_own_number') {
    return lookupVoucher(userId, userId);
  }
  if (input === 'lookup_different_number') {
    updateSession(userId, { state: STATES.LOOKUP_ENTER_PHONE });
    return [messages.askLookupPhoneMessage()];
  }
  return [messages.selectLookupNumberMessage(validators.formatPhoneForDisplay(userId))];
}

function handlePackageSelection(userId, input) {
  if (!validators.isValidPackageSelection(input, config.packages)) {
    return [messages.invalidPackageMessage()];
  }
  const pkg = getPackageById(input.trim());
  updateSession(userId, {
    state: STATES.SELECT_NUMBER,
    data: { packageId: pkg.id }
  });
  const ownNumberDisplay = validators.formatPhoneForDisplay(userId);
  return [messages.selectNumberMessage(ownNumberDisplay)];
}

function handleAirtimeAmountSelection(userId, input) {
  const preset = getAirtimeAmountById(input.trim());
  if (!preset) {
    return [messages.invalidAirtimeAmountMessage()];
  }
  updateSession(userId, {
    state: STATES.SELECT_NUMBER,
    data: { amount: preset.amount }
  });
  const ownNumberDisplay = validators.formatPhoneForDisplay(userId);
  return [messages.selectNumberMessage(ownNumberDisplay)];
}

function handleDataBundleSelection(userId, input) {
  const bundle = getDataBundleById(input.trim());
  if (!bundle) {
    return [messages.invalidDataBundleMessage()];
  }
  updateSession(userId, {
    state: STATES.SELECT_NUMBER,
    data: { bundleId: bundle.id }
  });
  const ownNumberDisplay = validators.formatPhoneForDisplay(userId);
  return [messages.selectNumberMessage(ownNumberDisplay)];
}

function handleSelectNumber(userId, input) {
  const options = ['use_own_number', 'use_different_number'];
  const ownNumberDisplay = validators.formatPhoneForDisplay(userId);

  if (!validators.isValidMenuSelection(input, options)) {
    return [messages.invalidSelectNumberMessage(ownNumberDisplay)];
  }

  if (input === 'use_own_number') {
    return startPayment(userId, userId);
  }

  updateSession(userId, { state: STATES.ENTER_PHONE });
  return [messages.askPhoneNumberMessage()];
}

async function handlePhoneEntry(userId, input) {
  if (!validators.isValidPhoneNumber(input)) {
    return [messages.invalidPhoneMessage()];
  }
  const phoneNumber = validators.normalizePhoneNumber(input);
  return startPayment(userId, phoneNumber);
}

async function startPayment(userId, phoneNumber) {
  const session = getSession(userId);
  const productType = session.data.productType || 'voucher';
  const product = getProductInfo(session);
  const network = validators.detectNetwork(phoneNumber);
  const phoneDisplay = validators.formatPhoneForDisplay(phoneNumber);

  const { transactionId } = await paymentService.initiatePayment(phoneNumber, product.price, {
    packageId: productType === 'voucher' ? session.data.packageId : undefined,
    packageLabel: product.label,
    network
  });

  updateSession(userId, {
    state: STATES.AWAITING_PAYMENT,
    data: { phoneNumber, transactionId }
  });

  return [messages.paymentRequestSentMessage(product, phoneDisplay)];
}

// ── Delivers the purchased product once payment has been confirmed ──
// Shared by the polling path (handleAwaitingPayment) and the async
// payment-callback webhook (deliverVoucherOnPaymentSuccess).
async function deliverProduct(session) {
  const { transactionId, phoneNumber, productType } = session.data;
  const network = validators.detectNetwork(phoneNumber);
  const phoneDisplay = validators.formatPhoneForDisplay(phoneNumber);
  const product = getProductInfo(session);

  if (productType === 'data') {
    const bundle = getDataBundleById(session.data.bundleId);
    await airtimeDataService.purchaseData(phoneNumber, bundle, { transactionId, network });
    return [
      messages.paymentReceivedMessage(product, phoneDisplay, product.price),
      messages.dataDeliveredMessage(bundle, phoneDisplay)
    ];
  }

  if (productType === 'airtime') {
    await airtimeDataService.sendAirtimeTopUp(phoneNumber, session.data.amount, { transactionId, network });
    return [
      messages.paymentReceivedMessage(product, phoneDisplay, product.price),
      messages.airtimeDeliveredMessage(session.data.amount, phoneDisplay)
    ];
  }

  const pkg = getPackageById(session.data.packageId);
  const voucher = await voucherService.issueVoucher(phoneNumber, pkg, { transactionId });
  paymentService.attachVoucher(transactionId, voucher);
  return [
    messages.paymentReceivedMessage(product, phoneDisplay, product.price),
    messages.voucherDeliveredMessage(voucher, pkg)
  ];
}

async function handleAwaitingPayment(userId, input) {
  const session = getSession(userId);
  const { transactionId } = session.data;
  const { status } = await paymentService.getPaymentStatus(transactionId);

  if (status === 'SUCCESS') {
    let reply;
    try {
      reply = await deliverProduct(session);
    } catch (error) {
      console.error('Product delivery failed', error.message);
      resetSession(userId);
      return [messages.productUnavailableMessage()];
    }
    resetSession(userId);
    return reply;
  }

  if (status === 'FAILED') {
    resetSession(userId);
    return [messages.paymentFailedMessage()];
  }

  return [messages.paymentPendingMessage()];
}

async function handleLookupPhoneEntry(userId, input) {
  if (!validators.isValidPhoneNumber(input)) {
    return [messages.invalidPhoneMessage()];
  }
  return lookupVoucher(userId, validators.normalizePhoneNumber(input));
}

async function lookupVoucher(userId, phoneNumber) {
  const voucher = await voucherService.getActiveVoucher(phoneNumber);
  resetSession(userId);
  if (!voucher) return [messages.noVoucherFoundMessage()];
  return [messages.voucherLookupResultMessage(voucher, getPackageById(voucher.packageId))];
}

function handleSupportState(userId, input) {
  if (input === 'main_menu') {
    resetSession(userId);
    return [messages.welcomeMessage()];
  }
  return [messages.supportMessage()];
}

// ── Called from the /payment-callback webhook when KaCyberPay confirms ──
// a MoMo collection asynchronously (as opposed to the customer polling
// by tapping a reply while sat in AWAITING_PAYMENT).
async function deliverVoucherOnPaymentSuccess(transactionId) {
  const session = findSessionByTransactionId(transactionId);
  if (!session) {
    return null;
  }

  let reply;
  try {
    reply = await deliverProduct(session);
  } catch (error) {
    console.error('Product delivery failed', error.message);
    resetSession(session.userId);
    return { userId: session.userId, message: [messages.productUnavailableMessage()] };
  }
  resetSession(session.userId);
  return { userId: session.userId, message: reply };
}

module.exports = {
  handleIncomingMessage,
  deliverVoucherOnPaymentSuccess
};
