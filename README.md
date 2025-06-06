# AsistenciaUNI

AsistenciaUNI es una aplicación web para registrar y administrar la asistencia de estudiantes de manera rápida y sencilla. El sistema está construido con **React**, **Vite** y **Tailwind CSS**, y utiliza funciones serverless de **Netlify** junto con **MongoDB** para almacenar los datos de forma segura.

## Ventajas principales

- **Registro ágil**: los estudiantes pueden marcar su asistencia desde un formulario interactivo que verifica su identidad.
- **Panel docente**: los profesores cuentan con un panel privado para consultar estadísticas diarias, semanales y mensuales.
- **Exportaciones**: permite exportar los registros a PDF o Google Sheets para respaldos o reportes.
- **Interfaz moderna**: diseño responsivo con soporte de tema claro y oscuro.
- **Backup automático**: además de la base de datos, se realiza un respaldo en Google Sheets mediante webhooks.
- **Despliegue sencillo**: preparado para ser publicado en Netlify sin configuraciones complejas.

## Requisitos

- Node.js 18 o superior.
- Una base de datos MongoDB accesible y la variable de entorno `MONGODB_URI` configurada.
- (Opcional) Cuenta en Make/Integromat para las integraciones de exportación.

## Instalación

```bash
# Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd class-status-logger

# Instalar dependencias
npm install
```

Crea un archivo `.env` en la raíz con la variable `MONGODB_URI` apuntando a tu base de datos.

## Uso en desarrollo

Inicia el servidor de desarrollo con recarga automática:

```bash
npm run dev
```

La aplicación estará disponible normalmente en `http://localhost:8080`.

## Construcción para producción

```bash
npm run build
```

Los archivos optimizados se generarán en la carpeta `dist/` listos para desplegar en Netlify u otro proveedor estático.

## Despliegue

1. Configura la variable `MONGODB_URI` en tu panel de Netlify.
2. Sube el contenido del repositorio o conecta el repositorio de GitHub.
3. Netlify ejecutará `npm run build` y publicará el contenido de `dist/`.

## Contribución

¡Se agradecen las contribuciones! Crea un _fork_ del proyecto y abre un **pull request** con tu mejora o corrección.

## Estado del proyecto

El proyecto se encuentra en desarrollo activo y se utiliza para gestionar asistencias en cursos universitarios. Puedes revisar `tasks.md` para ver las próximas mejoras planificadas.
