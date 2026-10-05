// Herramientas de agenda para el asistente (servidor). Trabajan con kit/almacen-agenda.js conectado a
// Supabase con la llave de servicio. El teléfono del cliente lo pone el sistema (WhatsApp o identificador
// de llamada), nunca el modelo: así nadie puede ver ni mover citas ajenas.
import * as A from "../kit/agenda.js";

const texto = (descripcion) => ({ type: "string", description: descripcion });
const opcional = (descripcion) => ({ type: ["string", "null"], description: descripcion });
const objeto = (props) => ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false });

export const DEFINICIONES = [
  { name: "ver_servicios", description: "Lista los servicios con duración y precio, y quién los da.", input_schema: objeto({}) },
  { name: "ver_horarios_libres", description: "Horarios libres de un servicio en una fecha (AAAA-MM-DD). Úsala antes de ofrecer horarios.",
    input_schema: objeto({ servicio_id: texto("id del servicio"), fecha: texto("AAAA-MM-DD"), persona_id: opcional("id de la persona, o null para cualquiera") }) },
  { name: "apartar_cita", description: "Aparta la cita para este cliente. Úsala solo después de que el cliente confirmó servicio, día, hora y su nombre.",
    input_schema: objeto({ servicio_id: texto("id del servicio"), fecha: texto("AAAA-MM-DD"), hora: texto("HH:MM de 24 horas"), nombre: texto("nombre del cliente"), persona_id: opcional("id de la persona, o null") }) },
  { name: "mis_citas", description: "Las citas próximas de este cliente.", input_schema: objeto({}) },
  { name: "cambiar_cita", description: "Mueve una cita del cliente a otra fecha y hora libres.",
    input_schema: objeto({ cita_id: texto("id que devolvió mis_citas"), fecha: texto("AAAA-MM-DD"), hora: texto("HH:MM") }) },
  { name: "cancelar_cita", description: "Cancela una cita del cliente. Confirma antes con el cliente.", input_schema: objeto({ cita_id: texto("id que devolvió mis_citas") }) },
];

// ctx = { almacen, tel, enlaceBase }
export function ejecutorAgenda({ almacen, tel, enlaceBase = "" }) {
  const propia = async (id) => {
    const c = (await almacen.citasDeTelefono(tel)).find((x) => x.id === id);
    if (!c) throw new Error("No encontré esa cita entre las de este cliente.");
    return c;
  };
  return async (nombre, input) => {
    switch (nombre) {
      case "ver_servicios": {
        const [servicios, personal] = await Promise.all([almacen.servicios(), almacen.personal()]);
        return servicios.map((s) => ({ id: s.id, nombre: s.nombre, minutos: s.minutos, precio: s.precio ?? null,
          personas: personal.filter((p) => s.personal.includes(p.id)).map((p) => ({ id: p.id, nombre: p.nombre })) }));
      }
      case "ver_horarios_libres": {
        const libres = await almacen.libres(input.servicio_id, input.fecha, input.persona_id || null);
        return { fecha: input.fecha, dia: A.fechaLarga(input.fecha), horarios: libres.map((l) => l.hora) };
      }
      case "apartar_cita": {
        const r = await almacen.reservar({ servicioId: input.servicio_id, fecha: input.fecha, hora: input.hora, nombre: input.nombre, tel, personalId: input.persona_id || null });
        return { ok: true, dia: A.fechaLarga(input.fecha), hora: A.horaBonita(input.hora), enlace: enlaceBase ? enlaceBase + r.token : null };
      }
      case "mis_citas": {
        const [citas, servicios] = await Promise.all([almacen.citasDeTelefono(tel), almacen.servicios()]);
        return citas.map((c) => ({ id: c.id, servicio: servicios.find((s) => s.id === c.servicio)?.nombre || c.servicio, dia: A.fechaLarga(c.fecha), fecha: c.fecha, hora: c.hora, estado: c.estado }));
      }
      case "cambiar_cita": {
        const c = await propia(input.cita_id);
        await almacen.reprogramar(c.token, input.fecha, input.hora);
        return { ok: true, dia: A.fechaLarga(input.fecha), hora: A.horaBonita(input.hora) };
      }
      case "cancelar_cita": {
        const c = await propia(input.cita_id);
        await almacen.cambiar(c.token, "cancelada");
        return { ok: true };
      }
      default: throw new Error("Herramienta desconocida: " + nombre);
    }
  };
}
