const express = require("express");
const cors = require("cors");
const webpush = require("web-push");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===== VAPID =====
webpush.setVapidDetails(
  "mailto:admin@bookpairsync.app",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ===== STORAGE POR USUÁRIO =====
const subscriptionsByUser = {};

// ===== SUBSCRIBE =====
app.post("/subscribe", (req, res) => {
  const { userId, subscription } = req.body;

  if (!userId || !subscription?.endpoint) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  if (!subscriptionsByUser[userId]) {
    subscriptionsByUser[userId] = [];
  }

  const exists = subscriptionsByUser[userId].some(
    (s) => s.endpoint === subscription.endpoint
  );

  if (!exists) {
    subscriptionsByUser[userId].push(subscription);
    console.log("📩 Nova subscription:", userId);
  }

  res.status(201).json({ success: true });
});

// ===== SEND PARA TODOS =====
app.post("/send", async (req, res) => {
  const { title, body } = req.body;
  const payload = JSON.stringify({ title, body });

  let sent = 0;

  for (const userId in subscriptionsByUser) {
    const validSubs = [];

    for (const sub of subscriptionsByUser[userId]) {
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
        validSubs.push(sub);
      } catch (err) {
        if (![404, 410].includes(err.statusCode)) {
          validSubs.push(sub);
        }
      }
    }

    subscriptionsByUser[userId] = validSubs;
  }

  res.json({ success: true, sent });
});

// ===== DEBUG =====
app.get("/debug/subscriptions", (_, res) => {
  res.json({
    totalUsers: Object.keys(subscriptionsByUser).length,
    subscriptionsByUser,
  });
});

app.listen(PORT, () => {
  console.log("🚀 Web Push Backend rodando");
});
