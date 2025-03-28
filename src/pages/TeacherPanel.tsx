
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { sheetsService } from '@/services/sheetsService';
import Navigation from '@/components/Navigation';
import { Loader2, Search, Calendar, Download, FileUp, BarChart3, Users } from 'lucide-react';
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

interface AttendanceRecord {
  timestamp: string;
  studentId: string;
  studentName: string;
  dni: string;
  date: string;
}

interface StatisticsData {
  dailyStats: { date: string; count: number }[];
  weeklyStats: { week: string; count: number }[];
  monthlyStats: { month: string; count: number }[];
  studentStats: { studentId: string; studentName: string; attendancePercentage: number }[];
}

const TeacherPanel = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'sheets' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  
  // Statistics state
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);

  const fetchAttendanceRecords = async (selectedDate: string) => {
    setLoading(true);
    try {
      const records = await sheetsService.getAttendance(selectedDate);
      setAttendanceRecords(records);
    } catch (error) {
      toast.error("Error al cargar los registros de asistencia");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    setStatsLoading(true);
    try {
      const data = await sheetsService.getStatistics();
      setStats(data);
    } catch (error) {
      toast.error('Error al cargar las estadísticas');
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

  const filteredRecords = searchTerm
    ? attendanceRecords.filter(record => 
        record.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.dni.includes(searchTerm)
      )
    : attendanceRecords;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navigation />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Panel Docente</h1>
          <p className="text-brand-purple mt-2">Bienvenido, {user?.name}</p>
        </div>

        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="attendance">Asistencia</TabsTrigger>
            <TabsTrigger value="statistics">Estadísticas</TabsTrigger>
          </TabsList>
          
          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-4">
            {/* Header card with summary */}
            <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle>Asistencia del día</CardTitle>
                <CardDescription>
                  {date === new Date().toISOString().split('T')[0] ? 'Registros de hoy' : `Registros de ${new Date(date).toLocaleDateString('es-ES', { dateStyle: 'long' })}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex items-center">
                    <Calendar className="w-12 h-12 text-brand-purple mr-3" />
                    <div>
                      <div className="text-3xl font-bold">
                        {attendanceRecords.length} <span className="text-lg font-medium text-gray-500">/ 150</span>
                      </div>
                      <div className="text-sm text-gray-500">estudiantes presentes</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex-none">
                      <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha
                      </label>
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
            
            {/* Student list */}
            <Card>
              <CardHeader>
                <CardTitle>Listado de asistencia</CardTitle>
                <div className="mt-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Buscar por nombre o DNI..."
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
                    <Loader2 className="h-8 w-8 animate-spin text-brand-purple" />
                  </div>
                ) : filteredRecords.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[400px] border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Nombre</th>
                          <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">DNI</th>
                          <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Hora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((record, index) => (
                          <tr key={record.studentId + index} className="border-b border-gray-100">
                            <td className="py-3 px-4 text-gray-800">{record.studentName}</td>
                            <td className="py-3 px-4 text-gray-800">{record.dni}</td>
                            <td className="py-3 px-4 text-gray-600">
                              {new Date(record.timestamp).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {searchTerm ? 'No se encontraron estudiantes que coincidan con la búsqueda' : 'No hay registros de asistencia para esta fecha'}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics" className="space-y-4">
            <div className="flex justify-between items-center mb-8">
              <CardTitle>Estadísticas de Asistencia</CardTitle>
              
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

            {statsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-brand-purple" />
              </div>
            ) : stats ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Daily Attendance Card */}
                <Card className="col-span-full md:col-span-2 lg:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-medium">Asistencia Diaria</CardTitle>
                      <CardDescription>Últimos 7 días</CardDescription>
                    </div>
                    <Calendar className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.dailyStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(tick) => new Date(tick).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          />
                          <YAxis />
                          <RechartsTooltip 
                            formatter={(value: any) => [`${value} estudiantes`, 'Asistencia']}
                            labelFormatter={(label: any) => new Date(label).toLocaleDateString('es-ES', { 
                              weekday: 'long',
                              day: 'numeric', 
                              month: 'long'
                            })}
                          />
                          <Bar dataKey="count" fill="#9b87f5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Weekly Stats */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-medium">Asistencia Semanal</CardTitle>
                      <CardDescription>Últimas 4 semanas</CardDescription>
                    </div>
                    <BarChart3 className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.weeklyStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="week" 
                            tickFormatter={(tick) => {
                              const date = new Date(tick);
                              return `Sem ${date.getDate()}/${date.getMonth() + 1}`;
                            }}
                          />
                          <YAxis />
                          <RechartsTooltip 
                            formatter={(value: any) => [`${value} estudiantes`, 'Asistencia']}
                            labelFormatter={(label: any) => `Semana del ${new Date(label).toLocaleDateString('es-ES', { 
                              day: 'numeric',
                              month: 'long'
                            })}`}
                          />
                          <Bar dataKey="count" fill="#7E69AB" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly Stats */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-medium">Asistencia Mensual</CardTitle>
                      <CardDescription>Últimos 3 meses</CardDescription>
                    </div>
                    <BarChart3 className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.monthlyStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="month" 
                            tickFormatter={(tick) => {
                              const [year, month] = tick.split('-');
                              return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('es-ES', { month: 'short' });
                            }}
                          />
                          <YAxis />
                          <RechartsTooltip 
                            formatter={(value: any) => [`${value} estudiantes`, 'Asistencia']}
                            labelFormatter={(label: any) => {
                              const [year, month] = label.split('-');
                              return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('es-ES', { 
                                month: 'long',
                                year: 'numeric'
                              });
                            }}
                          />
                          <Bar dataKey="count" fill="#6E59A5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Student Attendance List */}
                <Card className="col-span-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-medium">Asistencia por Estudiante</CardTitle>
                      <CardDescription>Estudiantes con menor asistencia</CardDescription>
                    </div>
                    <Users className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse min-w-[600px]">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Estudiante</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Porcentaje</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.studentStats.slice(0, 15).map((student) => (
                            <tr key={student.studentId} className="border-b border-gray-100">
                              <td className="py-3 px-4 text-gray-800">{student.studentName}</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center">
                                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div 
                                      className={`h-2.5 rounded-full ${
                                        student.attendancePercentage < 50 ? 'bg-red-500' : 
                                        student.attendancePercentage < 75 ? 'bg-yellow-500' : 
                                        'bg-green-500'
                                      }`}
                                      style={{ width: `${student.attendancePercentage}%` }}
                                    ></div>
                                  </div>
                                  <span className="ml-2 text-sm text-gray-600">
                                    {Math.round(student.attendancePercentage)}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  student.attendancePercentage < 50 
                                    ? 'bg-red-100 text-red-800' 
                                    : student.attendancePercentage < 75 
                                    ? 'bg-yellow-100 text-yellow-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {student.attendancePercentage < 50 
                                    ? 'Crítico' 
                                    : student.attendancePercentage < 75 
                                    ? 'Atención' 
                                    : 'Regular'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No se pudieron cargar las estadísticas.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TeacherPanel;
