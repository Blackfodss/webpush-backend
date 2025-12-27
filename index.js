import express from "express";
import cors from "cors";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

/* ==============================
   ENV
============================== */
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

/* ==============================
   SUPABASE
============================== */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/* ==============================
   VAPID
============================== */
webpush.setVapidDetails(
  "mailto:admin@bookpairsync.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/* ==============================
   HEALTHCHECK
============================== */
app.get("/", (_, res) => {
  res.json({ ok: true });
});

/* ==============================
   SUBSCRIBE
============================== */
app.post("/subscribe", async (req, res) => {
  const { user_id, endpoint, keys } = req.body;

  if (!user_id || !endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao salvar subscription" });
  }

  res.status(201).json({ success: true });
});

/* ==============================
   SEND — SYSTEM
============================== */
app.post("/send/system", async (req, res) => {
  const { title, body } = req.body;

  const { data } = await supabase
    .from("push_subscriptions")
    .select("*");

  let sent = 0;

  for (const sub of data) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({ title, body })
      );
      sent++;
    } catch {}
  }

  res.json({ success: true, sent });
});

/* ==============================
   SEND — PARTNER
============================== */
app.post("/send/partner", async (req, res) => {
  const { to_user_id, title, body } = req.body;

  const { data } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", to_user_id);

  let sent = 0;

  for (const sub of data) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({ title, body })
      );
      sent++;
    } catch {}
  }

  res.json({ success: true, sent });
});

/* ==============================
   DEBUG
============================== */
app.get("/debug/subscriptions", async (_, res) => {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("user_id");

  const users = [...new Set(data.map(d => d.user_id))];
  res.json({ totalUsers: users.length });
});

/* ==============================
   START
============================== */
app.listen(PORT, () => {
  console.log("Web Push backend running");
});

