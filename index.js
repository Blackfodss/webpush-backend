// ================================
// CONFIG BÁSICA
// ================================
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

// ================================
// SUPABASE
// ================================
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE ENV NÃO DEFINIDA");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ================================
// VAPID (USANDO AS CHAVES QUE VOCÊ PASSOU)
// ================================
const VAPID_PUBLIC_KEY =
  "BGSu23ewxj1vajATGxdttc1dZyBUSAg8dkss5cfgRMHFYqaLs9W0XX518j013kL6m6iXGsK96v8qawql-BIYw8M";

const VAPID_PRIVATE_KEY =
  "7pYc_niUZQjJrT-rfhcQSbCyFKLW_021Sny0n8cnRaY";

webpush.setVapidDetails(
  "mailto:admin@bookpair.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ================================
// ROTAS
// ================================
app.get("/", (_req, res) => {
  res.send("WebPush Backend OK");
});

// ---------- SUBSCRIBE ----------
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
      console.error("❌ ERRO SUPABASE:", error);
      return res.status(500).json({ error: "Erro ao salvar subscription" });
    }

    console.info("✅ SUBSCRIPTION SALVA:", userId);
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ ERRO /subscribe:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ---------- SEND SYSTEM ----------
app.post("/send-system", async (req, res) => {
  try {
    const { userId, title, body } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (error || !data?.length) {
      return res.status(404).json({ error: "Nenhuma subscription encontrada" });
    }

    const payload = JSON.stringify({
      title,
      body,
    });

    await Promise.all(
      data.map((row) =>
        webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: row.keys,
          },
          payload
        )
      )
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ ERRO /send-system:", err);
    res.status(500).json({ error: "Erro ao enviar push" });
  }
});

// ---------- DEBUG ----------
app.get("/debug/subscriptions", async (_req, res) => {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint");

  const map = {};
  data?.forEach((r) => {
    if (!map[r.user_id]) map[r.user_id] = [];
    map[r.user_id].push(r.endpoint);
  });

  res.json({
    totalUsers: Object.keys(map).length,
    subscriptionsByUser: map,
  });
});

// ================================
// START SERVER
// ================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 WebPush Backend rodando na porta", PORT);
});

