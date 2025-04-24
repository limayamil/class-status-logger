import { toast } from "sonner";

// Define las interfaces para las respuestas del servicio
interface ClassCountResponse {
  totalClassesHeld: number;
}

// Clase para manejar operaciones relacionadas con el contador de clases
export const classesService = {
  /**
   * Obtiene el contador actual de clases impartidas
   * @returns Número total de clases impartidas
   */
  getTotalClassesHeld: async (): Promise<number> => {
    try {
      const response = await fetch('/.netlify/functions/get-class-count');
      
      if (!response.ok) {
        throw new Error(`Error al obtener el contador de clases: ${response.statusText}`);
      }
      
      const data: ClassCountResponse = await response.json();
      return data.totalClassesHeld;
    } catch (error) {
      console.error('Error al obtener el contador de clases:', error);
      toast.error('Error al obtener el contador de clases');
      return 0; // Valor por defecto en caso de error
    }
  },

  /**
   * Incrementa el contador de clases impartidas
   * @param increment Cantidad a incrementar (opcional, por defecto 1)
   * @returns Nuevo contador después del incremento
   */
  incrementTotalClassesHeld: async (increment: number = 1): Promise<number> => {
    try {
      const response = await fetch('/.netlify/functions/get-class-count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ increment }),
      });
      
      if (!response.ok) {
        throw new Error(`Error al incrementar el contador de clases: ${response.statusText}`);
      }
      
      const data: ClassCountResponse & { message: string } = await response.json();
      toast.success('Contador de clases actualizado correctamente');
      return data.totalClassesHeld;
    } catch (error) {
      console.error('Error al incrementar el contador de clases:', error);
      toast.error('Error al actualizar el contador de clases');
      return -1; // Valor indicativo de error
    }
  }
}; 