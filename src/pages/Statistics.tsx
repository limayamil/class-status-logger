
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { sheetsService } from '@/services/sheetsService';
import Navigation from '@/components/Navigation';
import { Loader2, Download, FileUp, BarChart3, Users, Calendar } from 'lucide-react';
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

interface StatisticsData {
  dailyStats: { date: string; count: number }[];
  weeklyStats: { week: string; count: number }[];
  monthlyStats: { month: string; count: number }[];
  studentStats: { studentId: string; studentName: string; attendancePercentage: number }[];
}

const Statistics = () => {
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);
  const { user } = useAuth();

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

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const data = await sheetsService.getStatistics();
      setStats(data);
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navigation />

      <motion.div // Wrap main content area
        className="flex-1 container mx-auto px-4 py-8"
        initial="hidden"
        animate="visible"
        variants={{ // Simple fade-in for the whole page initially
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.5 } }
        }}
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Estadísticas de Asistencia</h1>
            <p className="text-brand-purple">Bienvenido/a, {user?.name}</p>
          </div>
          
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

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-brand-purple" />
          </div>
        ) : stats ? (
          <motion.div // Wrap the grid container for staggering
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Daily Attendance Card */}
            <motion.div variants={itemVariants} className="col-span-full md:col-span-2 lg:col-span-2"> {/* Wrap Card */}
              <Card>
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
                      <Tooltip 
                        formatter={(value) => [`${value} estudiantes`, 'Asistencia']}
                        labelFormatter={(label) => new Date(label).toLocaleDateString('es-ES', { 
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
            </motion.div>

            {/* Weekly Stats */}
            <motion.div variants={itemVariants}> {/* Wrap Card */}
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

            {/* Monthly Stats */}
            <motion.div variants={itemVariants}> {/* Wrap Card */}
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

            {/* Student Attendance List */}
            <motion.div variants={itemVariants} className="col-span-full"> {/* Wrap Card */}
              <Card>
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
            </motion.div>
          </motion.div> // Close grid motion.div
        ) : (
          <div className="text-center py-12 text-gray-500">
            No se pudieron cargar las estadísticas.
          </div>
        )}
      </motion.div> // Close main content motion.div
    </div>
  );
};

export default Statistics;
