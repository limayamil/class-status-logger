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
import { motion } from 'framer-motion';

// Definir variantes de animación fuera del componente
const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6, // Duración de la animación
      ease: "easeOut" // Tipo de easing
    }
  }
};

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
        setSubmitting(false); // Añadido para liberar el botón si no se encuentra
        return;
      }

      // Verificar que el DNI ingresado coincide con el DNI del estudiante
      if (student.dni !== dni) {
        toast.error("El DNI ingresado no coincide con el registrado para este estudiante");
        setSubmitting(false);
        return;
      }

      let mongoAttempted = false;
      let mongoSuccess = false;
      // let sheetsSuccess = false; // No se usa directamente para lógica condicional aquí
      let duplicateDetected = false;

      // --- Inicio: Llamada a MongoDB (Principal y Validación) ---
      try {
        mongoAttempted = true; // Marcamos que intentamos la operación con Mongo
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

        // Analizar la respuesta de la función
        if (response.status === 201) { // Éxito: Creado en MongoDB
          const responseData = await response.json();
          console.log('Respuesta de Netlify Function (MongoDB):', responseData);
          toast.success("Asistencia registrada correctamente.");
          mongoSuccess = true;
        } else if (response.status === 409) { // Conflicto: Duplicado
          const errorData = await response.json();
          toast.error(errorData.message || "Ya has registrado tu asistencia hoy.");
          duplicateDetected = true;
        } else { // Otro error del servidor
          const errorData = await response.json().catch(() => ({ message: 'Error desconocido del servidor' }));
          throw new Error(errorData.message || `Error ${response.status} al guardar en DB`);
        }

      } catch (mongoError: unknown) {
        // Capturar errores de red o errores inesperados al llamar a la función
        let errorMessage = "Error desconocido al contactar el servidor de registro.";
        if (mongoError instanceof Error) {
          errorMessage = `Error al registrar: ${mongoError.message}`;
        }
        toast.error(errorMessage);
        console.error("Error Fetch/MongoDB:", mongoError);
      }
      // --- Fin: Llamada a MongoDB ---


      // --- Inicio: Llamada a Google Sheets (Backup Condicional) ---
      // Solo intentar guardar en Sheets si MongoDB fue exitoso (no duplicado, no error)
      if (mongoSuccess) {
        try {
          await sheetsService.markAttendance(
            student.id,
            student.name,
            dni
          );
          // sheetsSuccess = true; // Marcamos éxito de Sheets
          console.log("Backup en Google Sheets realizado.");
        } catch (sheetsError) {
          toast.warning("Asistencia guardada, pero falló el backup en Google Sheets."); // Usar warning ya que lo principal funcionó
          console.error("Error Google Sheets Backup:", sheetsError);
        }
      }
      // --- Fin: Llamada a Google Sheets ---


      // Limpiar formulario solo si la operación principal (Mongo) fue exitosa
      // O si se detectó un duplicado (para que el usuario no siga intentando)
      if (mongoSuccess || duplicateDetected) {
        setSelectedStudent('');
        setDni('');
      }

    } catch (error) { // Catch para errores ANTES de las llamadas (ej. find student)
      toast.error("Ocurrió un error inesperado antes de registrar.");
      console.error("Error general previo en handleSubmit:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // Changed bg-gray-50 to bg-background
    <div className="flex flex-col bg-background"> {/* REMOVED min-h-screen */}
      <Navigation />

      <motion.div // Envolver el contenedor principal del contenido
        className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center" // Centrar contenido si es posible
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="max-w-md w-full"> {/* Asegurar que tome el ancho completo dentro del contenedor motion */}
          <div className="text-center mb-8">
            {/* Changed text-gray-800 to text-foreground */}
            <h1 className="text-3xl font-bold text-foreground">Asistencia - Taller de medios</h1>
            {/* Kept text-brand-purple for now, can change to text-primary if needed */}
            <p className="text-brand-purple mt-2 capitalize">{currentDate}</p>
            {/* Changed text-gray-500 to text-muted-foreground */}
            <p className="text-muted-foreground">{currentTime}</p>
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
                        <Loader2 className="h-4 w-4 animate-spin text-primary" /> {/* Added text-primary to spinner */}
                        {/* Changed text-gray-500 to text-muted-foreground */}
                        <span className="text-sm text-muted-foreground">Cargando estudiantes...</span>
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
                      type="number"
                      value={dni}
                      onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
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
      </motion.div> {/* Etiqueta de cierre correcta */}
    </div>
  );
};

export default Index;
