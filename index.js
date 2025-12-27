const express = require("express");
const cors = require("cors");
const webpush = require("web-push");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔐 VAPID (Render Environment Variables)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("❌ VAPID keys não configuradas");
}

webpush.setVapidDetails(
  "mailto:teste@seudominio.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// 🧠 Armazenamento em memória (teste)
const subscriptions = [];

// Recebe subscription do Lovable
app.post("/subscribe", (req, res) => {
  const subscription = req.body;

  console.log("📩 Subscription recebida no backend:");
  console.log(subscription);

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Invalid subscription" });
  }

  const exists = subscriptions.find(
    (s) => s.endpoint === subscription.endpoint
  );

  if (!exists) {
    subscriptions.push(subscription);
  }

  return res.status(201).json({ success: true });
});

// Envia push
app.post("/send", async (req, res) => {
  const { title = "Teste", body = "Push funcionando 🚀" } = req.body;

  const payload = JSON.stringify({ title, body });

  let sent = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (err) {
      console.error("❌ Erro ao enviar push:", err?.statusCode || err);
    }
  }

  res.json({ success: true, sent });
});

// Health check
app.get("/", (_, res) => {
  res.send("🚀 Web Push Backend rodando");
});

app.listen(PORT, () => {
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});

