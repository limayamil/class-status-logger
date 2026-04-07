import { toast } from "sonner";

const MAKE_WEBHOOK_URL = import.meta.env.VITE_MAKE_WEBHOOK_URL as string;

interface Student {
  id: string;
  name: string;
  dni: string;
}

interface StudentWithDetails extends Student {
  nombre: string;
  apellido: string;
}

interface AttendanceRecord {
  timestamp: string;
  studentId: string;
  studentName: string;
  dni: string;
  date: string;
}

// Cache de estudiantes obtenidos desde la API
let cachedStudents: StudentWithDetails[] | null = null;

const getOrFetchStudents = async (): Promise<StudentWithDetails[]> => {
  if (cachedStudents) return cachedStudents;
  const response = await fetch('/.netlify/functions/get-estudiantes');
  if (!response.ok) throw new Error('Error al cargar estudiantes');
  cachedStudents = await response.json();
  return cachedStudents!;
};

// Crear un objeto vacío para los registros de asistencia
const MOCK_ATTENDANCE: Record<string, AttendanceRecord[]> = {};

// Helper to get today's date in YYYY-MM-DD format based on local time
const getTodayDate = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  // getMonth() is 0-indexed, so add 1
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Service for attendance operations
export const sheetsService = {
  // Get all students
  getStudents: async (): Promise<Student[]> => {
    return await getOrFetchStudents();
  },

  // Mark a student as present
  markAttendance: async (studentId: string, studentName: string, dni: string): Promise<boolean> => {
    const students = await getOrFetchStudents();

    // Verificar que el ID del estudiante existe y que el DNI coincide
    const student = students.find(s => s.id === studentId);
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

    // Crear datos para el webhook
    const now = new Date();
    const webhookData = {
      fecha: today,
      hora: now.toTimeString().split(' ')[0], // Format: HH:MM:SS
      documento: dni,
      nombre: student.nombre,
      apellido: student.apellido
    };

    try {
      console.log("Enviando datos al webhook:", webhookData);

      // Enviar datos al webhook de Make
      const response = await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData),
      });

      // Imprimir la respuesta para diagnóstico
      console.log("Respuesta del webhook:", response.status, response.statusText);

      // Make podría responder con un status 200 pero con un cuerpo de error
      let responseBody = null;
      try {
        responseBody = await response.text();
        console.log("Cuerpo de la respuesta:", responseBody);
      } catch (e) {
        console.log("No se pudo leer el cuerpo de la respuesta");
      }

      if (!response.ok) {
        throw new Error(`Error al registrar asistencia: ${response.statusText}`);
      }

      // Create new attendance record para almacenamiento local
      const newRecord: AttendanceRecord = {
        timestamp: now.toISOString(),
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
      toast.success("¡Gracias por usar AsistenciaUNI!");
      return true;
    } catch (error) {
      console.error("Error al enviar datos al webhook:", error);

      // Almacenar localmente de todos modos si el webhook falla
      const newRecord: AttendanceRecord = {
        timestamp: new Date().toISOString(),
        studentId,
        studentName,
        dni,
        date: today
      };

      if (!MOCK_ATTENDANCE[today]) {
        MOCK_ATTENDANCE[today] = [];
      }

      MOCK_ATTENDANCE[today].push(newRecord);

      toast.warning("La asistencia se registró localmente, pero hubo un problema de conexión con el servidor.");
      return true;
    }
  },

  // Export attendance to PDF (using webhook)
  exportToPDF: async (date: string): Promise<boolean> => {
    toast.info("Exportando a PDF...");

    try {
      const students = await getOrFetchStudents();
      // Obtener registros de asistencia para la fecha
      const attendanceRecords = MOCK_ATTENDANCE[date] || [];

      // Preparar datos para el webhook
      const webhookData = {
        action: "ExportToPDF",
        date: date,
        records: attendanceRecords.map(record => {
          const estudianteOriginal = students.find(e => e.dni === record.dni);

          return {
            fecha: date,
            hora: new Date(record.timestamp).toTimeString().split(' ')[0],
            documento: record.dni,
            nombre: estudianteOriginal ? estudianteOriginal.nombre : '',
            apellido: estudianteOriginal ? estudianteOriginal.apellido : '',
            nombreCompleto: record.studentName
          };
        })
      };

      console.log("Enviando datos de exportación PDF:", webhookData);

      // Enviar datos al webhook
      const response = await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData),
      });

      // Imprimir la respuesta para diagnóstico
      console.log("Respuesta del webhook (PDF):", response.status, response.statusText);

      // Intentar leer el cuerpo de la respuesta
      try {
        const responseBody = await response.text();
        console.log("Cuerpo de la respuesta:", responseBody);
      } catch (e) {
        console.log("No se pudo leer el cuerpo de la respuesta");
      }

      if (!response.ok) {
        throw new Error(`Error al exportar a PDF: ${response.statusText}`);
      }

      toast.success("Archivo PDF generado correctamente. Descarga iniciada.");
      return true;
    } catch (error) {
      console.error("Error al exportar a PDF:", error);
      toast.error("Error al exportar a PDF. Intenta de nuevo.");
      return false;
    }
  },

  // Invalidate student cache (call after mutations)
  invalidateStudentCache: () => {
    cachedStudents = null;
  },

  // Export attendance to Google Sheets (using webhook)
  exportToSheets: async (date: string): Promise<boolean> => {
    toast.info("Exportando a Google Sheets...");

    try {
      const students = await getOrFetchStudents();
      // Obtener registros de asistencia para la fecha
      const attendanceRecords = MOCK_ATTENDANCE[date] || [];

      // Preparar datos para el webhook
      const webhookData = {
        action: "ExportToSheets",
        date: date,
        records: attendanceRecords.map(record => {
          const estudianteOriginal = students.find(e => e.dni === record.dni);

          return {
            fecha: date,
            hora: new Date(record.timestamp).toTimeString().split(' ')[0],
            documento: record.dni,
            nombre: estudianteOriginal ? estudianteOriginal.nombre : '',
            apellido: estudianteOriginal ? estudianteOriginal.apellido : '',
            nombreCompleto: record.studentName
          };
        })
      };

      console.log("Enviando datos de exportación a Sheets:", webhookData);

      // Enviar datos al webhook
      const response = await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData),
      });

      // Imprimir la respuesta para diagnóstico
      console.log("Respuesta del webhook (Sheets):", response.status, response.statusText);

      // Intentar leer el cuerpo de la respuesta
      try {
        const responseBody = await response.text();
        console.log("Cuerpo de la respuesta:", responseBody);
      } catch (e) {
        console.log("No se pudo leer el cuerpo de la respuesta");
      }

      if (!response.ok) {
        throw new Error(`Error al exportar a Google Sheets: ${response.statusText}`);
      }

      toast.success("Datos exportados correctamente a Google Sheets.");
      return true;
    } catch (error) {
      console.error("Error al exportar a Google Sheets:", error);
      toast.error("Error al exportar a Google Sheets. Intenta de nuevo.");
      return false;
    }
  }
};
