const express = require("express");
const cors = require("cors");
const webpush = require("web-push");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===== VAPID =====
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  "mailto:admin@bookpairsync.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ===== STORAGE EM MEMÓRIA =====
let subscriptions = [];

// ===== SUBSCRIBE =====
app.post("/subscribe", (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Invalid subscription" });
  }

  const exists = subscriptions.find(
    (s) => s.endpoint === subscription.endpoint
  );

  if (!exists) {
    subscriptions.push(subscription);
    console.log("📩 Subscription registrada:", subscription.endpoint);
  }

  console.log("📊 Total:", subscriptions.length);
  res.status(201).json({ success: true });
});

// ===== SEND =====
app.post("/send", async (req, res) => {
  const { title, body } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: "Missing title/body" });
  }

  const payload = JSON.stringify({ title, body });

  let sent = 0;
  const valid = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
      valid.push(sub);
    } catch (err) {
      if (err.statusCode !== 410 && err.statusCode !== 404) {
        valid.push(sub);
      }
    }
  }

  subscriptions = valid;
  res.json({ success: true, sent });
});

// ===== DEBUG =====
app.get("/debug/subscriptions", (_, res) => {
  res.json({
    total: subscriptions.length,
    subscriptions,
  });
});

// ===== ROOT =====
app.get("/", (_, res) => {
  res.send("🚀 Web Push Backend rodando");
});

app.listen(PORT, () => {
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});

