const config = require('./config');

function formatCurrency(amount) {
  return `UGX ${amount.toLocaleString()}`;
}

function kampalaHour() {
  const now = new Date();
  return (now.getUTCHours() + 3) % 24;
}

function getTimeGreeting() {
  const hour = kampalaHour();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

function getDayNightClosing() {
  const hour = kampalaHour();
  if (hour >= 5 && hour < 19) return 'Have a great day!';
  return 'Have a great night!';
}

// ── Alternates the bot's introduced name between Peter and Phiona ──
// every time a new conversation starts (welcome message shown).
let lastBotName = 'Phiona';
function nextBotName() {
  lastBotName = lastBotName === 'Peter' ? 'Phiona' : 'Peter';
  return lastBotName;
}

// ── Message shape helpers ────────────────────────────────────────
function text(body) {
  return { kind: 'text', body };
}

function list({ header, body, footer, buttonText, sections }) {
  return { kind: 'list', header, body, footer, buttonText, sections };
}

function buttons(body, buttonList) {
  return { kind: 'buttons', body, buttons: buttonList };
}

// ── Shared row set for the main menu ─────────────────────────────
function mainMenuSections() {
  return [
    {
      rows: [
        { id: 'buy_voucher', title: 'Buy Voucher', description: 'Get a WiFi voucher' },
        { id: 'buy_airtime', title: 'Buy Airtime', description: 'Top up your airtime' },
        { id: 'buy_data', title: 'Buy Data', description: 'Get a data bundle' },
        { id: 'check_voucher', title: 'Check Voucher', description: 'Look up an active voucher' },
        { id: 'contact_support', title: 'Contact Support', description: 'Reach our support team' }
      ]
    }
  ];
}

function welcomeMessage() {
  const botName = nextBotName();
  return list({
    header: config.business.name,
    body: `${getTimeGreeting()}! I'm ${botName}, your KaCyber E-Assistant.\n\nHow can I help you?`,
    buttonText: 'Select',
    sections: mainMenuSections()
  });
}

function invalidMenuMessage() {
  return list({
    header: config.business.name,
    body: `That's not a valid option. Please choose from the menu below.`,
    buttonText: 'Select',
    sections: mainMenuSections()
  });
}

// ── Shared row set for package selection ─────────────────────────
function packageSections() {
  return [
    {
      rows: [
        ...config.packages.map((pkg) => ({
          id: pkg.id,
          title: pkg.label,
          description: formatCurrency(pkg.price)
        })),
        { id: 'cancel', title: 'Cancel', description: 'Stop and come back later' }
      ]
    }
  ];
}

function packageListMessage() {
  return list({
    header: 'Choose a Package',
    body: 'Select a WiFi voucher package:',
    buttonText: 'Select',
    sections: packageSections()
  });
}

function invalidPackageMessage() {
  return list({
    header: 'Choose a Package',
    body: `That package doesn't exist. Please choose from the list below.`,
    buttonText: 'Select',
    sections: packageSections()
  });
}

// ── Shared row set for airtime amount selection ───────────────────
function airtimeAmountSections() {
  return [
    {
      rows: [
        ...config.airtimeAmounts.map((preset) => ({
          id: preset.id,
          title: formatCurrency(preset.amount),
          description: 'Airtime top-up'
        })),
        { id: 'cancel', title: 'Cancel', description: 'Stop and come back later' }
      ]
    }
  ];
}

function airtimeAmountMessage() {
  return list({
    header: 'Buy Airtime',
    body: 'Select an airtime amount:',
    buttonText: 'Select',
    sections: airtimeAmountSections()
  });
}

function invalidAirtimeAmountMessage() {
  return list({
    header: 'Buy Airtime',
    body: `That's not a valid amount. Please choose from the list below.`,
    buttonText: 'Select',
    sections: airtimeAmountSections()
  });
}

// ── Shared row set for data bundle selection ──────────────────────
function dataBundleSections() {
  return [
    {
      rows: [
        ...config.dataBundles.map((bundle) => ({
          id: bundle.id,
          title: bundle.label,
          description: formatCurrency(bundle.price)
        })),
        { id: 'cancel', title: 'Cancel', description: 'Stop and come back later' }
      ]
    }
  ];
}

function dataBundleMessage() {
  return list({
    header: 'Buy Data',
    body: 'Select a data bundle:',
    buttonText: 'Select',
    sections: dataBundleSections()
  });
}

function invalidDataBundleMessage() {
  return list({
    header: 'Buy Data',
    body: `That bundle doesn't exist. Please choose from the list below.`,
    buttonText: 'Select',
    sections: dataBundleSections()
  });
}

function selectNumberMessage(ownNumberDisplay) {
  return buttons(
    `Which number would you like to pay with?\n\nYour number: ${ownNumberDisplay}`,
    [
      { id: 'use_own_number', title: 'Use your number' },
      { id: 'use_different_number', title: 'Different number' },
      { id: 'cancel', title: 'Cancel' }
    ]
  );
}

function invalidSelectNumberMessage(ownNumberDisplay) {
  return buttons(
    `Please choose one of the options below.\n\nYour number: ${ownNumberDisplay}`,
    [
      { id: 'use_own_number', title: 'Use your number' },
      { id: 'use_different_number', title: 'Different number' },
      { id: 'cancel', title: 'Cancel' }
    ]
  );
}

function askPhoneNumberMessage() {
  return buttons(
    `Please type the Mobile Money number to pay with (e.g. 0771234567).`,
    [{ id: 'cancel', title: 'Cancel' }]
  );
}

function invalidPhoneMessage() {
  return buttons(
    `That doesn't look like a valid phone number. Please type it again (e.g. 0771234567).`,
    [{ id: 'cancel', title: 'Cancel' }]
  );
}

function paymentRequestSentMessage(product, phoneNumberDisplay) {
  return text(
    `A payment request of ${formatCurrency(product.price)} has been sent to ${phoneNumberDisplay}.\n\n` +
    `Reply YES on your phone to authorize the payment.`
  );
}

function paymentReceivedMessage(product, phoneNumberDisplay, amount) {
  return text(
    `Payment received.\n\n` +
    `Purchase: ${product.label}\n` +
    `Number: ${phoneNumberDisplay}\n` +
    `Amount paid: ${formatCurrency(amount)}\n\n` +
    `You'll get a confirmation message here shortly once it's delivered.`
  );
}

function paymentPendingMessage() {
  return text(`Still waiting for payment confirmation. This can take a minute.`);
}

function paymentFailedMessage() {
  return buttons(
    `Payment was not completed.`,
    [
      { id: 'main_menu', title: 'Try Again' },
      { id: 'contact_support', title: 'Support' }
    ]
  );
}

// ── Generic "payment succeeded but delivery failed" message ──
// Used for vouchers, airtime, and data alike — the wording stays
// deliberately product-agnostic since it's shown across all three flows.
function productUnavailableMessage() {
  return buttons(
    `Your payment was received, but we couldn't complete the delivery right now. Please contact support so we can sort this out for you.`,
    [{ id: 'contact_support', title: 'Support' }]
  );
}

// Kept for compatibility with existing voucher-specific call sites.
function voucherUnavailableMessage() {
  return productUnavailableMessage();
}

function paymentTimeoutMessage() {
  return buttons(
    `We didn't receive payment confirmation in time.`,
    [{ id: 'main_menu', title: 'Try Again' }]
  );
}

function voucherDeliveredMessage(voucher, pkg) {
  return text(
    `Your Voucher\n\n` +
    `Username: ${voucher.username}\n` +
    `Password: ${voucher.password}\n\n` +
    `Valid for: ${pkg.label}\n\n` +
    `Thank you for working with KaCyber Technologies. ${getDayNightClosing()}`
  );
}

function airtimeDeliveredMessage(amount, phoneNumberDisplay) {
  return text(
    `Airtime Delivered\n\n` +
    `${formatCurrency(amount)} airtime has been sent to ${phoneNumberDisplay}.\n\n` +
    `Thank you for working with KaCyber Technologies. ${getDayNightClosing()}`
  );
}

function dataDeliveredMessage(bundle, phoneNumberDisplay) {
  return text(
    `Data Bundle Delivered\n\n` +
    `${bundle.label} has been activated on ${phoneNumberDisplay}.\n\n` +
    `Thank you for working with KaCyber Technologies. ${getDayNightClosing()}`
  );
}

function askLookupPhoneMessage() {
  return buttons(
    `Please type the phone number used for your purchase.`,
    [{ id: 'cancel', title: 'Cancel' }]
  );
}

function selectLookupNumberMessage(ownNumberDisplay) {
  return buttons(
    `Which number was used to receive the voucher?\n\nYour WhatsApp number: ${ownNumberDisplay}`,
    [
      { id: 'lookup_own_number', title: 'My number' },
      { id: 'lookup_different_number', title: 'Different number' },
      { id: 'cancel', title: 'Cancel' }
    ]
  );
}

function noVoucherFoundMessage() {
  return buttons(
    `We couldn't find an active voucher for that number.`,
    [{ id: 'buy_voucher', title: 'Buy Voucher' }]
  );
}

function voucherLookupResultMessage(voucher, pkg) {
  return text(
    `Here is your active voucher\n\n` +
    `Username: ${voucher.username}\n` +
    `Password: ${voucher.password}\n\n` +
    `Package: ${pkg.label}\n` +
    `Expires: ${new Date(voucher.expiresAt).toLocaleString()}`
  );
}

function supportMessage() {
  return buttons(
    `You can reach us at:\n\nPhone: ${config.business.supportPhone}\nEmail: ${config.business.supportEmail}`,
    [{ id: 'main_menu', title: 'Main Menu' }]
  );
}

function cancelledMessage() {
  return text(`Thank you for using KaCyber's E-Assistant services. We hope to see you soon!`);
}

function sessionExpiredMessage() {
  return text(`Your session has expired. Type "Hello" to start again.`);
}

function fallbackMessage() {
  return text(`Sorry, I didn't understand that. Type "Hello" to see the menu.`);
}

module.exports = {
  formatCurrency,
  getTimeGreeting,
  getDayNightClosing,
  welcomeMessage,
  invalidMenuMessage,
  packageListMessage,
  invalidPackageMessage,
  airtimeAmountMessage,
  invalidAirtimeAmountMessage,
  dataBundleMessage,
  invalidDataBundleMessage,
  selectNumberMessage,
  invalidSelectNumberMessage,
  askPhoneNumberMessage,
  invalidPhoneMessage,
  paymentRequestSentMessage,
  paymentReceivedMessage,
  paymentPendingMessage,
  paymentFailedMessage,
  productUnavailableMessage,
  voucherUnavailableMessage,
  paymentTimeoutMessage,
  voucherDeliveredMessage,
  airtimeDeliveredMessage,
  dataDeliveredMessage,
  askLookupPhoneMessage,
  selectLookupNumberMessage,
  noVoucherFoundMessage,
  voucherLookupResultMessage,
  supportMessage,
  cancelledMessage,
  sessionExpiredMessage,
  fallbackMessage
};
