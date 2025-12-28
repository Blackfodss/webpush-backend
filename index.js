const express = require("express");
const cors = require("cors");
const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

/* =======================
   ENV
======================= */
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase env vars missing");
}

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error("VAPID keys missing");
}

/* =======================
   SUPABASE
======================= */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* =======================
   VAPID
======================= */
webpush.setVapidDetails(
  "mailto:admin@bookpair.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/* =======================
   ROUTES
======================= */

app.get("/", (_, res) => {
  res.send("WebPush Backend OK");
});

/* SUBSCRIBE */
app.post("/subscribe", async (req, res) => {
  try {
    const { userId, subscription } = req.body;

    if (!userId || !subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      }, {
        onConflict: "endpoint"
      });

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Erro ao salvar subscription" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* DEBUG */
app.get("/debug/subscriptions", async (_, res) => {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint");

  if (error) {
    return res.status(500).json({ error });
  }

  const grouped = {};
  for (const row of data) {
    if (!grouped[row.user_id]) grouped[row.user_id] = [];
    grouped[row.user_id].push(row.endpoint);
  }

  res.json({
    totalUsers: Object.keys(grouped).length,
    subscriptionsByUser: grouped,
  });
});

/* =======================
   START
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("WebPush backend running on port", PORT);
});

