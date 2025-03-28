
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { sheetsService } from '@/services/sheetsService';
import Navigation from '@/components/Navigation';
import { Loader2, Search, Calendar, Download, FileUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface AttendanceRecord {
  timestamp: string;
  studentId: string;
  studentName: string;
  dni: string;
  date: string;
}

const TeacherPanel = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'sheets' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();

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

  useEffect(() => {
    fetchAttendanceRecords(date);
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

        <div className="grid gap-6">
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
        </div>
      </div>
    </div>
  );
};

export default TeacherPanel;
