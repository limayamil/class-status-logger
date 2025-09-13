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

// Interfaz para el documento de configuración (alineada con MongoDB)
interface ConfigDocument {
  _id?: ObjectId | string;
  configKey: string;
  totalClassesHeld: number;
  updatedAt?: Date;
}

// Interfaz para la respuesta de la función
interface StatisticsResponse {
  dailyStats: { date: string; count: number }[];
  weeklyStats: { weekStartDate: string; count: number }[]; // Usaremos fecha de inicio de semana
  monthlyStats: { month: string; count: number }[]; // Formato YYYY-MM
  // Update studentStats to include total attendance count
  studentStats: { studentName: string; attendanceCount: number; totalAttendanceCount: number }[];
  totalClassesHeld: number; // Total de clases impartidas
  // New enhanced metrics
  totalUniqueStudents: number; // Total de estudiantes únicos que han asistido
  averageAttendancePerClass: number; // Promedio de asistencia por clase
  bestAttendanceDay?: { date: string; count: number }; // Mejor día de asistencia
  worstAttendanceDay?: { date: string; count: number }; // Peor día de asistencia
  attendanceTrend: { direction: 'up' | 'down' | 'stable'; percentage: number }; // Tendencia
}

const COLLECTION_NAME = 'asistencias';
const CONFIG_COLLECTION = 'configs';
const CONFIG_KEY = 'classSettings';

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

  // Extract query parameters for filtering
  const queryParams = event.queryStringParameters || {};
  const {
    dateFrom,
    dateTo,
    estado = 'Presente', // Default to 'Presente' to maintain backward compatibility
    showFullHistory
  } = queryParams;

  try {
    const asistenciasCollection = await getCollection<AsistenciaDocument>(COLLECTION_NAME);
    const configCollection = await getCollection<ConfigDocument>(CONFIG_COLLECTION);

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a inicio del día

    // --- Obtener totalClassesHeld de la colección de configuración ---
    const configDoc = await configCollection.findOne({ configKey: CONFIG_KEY });
    const totalClassesHeld = configDoc ? configDoc.totalClassesHeld : 0;

    // --- Build base match filter ---
    const baseMatchFilter: Record<string, unknown> = { estado };

    // --- Calculate date ranges based on parameters ---
    let dailyDateRange: Date, weeklyDateRange: Date, monthlyDateRange: Date, studentDateRange: Date;

    if (showFullHistory === 'true') {
      // Use very early date to get all historical data
      const veryEarlyDate = new Date('2020-01-01');
      dailyDateRange = weeklyDateRange = monthlyDateRange = studentDateRange = veryEarlyDate;
    } else if (dateFrom && dateTo) {
      // Use custom date range
      const customFromDate = new Date(dateFrom);
      dailyDateRange = weeklyDateRange = monthlyDateRange = studentDateRange = customFromDate;
    } else {
      // Use default ranges (backward compatibility)
      dailyDateRange = new Date(today);
      dailyDateRange.setDate(today.getDate() - 7);

      weeklyDateRange = getStartOfWeek(new Date(today.setDate(today.getDate() - (4 * 7))));

      monthlyDateRange = new Date(today.getFullYear(), today.getMonth() - 3, 1);

      studentDateRange = new Date(today);
      studentDateRange.setDate(today.getDate() - 30);
    }

    // --- Calcular Estadísticas Diarias ---
    const dailyMatchFilter = {
      ...baseMatchFilter,
      registradoEn: { $gte: dailyDateRange }
    };
    if (dateFrom && dateTo) {
      dailyMatchFilter.registradoEn = { $gte: new Date(dateFrom), $lte: new Date(dateTo) };
    }

    const dailyPipeline = [
      { $match: dailyMatchFilter },
      { $group: { _id: "$fecha", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }, // Ordenar por fecha
      { $project: { _id: 0, date: "$_id", count: 1 } } // Renombrar _id a date
    ];
    const dailyStats = await asistenciasCollection.aggregate<{ date: string; count: number }>(dailyPipeline).toArray();

    // --- Calcular Estadísticas Semanales ---
    const weeklyMatchFilter = {
      ...baseMatchFilter,
      registradoEn: { $gte: weeklyDateRange }
    };
    if (dateFrom && dateTo) {
      weeklyMatchFilter.registradoEn = { $gte: new Date(dateFrom), $lte: new Date(dateTo) };
    }

    const weeklyPipeline = [
        { $match: weeklyMatchFilter },
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


    // --- Calcular Estadísticas Mensuales ---
    const monthlyMatchFilter = {
      ...baseMatchFilter,
      registradoEn: { $gte: monthlyDateRange }
    };
    if (dateFrom && dateTo) {
      monthlyMatchFilter.registradoEn = { $gte: new Date(dateFrom), $lte: new Date(dateTo) };
    }

     const monthlyPipeline = [
        { $match: monthlyMatchFilter },
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


    // --- Calcular Estadísticas por Estudiante (período específico) ---
    const studentMatchFilter = {
      ...baseMatchFilter,
      registradoEn: { $gte: studentDateRange }
    };
    if (dateFrom && dateTo) {
      studentMatchFilter.registradoEn = { $gte: new Date(dateFrom), $lte: new Date(dateTo) };
    }

    const studentPipeline = [
      { $match: studentMatchFilter },
      { $group: { _id: "$nombreEstudiante", attendanceCount: { $sum: 1 } } },
      { $sort: { attendanceCount: 1 } }, // Ordenar por menos asistencias primero
      { $project: { _id: 0, studentName: "$_id", attendanceCount: 1 } }
    ];
    const studentStats30Days = await asistenciasCollection.aggregate<{ studentName: string; attendanceCount: number }>(studentPipeline).toArray();

    // --- Calcular Estadísticas Totales por Estudiante ---
    const totalStudentPipeline = [
      { $match: baseMatchFilter }, // Use base filter but without date restrictions for totals
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


    // --- Calcular Métricas Adicionales ---

    // Total de estudiantes únicos
    const totalUniqueStudents = totalStudentStats.length;

    // Promedio de asistencia por clase (basado en las estadísticas diarias filtradas)
    const totalDailyAttendances = dailyStats.reduce((sum, day) => sum + day.count, 0);
    const totalDaysWithData = dailyStats.length;
    const averageAttendancePerClass = totalDaysWithData > 0 ? totalDailyAttendances / totalDaysWithData : 0;

    // Mejor y peor día de asistencia (basado en estadísticas diarias)
    let bestAttendanceDay: { date: string; count: number } | undefined;
    let worstAttendanceDay: { date: string; count: number } | undefined;

    if (dailyStats.length > 0) {
      const sortedDailyStats = [...dailyStats].sort((a, b) => b.count - a.count);
      bestAttendanceDay = sortedDailyStats[0];
      worstAttendanceDay = sortedDailyStats[sortedDailyStats.length - 1];
    }

    // Tendencia de asistencia (comparar últimas 2 semanas con 2 semanas anteriores)
    let attendanceTrend: { direction: 'up' | 'down' | 'stable'; percentage: number } = {
      direction: 'stable',
      percentage: 0
    };

    if (weeklyStats.length >= 2) {
      const recentWeeks = weeklyStats.slice(-2);
      const olderWeeks = weeklyStats.slice(-4, -2);

      if (olderWeeks.length >= 2) {
        const recentAvg = recentWeeks.reduce((sum, week) => sum + week.count, 0) / recentWeeks.length;
        const olderAvg = olderWeeks.reduce((sum, week) => sum + week.count, 0) / olderWeeks.length;

        if (olderAvg > 0) {
          const percentageChange = ((recentAvg - olderAvg) / olderAvg) * 100;
          attendanceTrend.percentage = Math.abs(percentageChange);

          if (percentageChange > 5) {
            attendanceTrend.direction = 'up';
          } else if (percentageChange < -5) {
            attendanceTrend.direction = 'down';
          } else {
            attendanceTrend.direction = 'stable';
          }
        }
      }
    }

    // --- Ensamblar Respuesta (Ahora incluye todas las métricas) ---
    const responseData: StatisticsResponse = {
      dailyStats,
      weeklyStats,
      monthlyStats,
      studentStats: combinedStudentStats, // Use the combined stats
      totalClassesHeld, // Usa el valor corregido
      totalUniqueStudents,
      averageAttendancePerClass: Math.round(averageAttendancePerClass * 10) / 10, // Round to 1 decimal
      bestAttendanceDay,
      worstAttendanceDay,
      attendanceTrend
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
