require('dotenv').config();

const express = require('express');
const webpush = require('web-push');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   CONFIGURAÇÃO VAPID
========================= */

const VAPID_PUBLIC_KEY =
  'BMw7kT-B5J30v12TSPZ48Qv6FNc9Q0qvjP8RRSRRddpoFoYmyp57zW3IqEz_94u-6VuwhzvcS21mrK0iFkB1U6Y';

const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  'mailto:admin@leituraemcasal.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/* =========================
   STORAGE EM MEMÓRIA
   (produção: trocar por DB)
========================= */

const subscriptionsByUser = {};

/* =========================
   SUBSCRIBE
========================= */

app.post('/subscribe', (req, res) => {
  const { endpoint, keys, userId } = req.body;

  if (!endpoint || !keys || !userId) {
    return res.status(400).json({ error: 'Subscription inválida' });
  }

  if (!subscriptionsByUser[userId]) {
    subscriptionsByUser[userId] = [];
  }

  const exists = subscriptionsByUser[userId].some(
    (s) => s.endpoint === endpoint
  );

  if (!exists) {
    subscriptionsByUser[userId].push({ endpoint, keys });
  }

  console.log('📌 Subscription salva:', userId);

  return res.status(201).json({ success: true });
});

/* =========================
   SEND PUSH (CORRETO)
========================= */

app.post('/send', async (req, res) => {
  const { type, fromUserId, toUserId, title, body } = req.body;

  if (!toUserId || !title || !body) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const userSubscriptions = subscriptionsByUser[toUserId] || [];

  if (userSubscriptions.length === 0) {
    return res.json({ success: true, sent: 0 });
  }

  const payload = JSON.stringify({ title, body });
  let sent = 0;

  for (const sub of userSubscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        subscriptionsByUser[toUserId] =
          subscriptionsByUser[toUserId].filter(
            (s) => s.endpoint !== sub.endpoint
          );
      }
    }
  }

  console.log(
    `📤 Push enviado | para=${toUserId} | enviados=${sent}`
  );

  return res.json({ success: true, sent });
});

/* =========================
   DEBUG
========================= */

app.get('/debug/subscriptions', (req, res) => {
  const users = Object.keys(subscriptionsByUser);
  return res.json({
    totalUsers: users.length,
    subscriptionsByUser,
  });
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Web Push backend rodando na porta ${PORT}`);
});

