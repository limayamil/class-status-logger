import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { ObjectId } from 'mongodb';
import { getCollection } from "../../src/services/mongoService";

// Interfaz para el documento de configuración (alineada con MongoDB)
interface ConfigDocument {
  _id?: ObjectId | string;
  configKey: string; // <-- Asegúrate que sea configKey
  totalClassesHeld: number; // <-- Asegúrate que sea totalClassesHeld
  updatedAt?: Date; 
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
      // Busca usando configKey
      const config = await configCollection.findOne({ configKey: CONFIG_KEY }); 
      // Obtiene el valor del campo totalClassesHeld
      const count = config ? config.totalClassesHeld : 0; 
      
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

      // Actualizar usando configKey para encontrar el doc
      // Incrementar el campo totalClassesHeld
      const result = await configCollection.updateOne(
        { configKey: CONFIG_KEY }, 
        { 
          $inc: { totalClassesHeld: incrementAmount }, // <-- Incrementar totalClassesHeld
          $set: { updatedAt: new Date() } 
        },
        { upsert: true }
      );

      // Leer el valor actualizado buscando con configKey
      const updatedConfig = await configCollection.findOne({ configKey: CONFIG_KEY });
      // Obtener el valor del campo totalClassesHeld
      const newCount = updatedConfig ? updatedConfig.totalClassesHeld : incrementAmount; 

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