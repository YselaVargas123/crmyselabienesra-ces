# WhatsApp local para el CRM inmobiliario de Ysela

## Qué cambia y qué se conserva

La base sigue siendo `crmyselabienesra-ces`. Se conservan propiedades, perfiles
de búsqueda, captación/colocación, contactos, actividades, metas, vencimientos,
cierre del día, reportes, usuarios y su autenticación de Supabase.

La sección nueva **WhatsApp** incorpora:

- Líneas vinculadas con QR usando Baileys, con sesiones locales y reconexión.
- Conversaciones asociadas a los contactos existentes. Los números sin ficha
  se pueden vincular manualmente; no se crean contactos de forma automática.
- Envío y recepción de texto, imágenes, audio y PDF de hasta 10 MB.
- Respuestas rápidas reutilizables.
- Reglas de palabras clave con secuencias de hasta diez mensajes, desactivadas
  al crearlas y con una pausa de 24 horas por conversación.
- Mensajes programados y cancelación de solicitudes aún no procesadas.
- Estados de aceptación, entrega, lectura y rechazo cuando WhatsApp los informa.
- Recuperación de contraseña desde el ingreso.

Las reglas son secuencias por palabra clave. El editor visual de flujos con
ramificaciones, las etiquetas nativas de WhatsApp Business y la distribución
de líneas por vendedor del CRM del curso no se migran automáticamente: este
CRM conserva sus roles de agente/asistente. No se fusionan las bases de datos.

## Cómo funciona sin contratar un servidor

La página sigue en Netlify y los datos en el Supabase **del CRM inmobiliario**.
En tu computadora se ejecuta un programa de WhatsApp sin abrir puertos ni
necesitar una dirección pública. La página coloca solicitudes en Supabase;
el programa local las toma usando tu usuario y los permisos de la base.

Apagar/suspender la computadora o cerrar el programa detiene recepción, envíos,
reglas y programados. La página y los datos ya guardados siguen disponibles.
No hay garantía de recuperar todos los mensajes recibidos mientras estuvo
apagado ni se importa todo el historial anterior.

Un programado puede enviarse hasta 15 minutos después de su hora si el conector
vuelve a estar disponible en ese intervalo. Después vence y debe revisarse.
Un envío manual en cola vence en cinco minutos. Si el proceso se interrumpe
mientras enviaba, no reintenta a ciegas: comprueba WhatsApp antes de repetir.

## Instalar primero en una copia de prueba

1. Conserva una exportación o respaldo recuperable del Supabase inmobiliario.
   Un respaldo del código en GitHub no respalda los datos de Supabase.
2. En Supabase, comprueba que el proyecto sea
   **qzfnncblpsfefhsvldul**, el que usa `crmyselabienesraices.netlify.app`.
   No ejecutes esto en el proyecto del CRM del curso.
3. Abre SQL Editor y ejecuta **database/whatsapp-local.sql** una sola vez.
   Se ejecuta dentro de una transacción y añade tablas `crm_wa_*`, funciones,
   políticas y un espacio privado para archivos. No modifica las tablas de
   negocio existentes. No reemplaces tu base con `instalar.sql` del curso.
4. Revisa la vista previa de la rama/PR de integración en Netlify. Usa un
   usuario activo que ya exista en `profiles`; no crees otra cuenta.
5. Tras comprobarla, integra la rama en `main` para publicar en tu sitio.

El proyecto publicado debe conservar sus propias variables
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. La segunda es la clave pública,
no una dirección web. Una clave `sb_secret_*` o `service_role` nunca va en
variables `VITE_*`, Netlify frontend, GitHub público ni el programa local.

## Encender WhatsApp en Windows

1. Instala Node.js **22 o posterior** desde https://nodejs.org si no lo tienes.
2. Descarga la rama de integración desde GitHub (Code → Download ZIP) y
   **extrae el ZIP** a una carpeta permanente de tu computadora.
3. Abre **Iniciar WhatsApp.cmd** en esa carpeta. En el primer inicio descarga
   las dependencias del conector.
4. Ingresa tu correo y contraseña **del CRM inmobiliario**. La contraseña no
   se muestra, no se guarda y solo se usa para ingresar a su Supabase.
5. Deja esa ventana abierta. Cuando diga «Conector listo», abre el CRM,
   **WhatsApp → Conexiones**, agrega una línea y pulsa **Conectar / renovar QR**.
6. En el celular del número: WhatsApp → Dispositivos vinculados → Vincular
   un dispositivo. Escanea el QR del CRM. Comprueba el estado conectado.
7. Desde otro número, envía un mensaje de prueba y comprueba que aparezca en
   la bandeja. Responde primero a un contacto de prueba.

La conexión de este CRM es independiente de la del curso. Durante la prueba
evita conectar el mismo número en ambos sistemas para no duplicar respuestas
o automatizaciones. Los QR se escanean personalmente desde el celular.

Para detenerlo pulsa Ctrl+C en la ventana o ciérrala. Para reiniciarlo abre
el mismo archivo. La carpeta `.whatsapp-local` conserva la sesión de WhatsApp;
no la subas a GitHub ni la compartas. La sesión del CRM vive solo en memoria:
al volver a iniciar el programa ingresas de nuevo. Solo la persona que creó
la línea puede ejecutar su conector; los otros usuarios activos pueden atender
las conversaciones según los permisos de esta ampliación.

Si el programa no puede obtener la configuración pública desde la página,
crea `.env.local` en la raíz con `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` del mismo proyecto. El archivo está excluido de Git.

## Comprobar y volver atrás

- Verifica que propiedades, actividades, contactos, pipeline y reportes
  sigan mostrando tus registros originales.
- Comprueba ingreso y recuperación; en Supabase → Authentication → URL
  Configuration debe estar permitido el dominio de producción del CRM.
- Comprueba QR, recepción, respuesta y estados de envío con un contacto de
  prueba. Las confirmaciones dependen de WhatsApp y del destinatario.
- Crea una regla desactivada, revísala y luego actívala para una prueba.
- Programa un mensaje de prueba, cancela otro antes de su hora y comprueba
  el comportamiento al apagar el conector.

Para volver al comportamiento anterior, cierra el conector y vuelve a la
publicación anterior en Netlify o revierte la integración. Conserva las tablas
`crm_wa_*` para no perder el historial: el CRM anterior simplemente no las usa.

Baileys es una integración comunitaria no oficial de WhatsApp. No se garantiza
funcionamiento permanente ni importación de todo el historial.
