const express = require("express");
const cors = require("cors");
const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

// ===== ENV =====
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase env vars missing");
}

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error("VAPID env vars missing");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  "mailto:admin@bookpairsync.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ===== SUBSCRIBE =====
app.post("/subscribe", async (req, res) => {
  try {
    const { userId, endpoint, p256dh, auth } = req.body;

    if (!userId || !endpoint || !p256dh || !auth) {
      return res.status(400).json({
        error: "Dados incompletos",
        received: req.body,
      });
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({
        user_id: userId,
        endpoint,
        p256dh,
        auth,
      }, { onConflict: "endpoint" });

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Erro ao salvar subscription" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ===== DEBUG =====
app.get("/debug/subscriptions", async (req, res) => {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (error) {
    return res.status(500).json({ error });
  }

  const grouped = {};
  data.forEach(sub => {
    if (!grouped[sub.user_id]) grouped[sub.user_id] = [];
    grouped[sub.user_id].push(sub.endpoint);
  });

  res.json({
    totalUsers: Object.keys(grouped).length,
    subscriptionsByUser: grouped,
  });
});

// ===== HEALTH =====
app.get("/", (_, res) => {
  res.send("WebPush Backend OK");
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

