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
  console.log('get-class-count function called with method:', event.httpMethod);
  
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
    console.log('Intentando conectar a MongoDB...');
    const configCollection = await getCollection<ConfigDocument>(COLLECTION_NAME);
    console.log('Conexión a MongoDB establecida');
    
    // --- GET: Obtener valor actual del contador ---
    if (event.httpMethod === "GET") {
      console.log('Buscando documento de configuración...');
      // Buscar o crear el documento de configuración
      let config = await configCollection.findOne({ configKey: CONFIG_KEY });
      console.log('Resultado de búsqueda:', config);
      
      if (!config) {
        console.log('Documento no encontrado, creando uno nuevo...');
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
      const totalClasses = typeof config.totalClassesHeld === 'number' ? config.totalClassesHeld : 0;
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
      
      // Buscar y actualizar el documento en una sola operación atómica
      const result = await configCollection.findOneAndUpdate(
        { configKey: CONFIG_KEY },
        { 
          $inc: { totalClassesHeld: 1 },
          $set: { updatedAt: new Date() }
        },
        { 
          upsert: true, // Crear si no existe
          returnDocument: 'after' // Devolver el documento actualizado
        }
      );
      
      if (!result) {
        console.error('Error: No se pudo actualizar el contador');
        return {
          statusCode: 500,
          headers: jsonHeaders,
          body: JSON.stringify({ message: "Error al actualizar el contador de clases." })
        };
      }
      
      const updatedCount = result.totalClassesHeld ?? 1;
      console.log('Documento actualizado, nuevo contador:', updatedCount);
      
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