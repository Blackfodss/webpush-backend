const express = require("express");
const cors = require("cors");
const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_EMAIL,
  PORT = 3000,
} = process.env;

/* ========= VALIDACOES OBRIGATORIAS ========= */
if (!SUPABASE_URL) throw new Error("SUPABASE_URL is required");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
if (!VAPID_PUBLIC_KEY) throw new Error("VAPID_PUBLIC_KEY is required");
if (!VAPID_PRIVATE_KEY) throw new Error("VAPID_PRIVATE_KEY is required");
if (!VAPID_EMAIL) throw new Error("VAPID_EMAIL is required");

/* ========= SUPABASE ========= */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* ========= WEB PUSH ========= */
webpush.setVapidDetails(
  `mailto:${VAPID_EMAIL}`,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/* ========= EXPRESS ========= */
const app = express();
app.use(cors());
app.use(express.json());

/* ========= HEALTH ========= */
app.get("/", (_req, res) => {
  res.send("WebPush Backend OK");
});

/* ========= DEBUG ========= */
app.get("/debug/subscriptions", async (_req, res) => {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const map = {};
  for (const row of data) {
    if (!map[row.user_id]) map[row.user_id] = [];
    map[row.user_id].push(row.endpoint);
  }

  res.json({
    totalUsers: Object.keys(map).length,
    subscriptionsByUser: map,
  });
});

/* ========= SUBSCRIBE ========= */
app.post("/subscribe", async (req, res) => {
  try {
    const { userId, subscription } = req.body;

    if (!userId || !subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const { endpoint, keys } = subscription;

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint,
          keys,
        },
        { onConflict: "endpoint" }
      );

    if (error) {
      console.error("SUPABASE ERROR:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("SUBSCRIBE ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ========= START ========= */
app.listen(PORT, () => {
  console.log(`WebPush backend running on port ${PORT}`);
});

