# Estado de la integración

Base conservada: commit `46a6724` del CRM inmobiliario.
Origen de las mejoras: CRM WhatsApp del curso y sus correcciones de acceso.
Rama de revisión: `integracion-whatsapp-local`.

Se implementan bandeja, QR, adjuntos, respuestas rápidas, secuencias por
palabras clave, programados y recuperación de contraseña. Se adapta el conector
para ejecución local y se reutiliza el módulo de sesiones con escritura atómica
y respaldo del curso. No se copia su instalador de base de datos ni su despliegue
en servidor. No se cambian los módulos inmobiliarios existentes.

La migración se verifica en una base PostgreSQL temporal con datos de prueba y
roles agente/asistente/inactivo/anónimo, incluida exclusión de una segunda
computadora, reclamo atómico, vencimiento y conservación de contactos/propiedades.
Las pruebas del conector cubren teléfonos, exclusión de grupos, palabras clave,
archivos de visualización única, adjuntos autorizados y recuperación de sesiones.

Pendiente de activar: respaldo y ejecución de la ampliación en el Supabase
inmobiliario; revisión de la vista previa; vinculación personal por QR y prueba
real de envío/recepción. Ninguna prueba automatizada envía mensajes reales ni
crea cuentas. Estos pasos no se deben presentar como ya comprobados.
