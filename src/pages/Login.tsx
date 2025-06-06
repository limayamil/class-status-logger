import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import { motion } from 'framer-motion';

// Definir variantes de animación fuera del componente (reutilizable)
const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut"
    }
  }
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the redirect path from the location state or default to /panel
  const from = (location.state as { from?: string })?.from || '/panel';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const success = await login(email, password);
      
      if (success) {
        toast.success('Inicio de sesión exitoso');
        navigate(from);
      } else {
        toast.error('Credenciales incorrectas');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Changed bg-gray-50 to bg-background
    <div className="flex flex-col bg-background"> 
      <Navigation />

      <motion.div // Envolver el contenedor principal del contenido
        className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center" // Centrar contenido
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="max-w-md w-full"> {/* Asegurar ancho completo dentro de motion */}
          <div className="text-center mb-8">
            {/* Changed text-gray-800 to text-foreground */}
            <h1 className="text-3xl font-bold text-foreground">Acceso Docente</h1> 
            {/* Changed text-gray-500 to text-muted-foreground */}
            <p className="text-muted-foreground mt-2">Ingresa tus credenciales para continuar</p> 
          </div>
          
          {/* Card should adapt automatically */}
          <Card> 
            <CardHeader>
              <CardTitle>Acceso al sistema</CardTitle>
              <CardDescription>
                Ingresa tus credenciales para acceder al panel docente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </form>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={handleSubmit}
                disabled={isLoading || !email || !password}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar sesión'
                )}
              </Button>
            </CardFooter>
          </Card>
          
          {/* Removed demo user info display */}
        </div>
      </motion.div> {/* Cerrar motion.div */}
    </div>
  );
};

export default Login;
