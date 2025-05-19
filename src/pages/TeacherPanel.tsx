import { useState, useEffect, useMemo } from 'react';
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
      // Llamar a la nueva función Netlify para obtener estadísticas
      const response = await fetch(`/.netlify/functions/get-statistics`);

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
  }, [date]);

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
                              // .sort((a, b) => (a.totalAttendanceCount / stats.totalClassesHeld) - (b.totalAttendanceCount / stats.totalClassesHeld)) // Removed original sort
                              // .slice(0, 15) // Removed original slice
                              .map((student, index) => {
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
                                  <tr key={student.studentName + index} className="border-b border-border/10 hover:bg-accent/5">
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
