import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { sql } from "../../src/services/neonService";

interface StatisticsResponse {
  dailyStats: { date: string; count: number }[];
  weeklyStats: { weekStartDate: string; count: number }[];
  monthlyStats: { month: string; count: number }[];
  studentStats: { studentName: string; attendanceCount: number; totalAttendanceCount: number }[];
  totalClassesHeld: number;
  totalUniqueStudents: number;
  averageAttendancePerClass: number;
  bestAttendanceDay?: { date: string; count: number };
  worstAttendanceDay?: { date: string; count: number };
  attendanceTrend: { direction: 'up' | 'down' | 'stable'; percentage: number };
}

const jsonHeaders: { [header: string]: string | number | boolean } = {
  'Content-Type': 'application/json'
};

function calculateTrend(trendRows: { week_start: string; count: number }[]): StatisticsResponse['attendanceTrend'] {
  if (trendRows.length < 2) return { direction: 'stable', percentage: 0 };

  const sorted = [...trendRows].sort((a, b) => a.week_start.localeCompare(b.week_start));
  const midpoint = Math.floor(sorted.length / 2);

  const olderWeeks = sorted.slice(0, midpoint);
  const recentWeeks = sorted.slice(midpoint);

  const olderAvg = olderWeeks.reduce((s, w) => s + w.count, 0) / olderWeeks.length;
  const recentAvg = recentWeeks.reduce((s, w) => s + w.count, 0) / recentWeeks.length;

  if (olderAvg === 0) return { direction: 'stable', percentage: 0 };

  const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
  const rounded = Math.round(Math.abs(changePercent) * 100) / 100;

  if (changePercent > 5) return { direction: 'up', percentage: rounded };
  if (changePercent < -5) return { direction: 'down', percentage: rounded };
  return { direction: 'stable', percentage: rounded };
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: { ...jsonHeaders, "Allow": "GET" }, body: JSON.stringify({ message: "Método no permitido." }) };
  }

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL no está configurada.');
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ message: "Error interno: Configuración incompleta." }) };
  }

  try {
    // Parse filter parameters
    const params = event.queryStringParameters || {};
    const dateFrom = params.dateFrom || null;
    const dateTo = params.dateTo || null;
    const estado = params.estado || 'Presente';
    const showFullHistory = params.showFullHistory === 'true';

    // Effective date boundaries (sentinel values for always-true conditions)
    const effectiveDateFrom = dateFrom || '1970-01-01';
    const effectiveDateTo = dateTo || '2999-12-31';

    // Compute time-window start dates
    const now = new Date();
    const toISO = (d: Date) => d.toISOString().slice(0, 10);
    const dailyWindowStart = showFullHistory ? effectiveDateFrom : toISO(new Date(now.getTime() - 7 * 86400000));
    const weeklyWindowStart = showFullHistory ? effectiveDateFrom : toISO(new Date(now.getTime() - 28 * 86400000));
    const monthlyWindowStart = showFullHistory ? effectiveDateFrom : toISO(new Date(now.getTime() - 90 * 86400000));
    const studentWindowStart = showFullHistory ? effectiveDateFrom : toISO(new Date(now.getTime() - 30 * 86400000));

    // Execute all queries in parallel
    const [
      configResult,
      dailyStats,
      weeklyStats,
      monthlyStats,
      studentStats,
      uniqueStudentsResult,
      bestDayResult,
      worstDayResult,
      trendData
    ] = await Promise.all([
      // 1. Total de clases impartidas
      sql`SELECT total_classes_held FROM configs WHERE config_key = 'classSettings'`,

      // 2. Estadísticas diarias
      sql`
        SELECT fecha::text AS date, COUNT(*)::int AS count
        FROM asistencias
        WHERE estado = ${estado}
          AND fecha >= ${dailyWindowStart}::date
          AND fecha <= ${effectiveDateTo}::date
          AND fecha >= ${effectiveDateFrom}::date
        GROUP BY fecha
        ORDER BY fecha ASC
      `,

      // 3. Estadísticas semanales
      sql`
        SELECT DATE_TRUNC('week', fecha)::date::text AS "weekStartDate", COUNT(*)::int AS count
        FROM asistencias
        WHERE estado = ${estado}
          AND fecha >= ${weeklyWindowStart}::date
          AND fecha <= ${effectiveDateTo}::date
          AND fecha >= ${effectiveDateFrom}::date
        GROUP BY DATE_TRUNC('week', fecha)
        ORDER BY DATE_TRUNC('week', fecha) ASC
      `,

      // 4. Estadísticas mensuales
      sql`
        SELECT TO_CHAR(fecha, 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM asistencias
        WHERE estado = ${estado}
          AND fecha >= ${monthlyWindowStart}::date
          AND fecha <= ${effectiveDateTo}::date
          AND fecha >= ${effectiveDateFrom}::date
        GROUP BY TO_CHAR(fecha, 'YYYY-MM')
        ORDER BY month ASC
      `,

      // 5. Estadísticas por estudiante
      sql`
        SELECT
          nombre_estudiante AS "studentName",
          COUNT(*) FILTER (WHERE fecha >= ${studentWindowStart}::date)::int AS "attendanceCount",
          COUNT(*)::int AS "totalAttendanceCount"
        FROM asistencias
        WHERE estado = ${estado}
          AND fecha >= ${effectiveDateFrom}::date
          AND fecha <= ${effectiveDateTo}::date
        GROUP BY nombre_estudiante
        HAVING COUNT(*) FILTER (WHERE fecha >= ${studentWindowStart}::date) > 0
        ORDER BY "attendanceCount" ASC
      `,

      // 6. Total de estudiantes únicos
      sql`
        SELECT COUNT(DISTINCT nombre_estudiante)::int AS count
        FROM asistencias
        WHERE estado = ${estado}
          AND fecha >= ${effectiveDateFrom}::date
          AND fecha <= ${effectiveDateTo}::date
      `,

      // 7. Mejor día de asistencia
      sql`
        SELECT fecha::text AS date, COUNT(*)::int AS count
        FROM asistencias
        WHERE estado = ${estado}
          AND fecha >= ${effectiveDateFrom}::date
          AND fecha <= ${effectiveDateTo}::date
        GROUP BY fecha
        ORDER BY count DESC, fecha DESC
        LIMIT 1
      `,

      // 8. Peor día de asistencia
      sql`
        SELECT fecha::text AS date, COUNT(*)::int AS count
        FROM asistencias
        WHERE estado = ${estado}
          AND fecha >= ${effectiveDateFrom}::date
          AND fecha <= ${effectiveDateTo}::date
        GROUP BY fecha
        ORDER BY count ASC, fecha ASC
        LIMIT 1
      `,

      // 9. Datos de tendencia (últimas 4 semanas para cálculo de tendencia)
      sql`
        SELECT
          DATE_TRUNC('week', fecha)::date::text AS week_start,
          COUNT(*)::int AS count
        FROM asistencias
        WHERE estado = ${estado}
          AND fecha >= ${toISO(new Date(now.getTime() - 28 * 86400000))}::date
          AND fecha >= ${effectiveDateFrom}::date
          AND fecha <= ${effectiveDateTo}::date
        GROUP BY DATE_TRUNC('week', fecha)
        ORDER BY week_start ASC
      `,
    ]);

    const totalClassesHeld = configResult.length > 0 ? configResult[0].total_classes_held : 0;
    const totalUniqueStudents = uniqueStudentsResult[0]?.count || 0;

    // Calculate average attendance per class
    const totalAttendance = (dailyStats as { count: number }[]).reduce((sum, d) => sum + d.count, 0);
    const averageAttendancePerClass = totalClassesHeld > 0
      ? Math.round((totalAttendance / totalClassesHeld) * 100) / 100
      : 0;

    const responseData: StatisticsResponse = {
      dailyStats: dailyStats as StatisticsResponse['dailyStats'],
      weeklyStats: weeklyStats as StatisticsResponse['weeklyStats'],
      monthlyStats: monthlyStats as StatisticsResponse['monthlyStats'],
      studentStats: studentStats as StatisticsResponse['studentStats'],
      totalClassesHeld,
      totalUniqueStudents,
      averageAttendancePerClass,
      bestAttendanceDay: bestDayResult.length > 0 ? bestDayResult[0] as StatisticsResponse['bestAttendanceDay'] : undefined,
      worstAttendanceDay: worstDayResult.length > 0 ? worstDayResult[0] as StatisticsResponse['worstAttendanceDay'] : undefined,
      attendanceTrend: calculateTrend(trendData as { week_start: string; count: number }[]),
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
