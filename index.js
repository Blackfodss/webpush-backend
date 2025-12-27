// ==============================
// IMPORTS
// ==============================
const express = require("express");
const webpush = require("web-push");
const cors = require("cors");

// ==============================
// APP SETUP
// ==============================
const app = express();
app.use(cors());
app.use(express.json());

// ==============================
// PORT (Render usa PORT)
// ==============================
const PORT = process.env.PORT || 10000;

// ==============================
// VAPID CONFIG
// ==============================
webpush.setVapidDetails(
  "mailto:admin@bookpairsync.app",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ==============================
// STORAGE EM MEMÓRIA (TESTE)
// Cada endpoint = 1 dispositivo
// ==============================
const subscriptionsByEndpoint = {};

// ==============================
// SUBSCRIBE
// ==============================
app.post("/subscribe", (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Invalid subscription" });
  }

  const endpoint = subscription.endpoint;

  if (!subscriptionsByEndpoint[endpoint]) {
    subscriptionsByEndpoint[endpoint] = subscription;
    console.log("📥 Nova subscription salva:", endpoint);
  }

  res.status(201).json({ success: true });
});

// ==============================
// SEND
// ==============================
app.post("/send", async (req, res) => {
  const { title, body } = req.body;
  let sent = 0;

  for (const endpoint in subscriptionsByEndpoint) {
    try {
      await webpush.sendNotification(
        subscriptionsByEndpoint[endpoint],
        JSON.stringify({
          title: title || "Nova notificação",
          body: body || "",
        })
      );
      sent++;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        delete subscriptionsByEndpoint[endpoint];
      }
    }
  }

  res.json({ success: true, sent });
});

// ==============================
// DEBUG
// ==============================
app.get("/debug/subscriptions", (req, res) => {
  res.json({
    total: Object.keys(subscriptionsByEndpoint).length,
    endpoints: Object.keys(subscriptionsByEndpoint),
  });
});

// ==============================
// HEALTH
// ==============================
app.get("/", (req, res) => {
  res.send("🚀 Web Push Backend is running");
});

// ==============================
// START
// ==============================
app.listen(PORT, () => {
  console.log("🚀 Backend rodando na porta", PORT);
});

