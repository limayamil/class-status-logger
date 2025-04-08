// Importar directamente los datos del archivo JSON
import estudiantesData from '../../listado_completo_nombres.json';

// Ordenar estudiantes por apellido y luego por nombre
export const ESTUDIANTES_REALES = estudiantesData.sort((a, b) => {
    // Ordenar primero por apellido
    const apellidoComparison = a.apellido.localeCompare(b.apellido, 'es');
    
    // Si los apellidos son iguales, ordenar por nombre
    if (apellidoComparison === 0) {
        return a.nombre.localeCompare(b.nombre, 'es');
    }
    
    return apellidoComparison;
}); 