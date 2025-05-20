import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { ObjectId } from 'mongodb';
import { getCollection } from "../../src/services/mongoService"; // Ajusta la ruta si es necesario

// Interfaz para el documento almacenado en MongoDB (igual que en registrar-asistencia)
interface AsistenciaDocument {
  _id?: ObjectId;
  fecha: string; // Ej: "2024-04-15"
  nombreEstudiante: string;
  estado: 'Presente' | 'Ausente' | 'Justificado';
  materia?: string;
  comision?: string;
  registradoEn: Date; // Marca de tiempo del servidor
}

// Nombre de la colección en MongoDB
const COLLECTION_NAME = 'asistencias';

// Encabezados comunes para respuestas JSON
const jsonHeaders: { [header: string]: string | number | boolean } = {
  'Content-Type': 'application/json'
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Solo permitir solicitudes GET
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405, // Method Not Allowed
      headers: { ...jsonHeaders, "Allow": "GET" },
      body: JSON.stringify({ message: "Método no permitido. Solo se acepta GET." }),
    };
  }

  // Obtener la fecha del query string
  const dateParam = event.queryStringParameters?.date;
  const studentNameParam = event.queryStringParameters?.studentName;

  if (!dateParam && !studentNameParam) {
    return {
      statusCode: 400, // Bad Request
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Faltan los parámetros requeridos. Se necesita 'date' o 'studentName'." }),
    };
  }

  // Validación simple del formato de fecha (YYYY-MM-DD) si se proporciona dateParam
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

  // Verificar que MONGODB_URI esté disponible
  if (!process.env.MONGODB_URI) {
      console.error('Error: MONGODB_URI no está configurada en el entorno.');
      return {
          statusCode: 500,
          headers: jsonHeaders,
          body: JSON.stringify({ message: "Error interno del servidor: Configuración incompleta." }),
      };
  }

  try {
    // Obtener la colección de MongoDB
    const asistenciasCollection = await getCollection<AsistenciaDocument>(COLLECTION_NAME);

    // Construir el filtro dinámicamente
    const filter: { fecha?: string; nombreEstudiante?: string } = {};
    if (dateParam) {
      filter.fecha = dateParam;
    }
    if (studentNameParam) {
      filter.nombreEstudiante = studentNameParam;
    }

    // Buscar los registros para la fecha especificada y/o estudiante
    // Ordenamos por fecha de registro para que aparezcan en orden de llegada
    const records = await asistenciasCollection.find(filter).sort({ registradoEn: 1 }).toArray();

    // Devolver los registros encontrados
    return {
      statusCode: 200, // OK
      headers: jsonHeaders,
      body: JSON.stringify(records), // Devolvemos el array de documentos
    };

  } catch (error: unknown) {
    let errorMessage = "Error desconocido al obtener asistencias.";
    if (error instanceof Error) {
        errorMessage = `Error al obtener asistencias: ${error.message}`;
    }
    console.error(errorMessage, error);
    return {
      statusCode: 500, // Internal Server Error
      headers: jsonHeaders,
      body: JSON.stringify({ message: errorMessage }),
    };
  }
};

export { handler };
