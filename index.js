const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ================= ENV =================
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_EMAIL,
} = process.env;

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !VAPID_PUBLIC_KEY ||
  !VAPID_PRIVATE_KEY ||
  !VAPID_EMAIL
) {
  console.error("❌ ENV VARS AUSENTES");
  process.exit(1);
}

// ================= SUPABASE =================
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// ================= WEB PUSH =================
webpush.setVapidDetails(
  VAPID_EMAIL,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ================= ROUTES =================
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/subscribe", async (req, res) => {
  try {
    const { userId, subscription } = req.body;

    if (!userId || !subscription?.endpoint) {
      return res.status(400).json({ error: "payload inválido" });
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        subscription,
      });

    if (error) {
      console.error("❌ Supabase error:", error);
      return res.status(500).json({ error: "supabase error" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Subscribe crash:", err);
    res.status(500).json({ error: "internal error" });
  }
});

// ================= START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 WebPush backend rodando na porta", PORT);
});

