import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { sql } from "../../src/services/neonService";

interface AsistenciaData {
  fecha: string;
  nombreEstudiante: string;
  estado: 'Presente' | 'Ausente' | 'Justificado';
  materia?: string;
  comision?: string;
}

const jsonHeaders: { [header: string]: string | number | boolean } = {
  'Content-Type': 'application/json'
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...jsonHeaders, "Allow": "POST" },
      body: JSON.stringify({ message: "Método no permitido. Solo se acepta POST." }),
    };
  }

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL no está configurada en el entorno.');
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Error interno del servidor: Configuración incompleta." }),
    };
  }

  let asistenciaData: AsistenciaData;

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ message: "Cuerpo de la solicitud vacío." }),
      };
    }
    asistenciaData = JSON.parse(event.body);

    if (!asistenciaData.fecha || !asistenciaData.nombreEstudiante || !asistenciaData.estado) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ message: "Faltan datos requeridos (fecha, nombreEstudiante, estado)." }),
      };
    }
  } catch (error) {
    console.error('Error al parsear el cuerpo de la solicitud:', error);
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Error en el formato del cuerpo de la solicitud (debe ser JSON)." }),
    };
  }

  try {
    const result = await sql`
      INSERT INTO asistencias (fecha, nombre_estudiante, estado, materia, comision)
      VALUES (${asistenciaData.fecha}, ${asistenciaData.nombreEstudiante}, ${asistenciaData.estado}, ${asistenciaData.materia ?? null}, ${asistenciaData.comision ?? null})
      ON CONFLICT (nombre_estudiante, fecha) DO NOTHING
      RETURNING id
    `;

    if (result.length === 0) {
      console.warn(`Intento de registro duplicado: ${asistenciaData.nombreEstudiante} en ${asistenciaData.fecha}`);
      return {
        statusCode: 409,
        headers: jsonHeaders,
        body: JSON.stringify({ message: "Ya registraste tu asistencia hoy." }),
      };
    }

    console.log(`Asistencia registrada con ID: ${result[0].id}`);
    return {
      statusCode: 201,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Asistencia registrada correctamente.", id: result[0].id }),
    };

  } catch (error) {
    console.error('Error al registrar la asistencia:', error);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Error interno al guardar la asistencia." }),
    };
  }
};

export { handler };
