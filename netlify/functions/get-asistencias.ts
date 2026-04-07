import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { sql } from "../../src/services/neonService";

const jsonHeaders: { [header: string]: string | number | boolean } = {
  'Content-Type': 'application/json'
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { ...jsonHeaders, "Allow": "GET" },
      body: JSON.stringify({ message: "Método no permitido. Solo se acepta GET." }),
    };
  }

  const dateParam = event.queryStringParameters?.date;
  const studentNameParam = event.queryStringParameters?.studentName;

  if (!dateParam && !studentNameParam) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Faltan los parámetros requeridos. Se necesita 'date' o 'studentName'." }),
    };
  }

  if (dateParam) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateParam)) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ message: "Formato de fecha inválido. Use YYYY-MM-DD." }),
      };
    }
  }

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL no está configurada en el entorno.');
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Error interno del servidor: Configuración incompleta." }),
    };
  }

  try {
    let rows;
    if (dateParam && studentNameParam) {
      rows = await sql`
        SELECT id, fecha, nombre_estudiante, estado, materia, comision, registrado_en
        FROM asistencias
        WHERE fecha = ${dateParam}::date AND nombre_estudiante = ${studentNameParam}
        ORDER BY registrado_en ASC
      `;
    } else if (dateParam) {
      rows = await sql`
        SELECT id, fecha, nombre_estudiante, estado, materia, comision, registrado_en
        FROM asistencias
        WHERE fecha = ${dateParam}::date
        ORDER BY registrado_en ASC
      `;
    } else {
      rows = await sql`
        SELECT id, fecha, nombre_estudiante, estado, materia, comision, registrado_en
        FROM asistencias
        WHERE nombre_estudiante = ${studentNameParam}
        ORDER BY registrado_en ASC
      `;
    }

    // Mapear snake_case a camelCase para compatibilidad con el frontend
    const records = rows.map((r: Record<string, unknown>) => ({
      _id: r.id,
      fecha: r.fecha,
      nombreEstudiante: r.nombre_estudiante,
      estado: r.estado,
      materia: r.materia,
      comision: r.comision,
      registradoEn: r.registrado_en,
    }));

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify(records),
    };

  } catch (error: unknown) {
    let errorMessage = "Error desconocido al obtener asistencias.";
    if (error instanceof Error) {
      errorMessage = `Error al obtener asistencias: ${error.message}`;
    }
    console.error(errorMessage, error);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ message: errorMessage }),
    };
  }
};

export { handler };
