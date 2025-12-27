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
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

/* =======================
   SUPABASE CLIENT
======================= */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* =======================
   VAPID
======================= */
webpush.setVapidDetails(
  "mailto:admin@bookpairsync.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/* =======================
   ROUTES
======================= */

// health check
app.get("/", (_, res) => {
  res.send("Web Push Backend OK");
});

// salvar subscription
app.post("/subscribe", async (req, res) => {
  try {
    const { user_id, endpoint, keys } = req.body;

    if (!user_id || !endpoint || !keys) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        { user_id, endpoint, keys },
        { onConflict: "endpoint" }
      );

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Erro ao salvar subscription" });
    }

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// enviar push PARA UM USUÁRIO ESPECÍFICO
app.post("/send", async (req, res) => {
  const { target_user_id, title, body } = req.body;

  if (!target_user_id || !title || !body) {
    return res.status(400).json({ error: "Dados incompletos" });
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", target_user_id);

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar subscriptions" });
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
      console.error("Erro ao enviar push:", err);
    }
  }

  res.json({ success: true, sent });
});

// debug
app.get("/debug/subscriptions", async (_, res) => {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint");

  const grouped = {};
  data.forEach((s) => {
    if (!grouped[s.user_id]) grouped[s.user_id] = [];
    grouped[s.user_id].push(s.endpoint);
  });

  res.json({
    totalUsers: Object.keys(grouped).length,
    subscriptionsByUser: grouped,
  });
});

/* =======================
   START
======================= */
app.listen(PORT, () => {
  console.log("Backend rodando na porta", PORT);
});

