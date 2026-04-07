import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { sql } from "../../src/services/neonService";

const jsonHeaders: { [header: string]: string | number | boolean } = {
  'Content-Type': 'application/json'
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "DELETE") {
    return {
      statusCode: 405,
      headers: { ...jsonHeaders, "Allow": "DELETE" },
      body: JSON.stringify({ message: "Método no permitido. Solo se acepta DELETE." }),
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

  const id = event.queryStringParameters?.id;

  if (!id) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Falta el parámetro 'id'." }),
    };
  }

  const numericId = Number(id);
  if (isNaN(numericId)) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "El parámetro 'id' debe ser un número válido." }),
    };
  }

  try {
    const result = await sql`
      DELETE FROM asistencias WHERE id = ${numericId} RETURNING id
    `;

    if (result.length === 0) {
      return {
        statusCode: 404,
        headers: jsonHeaders,
        body: JSON.stringify({ message: "Registro de asistencia no encontrado." }),
      };
    }

    console.log(`Asistencia eliminada con ID: ${result[0].id}`);
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Asistencia eliminada correctamente.", id: result[0].id }),
    };

  } catch (error: unknown) {
    let errorMessage = "Error desconocido al eliminar la asistencia.";
    if (error instanceof Error) {
      errorMessage = `Error al eliminar la asistencia: ${error.message}`;
    }
    console.error(errorMessage, error);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Error interno al eliminar la asistencia." }),
    };
  }
};

export { handler };
