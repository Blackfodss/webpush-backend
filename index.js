require('dotenv').config();

const express = require('express');
const webpush = require('web-push');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const subscriptions = [];

app.post('/subscribe', (req, res) => {
  const { subscription, userId } = req.body;

  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }

  const exists = subscriptions.find(
    (s) => s.subscription.endpoint === subscription.endpoint
  );

  if (!exists) {
    subscriptions.push({ userId, subscription });
  }

  console.log('Subscriptions:', subscriptions.length);
  res.status(201).json({ success: true });
});

app.post('/send-to-user', async (req, res) => {
  const { userId, title, message } = req.body;

  if (!userId || !title || !message) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const payload = JSON.stringify({ title, body: message });

  const targets = subscriptions.filter((s) => s.userId === userId);

  await Promise.all(
    targets.map((t) => webpush.sendNotification(t.subscription, payload))
  );

  res.json({ success: true });
});

app.listen(process.env.PORT, () => {
  console.log(`Backend rodando em http://localhost:${process.env.PORT}`);
});

