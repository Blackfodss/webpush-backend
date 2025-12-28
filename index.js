const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

/* ======================
   ENV VALIDATION
====================== */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ ENV missing", {
    SUPABASE_URL: !!SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
  });
  process.exit(1);
}

/* ======================
   SUPABASE CLIENT
====================== */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* ======================
   ROUTES
====================== */
app.post("/subscribe", async (req, res) => {
  try {
    const { userId, subscription } = req.body;

    if (!userId || !subscription?.endpoint) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          subscription,
        },
        { onConflict: "endpoint" }
      );

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("🔥 /subscribe crash:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/debug/subscriptions", async (_, res) => {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint");

  if (error) return res.status(500).json(error);

  const grouped = {};
  data.forEach((r) => {
    grouped[r.user_id] ??= [];
    grouped[r.user_id].push(r.endpoint);
  });

  res.json({
    totalUsers: Object.keys(grouped).length,
    subscriptionsByUser: grouped,
  });
});

/* ======================
   START
====================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("✅ WebPush backend running on", PORT)
);

