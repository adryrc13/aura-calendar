# Aura Calendar

Aura Calendar es una PWA mobile-first para calendario personal y tareas. Funciona en modo local con IndexedDB/Dexie y, si configurás Supabase, también permite autenticación, sincronización remota, adjuntos remotos y calendarios compartidos con roles.

## Instalación y ejecución

```bash
npm install
npm run dev
npm run test:internal
npm run build
npm run preview
```

La app sigue funcionando sin Supabase configurado: el modo local con Dexie es el respaldo seguro y no borra datos locales al activar Supabase.

## Configuración de Supabase

### 1. Crear `.env.local`

Copiá el ejemplo:

```bash
cp .env.local.example .env.local
```

Completá solo claves públicas del frontend:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

`.env.local` está ignorado por Git. No subas claves reales, tokens privados ni `service_role`.

### 2. Ejecutar SQL en Supabase

En **Supabase SQL Editor**, ejecutar en este orden:

1. `supabase/schema.sql`
2. `supabase/storage.sql`
3. `supabase/sharing.sql`

El orden importa: `sharing.sql` extiende las policies base para calendarios compartidos y asume que schema/storage ya existen.

## Estado implementado

| Área | Estado |
|---|---|
| Tareas | Crear, editar, completar, eliminar y persistir |
| Vistas | Hoy, Calendario y Agenda |
| Tema | Modo claro/oscuro |
| Recurrencias | Diaria, semanal, mensual, anual, alternos, cada X días/semanas y excepciones |
| Adjuntos locales | Archivos, links y notas en IndexedDB |
| Supabase Auth | Login/registro opcional |
| Supabase Database | Sincronización remota opt-in de tareas |
| Supabase Storage | Bucket privado para adjuntos remotos |
| Calendarios compartidos | Roles owner/editor/viewer e invitaciones |
| i18n | Español/Inglés con persistencia de idioma |
| Asistente | Parser local ES/EN por texto y Web Speech API si el navegador lo soporta |
| PWA | `manifest.webmanifest`, `offline.html` y service worker de producción |
| Tests internos | `npm run test:internal` |

## Seguridad y permisos

- Usar solo `VITE_SUPABASE_ANON_KEY` en frontend.
- Nunca usar ni subir `service_role`.
- No commitear `.env.local`.
- RLS permanece activo en tablas públicas y Storage.
- El bucket `task-attachments` es privado.
- Los adjuntos remotos se descargan mediante Supabase Storage, no con URLs públicas permanentes.
- `viewer`: solo lectura.
- `editor`: puede crear/editar/completar/eliminar tareas y adjuntos en calendarios compartidos.
- `owner`: gestiona calendario, miembros e invitaciones.

## Modo local/remoto

- Modo local: Dexie/IndexedDB, sin requerir Supabase.
- Modo remoto: Supabase Auth + Database + Storage.
- La migración local → Supabase evita duplicados y conserva datos locales.
- Si Supabase falla al cargar tareas remotas, la UI informa el error y vuelve a modo local.

## PWA y preparación Android

La app está preparada como PWA básica. La integración nativa Android todavía no está implementada.

Pendiente para próximas fases:

- Capacitor.
- Android Studio.
- Notificaciones nativas Android.
- Build APK/AAB.
- Publicación en Play Store si aplica.

No instalar Capacitor hasta iniciar explícitamente esa fase.

## Stack

| Área | Decisión |
|---|---|
| UI | React + TypeScript + Vite |
| Estilos | Tailwind CSS, diseño mobile-first |
| Persistencia local | IndexedDB con Dexie |
| Backend opcional | Supabase Auth, Postgres y Storage |
| PWA | Manifest + service worker manual |
| Voz | Web Speech API cuando está disponible |
| IA externa | No se usa; el asistente es local |
