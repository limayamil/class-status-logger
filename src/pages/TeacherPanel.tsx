import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { getErrorMessage } from '@/lib/utils'; // Added import
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Added missing import
import { toast } from 'sonner';
import { sheetsService } from '@/services/sheetsService';
import Navigation from '@/components/Navigation';
import { Loader2, Search, Calendar, Download, FileUp, BarChart3, Users, Percent, PlusCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';
import { classesService } from '@/services/classesService';

const STUDENTS_PER_PAGE = 10; // Define STUDENTS_PER_PAGE here

// Interfaz adaptada a los datos de MongoDB
interface AttendanceRecord {
  _id?: string; // El _id de MongoDB (opcional, como string)
  timestamp: string; // Vendrá de 'registradoEn'
  studentName: string; // Vendrá de 'nombreEstudiante'
  date: string; // Vendrá de 'fecha'
  // DNI y studentId no están disponibles directamente en esta colección
}

// Interfaz para el documento recibido de la función Netlify
interface AsistenciaDocumentFromAPI {
  _id?: string;
  fecha: string;
  nombreEstudiante: string;
  estado: string; // 'Presente', 'Ausente', etc.
  materia?: string;
  comision?: string;
  registradoEn: string; // La fecha vendrá como string ISO
}

// Nueva interfaz para los detalles de asistencia de un estudiante específico
// interface StudentAttendanceDetail extends AsistenciaDocumentFromAPI {
//   // No necesita campos adicionales por ahora, pero la mantenemos por claridad
// }
// Convertida a type alias para resolver linter warning
type StudentAttendanceDetail = AsistenciaDocumentFromAPI;

// Interfaz adaptada a la respuesta de get-statistics.ts
interface StatisticsData {
  dailyStats: { date: string; count: number }[];
  weeklyStats: { weekStartDate: string; count: number }[]; // Campo renombrado
  monthlyStats: { month: string; count: number }[]; // Formato YYYY-MM
  // Update studentStats interface to include totalAttendanceCount
  studentStats: { studentName: string; attendanceCount: number; totalAttendanceCount: number }[]; 
  totalClassesHeld: number; // Total de clases impartidas
}

// Helper function to get today's date in YYYY-MM-DD format based on local time
const getTodayLocalISOString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TeacherPanel = () => {
  const [date, setDate] = useState(() => {
    // Initialize date to today's date in YYYY-MM-DD format
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0'); // +1 porque getMonth es 0-indexed
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'sheets' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  
  // Statistics state
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true); // Separate loading state for statistics
  const [exportingPDF, setExportingPDF] = useState(false);
  // Añadir estado para actualizar clases
  const [updatingClasses, setUpdatingClasses] = useState(false); // Loading state for class count updates

  // State for student search and pagination within the Statistics tab
  const [statsStudentSearchTerm, setStatsStudentSearchTerm] = useState('');
  const [statsStudentTablePage, setStatsStudentTablePage] = useState(1);

  // State for selected student and their detailed attendance
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null); // Tracks the currently selected student for detail view
  const [studentAttendanceDetails, setStudentAttendanceDetails] = useState<StudentAttendanceDetail[]>([]); // Stores attendance details for the selected student
  const [detailsLoading, setDetailsLoading] = useState(false); // Loading state for student attendance details

  // --- Animation Variants for Framer Motion ---
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1 // Stagger children inside this container
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };
  // --- End Animation Variants ---


  const fetchAttendanceRecords = async (selectedDate: string) => {
    setLoading(true);
    setAttendanceRecords([]); // Clear previous records while loading
    try {
      // Call the Netlify function to get attendance for the selected date
      const response = await fetch(`/.netlify/functions/get-asistencias?date=${selectedDate}`);

      if (!response.ok) {
        // Try to parse error from response, otherwise use a generic message
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData.message, `Error ${response.status} al obtener asistencias`));
      }

      const recordsFromAPI: AsistenciaDocumentFromAPI[] = await response.json();

      // Map the data received from the API to the AttendanceRecord interface used by the component
      const mappedRecords: AttendanceRecord[] = recordsFromAPI.map(record => ({
        _id: record._id,
        timestamp: record.registradoEn, // Use 'registradoEn' as the timestamp
        studentName: record.nombreEstudiante,
        date: record.fecha,
        // DNI and studentId are not available in this collection
      }));

      setAttendanceRecords(mappedRecords);

    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, "Error al cargar los registros de asistencia");
      toast.error(`Error al cargar los registros: ${errorMessage}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    setStatsLoading(true);
    setStats(null); // Clear previous stats
    try {
      // Call the Netlify function to get overall statistics
      const response = await fetch(`/.netlify/functions/get-statistics`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData.message, `Error ${response.status} al obtener estadísticas`));
      }

      const statsData: StatisticsData = await response.json();
      setStats(statsData);

    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, "Error al cargar las estadísticas");
      toast.error(`Error al cargar estadísticas: ${errorMessage}`);
      console.error(error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    // Fetch attendance records when the date changes.
    fetchAttendanceRecords(date);
    // Fetch general statistics when the date changes.
    // This might re-fetch global stats more often than needed if date is the only trigger,
    // but it ensures stats are fresh if they were to become date-dependent in the future.
    fetchStatistics();
  }, [date]); // Dependency array: re-run effect when 'date' changes.

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value);
  };

  const handleExportToPDF = async () => {
    setExporting('pdf');
    try {
      await sheetsService.exportToPDF(date);
      toast.success("Exportación a PDF iniciada."); // Provide feedback
    } catch (error) {
      const message = getErrorMessage(error, "Error al exportar a PDF");
      toast.error(message);
      console.error(error);
    } finally {
      setExporting(null); // Reset exporting state
    }
  };

  const handleExportToSheets = async () => {
    setExporting('sheets');
    try {
      await sheetsService.exportToSheets(date);
      toast.success("Exportación a Google Sheets iniciada."); // Provide feedback
    } catch (error) {
      const message = getErrorMessage(error, "Error al exportar a Google Sheets");
      toast.error(message);
      console.error(error);
    } finally {
      setExporting(null); // Reset exporting state
    }
  };

  const handleExportStatsToPDF = async () => {
    setExportingPDF(true);
    try {
      // Placeholder for actual PDF export logic for statistics
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      toast.success('Estadísticas exportadas a PDF correctamente.');
    } catch (error) {
      const message = getErrorMessage(error, "Error al exportar las estadísticas a PDF");
      toast.error(message);
      console.error(error);
    } finally {
      setExportingPDF(false); // Reset loading state for this button
    }
  };

  // Nueva función para incrementar el contador de clases
  const handleIncrementClasses = async () => {
    setUpdatingClasses(true);
    try {
      await classesService.incrementTotalClassesHeld();
      // Refresh statistics to reflect the new total classes held
      fetchStatistics();
      toast.success('Contador de clases actualizado correctamente.');
    } catch (error) {
      const message = getErrorMessage(error, "Error al actualizar el contador de clases");
      toast.error(message);
      console.error('Error al incrementar clases:', error);
    } finally {
      setUpdatingClasses(false); // Reset loading state for this button
    }
  };

  // Calcular la tasa general de asistencia
  const calculateOverallAttendanceRate = (): number => {
    if (!stats || !stats.studentStats.length || !stats.totalClassesHeld) return 0;
    
    // Sumar todas las asistencias y dividirlas por (número de estudiantes * total de clases)
    const totalAttendances = stats.studentStats.reduce(
      (sum, student) => sum + student.totalAttendanceCount, 0
    );
    
    return (totalAttendances / (stats.studentStats.length * stats.totalClassesHeld)) * 100;
  };

  // Filtrar solo por nombre, ya que no tenemos DNI aquí
  const filteredRecords = searchTerm
    ? attendanceRecords.filter(record =>
        record.studentName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : attendanceRecords;

  // Memoized calculations for student table in Statistics tab
  // Memoized calculation for filtering and sorting student statistics based on search term
  const filteredAndSortedStatsStudentStats = useMemo(() => {
    if (!stats?.studentStats) return []; // Return empty if no student stats available
    return stats.studentStats
      .filter(student => 
        student.studentName.toLowerCase().includes(statsStudentSearchTerm.toLowerCase()) // Case-insensitive search
      )
      .sort((a, b) => a.studentName.localeCompare(b.studentName)); // Sort alphabetically by student name
  }, [stats?.studentStats, statsStudentSearchTerm]); // Recalculate when stats or search term changes

  // Memoized calculation for paginating the filtered and sorted student statistics
  const paginatedStatsStudentStats = useMemo(() => {
    const startIndex = (statsStudentTablePage - 1) * STUDENTS_PER_PAGE;
    return filteredAndSortedStatsStudentStats.slice(startIndex, startIndex + STUDENTS_PER_PAGE);
  }, [filteredAndSortedStatsStudentStats, statsStudentTablePage]); // Recalculate when filtered list or page changes

  // Memoized calculation for the total number of pages for student statistics pagination
  const totalStatsStudentTablePages = useMemo(() => {
    return Math.ceil(filteredAndSortedStatsStudentStats.length / STUDENTS_PER_PAGE);
  }, [filteredAndSortedStatsStudentStats.length]); // Recalculate when the length of the filtered list changes

  // Fetches and displays detailed attendance records for a specific student.
  // Toggles visibility if the same student is clicked again.
  const fetchStudentAttendanceDetails = async (studentName: string) => {
    // If the clicked student is already selected, deselect them and clear details (toggle behavior)
    if (selectedStudent === studentName) {
      setSelectedStudent(null);
      setStudentAttendanceDetails([]);
      return;
    }

    setSelectedStudent(studentName); // Set the new selected student
    setDetailsLoading(true);
    setStudentAttendanceDetails([]); // Clear previous details

    try {
      // Fetch all attendance records for the specified student (no date filter)
      const response = await fetch(`/.netlify/functions/get-asistencias?studentName=${encodeURIComponent(studentName)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData.message, `Error ${response.status} al obtener detalles de asistencia`));
      }

      const details: StudentAttendanceDetail[] = await response.json();
      
      // Sort details by date in descending order to show the most recent first
      details.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      
      setStudentAttendanceDetails(details);

    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, "Error al cargar los detalles de asistencia del estudiante");
      toast.error(`Error al cargar detalles: ${errorMessage}`);
      console.error(error);
      setSelectedStudent(null); // Deselect student in case of an error
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    // Changed bg-gray-50 to bg-background
    <div className="flex flex-col bg-background"> 
      <Navigation />

      <motion.div // Wrap main content area
        className="flex-1 container mx-auto px-4 py-8"
        initial="hidden"
        animate="visible"
        variants={{ // Simple fade-in for the whole panel initially
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.5 } }
        }}
      >
        <div className="text-center mb-8">
          {/* Changed text-gray-800 to text-foreground */}
          <h1 className="text-3xl font-bold text-foreground">Panel Docente</h1> 
          {/* Changed text-brand-purple to text-primary */}
          <p className="text-primary mt-2">Bienvenido/a, {user?.name}</p> 
        </div>

        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="attendance">Asistencia</TabsTrigger>
            <TabsTrigger value="statistics">Estadísticas</TabsTrigger>
          </TabsList>

          {/* Attendance Tab */}
          <motion.div // Wrap TabsContent for animation
            variants={containerVariants} // Use container to potentially stagger items inside later
            initial="hidden"
            animate="visible"
          >
            <TabsContent value="attendance" className="space-y-4">
              {/* Header card with summary */}
              <motion.div variants={itemVariants}> {/* Wrap Card with motion.div */}
                {/* Card component should adapt automatically via CSS variables */}
                <Card className="shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle>Asistencia del día</CardTitle>
                <CardDescription>
                  {/* Compara con la fecha local formateada */}
                  {date === getTodayLocalISOString() 
                    ? 'Registros de hoy' 
                    // Añade 'T00:00:00' para interpretar la fecha como local al formatear
                    : `Registros de ${new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { dateStyle: 'long' })}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex items-center">
                    {/* Changed text-brand-purple to text-primary */}
                    <Calendar className="w-12 h-12 text-primary mr-3" /> 
                    <div>
                      <div className="text-3xl font-bold">
                        {/* Changed text-gray-500 to text-muted-foreground */}
                        {attendanceRecords.length} <span className="text-lg font-medium text-muted-foreground">/ 141</span> 
                      </div>
                      {/* Changed text-gray-500 to text-muted-foreground */}
                      <div className="text-sm text-muted-foreground">estudiantes presentes</div> 
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-4">
                    <div className="flex-none">
                      {/* Label component should adapt */}
                      <Label htmlFor="date" className="block text-sm font-medium mb-1"> 
                        Fecha
                      </Label>
                      {/* Input component should adapt */}
                      <Input 
                        id="date"
                        type="date"
                        value={date}
                        onChange={handleDateChange}
                        className="w-full"
                      />
                    </div>
                    
                    <div className="flex gap-2 sm:self-end w-full sm:w-auto justify-center sm:justify-start">
                      <Button 
                        variant="outline" 
                        onClick={handleExportToPDF}
                        disabled={loading || exporting !== null}
                      >
                        {exporting === 'pdf' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Exportando...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            PDF
                          </>
                        )}
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        onClick={handleExportToSheets}
                        disabled={loading || exporting !== null}
                      >
                        {exporting === 'sheets' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Exportando...
                          </>
                        ) : (
                          <>
                            <FileUp className="mr-2 h-4 w-4" />
                            Sheets
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                  </CardContent>
                </Card>
              </motion.div>

            {/* Student list */}
            <motion.div variants={itemVariants}> {/* Wrap Card with motion.div */}
              <Card>
                <CardHeader>
                  <CardTitle>Listado de asistencia</CardTitle>
                <div className="mt-2">
                  <div className="relative">
                    {/* Changed text-gray-500 to text-muted-foreground */}
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /> 
                    {/* Input component should adapt */}
                    <Input 
                      placeholder="Buscar por nombre..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    {/* Changed text-brand-purple to text-primary */}
                    <Loader2 className="h-8 w-8 animate-spin text-primary" /> 
                  </div>
                ) : filteredRecords.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[400px] border-collapse">
                      <thead>
                        {/* Changed border-gray-200 to border-border */}
                        <tr className="border-b border-border"> 
                          {/* Changed text-gray-500 to text-muted-foreground */}
                          <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Nombre</th> 
                          {/* <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">DNI</th> */} {/* Columna DNI eliminada */}
                          {/* Changed text-gray-500 to text-muted-foreground */}
                          <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Hora</th> 
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((record, index) => (
                          // Usar _id si existe, sino el índice como fallback para la key
                          // Changed border-gray-100 to border-border/10 for a lighter border
                          <tr key={record._id || index} className="border-b border-border/10"> 
                            {/* Changed text-gray-800 to text-foreground */}
                            <td className="py-3 px-4 text-foreground">{record.studentName}</td> 
                            {/* <td className="py-3 px-4 text-gray-800">{record.dni}</td> */} {/* Celda DNI eliminada */}
                            {/* Changed text-gray-600 to text-muted-foreground */}
                            <td className="py-3 px-4 text-muted-foreground"> 
                              {/* Asegurarse de que timestamp es un string ISO válido antes de crear Date */}
                              {record.timestamp ? new Date(record.timestamp).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : ''} {/* Añadido fallback por si timestamp no existe */}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // Changed text-gray-500 to text-muted-foreground
                  <div className="text-center py-8 text-muted-foreground"> 
                    {searchTerm ? 'No se encontraron estudiantes que coincidan con la búsqueda' : 'No hay registros de asistencia para esta fecha'}
                  </div>
                )}
                </CardContent>
              </Card>
            </motion.div>
            </TabsContent>
          </motion.div>

          {/* Statistics Tab */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <TabsContent value="statistics" className="space-y-4">
              <div className="flex flex-wrap justify-between items-center mb-8 gap-2">
                <CardTitle>Estadísticas de Asistencia</CardTitle>
              
                <div className="flex gap-2 flex-wrap">
                  {/* Botón para incrementar clases */}
                  <Button 
                    variant="outline" 
                    onClick={handleIncrementClasses}
                    disabled={statsLoading || updatingClasses}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
                  >
                    {updatingClasses ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Actualizando...
                      </>
                    ) : (
                      <>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Registrar Clase Impartida (+1)
                      </>
                    )}
                  </Button>

                  <Button 
                    variant="outline" 
                    onClick={handleExportStatsToPDF}
                    disabled={statsLoading || exportingPDF}
                  >
                    {exportingPDF ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exportando...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Exportar estadísticas
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {statsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              ) : stats ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {/* Tasa de Asistencia General Card */}
                  <motion.div variants={itemVariants} className="lg:col-span-1">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                          <CardTitle className="text-base font-medium">Tasa de Asistencia General</CardTitle>
                          <CardDescription>Promedio total hasta la fecha</CardDescription>
                        </div>
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold text-primary">
                          {calculateOverallAttendanceRate().toFixed(1)}% 
                        </div>
                        <p className="text-xs text-muted-foreground pt-1">
                          Basado en {stats.totalClassesHeld} clases impartidas.
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Weekly Stats */}
                  <motion.div variants={itemVariants} className="lg:col-span-1">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                        <CardTitle className="text-base font-medium">Asistencia Semanal</CardTitle>
                        <CardDescription>Últimas 4 semanas</CardDescription>
                      </div>
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.weeklyStats}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="weekStartDate" 
                              stroke="hsl(var(--muted-foreground))" 
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(tick) => {
                                const date = new Date(tick + 'T00:00:00');
                                return `Sem ${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' })}`;
                              }}
                            />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                            <RechartsTooltip
                              cursor={{ fill: 'hsl(var(--accent))' }} 
                              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} 
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                              itemStyle={{ color: 'hsl(var(--foreground))' }}
                              formatter={(value: number) => [`${value} estudiantes`, 'Asistencia']}
                              labelFormatter={(label: string) => `Semana del ${new Date(label + 'T00:00:00').toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'long'
                              })}`}
                            />
                            <Bar dataKey="count" fill="hsl(var(--secondary-foreground))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Monthly Stats */}
                  <motion.div variants={itemVariants} className="lg:col-span-1">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                        <CardTitle className="text-base font-medium">Asistencia Mensual</CardTitle>
                        <CardDescription>Últimos 3 meses</CardDescription>
                      </div>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.monthlyStats}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis 
                              dataKey="month" 
                              stroke="hsl(var(--muted-foreground))" 
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(tick) => {
                                const [year, month] = tick.split('-');
                                return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('es-ES', { month: 'short' });
                              }}
                            />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                            <RechartsTooltip 
                              cursor={{ fill: 'hsl(var(--accent))' }} 
                              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} 
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                              itemStyle={{ color: 'hsl(var(--foreground))' }}
                              formatter={(value: number) => [`${value} estudiantes`, 'Asistencia']}
                              labelFormatter={(label: string) => {
                                const [year, month] = label.split('-');
                                return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('es-ES', { 
                                  month: 'long',
                                  year: 'numeric'
                                });
                              }}
                            />
                            <Bar dataKey="count" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Student Attendance List */}
                  <motion.div variants={itemVariants} className="col-span-full">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                        <CardTitle className="text-base font-medium">Asistencia por Estudiante</CardTitle>
                        <CardDescription>Detalle de asistencia individual ({stats.totalClassesHeld} clases totales)</CardDescription>
                      </div>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {/* Added Search Input for Student Table in Stats Tab */}
                      <div className="mb-4">
                        <Input 
                          placeholder="Buscar estudiante por nombre..."
                          value={statsStudentSearchTerm}
                          onChange={(e) => {
                            setStatsStudentSearchTerm(e.target.value);
                            setStatsStudentTablePage(1); // Reset to first page on new search
                          }}
                          className="max-w-sm"
                        />
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[600px]">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Estudiante</th>
                              <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Regularidad</th>
                              <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">% Asistencia</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedStatsStudentStats.length > 0 ? (
                              paginatedStatsStudentStats
                                .map((student, index) => {
                                  const studentKey = student.studentName + index; // Clave única para la fila principal
                                  const isSelected = selectedStudent === student.studentName;
                                  // Calcular porcentaje real basado en totalClassesHeld
                                  const attendancePercentage = stats.totalClassesHeld > 0 
                                    ? (student.totalAttendanceCount / stats.totalClassesHeld) * 100 
                                    : 0;
                                  
                                  // Determinar color de la barra de progreso según el porcentaje
                                  const progressBarColor = attendancePercentage >= 75 ? 'bg-green-500' 
                                                         : attendancePercentage >= 50 ? 'bg-yellow-500' 
                                                         : 'bg-red-500';
                                  const progressBarClass = `h-2.5 rounded-full ${progressBarColor}`;
                                  const progressWidth = `${attendancePercentage}%`;

                                  return (
                                    // Usamos React.Fragment para poder tener múltiples elementos raíz por fila
                                    <React.Fragment key={studentKey}>
                                      <tr 
                                        className={`border-b border-border/10 hover:bg-accent/10 cursor-pointer ${isSelected ? 'bg-accent/20' : ''}`}
                                        onClick={() => fetchStudentAttendanceDetails(student.studentName)}
                                      >
                                        <td className="py-3 px-4 text-foreground">{student.studentName}</td>
                                        <td className="py-3 px-4 text-muted-foreground">
                                          {student.totalAttendanceCount} / {stats.totalClassesHeld}
                                        </td>
                                        <td className="py-3 px-4">
                                          <div className="flex items-center">
                                            <div className="w-full bg-accent/20 rounded-full h-2.5 mr-2">
                                              <div
                                                className={progressBarClass}
                                                style={{ width: progressWidth }}
                                              ></div>
                                            </div>
                                            <span className="text-sm text-muted-foreground font-medium w-10 text-right">
                                              {attendancePercentage.toFixed(0)}%
                                            </span>
                                          </div>
                                        </td>
                                      </tr>
                                      {/* Fila de detalles (condicional) */}
                                      {isSelected && (
                                        <tr className="bg-accent/5">
                                          <td colSpan={3} className="p-0"> {/* p-0 para que la tarjeta interna ocupe todo el espacio */}
                                            <motion.div
                                              initial={{ opacity: 0, height: 0 }}
                                              animate={{ opacity: 1, height: 'auto' }}
                                              exit={{ opacity: 0, height: 0 }}
                                              transition={{ duration: 0.3 }}
                                              className="p-4" // Añadimos padding aquí
                                            >
                                              {detailsLoading ? (
                                                <div className="flex items-center justify-center py-4">
                                                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                  <span className="ml-2 text-muted-foreground">Cargando fechas...</span>
                                                </div>
                                              ) : studentAttendanceDetails.length > 0 ? (
                                                <div>
                                                  <h4 className="text-sm font-semibold mb-2 text-foreground">
                                                    Fechas de asistencia para {selectedStudent}:
                                                  </h4>
                                                  <ul className="list-disc list-inside space-y-1 max-h-40 overflow-y-auto pr-2">
                                                    {studentAttendanceDetails.map((detail) => (
                                                      <li key={detail._id || detail.registradoEn} className="text-xs text-muted-foreground">
                                                        {new Date(detail.fecha + 'T00:00:00').toLocaleDateString('es-ES', { 
                                                          year: 'numeric', month: 'long', day: 'numeric' 
                                                        })}
                                                        {' - '}
                                                        <span className="text-green-600 font-medium">{detail.estado}</span>
                                                        {` (Registrado: ${new Date(detail.registradoEn).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})`}
                                                      </li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              ) : (
                                                <p className="text-xs text-center text-muted-foreground py-3">
                                                  No se encontraron registros de asistencia para este estudiante o no asistió.
                                                </p>
                                              )}
                                            </motion.div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })
                            ) : (
                              <tr>
                                <td colSpan={3} className="py-4 px-4 text-center text-muted-foreground">
                                  {statsStudentSearchTerm ? 'No se encontraron estudiantes con ese nombre.' : 'No hay datos de estudiantes.'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        </div>
                        {/* Added Pagination Controls for Stats Student Table */}
                        {filteredAndSortedStatsStudentStats.length > STUDENTS_PER_PAGE && (
                          <div className="flex justify-end items-center mt-4 space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setStatsStudentTablePage(prev => Math.max(1, prev - 1))}
                              disabled={statsStudentTablePage === 1}
                            >
                              Anterior
                            </Button>
                            <span className="text-sm text-gray-700">
                              Página {statsStudentTablePage} de {totalStatsStudentTablePages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setStatsStudentTablePage(prev => Math.min(totalStatsStudentTablePages, prev + 1))}
                              disabled={statsStudentTablePage === totalStatsStudentTablePages}
                            >
                              Siguiente
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No se pudieron cargar las estadísticas.
                </div>
              )}
              </TabsContent>
            </motion.div>
          </Tabs>
        </motion.div> {/* Close main content motion.div */}
      </div>
    );
};

export default TeacherPanel;
