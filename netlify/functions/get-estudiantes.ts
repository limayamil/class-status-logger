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

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL no está configurada en el entorno.');
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Error interno del servidor: Configuración incompleta." }),
    };
  }

  try {
    const rows = await sql`
      SELECT id, documento, nombre, apellido
      FROM estudiantes
      WHERE activo = TRUE
      ORDER BY apellido ASC, nombre ASC
    `;

    const students = rows.map((r: Record<string, unknown>) => ({
      id: `student_${r.id}`,
      name: `${r.nombre} ${r.apellido}`,
      dni: r.documento,
      nombre: r.nombre,
      apellido: r.apellido,
    }));

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify(students),
    };

  } catch (error: unknown) {
    let errorMessage = "Error desconocido al obtener estudiantes.";
    if (error instanceof Error) {
      errorMessage = `Error al obtener estudiantes: ${error.message}`;
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
