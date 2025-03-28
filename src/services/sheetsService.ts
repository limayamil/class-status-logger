import { toast } from "sonner";

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

// Mock data for development - This would be replaced with actual API calls to Google Sheets
const MOCK_STUDENTS: Student[] = Array.from({ length: 150 }, (_, i) => ({
  id: `student_${i + 1}`,
  name: `Estudiante ${i + 1}`,
  dni: `${30000000 + i}`,
}));

const MOCK_ATTENDANCE: Record<string, AttendanceRecord[]> = {};

// Helper to get today's date in YYYY-MM-DD format
const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

// For development, create some sample attendance data for the past 30 days
const initializeMockData = () => {
  const today = new Date();
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Randomly select between 20 and 120 students who attended
    const attendanceCount = Math.floor(Math.random() * 100) + 20;
    const attendingStudents = [...MOCK_STUDENTS]
      .sort(() => 0.5 - Math.random())
      .slice(0, attendanceCount);
      
    MOCK_ATTENDANCE[dateStr] = attendingStudents.map(student => ({
      timestamp: date.toISOString(),
      studentId: student.id,
      studentName: student.name,
      dni: student.dni,
      date: dateStr
    }));
  }
};

// Initialize mock data
initializeMockData();

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
  
  // Get attendance statistics
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
    const totalDays = dates.length;
    const studentStats = Object.entries(studentAttendance).map(([studentId, data]) => ({
      studentId,
      studentName: data.name,
      attendancePercentage: totalDays > 0 ? (data.present / totalDays) * 100 : 0
    })).sort((a, b) => a.attendancePercentage - b.attendancePercentage);
    
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
