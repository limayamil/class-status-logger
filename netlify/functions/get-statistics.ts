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

// Interfaz para la respuesta de la función
interface StatisticsResponse {
  dailyStats: { date: string; count: number }[];
  weeklyStats: { weekStartDate: string; count: number }[]; // Usaremos fecha de inicio de semana
  monthlyStats: { month: string; count: number }[]; // Formato YYYY-MM
  studentStats: { studentName: string; attendanceCount: number }[];
}

const COLLECTION_NAME = 'asistencias';
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
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a inicio del día

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
    const studentStats = await asistenciasCollection.aggregate<{ studentName: string; attendanceCount: number }>(studentPipeline).toArray();

    // --- Ensamblar Respuesta ---
    const responseData: StatisticsResponse = {
      dailyStats,
      weeklyStats,
      monthlyStats,
      studentStats
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
