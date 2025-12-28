import express from "express";
import cors from "cors";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_EMAIL,
} = process.env;

/* 🔥 FAIL FAST — se faltar algo, o backend NÃO sobe */
if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !VAPID_PUBLIC_KEY ||
  !VAPID_PRIVATE_KEY ||
  !VAPID_EMAIL
) {
  console.error("❌ Variáveis de ambiente ausentes", {
    SUPABASE_URL: !!SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
    VAPID_PUBLIC_KEY: !!VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: !!VAPID_PRIVATE_KEY,
    VAPID_EMAIL: !!VAPID_EMAIL,
  });
  process.exit(1);
}

/* Supabase */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* Web Push */
webpush.setVapidDetails(
  VAPID_EMAIL,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const app = express();
app.use(cors());
app.use(express.json());

/* Health check */
app.get("/", (_req, res) => {
  res.send("WebPush Backend OK");
});

/* Subscribe */
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
      }, { onConflict: "endpoint" });

    if (error) {
      console.error("❌ Supabase error:", error);
      return res.status(500).json({ error: "Erro ao salvar subscription" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Erro inesperado:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

/* Debug */
app.get("/debug/subscriptions", async (_req, res) => {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint");

  const map = {};
  data?.forEach(row => {
    map[row.user_id] ||= [];
    map[row.user_id].push(row.endpoint);
  });

  res.json({
    totalUsers: Object.keys(map).length,
    subscriptionsByUser: map,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 WebPush backend rodando na porta", PORT);
});

