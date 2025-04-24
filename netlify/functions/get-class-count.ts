import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { ObjectId } from 'mongodb';
import { getCollection } from "../../src/services/mongoService";

// Interfaz para el documento de configuración que almacena el contador de clases
interface ConfigDocument {
  _id?: ObjectId | string;
  key: string; // Identificador único para este valor de configuración
  value: number; // El valor del contador
  updatedAt: Date; // Última vez que se actualizó
}

const COLLECTION_NAME = 'configs';
const CONFIG_KEY = 'classSettings';

const jsonHeaders: { [header: string]: string | number | boolean } = {
  'Content-Type': 'application/json'
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Verificar MongoDB URI
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI no está configurada.');
    return { 
      statusCode: 500, 
      headers: jsonHeaders, 
      body: JSON.stringify({ message: "Error interno: Configuración incompleta." }) 
    };
  }

  try {
    const configCollection = await getCollection<ConfigDocument>(COLLECTION_NAME);
    
    // --- GET: Obtener valor actual del contador ---
    if (event.httpMethod === "GET") {
      const config = await configCollection.findOne({ configKey: CONFIG_KEY });
      
      // Si no existe, devolvemos 0 como valor predeterminado
      const count = config ? config.value : 0;
      
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ totalClassesHeld: count }),
      };
    }
    
    // --- POST: Incrementar el contador ---
    if (event.httpMethod === "POST") {
      // Se puede requerir un cuerpo para indicar cuánto incrementar, pero lo haremos
      // por defecto en +1 por simplicidad
      let incrementAmount = 1;

      // Si hay cuerpo con un incremento específico lo usamos (opcional)
      if (event.body) {
        try {
          const body = JSON.parse(event.body);
          if (typeof body.increment === 'number' && body.increment > 0) {
            incrementAmount = body.increment;
          }
        } catch (e) {
          // Si hay un error en el parseo, usamos el incremento por defecto
          console.warn('Error al parsear el cuerpo de la solicitud, usando incremento predeterminado');
        }
      }

      // Actualizar el contador usando $inc para operación atómica, con upsert para crearlo si no existe
      const result = await configCollection.updateOne(
        { key: CONFIG_KEY },
        { 
          $inc: { value: incrementAmount },
          $set: { updatedAt: new Date() }
        },
        { upsert: true }
      );

      // Leer el valor actualizado para devolverlo en la respuesta
      const updatedConfig = await configCollection.findOne({ key: CONFIG_KEY });
      const newCount = updatedConfig ? updatedConfig.value : incrementAmount; // Fallback si no se puede leer

      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ 
          message: "Contador de clases actualizado correctamente",
          totalClassesHeld: newCount,
          updated: result.modifiedCount > 0,
          created: result.upsertedCount > 0
        }),
      };
    }

    // Método no permitido
    return { 
      statusCode: 405, 
      headers: { ...jsonHeaders, "Allow": "GET, POST" }, 
      body: JSON.stringify({ message: "Método no permitido. Solo se aceptan GET y POST." }) 
    };

  } catch (error: unknown) {
    let errorMessage = "Error desconocido.";
    if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
    }
    console.error(errorMessage, error);
    return { 
      statusCode: 500, 
      headers: jsonHeaders, 
      body: JSON.stringify({ message: errorMessage }) 
    };
  }
};

export { handler }; 