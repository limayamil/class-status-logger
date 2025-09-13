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

  // Obtener parámetros del query string
  const queryParams = event.queryStringParameters || {};
  const {
    date: dateParam,
    dateFrom,
    dateTo,
    studentName: studentNameParam,
    materia,
    comision,
    estado
  } = queryParams;

  // Validar que al menos un parámetro esté presente
  if (!dateParam && !studentNameParam && !dateFrom && !dateTo) {
    return {
      statusCode: 400, // Bad Request
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Faltan los parámetros requeridos. Se necesita 'date', 'dateFrom/dateTo' o 'studentName'." }),
    };
  }

  // Validación simple del formato de fecha (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateParam && !dateRegex.test(dateParam)) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Formato de fecha inválido. Use YYYY-MM-DD." }),
    };
  }
  if (dateFrom && !dateRegex.test(dateFrom)) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Formato de dateFrom inválido. Use YYYY-MM-DD." }),
    };
  }
  if (dateTo && !dateRegex.test(dateTo)) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Formato de dateTo inválido. Use YYYY-MM-DD." }),
    };
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
    const filter: Record<string, unknown> = {};

    // Filtro por fecha específica o rango de fechas
    if (dateParam) {
      filter.fecha = dateParam;
    } else if (dateFrom || dateTo) {
      // Si solo hay dateFrom, buscar desde esa fecha en adelante
      // Si solo hay dateTo, buscar hasta esa fecha
      // Si hay ambos, buscar en el rango
      const dateFilter: Record<string, string> = {};
      if (dateFrom) {
        dateFilter.$gte = dateFrom;
      }
      if (dateTo) {
        dateFilter.$lte = dateTo;
      }
      filter.fecha = dateFilter;
    }

    // Otros filtros
    if (studentNameParam) {
      filter.nombreEstudiante = studentNameParam;
    }
    if (materia) {
      filter.materia = materia;
    }
    if (comision) {
      filter.comision = comision;
    }
    if (estado) {
      filter.estado = estado;
    }

    // Buscar los registros con los filtros aplicados
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
