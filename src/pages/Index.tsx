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

// Importar Google Fonts para fuente manuscrita
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

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
              className="relative bg-gradient-to-br from-emerald-50/90 via-green-50/90 to-teal-50/90 dark:from-emerald-900/40 dark:via-green-900/30 dark:to-teal-900/40 p-8 shadow-2xl rounded-lg border border-emerald-200/50 dark:border-emerald-700/30"
              style={{
                fontFamily: '"Kalam", cursive',
              }}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-600 dark:text-emerald-400 mb-4 transform rotate-12" />
                <h2 className="text-2xl font-semibold mb-2 text-slate-800 dark:text-slate-200 transform -rotate-1" style={{ fontFamily: '"Kalam", cursive' }}>¡Asistencia Registrada!</h2>
                <p className="text-slate-600 dark:text-slate-400 transform rotate-0.5" style={{ fontFamily: '"Kalam", cursive' }}>Gracias por marcar tu asistencia.</p>
              </div>
            </motion.div>
          ) : (
            <div className="relative">
              {/* Efecto de papel */}
              <div 
                className="relative bg-gradient-to-br from-amber-50/90 via-yellow-50/90 to-orange-50/90 dark:from-amber-900/40 dark:via-yellow-900/30 dark:to-orange-900/40 p-8 shadow-2xl rounded-lg border border-amber-200/50 dark:border-amber-700/30"
                style={{
                  fontFamily: '"Kalam", cursive',
                }}
              >
                {/* Líneas de cuaderno sutiles */}
                <div className="absolute inset-0 opacity-10 dark:opacity-5 rounded-lg overflow-hidden">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div
                      key={i}
                      className="border-b border-blue-300 dark:border-blue-600"
                      style={{
                        height: '28px',
                        marginTop: i === 0 ? '60px' : '0',
                      }}
                    />
                  ))}
                </div>

                <div className="relative z-10">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2 transform -rotate-1" style={{ fontFamily: '"Kalam", cursive' }}>
                      ¿Estás presente?
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 transform rotate-0.5" style={{ fontFamily: '"Kalam", cursive', fontSize: '16px' }}>
                      Completá tus datos para que te contemos como presente.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className="flex items-center gap-2 text-slate-700 dark:text-slate-300 transform -rotate-0.5" style={{ fontFamily: '"Kalam", cursive', fontSize: '18px' }}>
                        <User className="h-5 w-5" />
                        Nombre y Apellido
                      </Label>
                      {loading ? (
                        <div className="flex items-center space-x-2 p-3">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground" style={{ fontFamily: '"Kalam", cursive' }}>Cargando estudiantes...</span>
                        </div>
                      ) : (
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openCombobox}
                              className="w-full justify-between bg-white/80 dark:bg-slate-800/80 border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-inner hover:bg-white/90 dark:hover:bg-slate-700/90 transform rotate-0.5"
                              style={{ 
                                fontFamily: '"Kalam", cursive', 
                                fontSize: '16px',
                                borderStyle: 'dashed'
                              }}
                              disabled={students.length === 0}
                            >
                              {selectedStudent
                                ? students.find((student) => student.id === selectedStudent)?.name
                                : "Selecciona tu nombre..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0 bg-amber-50/95 dark:bg-slate-800/95 border-dashed">
                            <Command>
                              <CommandInput placeholder="Busca tu nombre..." style={{ fontFamily: '"Kalam", cursive' }} />
                              <CommandList>
                                <CommandEmpty style={{ fontFamily: '"Kalam", cursive' }}>No se encontró el estudiante.</CommandEmpty>
                                <CommandGroup>
                                  {students.map((student) => (
                                    <CommandItem
                                      key={student.id}
                                      value={student.name}
                                      style={{ fontFamily: '"Kalam", cursive' }}
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
                      <div className="space-y-3">
                        <Label htmlFor="dni" className="flex items-center gap-2 text-slate-700 dark:text-slate-300 transform rotate-0.5" style={{ fontFamily: '"Kalam", cursive', fontSize: '18px' }}>
                          <CreditCard className="h-5 w-5" />
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
                          className="bg-white/80 dark:bg-slate-800/80 border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-inner transform -rotate-0.5 text-slate-800 dark:text-slate-200"
                          style={{ 
                            fontFamily: '"Kalam", cursive', 
                            fontSize: '18px',
                            borderStyle: 'dashed'
                          }}
                        />
                      </div>
                    )}

                    <div className="pt-4">
                      <Button
                        type="submit"
                        className="w-full bg-brand-purple hover:brand-purple-700 dark:bg-brand-purple-700 dark:hover:brand-purple-800 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 rotate-1"
                        style={{ 
                          fontFamily: '"Kalam", cursive', 
                          fontSize: '18px',
                          textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                        }}
                        disabled={submitting || !selectedStudent || !dni || loading}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Registrando...
                          </>
                        ) : (
                          <>
                            <Hand className="mr-2 h-5 w-5" />
                            ¡Estoy presente!
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Index;
