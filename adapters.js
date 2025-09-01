import dayjs from "dayjs";

// Simulaciones en memoria
let EVENTS = [
  { id: "e1", when: dayjs().hour(10).minute(0).toISOString(), title: "Visita - PH en Palermo" },
  { id: "e2", when: dayjs().hour(15).minute(30).toISOString(), title: "Llamada - Dueño Núñez" }
];
let CLIENTS = [
  { id: "c1", name: "Juan Pérez", phone: "+5491112345678", notes: [] },
  { id: "c2", name: "María López", phone: "+5491122233344", notes: [] }
];

export const CRM = {
  async agendaHoy() {
    const inicio = dayjs().startOf("day");
    const fin = dayjs().endOf("day");
    return EVENTS.filter(e => dayjs(e.when).isAfter(inicio) && dayjs(e.when).isBefore(fin));
  },
  async crearEvento({ whenISO, title }) {
    const id = "e" + (EVENTS.length + 1);
    EVENTS.push({ id, when: whenISO, title });
    return { id };
  },
  async moverEvento({ id, newWhenISO }) {
    const ev = EVENTS.find(e => e.id === id);
    if (!ev) throw new Error("Evento no encontrado");
    ev.when = newWhenISO; return ev;
  },
  async eliminarEvento({ id }) {
    EVENTS = EVENTS.filter(e => e.id !== id); return { ok: true };
  },
  async buscarClientes(q) {
    const s = q.toLowerCase();
    return CLIENTS.filter(c => c.name.toLowerCase().includes(s) || c.phone.includes(s));
  },
  async agregarNota({ clientNameOrId, text }) {
    const c = CLIENTS.find(x => x.id === clientNameOrId || x.name.toLowerCase() === clientNameOrId.toLowerCase());
    if (!c) throw new Error("Cliente no encontrado");
    c.notes.push({ at: new Date().toISOString(), text });
    return { ok: true };
  }
};
