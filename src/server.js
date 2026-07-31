const express = require('express');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const whatsappClient = require('./whatsappClient');
const conversationFlow = require('./conversationFlow');
const paymentService = require('./integrations/paymentService');
const voucherService = require('./integrations/voucherService');
const webhookSecurity = require('./webhookSecurity');
const dedupeStore = require('./dedupeStore');
const { requireAdminAuth } = require('./authMiddleware');
const paymentTimeoutWatcher = require('./paymentTimeoutWatcher');

const app = express();
app.use(cors());

app.use(express.json({ verify: webhookSecurity.captureRawBody }));

app.use('/admin', requireAdminAuth, express.static(path.join(__dirname, '..', 'admin-dashboard')));
app.use('/api', requireAdminAuth);

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

function extractIncomingValue(message) {
  if (!message) {
    return null;
  }
  if (message.type === 'text') {
    return message.text.body;
  }
  if (message.type === 'interactive') {
    if (message.interactive.type === 'list_reply') {
      return message.interactive.list_reply.id;
    }
    if (message.interactive.type === 'button_reply') {
      return message.interactive.button_reply.id;
    }
  }
  return null;
}

app.post('/webhook', async (req, res) => {
  if (!webhookSecurity.isValidSignature(req)) {
    console.warn('Rejected webhook with invalid signature');
    return res.sendStatus(401);
  }


  res.sendStatus(200);

  const entry = req.body.entry && req.body.entry[0];
  const change = entry && entry.changes && entry.changes[0];
  const value = change && change.value;
  const message = value && value.messages && value.messages[0];

  if (!message) {
    return;
  }

  if (!dedupeStore.isFirstDelivery(message.id)) {
    return;
  }

  const userId = message.from;
  const incoming = extractIncomingValue(message);

  if (incoming === null) {
    return;
  }

  const replies = await conversationFlow.handleIncomingMessage(userId, incoming);
  for (const reply of replies) {
    await whatsappClient.sendMessage(userId, reply);
  }
});

app.post('/payment-callback', async (req, res) => {
  const { transactionId, status } = req.body;

  if (!transactionId || !status) {
    return res.status(400).json({ error: 'transactionId and status are required' });
  }

  paymentService.markPaymentStatus(transactionId, status);

  if (status === 'SUCCESS') {
    const result = await conversationFlow.deliverVoucherOnPaymentSuccess(transactionId);
    if (result) {
      for (const msg of result.message) {
        await whatsappClient.sendMessage(result.userId, msg);
      }
    }
  }

  res.status(200).json({ received: true });
});

app.get('/api/transactions', (req, res) => {
  res.json(paymentService.getAllTransactions());
});

app.get('/api/transactions/:id', (req, res) => {
  const tx = paymentService.getTransactionById(req.params.id);
  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json(tx);
});

app.post('/api/transactions/:id/refresh', async (req, res) => {
  const tx = paymentService.getTransactionById(req.params.id);
  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  if (tx.status === 'PENDING' && Math.random() > 0.3) {
    const pkg = config.packages.find((p) => p.id === tx.packageId);
    const voucher = await voucherService.issueVoucher(tx.phoneNumber, pkg, {
      transactionId: tx.transactionId,
      paymentReference: tx.reference
    });
    paymentService.markPaymentStatus(tx.transactionId, 'SUCCESS');
    paymentService.attachVoucher(tx.transactionId, voucher);
  }

  res.json(paymentService.getTransactionById(req.params.id));
});

app.get('/api/packages', (req, res) => {
  res.json(config.packages);
});

app.get('/api/vouchers', (req, res) => {
  const rows = require('./db').prepare(`
    SELECT package_id AS packageId, status, COUNT(*) AS count
    FROM voucher_inventory GROUP BY package_id, status ORDER BY package_id, status
  `).all();
  res.json({ merchantIdConfigured: Boolean(config.wifiVoucherApi.merchantId), inventory: rows });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(config.port, () => {
  console.log(`WhatsApp WiFi bot running on port ${config.port}`);
  paymentTimeoutWatcher.start();
});
