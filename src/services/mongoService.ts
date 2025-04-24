import { MongoClient, Db, Collection } from 'mongodb';

// Asegúrate de que la variable de entorno MONGODB_URI esté configurada
// en tu entorno local (.env) y en Netlify.
const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('La variable de entorno MONGODB_URI no está definida.');
}

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Conecta a la base de datos MongoDB si aún no está conectado.
 * Reutiliza la conexión existente si ya está establecida.
 */
async function connectToDatabase(): Promise<Db> {
  // Si ya tenemos una instancia de Db, la conexión está activa (o el driver la manejará)
  if (db) {
    console.log('Reutilizando conexión existente a MongoDB');
    return db;
  }

  try {
    console.log('Creando nueva conexión a MongoDB...');
    client = new MongoClient(uri, {
      // Opciones recomendadas por MongoDB Atlas
      // useNewUrlParser: true, // Deprecado en versiones recientes del driver
      // useUnifiedTopology: true, // Deprecado en versiones recientes del driver
    });

    console.log('Conectando a MongoDB Atlas...');
    await client.connect();
    console.log('Conexión a MongoDB Atlas establecida.');

    // Selecciona la base de datos. Puedes cambiar 'asistenciasDB' si lo deseas.
    db = client.db('asistenciasDB');
    console.log('Base de datos seleccionada:', db.databaseName);
    return db;
  } catch (error) {
    console.error('Error detallado al conectar con MongoDB:', error);
    // Si la conexión falla, asegúrate de cerrar el cliente si se inicializó
    if (client) {
      console.log('Cerrando conexión fallida...');
      await client.close();
      client = null;
      db = null;
    }
    throw error; // Relanza el error para que la función que llama lo maneje
  }
}

/**
 * Obtiene una referencia a una colección específica.
 * @param collectionName El nombre de la colección.
 * @returns Una instancia de la colección.
 */
async function getCollection<T>(collectionName: string): Promise<Collection<T>> {
  console.log('Solicitando colección:', collectionName);
  const database = await connectToDatabase();
  const collection = database.collection<T>(collectionName);
  console.log('Colección obtenida:', collectionName);
  return collection;
}

// Exporta las funciones que necesitarás
export { connectToDatabase, getCollection };

// Opcional: Manejo de cierre de conexión al terminar el proceso (más relevante para scripts largos o servidores)
// process.on('SIGINT', async () => {
//   if (client) {
//     await client.close();
//     console.log('Conexión a MongoDB cerrada.');
//   }
//   process.exit();
// });
