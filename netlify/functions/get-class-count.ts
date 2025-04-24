import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { ObjectId, WithId, ModifyResult } from 'mongodb';
import { getCollection } from "../../src/services/mongoService";

// Interfaz para el documento de configuración (alineada con MongoDB)
interface ConfigDocument {
  _id?: ObjectId | string;
  configKey: string;
  totalClassesHeld: number;
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
      // Buscar o crear el documento de configuración
      let config = await configCollection.findOne({ configKey: CONFIG_KEY });
      
      if (!config) {
        // Si no existe el documento, lo creamos con valor inicial 0
        const initialConfig: ConfigDocument = {
          configKey: CONFIG_KEY,
          totalClassesHeld: 0,
          updatedAt: new Date()
        };
        
        const result = await configCollection.insertOne(initialConfig);
        config = { ...initialConfig, _id: result.insertedId };
        
        console.log('Documento de configuración inicial creado:', result.insertedId);
      }
      
      // Asegurarnos de que totalClassesHeld sea un número
      const count = config && typeof config.totalClassesHeld === 'number' ? config.totalClassesHeld : 0;
      
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ totalClassesHeld: count }),
      };
    }
    
    // --- POST: Incrementar el contador ---
    if (event.httpMethod === "POST") {
      let incrementAmount = 1;

      if (event.body) {
        try {
          const body = JSON.parse(event.body);
          if (typeof body.increment === 'number' && body.increment > 0) {
            incrementAmount = body.increment;
          }
        } catch (e) {
          console.warn('Error al parsear el cuerpo de la solicitud, usando incremento predeterminado');
        }
      }

      // Usar findOneAndUpdate para obtener el valor actualizado en una sola operación
      const result = await configCollection.findOneAndUpdate(
        { configKey: CONFIG_KEY },
        { 
          $inc: { totalClassesHeld: incrementAmount },
          $set: { updatedAt: new Date() }
        },
        { 
          upsert: true,
          returnDocument: 'after'
        }
      );

      const newCount = result?.totalClassesHeld ?? incrementAmount;

      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ 
          message: "Contador de clases actualizado correctamente",
          totalClassesHeld: newCount,
          updated: true
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