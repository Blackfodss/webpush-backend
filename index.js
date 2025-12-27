const express = require("express");
const webpush = require("web-push");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   ENV VALIDATION
========================= */
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  PORT = 10000,
} = process.env;

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !VAPID_PUBLIC_KEY ||
  !VAPID_PRIVATE_KEY
) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

/* =========================
   SUPABASE CLIENT
========================= */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* =========================
   VAPID
========================= */
webpush.setVapidDetails(
  "mailto:admin@bookpairsync.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.json({ ok: true });
});

/* =========================
   SUBSCRIBE
========================= */
app.post("/subscribe", async (req, res) => {
  const { user_id, endpoint, keys } = req.body;

  if (!user_id || !endpoint || !keys) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id,
        endpoint,
        keys,
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    console.error("❌ Supabase error:", error);
    return res.status(500).json({ error: "Failed to save subscription" });
  }

  res.status(201).json({ success: true });
});

/* =========================
   SEND PUSH (TARGET USER)
========================= */
app.post("/send", async (req, res) => {
  const { target_user_id, title, body } = req.body;

  if (!target_user_id || !title || !body) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", target_user_id);

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Query failed" });
  }

  let sent = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        JSON.stringify({ title, body })
      );
      sent++;
    } catch (err) {
      console.error("❌ Push error:", err.statusCode);
    }
  }

  res.json({ success: true, sent });
});

/* =========================
   DEBUG
========================= */
app.get("/debug/subscriptions", async (req, res) => {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("user_id");

  const users = new Set(data.map((d) => d.user_id));
  res.json({ totalUsers: users.size });
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log("🚀 WebPush backend running on port", PORT);
});

