import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { ObjectId } from 'mongodb';
import { getCollection } from "../../src/services/mongoService";

// Interfaz para el documento de asistencia (igual que en otras funciones)
interface AsistenciaDocument {
  _id?: ObjectId;
  fecha: string; // Ej: "2024-04-15"
  nombreEstudiante: string;
  estado: 'Presente' | 'Ausente' | 'Justificado';
  materia?: string;
  comision?: string;
  registradoEn: Date; // Marca de tiempo del servidor
}

// Interfaz para el documento de configuración
interface ConfigDocument {
  _id?: ObjectId | string;
  key: string;
  value: number;
  updatedAt: Date;
}

// Interfaz para la respuesta de la función
interface StatisticsResponse {
  dailyStats: { date: string; count: number }[];
  weeklyStats: { weekStartDate: string; count: number }[]; // Usaremos fecha de inicio de semana
  monthlyStats: { month: string; count: number }[]; // Formato YYYY-MM
  // Update studentStats to include total attendance count
  studentStats: { studentName: string; attendanceCount: number; totalAttendanceCount: number }[];
  totalClassesHeld: number; // Total de clases impartidas
}

const COLLECTION_NAME = 'asistencias';
const CONFIG_COLLECTION = 'config';
const CONFIG_KEY = 'totalClassesHeld';

const jsonHeaders: { [header: string]: string | number | boolean } = {
  'Content-Type': 'application/json'
};

// Helper para obtener la fecha de inicio de la semana (lunes)
function getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Domingo, 1 = Lunes, ...
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar al lunes
    return new Date(d.setDate(diff));
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: { ...jsonHeaders, "Allow": "GET" }, body: JSON.stringify({ message: "Método no permitido." }) };
  }

  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI no está configurada.');
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ message: "Error interno: Configuración incompleta." }) };
  }

  try {
    const asistenciasCollection = await getCollection<AsistenciaDocument>(COLLECTION_NAME);
    const configCollection = await getCollection<ConfigDocument>(CONFIG_COLLECTION);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a inicio del día

    // --- Obtener totalClassesHeld de la colección de configuración ---
    const configDoc = await configCollection.findOne({ key: CONFIG_KEY });
    const totalClassesHeld = configDoc ? configDoc.value : 0; // Si no existe, usamos 0 como valor predeterminado

    // --- Calcular Estadísticas Diarias (Últimos 7 días) ---
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const dailyPipeline = [
      { $match: { registradoEn: { $gte: sevenDaysAgo }, estado: 'Presente' } },
      { $group: { _id: "$fecha", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }, // Ordenar por fecha
      { $project: { _id: 0, date: "$_id", count: 1 } } // Renombrar _id a date
    ];
    const dailyStats = await asistenciasCollection.aggregate<{ date: string; count: number }>(dailyPipeline).toArray();

    // --- Calcular Estadísticas Semanales (Últimas 4 semanas) ---
    const fourWeeksAgoMonday = getStartOfWeek(new Date(today.setDate(today.getDate() - (4 * 7))));
    const weeklyPipeline = [
        { $match: { registradoEn: { $gte: fourWeeksAgoMonday }, estado: 'Presente' } },
        {
            $group: {
                // Agrupar por el lunes de la semana
                _id: {
                    $dateTrunc: { date: "$registradoEn", unit: "week", startOfWeek: "monday" }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, weekStartDate: { $dateToString: { format: "%Y-%m-%d", date: "$_id" } }, count: 1 } }
    ];
    const weeklyStats = await asistenciasCollection.aggregate<{ weekStartDate: string; count: number }>(weeklyPipeline).toArray();


    // --- Calcular Estadísticas Mensuales (Últimos 3 meses) ---
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1); // Inicio de hace 3 meses
     const monthlyPipeline = [
        { $match: { registradoEn: { $gte: threeMonthsAgo }, estado: 'Presente' } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$registradoEn" } }, // Agrupar por año-mes
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, month: "$_id", count: 1 } }
    ];
    const monthlyStats = await asistenciasCollection.aggregate<{ month: string; count: number }>(monthlyPipeline).toArray();


    // --- Calcular Estadísticas por Estudiante (Últimos 30 días) ---
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const studentPipeline = [
      { $match: { registradoEn: { $gte: thirtyDaysAgo }, estado: 'Presente' } },
      { $group: { _id: "$nombreEstudiante", attendanceCount: { $sum: 1 } } },
      { $sort: { attendanceCount: 1 } }, // Ordenar por menos asistencias primero
      { $project: { _id: 0, studentName: "$_id", attendanceCount: 1 } }
    ];
    const studentStats30Days = await asistenciasCollection.aggregate<{ studentName: string; attendanceCount: number }>(studentPipeline).toArray();

    // --- Calcular Estadísticas Totales por Estudiante ---
    const totalStudentPipeline = [
      { $match: { estado: 'Presente' } }, // Match all 'Presente' records regardless of date
      { $group: { _id: "$nombreEstudiante", totalAttendanceCount: { $sum: 1 } } },
      { $project: { _id: 0, studentName: "$_id", totalAttendanceCount: 1 } }
    ];
    const totalStudentStats = await asistenciasCollection.aggregate<{ studentName: string; totalAttendanceCount: number }>(totalStudentPipeline).toArray();

    // Create a map for quick lookup of total counts
    const totalCountsMap = new Map<string, number>();
    totalStudentStats.forEach(stat => {
      totalCountsMap.set(stat.studentName, stat.totalAttendanceCount);
    });

    // Combine the stats: Add totalAttendanceCount to the 30-day stats list
    // The list remains sorted by the 30-day attendance count (lowest first)
    const combinedStudentStats = studentStats30Days.map(stat30 => ({
      ...stat30,
      totalAttendanceCount: totalCountsMap.get(stat30.studentName) || 0 // Get total count, default to 0
    }));


    // --- Ensamblar Respuesta (Ahora incluye totalClassesHeld) ---
    const responseData: StatisticsResponse = {
      dailyStats,
      weeklyStats,
      monthlyStats,
      studentStats: combinedStudentStats, // Use the combined stats
      totalClassesHeld // Añadimos el total de clases impartidas
    };

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify(responseData),
    };

  } catch (error: unknown) {
    let errorMessage = "Error desconocido al calcular estadísticas.";
    if (error instanceof Error) {
        errorMessage = `Error al calcular estadísticas: ${error.message}`;
    }
    console.error(errorMessage, error);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ message: errorMessage }) };
  }
};

export { handler };
