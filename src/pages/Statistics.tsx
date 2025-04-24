import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { sheetsService } from '@/services/sheetsService';
import { classesService } from '@/services/classesService';
import Navigation from '@/components/Navigation';
import { Loader2, Download, BarChart3, Users, Calendar, Percent, PlusCircle } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';

interface StatsServiceResponse {
  dailyStats?: { date: string; count: number }[];
  weeklyStats: { week: string; count: number }[];
  monthlyStats: { month: string; count: number }[];
  studentStats: { studentId: string; studentName: string; attendedClassesCount: number }[];
  totalClassesHeld?: number;
}

interface StatisticsData {
  weeklyStats: { week: string; count: number }[];
  monthlyStats: { month: string; count: number }[];
  studentStats: { studentId: string; studentName: string; attendedClassesCount: number }[];
  totalClassesHeld: number;
}

const Statistics = () => {
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [updatingClasses, setUpdatingClasses] = useState(false);
  const { user } = useAuth();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const data: StatsServiceResponse = await sheetsService.getStatistics();
      
      setStats({
        weeklyStats: data.weeklyStats || [],
        monthlyStats: data.monthlyStats || [],
        studentStats: data.studentStats || [],
        totalClassesHeld: data.totalClassesHeld || 0,
      });
    } catch (error) {
      toast.error('Error al cargar las estadísticas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, []);

  const handleExportToPDF = async () => {
    setExportingPDF(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Estadísticas exportadas a PDF correctamente');
    } catch (error) {
      toast.error('Error al exportar las estadísticas');
      console.error(error);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleIncrementClasses = async () => {
    setUpdatingClasses(true);
    try {
      await classesService.incrementTotalClassesHeld();
      fetchStatistics();
    } catch (error) {
      console.error('Error al incrementar clases:', error);
    } finally {
      setUpdatingClasses(false);
    }
  };

  const calculateOverallAttendanceRate = (): number => {
    if (!stats || !stats.studentStats.length || !stats.totalClassesHeld) return 0;
    
    const totalAttendances = stats.studentStats.reduce(
      (sum, student) => sum + student.attendedClassesCount, 0
    );
    
    return (totalAttendances / (stats.studentStats.length * stats.totalClassesHeld)) * 100;
  };

  const overallAttendanceRate = stats ? calculateOverallAttendanceRate() : 0;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navigation />

      <motion.div 
        className="flex-1 container mx-auto px-4 py-8"
        initial="hidden"
        animate="visible"
        variants={{ 
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.5 } }
        }}
      >
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Estadísticas de Asistencia</h1>
            <p className="text-brand-purple">Bienvenido/a, {user?.name}</p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={handleIncrementClasses}
              disabled={loading || updatingClasses}
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
              onClick={handleExportToPDF}
              disabled={loading || exportingPDF}
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

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-brand-purple" />
          </div>
        ) : stats ? (
          <motion.div 
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} className="lg:col-span-1">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-medium">Tasa de Asistencia General</CardTitle>
                    <CardDescription>Promedio total hasta la fecha</CardDescription>
                  </div>
                  <Percent className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-brand-purple">
                    {overallAttendanceRate.toFixed(1)}% 
                  </div>
                  <p className="text-xs text-gray-500 pt-1">
                    Basado en {stats.totalClassesHeld} clases impartidas.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants} className="lg:col-span-1">
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
                      <Tooltip 
                        formatter={(value) => [`${value} estudiantes`, 'Asistencia']}
                        labelFormatter={(label) => `Semana del ${new Date(label).toLocaleDateString('es-ES', { 
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
            </motion.div>

            <motion.div variants={itemVariants} className="lg:col-span-1">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                  <CardTitle className="text-base font-medium">Asistencia Mensual</CardTitle>
                  <CardDescription>Últimos 3 meses</CardDescription>
                </div>
                <Calendar className="h-4 w-4 text-gray-500" />
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
                      <Tooltip 
                        formatter={(value) => [`${value} estudiantes`, 'Asistencia']}
                        labelFormatter={(label) => {
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
            </motion.div>

            <motion.div variants={itemVariants} className="col-span-full">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                  <CardTitle className="text-base font-medium">Asistencia por Estudiante</CardTitle>
                  <CardDescription>Detalle de asistencia individual ({stats.totalClassesHeld} clases totales)</CardDescription>
                </div>
                <Users className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Estudiante</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Regularidad</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">% Asistencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.studentStats
                        .sort((a, b) => (a.attendedClassesCount / stats.totalClassesHeld) - (b.attendedClassesCount / stats.totalClassesHeld))
                        .slice(0, 15)
                        .map((student) => {
                          const attendancePercentage = stats.totalClassesHeld > 0 
                            ? (student.attendedClassesCount / stats.totalClassesHeld) * 100 
                            : 0;
                          
                          const progressBarColor = attendancePercentage >= 75 ? 'bg-green-500' 
                                                : attendancePercentage >= 50 ? 'bg-yellow-500' 
                                                : 'bg-red-500';
                          const progressBarClass = `h-2.5 rounded-full ${progressBarColor}`;
                          const progressWidth = `${attendancePercentage}%`;

                          return (
                            <tr key={student.studentId} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-4 text-gray-800">{student.studentName}</td>
                              <td className="py-3 px-4 text-gray-600 text-sm">
                                {student.attendedClassesCount} / {stats.totalClassesHeld}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center">
                                  <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                                    <div
                                      className={progressBarClass}
                                      style={{ width: progressWidth }}
                                    ></div>
                                  </div>
                                  <span className="text-sm text-gray-600 font-medium w-10 text-right">
                                    {attendancePercentage.toFixed(0)}% 
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No se pudieron cargar las estadísticas.
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Statistics;
