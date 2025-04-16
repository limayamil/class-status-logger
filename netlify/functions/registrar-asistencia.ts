import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { ObjectId } from 'mongodb'; // Importar ObjectId
import { getCollection } from "../../src/services/mongoService"; // Ajusta la ruta si es necesario

// Interfaz para los datos de asistencia esperados en el cuerpo de la solicitud
interface AsistenciaData {
  fecha: string; // Ej: "2024-04-15"
  nombreEstudiante: string;
  estado: 'Presente' | 'Ausente' | 'Justificado'; // O los estados que uses
  // Puedes añadir más campos si los necesitas, ej: materia, profesor, etc.
  materia?: string;
  comision?: string;
}

// Interfaz para el documento almacenado en MongoDB
interface AsistenciaDocument extends AsistenciaData {
  _id?: ObjectId; // MongoDB añade este campo
  registradoEn: Date; // Marca de tiempo del servidor
}

// Nombre de la colección en MongoDB
const COLLECTION_NAME = 'asistencias';

// Encabezados comunes para respuestas JSON
const jsonHeaders: { [header: string]: string | number | boolean } = {
  'Content-Type': 'application/json'
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Solo permitir solicitudes POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405, // Method Not Allowed
      headers: { // Combinar encabezados comunes y específicos para 405
        ...jsonHeaders,
        "Allow": "POST"
      },
      body: JSON.stringify({ message: "Método no permitido. Solo se acepta POST." }),
    };
  }

  // Verificar que MONGODB_URI esté disponible (Netlify lo inyecta desde la config)
  if (!process.env.MONGODB_URI) {
      console.error('Error: MONGODB_URI no está configurada en el entorno.');
      return {
          statusCode: 500,
          headers: jsonHeaders, // Usar encabezados comunes
          body: JSON.stringify({ message: "Error interno del servidor: Configuración incompleta." }),
      };
  }

  let asistenciaData: AsistenciaData;

  try {
    // Parsear el cuerpo de la solicitud
    if (!event.body) {
      return {
        statusCode: 400, // Bad Request
        headers: jsonHeaders, // Usar encabezados comunes
        body: JSON.stringify({ message: "Cuerpo de la solicitud vacío." }),
      };
    }
    asistenciaData = JSON.parse(event.body);

    // Validación básica (puedes añadir validaciones más robustas)
    if (!asistenciaData.fecha || !asistenciaData.nombreEstudiante || !asistenciaData.estado) {
      return {
        statusCode: 400,
        headers: jsonHeaders, // Usar encabezados comunes
        body: JSON.stringify({ message: "Faltan datos requeridos (fecha, nombreEstudiante, estado)." }),
      };
    }

  } catch (error) {
    console.error('Error al parsear el cuerpo de la solicitud:', error);
    return {
      statusCode: 400,
      headers: jsonHeaders, // Usar encabezados comunes
      body: JSON.stringify({ message: "Error en el formato del cuerpo de la solicitud (debe ser JSON)." }),
    };
  }

  try {
    // Obtener la colección de MongoDB, especificando el tipo de documento
    const asistenciasCollection = await getCollection<AsistenciaDocument>(COLLECTION_NAME);

    // Crear el documento a insertar
    const documentoAInsertar: Omit<AsistenciaDocument, '_id'> = {
        ...asistenciaData,
        registradoEn: new Date(), // Añadir la marca de tiempo del servidor
    };

    // Insertar el nuevo registro de asistencia
    const result = await asistenciasCollection.insertOne(documentoAInsertar);

    console.log(`Asistencia registrada con ID: ${result.insertedId}`);

    // Enviar respuesta de éxito
    return {
      statusCode: 201, // Created
      headers: jsonHeaders, // Usar encabezados comunes
      body: JSON.stringify({ message: "Asistencia registrada correctamente.", id: result.insertedId }),
    };

  } catch (error) {
    console.error('Error al registrar la asistencia en MongoDB:', error);
    return {
      statusCode: 500, // Internal Server Error
      headers: jsonHeaders, // Usar encabezados comunes
      body: JSON.stringify({ message: "Error interno al guardar la asistencia." }),
    };
  }
};

export { handler };
