const express = require("express");
const cors = require("cors");
const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// ENV
// ===============================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const VAPID_PUBLIC_KEY =
  "BGSu23ewxj1vajATGxdttc1dZyBUSAg8dkss5cfgRMHFYqaLs9W0XX518j013kL6m6iXGsK96v8qawql-BIYw8M";
const VAPID_PRIVATE_KEY =
  "7pYc_niUZQjJrT-rfhcQSbCyFKLW_021Sny0n8cnRaY";

// ===============================
// CLIENTS
// ===============================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

webpush.setVapidDetails(
  "mailto:admin@book-pair-sync.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ===============================
// ROUTES
// ===============================
app.get("/", (req, res) => {
  res.send("WebPush Backend OK");
});

// ---- SUBSCRIBE (CORRIGIDO) ----
app.post("/subscribe", async (req, res) => {
  try {
    const { userId, subscription } = req.body;

    if (!userId || !subscription || !subscription.endpoint || !subscription.keys) {
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
      return res.status(500).json({ error: "Erro ao salvar subscription" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("SUBSCRIBE ERROR:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ---- DEBUG ----
app.get("/debug/subscriptions", async (req, res) => {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint");

  if (error) {
    return res.status(500).json({ error: error.message });
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

// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("WebPush backend running on port", PORT);
});

