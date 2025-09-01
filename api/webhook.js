// api/webhook.js
import fetch from "node-fetch";
import dayjs from "dayjs";
import { CRM } from "./adapters.js";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WABA_TOKEN   = process.env.WHATSAPP_TOKEN;
const PHONE_ID     = process.env.WHATSAPP_PHONE_ID;

// 1) Enviar texto con logs y manejo de errores + v22.0
async function sendText(to, text) {
  // asegurar formato +E164 (+549...)
  const toFormatted = to.startsWith("+") ? to : `+${to}`;

  const url = `https://graph.facebook.com/v22.0/${PHONE_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: toFormatted,
    type: "text",
    text: { body: text }
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WABA_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  let data = {};
  try { data = await resp.json(); } catch {}
  console.log("GRAPH /messages →", resp.status, data);

  if (!resp.ok) {
    throw new Error(`Graph error ${resp.status}: ${JSON.stringify(data)}`);
  }
}

// Intents simples
function intentFromText(t) {
  const s = t.trim().toLowerCase();
  if (s.includes("qué tengo hoy") || s.includes("que tengo hoy")) return { name: "AGENDA_HOY" };
  if (s.startsWith("crear evento")) return { name: "CREAR_EVENTO", args: s.replace("crear evento", "").trim() };
  if (s.startsWith("mover evento")) return { name: "MOVER_EVENTO", args: s.replace("mover evento", "").trim() };
  if (s.startsWith("eliminar evento")) return { name: "ELIMINAR_EVENTO", args: s.replace("eliminar evento", "").trim() };
  if (s.startsWith("nota")) return { name: "AGREGAR_NOTA", args: s.replace("nota", "").trim() };
  if (s.startsWith("buscar cliente")) return { name: "BUSCAR_CLIENTE", args: s.replace("buscar cliente", "").trim() };
  return { name: "AYUDA" };
}

function parseDate(str) {
  const s = str.toLowerCase();
  let d = dayjs();
  if (s.includes("mañana")) d = d.add(1, "day");
  const hm = s.match(/(\d{1,2})[:h\.]?(\d{2})?/);
  if (hm) {
    const h = parseInt(hm[1], 10);
    const m = hm[2] ? parseInt(hm[2], 10) : 0;
    d = d.hour(h).minute(m);
  }
  return d.toISOString();
}

// 2) Responder 200 inmediatamente y procesar async
export default async function handler(req, res) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("forbidden");
  }

  if (req.method === "POST") {
    // responder YA para que Meta no timeoutee
    res.status(200).end();

    try {
      const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const from = msg?.from;               // ej: "5493875921715" (sin +)
      const text = msg?.text?.body;
      console.log("INBOUND:", { from, text });

      if (!from || !text) return;

      const intent = intentFromText(text);

      switch (intent.name) {
        case "AGENDA_HOY": {
          const events = await CRM.agendaHoy();
          const lines = events.length
            ? events.map(e => `• ${dayjs(e.when).format("HH:mm")} — ${e.title}`).join("\n")
            : "No tienes eventos hoy.";
          await sendText(from, `Agenda de hoy:\n${lines}`);
          break;
        }
        case "CREAR_EVENTO": {
          const [whenStr = "", title = "Evento"] = (intent.args || "").split("-").map(s => s.trim());
          const whenISO = parseDate(whenStr || "hoy 10:00");
          const { id } = await CRM.crearEvento({ whenISO, title });
          await sendText(from, `✔ Evento creado (${dayjs(whenISO).format("DD/MM HH:mm")}): ${title} — ID ${id}`);
          break;
        }
        case "MOVER_EVENTO":
          await sendText(from, "✔ Evento movido (simulado en MVP)"); break;
        case "ELIMINAR_EVENTO":
          await sendText(from, "🗑 Evento eliminado (simulado en MVP)"); break;
        case "AGREGAR_NOTA":
          await sendText(from, "✔ Nota agregada (simulado en MVP)"); break;
        case "BUSCAR_CLIENTE":
          await sendText(from, "Resultados de clientes (simulado en MVP)"); break;
        default:
          await sendText(from, "Comandos:\n• ¿Qué tengo hoy?\n• crear evento hoy 15:00 - visita depto\n• nota para juan: seguimiento\n• buscar cliente juan");
      }
    } catch (e) {
      console.error("WEBHOOK ERROR:", e);
    }
    return;
  }

  return res.status(405).send("method not allowed");
}
