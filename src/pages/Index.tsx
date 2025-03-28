
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
    // Find the student and auto-fill the DNI
    const student = students.find(s => s.id === value);
    if (student) {
      setDni(student.dni);
    }
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

      const result = await sheetsService.markAttendance(
        student.id,
        student.name,
        dni
      );

      if (result) {
        // Clear form after successful submission
        setSelectedStudent('');
        setDni('');
      }
    } catch (error) {
      toast.error("Error al registrar asistencia");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
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
                Selecciona tu nombre y verifica tu DNI para registrar tu asistencia de hoy.
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
