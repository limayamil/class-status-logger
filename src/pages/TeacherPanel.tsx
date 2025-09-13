import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Added missing import
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { sheetsService } from '@/services/sheetsService';
import Navigation from '@/components/Navigation';
import { Loader2, Search, Calendar, Download, FileUp, BarChart3, Users, Percent, PlusCircle, Filter, X, CalendarIcon, TrendingUp, TrendingDown, Minus, Star, ArrowUp, ArrowDown } from 'lucide-react';
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
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
  // New enhanced metrics
  totalUniqueStudents: number; // Total de estudiantes únicos que han asistido
  averageAttendancePerClass: number; // Promedio de asistencia por clase
  bestAttendanceDay?: { date: string; count: number }; // Mejor día de asistencia
  worstAttendanceDay?: { date: string; count: number }; // Peor día de asistencia
  attendanceTrend: { direction: 'up' | 'down' | 'stable'; percentage: number }; // Tendencia
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
  const [statsLoading, setStatsLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);
  // Añadir estado para actualizar clases
  const [updatingClasses, setUpdatingClasses] = useState(false);

  // Added state for student table in Statistics tab
  const [statsStudentSearchTerm, setStatsStudentSearchTerm] = useState('');
  const [statsStudentTablePage, setStatsStudentTablePage] = useState(1);

  // State for selected student and their detailed attendance
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [studentAttendanceDetails, setStudentAttendanceDetails] = useState<StudentAttendanceDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Filter state
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
  const [filterEstado, setFilterEstado] = useState<string>('Presente');
  const [showFullHistory, setShowFullHistory] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // --- Animation Variants ---
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
    setAttendanceRecords([]); // Limpiar registros anteriores mientras carga
    try {
      // Llamar a la nueva función Netlify
      const response = await fetch(`/.netlify/functions/get-asistencias?date=${selectedDate}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido del servidor' }));
        throw new Error(errorData.message || `Error ${response.status} al obtener asistencias`);
      }

      const recordsFromAPI: AsistenciaDocumentFromAPI[] = await response.json();

      // Mapear los datos recibidos a la interfaz AttendanceRecord que usa el componente
      const mappedRecords: AttendanceRecord[] = recordsFromAPI.map(record => ({
        _id: record._id,
        timestamp: record.registradoEn, // Usar registradoEn como timestamp
        studentName: record.nombreEstudiante,
        date: record.fecha,
        // dni y studentId no están disponibles
      }));

      setAttendanceRecords(mappedRecords);

    } catch (error: unknown) {
      let errorMessage = "Error al cargar los registros de asistencia";
       if (error instanceof Error) {
          errorMessage = `Error al cargar los registros: ${error.message}`;
       }
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    setStatsLoading(true);
    setStats(null); // Limpiar stats anteriores
    try {
      // Build query parameters for filtering
      const queryParams = new URLSearchParams();

      if (filterDateFrom) {
        queryParams.append('dateFrom', format(filterDateFrom, 'yyyy-MM-dd'));
      }
      if (filterDateTo) {
        queryParams.append('dateTo', format(filterDateTo, 'yyyy-MM-dd'));
      }
      if (filterEstado && filterEstado !== 'Presente') {
        queryParams.append('estado', filterEstado);
      }
      if (showFullHistory) {
        queryParams.append('showFullHistory', 'true');
      }

      const queryString = queryParams.toString();
      const url = `/.netlify/functions/get-statistics${queryString ? `?${queryString}` : ''}`;

      // Llamar a la función Netlify para obtener estadísticas con filtros
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido del servidor' }));
        throw new Error(errorData.message || `Error ${response.status} al obtener estadísticas`);
      }

      const statsData: StatisticsData = await response.json();
      setStats(statsData);

    } catch (error: unknown) {
       let errorMessage = "Error al cargar las estadísticas";
       if (error instanceof Error) {
          errorMessage = `Error al cargar estadísticas: ${error.message}`;
       }
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceRecords(date);
    fetchStatistics();
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value);
  };

  const handleExportToPDF = async () => {
    setExporting('pdf');
    try {
      await sheetsService.exportToPDF(date);
    } catch (error) {
      toast.error("Error al exportar a PDF");
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  const handleExportToSheets = async () => {
    setExporting('sheets');
    try {
      await sheetsService.exportToSheets(date);
    } catch (error) {
      toast.error("Error al exportar a Google Sheets");
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  const handleExportStatsToPDF = async () => {
    setExportingPDF(true);
    try {
      // In a real app, this would export the actual statistics
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Estadísticas exportadas a PDF correctamente');
    } catch (error) {
      toast.error('Error al exportar las estadísticas');
      console.error(error);
    } finally {
      setExportingPDF(false);
    }
  };

  // Nueva función para incrementar el contador de clases
  const handleIncrementClasses = async () => {
    setUpdatingClasses(true);
    try {
      await classesService.incrementTotalClassesHeld();
      // Refrescar las estadísticas para obtener el nuevo contador
      fetchStatistics();
      toast.success('Contador de clases actualizado correctamente');
    } catch (error) {
      console.error('Error al incrementar clases:', error);
      toast.error('Error al actualizar el contador de clases');
    } finally {
      setUpdatingClasses(false);
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
  const filteredAndSortedStatsStudentStats = useMemo(() => {
    if (!stats?.studentStats) return [];
    return stats.studentStats
      .filter(student => 
        student.studentName.toLowerCase().includes(statsStudentSearchTerm.toLowerCase())
      )
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [stats?.studentStats, statsStudentSearchTerm]);

  const paginatedStatsStudentStats = useMemo(() => {
    const startIndex = (statsStudentTablePage - 1) * STUDENTS_PER_PAGE;
    return filteredAndSortedStatsStudentStats.slice(startIndex, startIndex + STUDENTS_PER_PAGE);
  }, [filteredAndSortedStatsStudentStats, statsStudentTablePage]);

  const totalStatsStudentTablePages = useMemo(() => {
    return Math.ceil(filteredAndSortedStatsStudentStats.length / STUDENTS_PER_PAGE);
  }, [filteredAndSortedStatsStudentStats.length]);

  // Filter helper functions
  const resetFilters = () => {
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
    setFilterEstado('Presente');
    setShowFullHistory(false);
  };

  const applyFilters = () => {
    fetchStatistics();
  };

  // Quick filter presets
  const applyQuickFilter = (preset: string) => {
    const today = new Date();
    resetFilters(); // First clear all filters

    switch (preset) {
      case 'lastWeek':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        setFilterDateFrom(weekAgo);
        setFilterDateTo(today);
        break;
      case 'lastMonth':
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        setFilterDateFrom(monthAgo);
        setFilterDateTo(today);
        break;
      case 'fullHistory':
        setShowFullHistory(true);
        break;
      case 'thisMonth':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setFilterDateFrom(startOfMonth);
        setFilterDateTo(today);
        break;
    }

    // Auto-apply the filter after setting
    setTimeout(() => fetchStatistics(), 100);
  };

  const hasActiveFilters = () => {
    return filterDateFrom || filterDateTo ||
           (filterEstado && filterEstado !== 'Presente') || showFullHistory;
  };

  const getFilterDescription = () => {
    const filters = [];
    if (filterDateFrom) filters.push(`desde ${format(filterDateFrom, 'dd/MM/yyyy', { locale: es })}`);
    if (filterDateTo) filters.push(`hasta ${format(filterDateTo, 'dd/MM/yyyy', { locale: es })}`);
    if (filterEstado && filterEstado !== 'Presente') filters.push(`estado: ${filterEstado}`);
    if (showFullHistory) filters.push('historial completo');
    return filters.length > 0 ? ` (${filters.join(', ')})` : '';
  };

  // Nueva función para obtener detalles de asistencia de un estudiante
  const fetchStudentAttendanceDetails = async (studentName: string) => {
    if (selectedStudent === studentName) { // Si ya está seleccionado, lo deseleccionamos (toggle)
      setSelectedStudent(null);
      setStudentAttendanceDetails([]);
      return;
    }

    setSelectedStudent(studentName);
    setDetailsLoading(true);
    setStudentAttendanceDetails([]); // Limpiar detalles anteriores

    try {
      // Llamar a la función Netlify con el nombre del estudiante
      // No necesitamos 'date' aquí, ya que queremos todos los registros del estudiante
      const response = await fetch(`/.netlify/functions/get-asistencias?studentName=${encodeURIComponent(studentName)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido del servidor' }));
        throw new Error(errorData.message || `Error ${response.status} al obtener detalles de asistencia`);
      }

      const details: StudentAttendanceDetail[] = await response.json();
      
      // Ordenar por fecha descendente para mostrar las más recientes primero
      details.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      
      setStudentAttendanceDetails(details);

    } catch (error: unknown) {
      let errorMessage = "Error al cargar los detalles de asistencia del estudiante";
       if (error instanceof Error) {
          errorMessage = `Error al cargar detalles: ${error.message}`;
       }
      toast.error(errorMessage);
      console.error(error);
      setSelectedStudent(null); // Deseleccionar en caso de error
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

                  <div className="flex items-center space-x-4">
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
                    
                    <div className="flex gap-2 self-end">
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
                  {/* Filter toggle button */}
                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(hasActiveFilters() && "border-primary bg-primary/10")}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Filtros {hasActiveFilters() && `(${Object.values({
                      dateRange: filterDateFrom || filterDateTo,
                      estado: filterEstado !== 'Presente',
                      fullHistory: showFullHistory
                    }).filter(Boolean).length})`}
                  </Button>

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

              {/* Filter Panel */}
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6"
                >
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Filtros de Estadísticas</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowFilters(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Quick Filter Presets */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Filtros Rápidos</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyQuickFilter('lastWeek')}
                            className="text-xs"
                          >
                            Última Semana
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyQuickFilter('thisMonth')}
                            className="text-xs"
                          >
                            Este Mes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyQuickFilter('lastMonth')}
                            className="text-xs"
                          >
                            Último Mes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyQuickFilter('fullHistory')}
                            className="text-xs"
                          >
                            Historia Completa
                          </Button>
                        </div>
                      </div>

                      {/* Custom Filters */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Date From */}
                        <div className="space-y-2">
                          <Label>Fecha Desde</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !filterDateFrom && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {filterDateFrom ? format(filterDateFrom, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent
                                mode="single"
                                selected={filterDateFrom}
                                onSelect={setFilterDateFrom}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Date To */}
                        <div className="space-y-2">
                          <Label>Fecha Hasta</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !filterDateTo && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {filterDateTo ? format(filterDateTo, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent
                                mode="single"
                                selected={filterDateTo}
                                onSelect={setFilterDateTo}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Estado */}
                        <div className="space-y-2">
                          <Label>Estado de Asistencia</Label>
                          <Select value={filterEstado} onValueChange={setFilterEstado}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar estado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Presente">Presente</SelectItem>
                              <SelectItem value="Ausente">Ausente</SelectItem>
                              <SelectItem value="Justificado">Justificado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Show Full History Toggle */}
                        <div className="space-y-2">
                          <Label>Tipo de Vista</Label>
                          <Button
                            variant={showFullHistory ? "default" : "outline"}
                            className="w-full"
                            onClick={() => setShowFullHistory(!showFullHistory)}
                          >
                            {showFullHistory ? "Historia Completa" : "Período Limitado"}
                          </Button>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t">
                        <Button onClick={applyFilters} className="flex-1">
                          Aplicar Filtros
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            resetFilters();
                            // Auto-apply after reset
                            setTimeout(applyFilters, 100);
                          }}
                        >
                          Limpiar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Active Filters Summary */}
              {hasActiveFilters() && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap items-center gap-2 p-3 bg-accent/20 rounded-lg border"
                >
                  <span className="text-sm font-medium text-muted-foreground">Filtros activos:</span>
                  {filterDateFrom && (
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                      Desde: {format(filterDateFrom, 'dd/MM/yyyy', { locale: es })}
                    </span>
                  )}
                  {filterDateTo && (
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                      Hasta: {format(filterDateTo, 'dd/MM/yyyy', { locale: es })}
                    </span>
                  )}
                  {filterEstado !== 'Presente' && (
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                      Estado: {filterEstado}
                    </span>
                  )}
                  {showFullHistory && (
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                      Historial Completo
                    </span>
                  )}
                </motion.div>
              )}

              {/* Quick Stats Bar */}
              {stats && !statsLoading && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-accent/5 via-accent/10 to-accent/5 rounded-lg border mb-6"
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{stats.totalUniqueStudents}</div>
                    <div className="text-xs text-muted-foreground">Estudiantes Únicos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{stats.totalClassesHeld}</div>
                    <div className="text-xs text-muted-foreground">Clases Impartidas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{stats.averageAttendancePerClass}</div>
                    <div className="text-xs text-muted-foreground">Promedio por Clase</div>
                  </div>
                  <div className="text-center">
                    <div className={cn("text-2xl font-bold",
                      stats.attendanceTrend.direction === 'up' ? 'text-green-500' :
                      stats.attendanceTrend.direction === 'down' ? 'text-red-500' :
                      'text-muted-foreground'
                    )}>
                      {stats.attendanceTrend.direction === 'up' ? '↗' : stats.attendanceTrend.direction === 'down' ? '↘' : '→'}
                      {stats.attendanceTrend.percentage.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Tendencia</div>
                  </div>
                </motion.div>
              )}

              {statsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              ) : stats ? (
                <>
                  {/* Top Row - 3 Key Metrics Cards */}
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
                    {/* Tasa de Asistencia General with Donut Chart */}
                    <motion.div variants={itemVariants}>
                      <Card className="relative overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <div className="space-y-1">
                            <CardTitle className="text-base font-medium">Tasa de Asistencia General</CardTitle>
                            <CardDescription>Promedio total hasta la fecha</CardDescription>
                          </div>
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full border-4 border-muted flex items-center justify-center">
                              <Percent className="h-4 w-4 text-primary" />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-baseline gap-2">
                            <div className="text-3xl font-bold text-primary">
                              {calculateOverallAttendanceRate().toFixed(1)}%
                            </div>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Star className="w-3 h-3 mr-1" />
                              de {stats.totalClassesHeld} clases
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* Total Students and Average */}
                    <motion.div variants={itemVariants}>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <div className="space-y-1">
                            <CardTitle className="text-base font-medium">Estudiantes Activos</CardTitle>
                            <CardDescription>Total únicos y promedio por clase</CardDescription>
                          </div>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex items-baseline gap-2">
                              <div className="text-3xl font-bold text-primary">{stats.totalUniqueStudents}</div>
                              <div className="text-sm text-muted-foreground">estudiantes únicos</div>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <BarChart3 className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Promedio:</span>
                              <span className="font-semibold">{stats.averageAttendancePerClass} por clase</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* Attendance Trend */}
                    <motion.div variants={itemVariants}>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <div className="space-y-1">
                            <CardTitle className="text-base font-medium">Tendencia de Asistencia</CardTitle>
                            <CardDescription>Comparación últimas semanas</CardDescription>
                          </div>
                          {stats.attendanceTrend.direction === 'up' ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : stats.attendanceTrend.direction === 'down' ? (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          ) : (
                            <Minus className="h-4 w-4 text-muted-foreground" />
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-baseline gap-2">
                            <div className={cn("text-3xl font-bold",
                              stats.attendanceTrend.direction === 'up' ? 'text-green-500' :
                              stats.attendanceTrend.direction === 'down' ? 'text-red-500' :
                              'text-muted-foreground'
                            )}>
                              {stats.attendanceTrend.direction === 'up' ? '+' : stats.attendanceTrend.direction === 'down' ? '-' : ''}
                              {stats.attendanceTrend.percentage.toFixed(1)}%
                            </div>
                            <div className="flex items-center text-xs text-muted-foreground">
                              {stats.attendanceTrend.direction === 'up' ? (
                                <ArrowUp className="w-3 h-3 mr-1" />
                              ) : stats.attendanceTrend.direction === 'down' ? (
                                <ArrowDown className="w-3 h-3 mr-1" />
                              ) : null}
                              {stats.attendanceTrend.direction === 'stable' ? 'Estable' :
                               stats.attendanceTrend.direction === 'up' ? 'Mejorando' : 'Decreciendo'}
                            </div>
                          </div>
                          {stats.bestAttendanceDay && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Mejor día: {stats.bestAttendanceDay.count} estudiantes el {new Date(stats.bestAttendanceDay.date + 'T00:00:00').toLocaleDateString('es-ES')}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>

                  {/* Bottom Row - 2 Large Chart Cards */}
                  <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 mb-6">

                    {/* Weekly Stats - Enhanced */}
                    <motion.div variants={itemVariants}>
                      <Card className="h-full">
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <CardTitle className="text-lg font-semibold">Asistencia Semanal{getFilterDescription()}</CardTitle>
                              <CardDescription>
                                {showFullHistory ? 'Historial completo' : 'Últimas 4 semanas'} •
                                {stats.weeklyStats.length} período(s)
                              </CardDescription>
                            </div>
                            <BarChart3 className="h-5 w-5 text-primary" />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={stats.weeklyStats}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis
                                  dataKey="weekStartDate"
                                  stroke="hsl(var(--muted-foreground))"
                                  fontSize={11}
                                  tickLine={false}
                                  axisLine={false}
                                  tickFormatter={(tick) => {
                                    const date = new Date(tick + 'T00:00:00');
                                    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                                  }}
                                />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                                <RechartsTooltip
                                  cursor={{ fill: 'hsl(var(--accent))', opacity: 0.3 }}
                                  contentStyle={{
                                    backgroundColor: 'hsl(var(--popover))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '6px',
                                    boxShadow: 'hsl(var(--shadow)) 0px 4px 12px'
                                  }}
                                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                  itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                  formatter={(value: number) => [`${value} estudiantes`, 'Asistencia']}
                                  labelFormatter={(label: string) =>
                                    `Semana del ${new Date(label + 'T00:00:00').toLocaleDateString('es-ES', {
                                      day: 'numeric',
                                      month: 'long'
                                    })}`
                                  }
                                />
                                <Bar
                                  dataKey="count"
                                  fill="hsl(var(--primary))"
                                  radius={[4, 4, 0, 0]}
                                  className="hover:opacity-80 transition-opacity"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* Monthly Stats - Enhanced */}
                    <motion.div variants={itemVariants}>
                      <Card className="h-full">
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <CardTitle className="text-lg font-semibold">Asistencia Mensual{getFilterDescription()}</CardTitle>
                              <CardDescription>
                                {showFullHistory ? 'Historial completo' : 'Últimos 3 meses'} •
                                {stats.monthlyStats.length} mes(es)
                              </CardDescription>
                            </div>
                            <Calendar className="h-5 w-5 text-primary" />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={stats.monthlyStats}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis
                                  dataKey="month"
                                  stroke="hsl(var(--muted-foreground))"
                                  fontSize={11}
                                  tickLine={false}
                                  axisLine={false}
                                  tickFormatter={(tick) => {
                                    const [year, month] = tick.split('-');
                                    return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
                                  }}
                                />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                                <RechartsTooltip
                                  cursor={{ fill: 'hsl(var(--accent))', opacity: 0.3 }}
                                  contentStyle={{
                                    backgroundColor: 'hsl(var(--popover))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '6px',
                                    boxShadow: 'hsl(var(--shadow)) 0px 4px 12px'
                                  }}
                                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                  itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                  formatter={(value: number) => [`${value} estudiantes`, 'Asistencia']}
                                  labelFormatter={(label: string) => {
                                    const [year, month] = label.split('-');
                                    return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('es-ES', {
                                      month: 'long',
                                      year: 'numeric'
                                    });
                                  }}
                                />
                                <Bar
                                  dataKey="count"
                                  fill="hsl(var(--secondary))"
                                  radius={[4, 4, 0, 0]}
                                  className="hover:opacity-80 transition-opacity"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>

                  {/* Student Attendance List */}
                  <motion.div variants={itemVariants} className="col-span-full">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                        <CardTitle className="text-base font-medium">Asistencia por Estudiante{getFilterDescription()}</CardTitle>
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
                </>
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
