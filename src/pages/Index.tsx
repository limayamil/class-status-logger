import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { sheetsService } from '@/services/sheetsService';
import Navigation from '@/components/Navigation';
import { Loader2 } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  dni: string;
}

const Index = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [dni, setDni] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  // Get students on component mount
  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const fetchedStudents = await sheetsService.getStudents();
        setStudents(fetchedStudents);
      } catch (error) {
        toast.error("Error al cargar la lista de estudiantes");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  // Update current time every second
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString());
      setCurrentDate(now.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }));
    };

    updateDateTime();
    const intervalId = setInterval(updateDateTime, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const handleStudentChange = (value: string) => {
    setSelectedStudent(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStudent || !dni) {
      toast.error("Por favor, selecciona tu nombre y verifica tu DNI");
      return;
    }

    setSubmitting(true);
    
    try {
      const student = students.find(s => s.id === selectedStudent);
      if (!student) {
        toast.error("Estudiante no encontrado");
        return;
      }

      // Verificar que el DNI ingresado coincide con el DNI del estudiante
      if (student.dni !== dni) {
        toast.error("El DNI ingresado no coincide con el registrado para este estudiante");
        setSubmitting(false);
        return;
      }

      // --- Inicio: Llamada a Google Sheets (Backup) ---
      let sheetsSuccess = false;
      try {
        await sheetsService.markAttendance(
          student.id,
          student.name,
          dni
        );
        sheetsSuccess = true; // Marcamos éxito si no hay error
        // No limpiamos el formulario aquí todavía, esperamos a MongoDB
      } catch (sheetsError) {
        toast.error("Error al registrar en Google Sheets (backup)");
        console.error("Error Google Sheets:", sheetsError);
        // Continuamos para intentar guardar en MongoDB de todas formas
      }
      // --- Fin: Llamada a Google Sheets ---

      // --- Inicio: Llamada a MongoDB (Principal) ---
      let mongoSuccess = false;
      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const fechaActual = `${year}-${month}-${day}`;

        const asistenciaData = {
          fecha: fechaActual,
          nombreEstudiante: student.name,
          estado: 'Presente' as const, // Aseguramos el tipo literal
          // Podrías añadir materia/comision aquí si los tuvieras
        };

        const response = await fetch('/.netlify/functions/registrar-asistencia', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(asistenciaData),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Error desconocido del servidor' }));
          throw new Error(errorData.message || `Error ${response.status} al guardar en DB`);
        }

        const responseData = await response.json();
        console.log('Respuesta de Netlify Function (MongoDB):', responseData);
        toast.success("Asistencia registrada correctamente en la base de datos.");
        mongoSuccess = true;

      } catch (mongoError: unknown) {
        let errorMessage = "Error desconocido al registrar en la base de datos.";
        if (mongoError instanceof Error) {
          errorMessage = `Error al registrar en la base de datos: ${mongoError.message}`;
        }
        toast.error(errorMessage);
        console.error("Error MongoDB:", mongoError);
      }
      // --- Fin: Llamada a MongoDB ---

      // Limpiar formulario solo si al menos una de las operaciones fue exitosa
      if (sheetsSuccess || mongoSuccess) {
        setSelectedStudent('');
        setDni('');
      }

    } catch (error) { // Este catch es más general, por si algo falla antes de las llamadas
      toast.error("Ocurrió un error inesperado");
      console.error("Error general en handleSubmit:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col bg-gray-50">
      <Navigation />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Registro de Asistencia</h1>
            <p className="text-brand-purple mt-2 capitalize">{currentDate}</p>
            <p className="text-gray-500">{currentTime}</p>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Marcar Asistencia</CardTitle>
              <CardDescription>
                Selecciona tu nombre e ingresa tu DNI correctamente para verificar tu identidad y registrar tu asistencia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre y Apellido</Label>
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-gray-500">Cargando estudiantes...</span>
                      </div>
                    ) : (
                      <Select 
                        value={selectedStudent} 
                        onValueChange={handleStudentChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tu nombre" />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {students.map(student => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="dni">DNI</Label>
                    <Input
                      id="dni"
                      value={dni}
                      onChange={(e) => setDni(e.target.value)}
                      placeholder="Ingresa tu DNI"
                      required
                    />
                  </div>
                </div>
              </form>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={handleSubmit}
                disabled={submitting || !selectedStudent || !dni}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Estoy Presente'
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
