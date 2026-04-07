import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { sql } from "../../src/services/neonService";

interface StatisticsResponse {
  dailyStats: { date: string; count: number }[];
  weeklyStats: { weekStartDate: string; count: number }[];
  monthlyStats: { month: string; count: number }[];
  studentStats: { studentName: string; attendanceCount: number; totalAttendanceCount: number }[];
  totalClassesHeld: number;
}

const jsonHeaders: { [header: string]: string | number | boolean } = {
  'Content-Type': 'application/json'
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: { ...jsonHeaders, "Allow": "GET" }, body: JSON.stringify({ message: "Método no permitido." }) };
  }

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL no está configurada.');
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ message: "Error interno: Configuración incompleta." }) };
  }

  try {
    // Ejecutar todas las queries en paralelo
    const [configResult, dailyStats, weeklyStats, monthlyStats, studentStats] = await Promise.all([
      // Total de clases impartidas
      sql`SELECT total_classes_held FROM configs WHERE config_key = 'classSettings'`,

      // Estadísticas diarias (últimos 7 días)
      sql`
        SELECT fecha::text AS date, COUNT(*)::int AS count
        FROM asistencias
        WHERE registrado_en >= NOW() - INTERVAL '7 days'
          AND estado = 'Presente'
        GROUP BY fecha
        ORDER BY fecha ASC
      `,

      // Estadísticas semanales (últimas 4 semanas)
      sql`
        SELECT DATE_TRUNC('week', registrado_en)::date::text AS "weekStartDate", COUNT(*)::int AS count
        FROM asistencias
        WHERE registrado_en >= DATE_TRUNC('week', NOW()) - INTERVAL '4 weeks'
          AND estado = 'Presente'
        GROUP BY DATE_TRUNC('week', registrado_en)
        ORDER BY DATE_TRUNC('week', registrado_en) ASC
      `,

      // Estadísticas mensuales (últimos 3 meses)
      sql`
        SELECT TO_CHAR(registrado_en, 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM asistencias
        WHERE registrado_en >= DATE_TRUNC('month', NOW()) - INTERVAL '3 months'
          AND estado = 'Presente'
        GROUP BY TO_CHAR(registrado_en, 'YYYY-MM')
        ORDER BY month ASC
      `,

      // Estadísticas por estudiante: 30 días + total en una sola query
      sql`
        SELECT
          nombre_estudiante AS "studentName",
          COUNT(*) FILTER (WHERE registrado_en >= NOW() - INTERVAL '30 days')::int AS "attendanceCount",
          COUNT(*)::int AS "totalAttendanceCount"
        FROM asistencias
        WHERE estado = 'Presente'
        GROUP BY nombre_estudiante
        HAVING COUNT(*) FILTER (WHERE registrado_en >= NOW() - INTERVAL '30 days') > 0
        ORDER BY "attendanceCount" ASC
      `,
    ]);

    const totalClassesHeld = configResult.length > 0 ? configResult[0].total_classes_held : 0;

    const responseData: StatisticsResponse = {
      dailyStats: dailyStats as StatisticsResponse['dailyStats'],
      weeklyStats: weeklyStats as StatisticsResponse['weeklyStats'],
      monthlyStats: monthlyStats as StatisticsResponse['monthlyStats'],
      studentStats: studentStats as StatisticsResponse['studentStats'],
      totalClassesHeld,
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
