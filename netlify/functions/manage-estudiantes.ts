import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { sql } from "../../src/services/neonService";

const jsonHeaders: { [header: string]: string | number | boolean } = {
  'Content-Type': 'application/json'
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL no está configurada en el entorno.');
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Error interno del servidor: Configuración incompleta." }),
    };
  }

  const method = event.httpMethod;

  if (method === "POST") {
    try {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: jsonHeaders,
          body: JSON.stringify({ message: "Cuerpo de la solicitud vacío." }),
        };
      }

      const { nombre, apellido, documento } = JSON.parse(event.body);

      if (!nombre || !apellido || !documento) {
        return {
          statusCode: 400,
          headers: jsonHeaders,
          body: JSON.stringify({ message: "Faltan datos requeridos (nombre, apellido, documento)." }),
        };
      }

      const result = await sql`
        INSERT INTO estudiantes (nombre, apellido, documento)
        VALUES (${nombre.trim()}, ${apellido.trim()}, ${documento.trim()})
        RETURNING id, documento, nombre, apellido
      `;

      return {
        statusCode: 201,
        headers: jsonHeaders,
        body: JSON.stringify({
          message: "Alumno creado correctamente.",
          student: result[0],
        }),
      };
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === '23505') {
        return {
          statusCode: 409,
          headers: jsonHeaders,
          body: JSON.stringify({ message: "Ya existe un alumno con ese documento." }),
        };
      }
      console.error('Error al crear estudiante:', error);
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({ message: "Error interno al crear el alumno." }),
      };
    }
  }

  if (method === "PUT") {
    try {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: jsonHeaders,
          body: JSON.stringify({ message: "Cuerpo de la solicitud vacío." }),
        };
      }

      const { id, nombre, apellido, documento } = JSON.parse(event.body);

      if (!id || !nombre || !apellido || !documento) {
        return {
          statusCode: 400,
          headers: jsonHeaders,
          body: JSON.stringify({ message: "Faltan datos requeridos (id, nombre, apellido, documento)." }),
        };
      }

      const result = await sql`
        UPDATE estudiantes
        SET nombre = ${nombre.trim()}, apellido = ${apellido.trim()}, documento = ${documento.trim()}
        WHERE id = ${id} AND activo = TRUE
        RETURNING id, documento, nombre, apellido
      `;

      if (result.length === 0) {
        return {
          statusCode: 404,
          headers: jsonHeaders,
          body: JSON.stringify({ message: "Alumno no encontrado." }),
        };
      }

      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          message: "Alumno actualizado correctamente.",
          student: result[0],
        }),
      };
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === '23505') {
        return {
          statusCode: 409,
          headers: jsonHeaders,
          body: JSON.stringify({ message: "Ya existe un alumno con ese documento." }),
        };
      }
      console.error('Error al actualizar estudiante:', error);
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({ message: "Error interno al actualizar el alumno." }),
      };
    }
  }

  if (method === "DELETE") {
    try {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: jsonHeaders,
          body: JSON.stringify({ message: "Cuerpo de la solicitud vacío." }),
        };
      }

      const { id } = JSON.parse(event.body);

      if (!id) {
        return {
          statusCode: 400,
          headers: jsonHeaders,
          body: JSON.stringify({ message: "Falta el ID del alumno." }),
        };
      }

      const result = await sql`
        UPDATE estudiantes SET activo = FALSE
        WHERE id = ${id} AND activo = TRUE
        RETURNING id
      `;

      if (result.length === 0) {
        return {
          statusCode: 404,
          headers: jsonHeaders,
          body: JSON.stringify({ message: "Alumno no encontrado." }),
        };
      }

      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ message: "Alumno eliminado correctamente." }),
      };
    } catch (error: unknown) {
      console.error('Error al eliminar estudiante:', error);
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({ message: "Error interno al eliminar el alumno." }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: { ...jsonHeaders, "Allow": "POST, PUT, DELETE" },
    body: JSON.stringify({ message: "Método no permitido." }),
  };
};

export { handler };
