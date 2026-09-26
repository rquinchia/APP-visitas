# PROJECT_STATUS — APP Visitas

_Última actualización: 2026-09-26_

## Objetivo

App PWA mobile-first, offline-first e instalable, para administrar visitas técnicas
industriales (PA – Stretch Line 15 días, SC – Soldadoras de alambrón 5 días, FL – Rolling
Cassette 5 días) desde planificación hasta cierre y seguimiento de pendientes. Sin backend
obligatorio en v1. Uso principal en campo desde iPhone; gestión/planificación también desde
Windows.

## Arquitectura

- Vite + React + TypeScript, Tailwind CSS, `vite-plugin-pwa`, IndexedDB (`idb`).
- Ver detalle completo y decisiones de entorno en [CLAUDE.md](CLAUDE.md).

## Pulido visual + confiabilidad offline (2026-09-26, sesión 3)

- **Indicador de conexión + verificación de actualización** (`src/components/EstadoApp.tsx`,
  visible en el encabezado): punto verde/gris de "En línea" / "Sin conexión", botón 🔄 para
  forzar la verificación de una versión nueva, y confirma explícitamente "Ya tienes la última
  versión ✓" o "Hay una actualización disponible" (con botón para aplicarla). Usa el hook oficial
  `useRegisterSW` de `vite-plugin-pwa` (`virtual:pwa-register/react`); se desactivó el registro
  automático por script (`injectRegister: false`) para evitar un doble registro del service
  worker.
- **Nunca se pierde información**: se agregó manejo de errores explícito (con aviso claro al
  usuario) en los guardados más usados en campo — registro diario (estado/comentario de
  actividad), fotos, formulario de actividad y formulario de pendiente. Si el guardado en el
  dispositivo llegara a fallar (por ejemplo, almacenamiento lleno), la app avisa en vez de fallar
  en silencio; los datos que sí se alcanzaron a guardar no se tocan.
- **Diseño más "nativo"**: retroalimentación táctil tipo iOS en toda la app (un solo cambio
  global en `index.css`, sin tocar cada botón), tarjetas con sombra suave en vez de borde duro,
  encabezado y barra inferior con efecto de vidrio esmerilado (blur), pestaña activa resaltada.
  En pantallas anchas (PC), la app se muestra como una tarjeta centrada con sombra sobre un fondo
  degradado, en vez de estirarse de borde a borde — en el iPhone no cambia nada (sigue a pantalla
  completa). Se corrigió además un padding de área segura duplicado que existía desde el
  andamiaje inicial (podía dejar un espacio en blanco de más arriba del encabezado en iPhones
  con notch/Dynamic Island).
- Verificado con `npm run typecheck`, `npm run build` y `npm run preview` (petición HTTP real)
  sin errores.

## Publicada y en uso (2026-09-26)

- **App en vivo**: https://rquinchia.github.io/APP-visitas/ — confirmada instalada y funcionando
  en el iPhone del usuario (Agregar a inicio) y accesible desde la PC.
- **Repositorio**: https://github.com/rquinchia/APP-visitas (público) con publicación automática
  vía GitHub Actions en cada `push` a `master`. Detalle del flujo de publicación en CLAUDE.md.
- Cada dispositivo tiene su propia copia local de los datos (sin sincronización automática); el
  módulo Respaldo es el mecanismo para pasar información entre PC e iPhone.

## Estado del entorno (Fase 0 — completada)

- Node v24.17.0 / npm 11.13.0: OK.
- Git: no está en PATH del sistema; se usa el portátil de GitHub Desktop (ver CLAUDE.md). OK.
- `winget`/`scoop`: bloqueados por política corporativa — no se necesitan, no bloquean el proyecto.
- Python 3.13 + pymupdf/python-docx/pywin32 (`pip install --user`): usados solo para extraer
  texto de los 5 manuales técnicos a `reference/extracted/`. No forman parte de la app.
- 5 manuales técnicos recibidos, leídos y clasificados por visita (tabla en CLAUDE.md).

## Tareas (orden de implementación del MVP)

1. [x] Fase 0 — verificación de entorno, manuales y reglas del proyecto.
2. [x] Andamiaje técnico del proyecto (Vite/React/TS/Tailwind/PWA/IndexedDB) + modelo de datos base.
3. [x] Dashboard (resumen de pendientes críticos + tarjeta de avance por visita).
4. [x] Gestión de visitas: crear (PA/SC/FL con objetivo/duración precargados), listar, ver
   detalle, editar fecha de inicio y recorrer el ciclo de vida completo (borrador → cerrado)
   con confirmación y registro en historial en cada paso.
5. [x] Plan editable/reordenable: crear, editar, eliminar, duplicar, reordenar (▲▼ dentro del
   día), reprogramar (cambiar de día), marcar no aplicable, actividad emergente. Vista previa
   obligatoria (editar/confirmar/compartir) antes de "Enviar a revisión" o "Enviar para
   aprobación". Historial de versiones: tras la aprobación, cualquier cambio exige motivo y
   crea una nueva versión (nunca sobrescribe en silencio).
6. [x] Activación de visita ("Iniciar visita") + pantalla "Hoy" accesible desde el detalle en
   cuanto la visita está activa (o terminada, para consulta).
7. [x] Registro diario: checklist del día con botones grandes de estado (Completada/Parcial/
   Bloqueada/…), comentario corto, fotos por actividad, selector de día para adelantar o
   corregir, avance del día y total, accesos directos a actividad emergente y a pendiente.
   Los cambios aquí son directos (sin exigir motivo) porque es el uso normal en campo; el
   historial con motivo obligatorio sigue aplicando solo a ediciones estructurales del plan
   (ver módulo 5).
8. [x] Fotos: componente `FotosPicker` reutilizable (múltiples fotos por registro, cámara o
   galería en iPhone vía `capture="environment"`), integrado en Pendientes; falta conectarlo
   también a las actividades del registro diario (módulo 7).
9. [x] Hallazgos / pendientes: módulo independiente completo (crear/editar, categorías,
   prioridades P1–P4, estados, responsable/fecha con "POR ASIGNAR"/"POR DEFINIR" por defecto,
   fotos de evidencia y evidencia de cierre separadas, filtros por estado/prioridad, vista
   global y filtrada por visita).
10. [x] Reporte WhatsApp: plantilla ejecutiva exacta (📍/📊/✅/👥/🔎/📌/➡️), aviso automático de
    pendientes sin responsable/fecha, cierre con referencia al informe por correo. Editable antes
    de compartir (Web Share API) o copiar.
11. [x] Reporte Outlook: asunto con el formato pedido, cuerpo con las 8 secciones y tabla final
    ID/Prioridad/Pendiente/Responsable/Fecha/Estado. Copiar o abrir borrador de correo (`mailto:`).
12. [x] Cierre de visita: al pulsar "TERMINAR VISITA" se abre un checklist de cierre (actividades
    sin completar, formación realizada, evidencias, acciones cerradas/abiertas, historial de
    actividades y de cambios del plan) y los informes finales consolidados (WhatsApp y Outlook,
    con toda la visita, no solo el último día) antes de confirmar. Los pendientes abiertos no se
    cierran solos: pasan a seguimiento post-visita (siguiente estado del ciclo de vida).
13. [x] Backup/restore: exportar todo el proyecto (visitas, plan, pendientes, historial y fotos
    en base64) a un único archivo `.json` portable, descargable o compartible (Web Share API);
    importar con opción de "combinar" o "reemplazar todo" (con advertencia explícita antes de
    borrar datos). Acceso permanente desde un cuarto ítem en el menú inferior ("Respaldo").
14. [ ] Pulido visual y funciones secundarias.

**Con esto queda cerrado el MVP completo (los 11 puntos del orden de implementación original).**

## Completado

- Inspección del directorio y del entorno Windows corporativo (sin admin).
- Localización de un Git funcional sin instalar nada nuevo (portátil de GitHub Desktop).
- Confirmado que `npm install` funciona localmente sin privilegios elevados.
- Extracción y clasificación de los 5 manuales técnicos por visita, en
  `reference/extracted/*.txt` (fuente única autorizada de datos técnicos — no se inventan
  parámetros).
- `CLAUDE.md` con reglas permanentes del proyecto.
- Proyecto Vite/React/TS/Tailwind/PWA instalado, compila sin errores (`npm run typecheck` y
  `npm run build` verificados) y sirve correctamente (`npm run preview` probado con petición
  HTTP real, respuesta 200 OK).
- Repositorio Git local inicializado con el primer commit (histórico limpio, manuales originales
  excluidos vía `.gitignore`).
- Dashboard funcional: tarjetas por visita con estado, día X/X, barra de avance y conteos
  (completadas/parciales/pendientes/bloqueadas), más resumen global de pendientes
  (P1/P2/abiertos/sin responsable/sin fecha/vencidos).
- Gestión de visitas funcional: alta de visita (PA/SC/FL con objetivo y duración precargados
  desde la definición del proyecto, sin inventar datos), listado, detalle editable (fecha de
  inicio) y las 10 etapas del ciclo de vida con confirmación explícita y motivo registrado en
  el historial antes de cada cambio de estado.

## Completado — módulo de Plan (2026-09-26, sesión 2)

- `src/pages/Plan.tsx`: listado por día con todas las acciones (crear/editar/duplicar/eliminar/
  reordenar/cambiar estado/actividad emergente).
- `src/pages/ActividadForm.tsx`: alta y edición con los campos mínimos definidos (día, orden,
  actividad, objetivo, tipo, equipo/proceso, evidencia, criterio de cumplimiento, estado,
  observación) y recálculo automático de orden al reprogramar de día.
- `src/pages/PlanVistaPrevia.tsx`: vista previa de solo lectura con Editar/Confirmar/Compartir
  (Web Share API con copiar al portapapeles como respaldo), enlazada desde las transiciones
  "Enviar a revisión" y "Enviar para aprobación".
- `src/lib/historial.ts` y `src/lib/transiciones.ts`: lógica compartida de versionado e
  historial (`registrarCambioPlan`) y de cambios de estado (`aplicarTransicionEstado`),
  reutilizada entre `VisitaDetalle` y `PlanVistaPrevia`.
- Verificado con `npm run typecheck`, `npm run build` y arrancando el servidor de desarrollo
  (`npm run dev`) con una petición HTTP real — sin errores. **Nota:** no se hizo una prueba de
  clic a clic en navegador real (no hay herramienta de automatización de navegador en este
  entorno); la próxima vez que el usuario abra la app conviene revisar el flujo completo una
  vez en pantalla.

## Estado actual (2026-09-26, fin de sesión 2)

El MVP completo de los 11 puntos del orden de implementación está construido y compilando sin
errores (`npm run typecheck`, `npm run build`, y arranque real de `npm run dev` / `npm run
preview` verificados en cada módulo). Todavía **no se ha probado clic a clic en un navegador
real** (no hay herramienta de automatización de navegador en este entorno) — la próxima vez que
el usuario use la app conviene recorrer el flujo completo una vez en pantalla: crear visita →
plan → vista previa → enviar a revisión/aprobación → iniciar → Hoy (checklist + fotos) →
pendientes → reporte → cierre → respaldo.

## Pendiente

- Definir con datos reales de los manuales las plantillas de actividades sugeridas por visita
  (PA/SC/FL), marcando cada dato como `[FABRICANTE]`, `[BUENA PRÁCTICA]` o `[VALIDAR EN PLANTA]` —
  hoy el usuario crea las actividades manualmente en el Plan; sería valioso precargar sugerencias
  basadas en `reference/extracted/`.
- Generar íconos reales de la app (actualmente placeholders geométricos generados con Pillow)
  antes de publicar/instalar en iPhone.
- Probar la instalación real en iPhone (Add to Home Screen) una vez haya un despliegue accesible
  desde ese dispositivo — hoy la app solo corre en `localhost` de este PC.
- Pulido visual y funciones secundarias (módulo 14): revisar accesibilidad de contrastes, afinar
  espaciados en pantallas muy pequeñas, posibles atajos adicionales para uso a una mano.
- Capa de sincronización corporativa (OneDrive/SharePoint/Listas) sigue sin implementar, tal como
  se decidió — el respaldo/restauración JSON es el mecanismo de continuidad de datos en esta v1.

## Decisiones tomadas

- **Sin backend obligatorio en v1**: todo local (IndexedDB) con export/import JSON como respaldo
  portátil. Sincronización con OneDrive/SharePoint/Listas queda como capa desacoplada para el
  futuro, sin bloquear el uso actual.
- **Compartir por WhatsApp**: Web Share API + "copiar al portapapeles" como respaldo. No se
  implementa la API de WhatsApp (requeriría registro/autorización que no se puede gestionar sin
  TI/administración).
- **Outlook**: generación de texto para copiar/pegar y enlace `mailto:` cuando el navegador lo
  permita. No se usa Microsoft Graph (requeriría registro de app en Azure — fuera del alcance de
  permisos normales).
- **Los manuales originales (PDF/DOC, ~150 MB en total) no se versionan en git**: son archivos
  binarios grandes de referencia, no código. Se conserva únicamente su extracto de texto
  (`reference/extracted/`) para trazabilidad de las decisiones de contenido.
- **Git portátil**: se usa el que incluye GitHub Desktop porque `winget`/instaladores requieren
  admin o están bloqueados por política de grupo. No se modificó el PATH del sistema, solo el de
  la sesión de trabajo (ver CLAUDE.md para el comando).
- **Respaldo en un solo archivo JSON (fotos en base64), no ZIP**: más simple de generar/leer con
  APIs nativas del navegador (sin librerías adicionales), suficiente para los volúmenes de datos
  esperados de estas visitas, y fácil de inspeccionar si algo falla.
- **Historial con motivo obligatorio solo para cambios estructurales del plan** (crear/editar/
  eliminar/reordenar actividades una vez aprobado el plan), **no para el registro diario en
  campo**: marcar una actividad como completada o añadir una foto durante la visita activa es el
  uso normal esperado y debe ser instantáneo, no una excepción que requiera justificación.
- **Cuarto ítem de navegación "Respaldo"** en vez de esconderlo en un menú de ajustes: dado que
  todo vive en el navegador de un solo dispositivo, exportar respaldos con frecuencia es crítico
  y debe ser muy fácil de encontrar.
