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
import { toast } from 'sonner';
import { sheetsService } from '@/services/sheetsService';
import Navigation from '@/components/Navigation';
import { Loader2, Check, ChevronsUpDown, CheckCircle2, Hand, User, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import confetti from 'canvas-confetti';

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
  const [openCombobox, setOpenCombobox] = useState(false);
  const [showThankYou, setShowThankYou] = useState<boolean>(false);

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

  // Función para crear el efecto de confetti celebratorio
  const triggerCelebrationConfetti = () => {
    // Primera ráfaga desde el centro
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#9333ea', '#c084fc', '#7c3aed', '#a855f7', '#8b5cf6', '#fbbf24', '#f59e0b']
    });

    // Segunda ráfaga desde la izquierda
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: ['#9333ea', '#c084fc', '#7c3aed', '#a855f7', '#8b5cf6']
      });
    }, 250);

    // Tercera ráfaga desde la derecha
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: ['#fbbf24', '#f59e0b', '#eab308', '#facc15']
      });
    }, 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStudent || !dni) {
      toast.error("Por favor, selecciona tu nombre y verifica tu DNI");
      return;
    }

    setSubmitting(true);
    setShowThankYou(false);

    try {
      const student = students.find(s => s.id === selectedStudent);
      if (!student) {
        toast.error("Estudiante no encontrado");
        setSubmitting(false);
        return;
      }

      if (student.dni !== dni) {
        toast.error("El DNI ingresado no coincide con el registrado para este estudiante");
        setSubmitting(false);
        return;
      }

      let mongoAttempted = false;
      let mongoSuccess = false;
      let duplicateDetected = false;

      try {
        mongoAttempted = true;
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const fechaActual = `${year}-${month}-${day}`;

        const asistenciaData = {
          fecha: fechaActual,
          nombreEstudiante: student.name,
          estado: 'Presente' as const,
        };

        const response = await fetch('/.netlify/functions/registrar-asistencia', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(asistenciaData),
        });

        if (response.status === 201) {
          const responseData = await response.json();
          console.log('Respuesta de Netlify Function (MongoDB):', responseData);
          toast.success("Asistencia registrada correctamente.");
          mongoSuccess = true;
          setShowThankYou(true);
          triggerCelebrationConfetti();
        } else if (response.status === 409) {
          const errorData = await response.json();
          toast.error(errorData.message || "Ya has registrado tu asistencia hoy.");
          duplicateDetected = true;
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Error desconocido del servidor' }));
          throw new Error(errorData.message || `Error ${response.status} al guardar en DB`);
        }

      } catch (mongoError: unknown) {
        let errorMessage = "Error desconocido al contactar el servidor de registro.";
        if (mongoError instanceof Error) {
          errorMessage = `Error al registrar: ${mongoError.message}`;
        }
        toast.error(errorMessage);
        console.error("Error Fetch/MongoDB:", mongoError);
      }

      if (mongoSuccess) {
        try {
          await sheetsService.markAttendance(
            student.id,
            student.name,
            dni
          );
          console.log("Backup en Google Sheets realizado.");
        } catch (sheetsError) {
          toast.warning("Asistencia guardada, pero falló el backup en Google Sheets.");
          console.error("Error Google Sheets Backup:", sheetsError);
        }
      }

      if (!showThankYou && (mongoSuccess || duplicateDetected)) {
        setSelectedStudent('');
        setDni('');
      }

    } catch (error) {
      toast.error("Ocurrió un error inesperado antes de registrar.");
      console.error("Error general previo en handleSubmit:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col bg-background">
      <Navigation />

      <motion.div
        className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center"
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="/university_icon.webp" 
                alt="Universidad" 
                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain drop-shadow-md filter hover:drop-shadow-lg transition-all duration-300"
              />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Taller de medios</h1>
            <p className="text-brand-purple mt-2 capitalize">{currentDate}</p>
            <p className="text-muted-foreground">{currentTime}</p>
          </div>

          {showThankYou ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col items-center justify-center p-8 bg-card text-card-foreground rounded-lg shadow-md"
            >
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
              <h2 className="text-2xl font-semibold mb-2">¡Asistencia Registrada!</h2>
              <p className="text-muted-foreground text-center">Gracias por marcar tu asistencia.</p>
            </motion.div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>¿Estás presente?</CardTitle>
                <CardDescription>
                Completá tus datos para que te contemos como presente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Nombre y Apellido
                    </Label>
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Cargando estudiantes...</span>
                      </div>
                    ) : (
                      <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openCombobox}
                            className="w-full justify-between"
                            disabled={students.length === 0}
                          >
                            {selectedStudent
                              ? students.find((student) => student.id === selectedStudent)?.name
                              : "Selecciona tu nombre..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                          <Command>
                            <CommandInput placeholder="Busca tu nombre..." />
                            <CommandList>
                              <CommandEmpty>No se encontró el estudiante.</CommandEmpty>
                              <CommandGroup>
                                {students.map((student) => (
                                  <CommandItem
                                    key={student.id}
                                    value={student.name}
                                    onSelect={(currentValue) => {
                                      const matchedStudent = students.find(s => s.name.toLowerCase() === currentValue.toLowerCase());
                                      setSelectedStudent(matchedStudent ? matchedStudent.id : "");
                                      setOpenCombobox(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedStudent === student.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {student.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                  {selectedStudent && (
                    <div className="space-y-2">
                      <Label htmlFor="dni" className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        DNI
                      </Label>
                      <Input
                        id="dni"
                        type="text"
                        value={dni}
                        onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                        placeholder="Tu DNI"
                        required
                        inputMode="numeric"
                        pattern="\d*"
                      />
                    </div>
                  )}

                  <CardFooter className="p-0 pt-4">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={submitting || !selectedStudent || !dni || loading}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Registrando...
                        </>
                      ) : (
                        <>
                          <Hand className="mr-2 h-4 w-4" />
                          ¡Estoy presente!
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Index;
