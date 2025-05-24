import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { UserCircle, ClipboardList, Moon, Sun, GraduationCap } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const Navigation = () => {
  const location = useLocation();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Initialize theme from localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Apply theme class to html element and save preference
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const navItems = [
    {
      title: 'Asistencia',
      path: '/',
      icon: <ClipboardList className="h-5 w-5" />
    },
    {
      title: 'Panel Docente',
      path: '/panel',
      icon: <UserCircle className="h-5 w-5" />
    }
  ];

  return (
    <nav className="bg-card text-card-foreground shadow-sm border-b border-border"> {/* Changed bg-white to bg-card, added text-card-foreground and border */}
      <div className="container mx-auto">
        <div className="flex justify-between items-center p-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-brand-purple rounded-md flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-lg">AsistenciaUNI</span>
          </div>
          
          <div className="hidden md:flex space-x-6">
            {navItems.map((item) => (
              <Link 
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center space-x-1 px-2 py-1 rounded-md transition-colors",
                  location.pathname === item.path
                    ? "text-primary font-medium" // Changed text-brand-purple to text-primary
                    : "text-muted-foreground hover:text-primary" // Changed text-gray-600 to text-muted-foreground, hover:text-brand-purple to hover:text-primary
                )}
              >
                {item.icon}
                <span>{item.title}</span>
              </Link>
            ))}
          </div>

          {/* Theme Toggle Switch */}
          <div className="flex items-center space-x-2">
            <Sun className="h-[1.2rem] w-[1.2rem] text-muted-foreground" /> {/* Changed text color */}
            <Switch
              id="theme-switch"
              checked={theme === 'dark'}
              onCheckedChange={toggleTheme}
              aria-label="Cambiar tema"
            />
            <Moon className="h-[1.2rem] w-[1.2rem] text-muted-foreground" /> {/* Changed text color */}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-10"> {/* Changed bg-white to bg-card, border-gray-200 to border-border */}
        <div className="flex justify-around items-center">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center py-3 px-2",
                location.pathname === item.path
                  ? "text-primary" // Changed text-brand-purple to text-primary
                  : "text-muted-foreground" // Changed text-gray-500 to text-muted-foreground
              )}
            >
              {item.icon}
              <span className="text-xs mt-1">{item.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
