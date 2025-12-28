const express = require("express");
const cors = require("cors");
const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

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
  console.error("❌ Variáveis de ambiente ausentes");
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  VAPID_EMAIL,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

app.get("/", (_req, res) => {
  res.send("WebPush Backend OK");
});

app.post("/subscribe", async (req, res) => {
  try {
    const { userId, subscription } = req.body;

    if (!userId || !subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        { onConflict: "endpoint" }
      );

    if (error) {
      console.error("❌ Supabase error:", error);
      return res.status(500).json({ error: "Erro ao salvar subscription" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Crash:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

app.get("/debug/subscriptions", async (_req, res) => {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint");

  const map = {};
  data?.forEach((row) => {
    if (!map[row.user_id]) map[row.user_id] = [];
    map[row.user_id].push(row.endpoint);
  });

  res.json({
    totalUsers: Object.keys(map).length,
    subscriptionsByUser: map,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 WebPush backend rodando na porta ${PORT}`)
);

