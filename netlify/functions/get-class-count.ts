import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { sql } from "../../src/services/neonService";

const jsonHeaders: { [header: string]: string | number | boolean } = {
  'Content-Type': 'application/json'
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('get-class-count function called with method:', event.httpMethod);

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL no está configurada.');
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Error interno: Configuración incompleta." })
    };
  }

  try {
    // --- GET: Obtener valor actual del contador ---
    if (event.httpMethod === "GET") {
      const result = await sql`
        SELECT total_classes_held FROM configs WHERE config_key = 'classSettings'
      `;

      const totalClasses = result.length > 0 ? result[0].total_classes_held : 0;
      console.log('Total de clases:', totalClasses);

      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ totalClassesHeld: totalClasses })
      };
    }

    // --- POST: Incrementar el contador ---
    if (event.httpMethod === "POST") {
      console.log('Incrementando contador de clases...');

      const result = await sql`
        INSERT INTO configs (config_key, total_classes_held, updated_at)
        VALUES ('classSettings', 1, NOW())
        ON CONFLICT (config_key)
        DO UPDATE SET total_classes_held = configs.total_classes_held + 1, updated_at = NOW()
        RETURNING total_classes_held
      `;

      const updatedCount = result[0].total_classes_held;
      console.log('Nuevo contador:', updatedCount);

      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          totalClassesHeld: updatedCount,
          message: "Contador incrementado correctamente."
        })
      };
    }

    // --- Método no permitido ---
    return {
      statusCode: 405,
      headers: { ...jsonHeaders, "Allow": "GET, POST" },
      body: JSON.stringify({ message: "Método no permitido." })
    };

  } catch (error) {
    console.error('Error en get-class-count:', error);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Error interno del servidor." })
    };
  }
};

export { handler };
