# CLAUDE.md — Reglas permanentes del proyecto "APP Visitas"

## Qué es este proyecto

Aplicación web progresiva (PWA) para administrar visitas técnicas industriales
(planificación → ejecución en planta → cierre → seguimiento de pendientes).
El usuario final **no programa**. Claude Code es quien crea, modifica, prueba
y corrige todo el código. El usuario solo usa la aplicación y, cuando es
imprescindible, realiza acciones manuales muy simples y guiadas.

Visitas iniciales que administra el sistema:

| Código | Duración | Objetivo |
|---|---|---|
| PA | 15 días | Formación y repaso Stretch Line |
| SC | 5 días | Evaluación de soldadoras de alambrón, pruebas de soldadura/tensión, capacitación |
| FL | 5 días | Capacitación y práctica de ajuste de Rolling Cassette / cassetera |

## Entorno de desarrollo verificado (Fase 0 — 2026-09-26)

- SO: Windows 11 Enterprise, PowerShell 5.1. Sin privilegios de administrador.
- Node.js v24.17.0 / npm 11.13.0 — disponibles y funcionales (`npm install` local sin admin confirmado).
- **Git no está en el PATH del sistema** y `winget`/`scoop` están bloqueados por política de grupo.
  Se encontró un Git portátil funcional incluido con GitHub Desktop:
  `C:\Users\rquinchia\AppData\Local\GitHubDesktop\app-3.6.4\resources\app\git\cmd\git.exe`.
  Añadir esa carpeta al `PATH` de la sesión de PowerShell antes de usar `git`:
  ```powershell
  $env:Path = "C:\Users\rquinchia\AppData\Local\GitHubDesktop\app-3.6.4\resources\app\git\cmd;" + $env:Path
  ```
  Git global ya tenía configurado `user.name`/`user.email` (Ruben Quinchia) — no se sobrescribió.
- Python 3.13.14 disponible con `pymupdf` (fitz) preinstalado; se instalaron `python-docx` y
  `pywin32` con `pip install --user` (sin admin) para extraer texto de manuales .pdf/.docx/.doc.
  Word de Microsoft 365 está instalado y se usó vía COM (`win32com.client`) solo para leer los
  manuales .doc antiguos — de forma local, sin subir nada a ningún servicio.
- `pdftoppm`/poppler no está disponible (no se puede renderizar PDF a imagen), pero no hace falta:
  la extracción de texto con `pymupdf` es suficiente para esta aplicación.

**Regla:** antes de asumir que falta una herramienta, probar alternativas sin admin (paquetes
`--user` de pip, binarios portátiles ya presentes en el equipo, paquetes npm locales). Solo pedir
intervención de TI si de verdad no hay alternativa con privilegios de usuario normal.

## Manuales técnicos disponibles y su clasificación por visita

El texto completo de cada manual fue extraído a `reference/extracted/*.txt` (no se suben a
ningún servicio externo; permanecen locales). Son la única fuente autorizada de datos técnicos
(parámetros, tolerancias, procedimientos, criterios de aceptación). **No inventar** estos datos;
si algo no está en el manual, marcarlo `[VALIDAR EN PLANTA]`.

| Archivo original | Visita | Contenido |
|---|---|---|
| `01_80CS1UEN001_User_Manual.pdf` | **PA** | Schnell "Stretch Drive 6-16/COLD2 Mirror" — manual de usuario de la línea de trefilado/estirado en frío (Cold Rolling and Stretching Line). Incluye también la Rolling Cassette como accesorio (secciones 2.6.1, 8.15), relevante para **FL**. |
| `04_80CS1RY1011_Spare_Parts.pdf` | **PA** | Mismo equipo Schnell — catálogo/despiece de repuestos (Spare Parts Booklet). |
| `Manual CL26CB33.docx` | **FL** | Eurolls — "Rolling Cassette type CB (C-010 & C-086, BK version)" — manual de operación y mantenimiento de la cassetera. |
| `Manual soldador micro weld J5-S_11.doc` | **SC** | Soldador Micro Weld modelo J5-S — especificaciones, operación, mantenimiento, ajustes, diagnóstico de fallas (en español). |
| `Manual soldador Micro Weld THD.doc` | **SC** | Soldador Micro Weld modelo THD (línea Schumag) — mismo tipo de contenido que el anterior. |

Al usar información de estos manuales en la app (checklists, criterios de cumplimiento,
actividades), etiquetarla siempre como:
- `[FABRICANTE]` — dato textual o derivado directo del manual.
- `[BUENA PRÁCTICA]` — recomendación razonable no explícita en el manual.
- `[VALIDAR EN PLANTA]` — dato que debe confirmarse con el usuario/operador antes de usarse como criterio oficial.

## Arquitectura elegida

- **PWA mobile-first, offline-first, local-first**, instalable en iPhone (Add to Home Screen) y
  utilizable en Windows/escritorio. Sin backend obligatorio en la v1.
- Stack: **Vite + React + TypeScript**, `vite-plugin-pwa` (service worker + manifest),
  **Tailwind CSS** (diseño sobrio/industrial), **IndexedDB** vía `idb` para persistencia local
  robusta (visitas, actividades, hallazgos, pendientes, fotos como Blob).
- Sin dependencias de Azure/Supabase/Firebase/Telegram/WhatsApp API/Microsoft Graph. Compartir por
  WhatsApp usa **Web Share API** con "copiar al portapapeles" como respaldo. Outlook usa
  texto para copiar/pegar y `mailto:` cuando sea posible — sin integraciones especiales.
- Capa de sincronización pensada para agregarse después (OneDrive/SharePoint/Listas) **desacoplada**
  del resto: la UI y la lógica de negocio nunca deben depender directamente de un backend concreto.
- Backups: exportar/importar todo el proyecto como archivo JSON (con fotos incluidas) portátil.

## Reglas de trabajo con el usuario

- El usuario **no sabe programar**: Claude crea y modifica todos los archivos, ejecuta pruebas,
  corrige errores. Nunca pedirle copiar/pegar código.
- Ningún cambio crítico (enviar a aprobación, iniciar visita, terminar visita, sobrescribir un
  plan aprobado) ocurre automáticamente: siempre requiere una confirmación explícita en la UI.
- Cuando se necesite una acción manual real (p. ej. autorizar algo fuera del alcance de las
  herramientas), usar este formato:
  ```
  ACCIÓN DEL USUARIO
  Qué hacer:
  Dónde:
  Qué debería aparecer:
  Qué responderme después:
  ```
- Comunicación de progreso: breve. Qué se construyó, qué se probó, qué falta, si se necesita algo
  del usuario. Sin razonamiento interno extenso.
- Trabajar incrementalmente: no añadir complejidad/módulos hasta que el flujo principal (MVP)
  funcione. Después de cada módulo: ejecutar pruebas disponibles, corregir errores, actualizar
  `PROJECT_STATUS.md`.
- No subir manuales, fotos ni datos de planta a servicios externos sin autorización explícita.
  No incluir credenciales en el repositorio. Sin telemetría propia.
- Ante dos alternativas razonables, elegir la más simple, seria y mantenible sin preguntar.
  Preguntar solo si la decisión afecta costos, seguridad, datos corporativos o una función esencial.

## Comandos útiles

```powershell
# Añadir Git portátil al PATH de la sesión (necesario en cada sesión nueva de PowerShell)
$env:Path = "C:\Users\rquinchia\AppData\Local\GitHubDesktop\app-3.6.4\resources\app\git\cmd;" + $env:Path

# Instalar dependencias / levantar entorno de desarrollo
npm install
npm run dev

# Compilar para producción
npm run build
```
