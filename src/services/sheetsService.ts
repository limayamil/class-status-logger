import { toast } from "sonner";
import { ESTUDIANTES_REALES } from "./estudiantesData";

interface Student {
  id: string;
  name: string;
  dni: string;
}

interface AttendanceRecord {
  timestamp: string;
  studentId: string;
  studentName: string;
  dni: string;
  date: string;
}

// Convertir datos reales al formato de la aplicación
const MOCK_STUDENTS: Student[] = ESTUDIANTES_REALES.map((estudiante, index) => ({
  id: `student_${index + 1}`,
  name: `${estudiante.nombre} ${estudiante.apellido}`,
  dni: estudiante.documento
}));

// Crear un objeto vacío para los registros de asistencia
const MOCK_ATTENDANCE: Record<string, AttendanceRecord[]> = {};

// Helper to get today's date in YYYY-MM-DD format
const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Mock implementation of the service - would be replaced with actual API calls
export const sheetsService = {
  // Get all students
  getStudents: async (): Promise<Student[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return MOCK_STUDENTS;
  },
  
  // Mark a student as present
  markAttendance: async (studentId: string, studentName: string, dni: string): Promise<boolean> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificar que el ID del estudiante existe y que el DNI coincide
    const student = MOCK_STUDENTS.find(s => s.id === studentId);
    if (!student) {
      toast.error("Estudiante no encontrado");
      return false;
    }
    
    // Verificación adicional de seguridad en el backend
    if (student.dni !== dni) {
      toast.error("El DNI no coincide con los registros del sistema");
      return false;
    }
    
    const today = getTodayDate();
    
    // Check if student already marked attendance today
    if (MOCK_ATTENDANCE[today]?.some(record => record.studentId === studentId)) {
      toast.error("Ya registraste tu asistencia hoy");
      return false;
    }
    
    // Create new attendance record
    const newRecord: AttendanceRecord = {
      timestamp: new Date().toISOString(),
      studentId,
      studentName,
      dni,
      date: today
    };
    
    // Add to mock attendance data
    if (!MOCK_ATTENDANCE[today]) {
      MOCK_ATTENDANCE[today] = [];
    }
    
    MOCK_ATTENDANCE[today].push(newRecord);
    toast.success("Asistencia registrada correctamente");
    return true;
  },
  
  // Get attendance for a specific date
  getAttendance: async (date: string): Promise<AttendanceRecord[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 700));
    return MOCK_ATTENDANCE[date] || [];
  },
  
  // Get statistics
  getStatistics: async (): Promise<{
    dailyStats: { date: string, count: number }[],
    weeklyStats: { week: string, count: number }[],
    monthlyStats: { month: string, count: number }[],
    studentStats: { studentId: string, studentName: string, attendancePercentage: number }[]
  }> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Process the mock data to generate statistics
    const dates = Object.keys(MOCK_ATTENDANCE).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    // Daily stats - last 7 days
    const dailyStats = dates.slice(0, 7).map(date => ({
      date,
      count: MOCK_ATTENDANCE[date]?.length || 0
    }));
    
    // Si no hay datos, añadir el día de hoy con 0 asistencias
    if (dailyStats.length === 0) {
      dailyStats.push({
        date: getTodayDate(),
        count: 0
      });
    }
    
    // Weekly stats - Group by week
    const weeklyMap: Record<string, number> = {};
    dates.forEach(date => {
      const d = new Date(date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyMap[weekKey]) {
        weeklyMap[weekKey] = 0;
      }
      weeklyMap[weekKey] += MOCK_ATTENDANCE[date]?.length || 0;
    });
    
    const weeklyStats = Object.entries(weeklyMap)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => new Date(b.week).getTime() - new Date(a.week).getTime())
      .slice(0, 4);
      
    // Si no hay datos semanales, añadir la semana actual con 0 asistencias
    if (weeklyStats.length === 0) {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      weeklyStats.push({
        week: weekStart.toISOString().split('T')[0],
        count: 0
      });
    }
    
    // Monthly stats
    const monthlyMap: Record<string, number> = {};
    dates.forEach(date => {
      const monthKey = date.substring(0, 7); // YYYY-MM
      
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = 0;
      }
      monthlyMap[monthKey] += MOCK_ATTENDANCE[date]?.length || 0;
    });
    
    const monthlyStats = Object.entries(monthlyMap)
      .map(([month, count]) => ({ 
        month, 
        count 
      }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 3);
      
    // Si no hay datos mensuales, añadir el mes actual con 0 asistencias
    if (monthlyStats.length === 0) {
      const today = getTodayDate();
      monthlyStats.push({
        month: today.substring(0, 7),
        count: 0
      });
    }
    
    // Student attendance percentage
    const studentAttendance: Record<string, { present: number, name: string }> = {};
    
    // Initialize all students with 0 attendance
    MOCK_STUDENTS.forEach(student => {
      studentAttendance[student.id] = { present: 0, name: student.name };
    });
    
    // Count attendance for each student
    Object.values(MOCK_ATTENDANCE).forEach(records => {
      records.forEach(record => {
        if (studentAttendance[record.studentId]) {
          studentAttendance[record.studentId].present += 1;
        }
      });
    });
    
    // Calculate percentage based on total days
    const totalDays = dates.length || 1; // Evitar división por cero
    const studentStats = Object.entries(studentAttendance).map(([studentId, data]) => ({
      studentId,
      studentName: data.name,
      attendancePercentage: totalDays > 0 ? (data.present / totalDays) * 100 : 0
    })).sort((a, b) => b.attendancePercentage - a.attendancePercentage);
    
    return {
      dailyStats,
      weeklyStats,
      monthlyStats,
      studentStats
    };
  },
  
  // Export attendance to PDF (mock implementation)
  exportToPDF: async (date: string): Promise<boolean> => {
    toast.info("Exportando a PDF... (simulación)");
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success("Archivo PDF generado correctamente. Descarga iniciada.");
    return true;
  },
  
  // Export attendance to Google Sheets (mock implementation)
  exportToSheets: async (date: string): Promise<boolean> => {
    toast.info("Exportando a Google Sheets... (simulación)");
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success("Datos exportados correctamente a Google Sheets.");
    return true;
  }
};
