# Aura Calendar

Aura Calendar es una PWA mobile-first para calendario personal y tareas. Funciona en modo local con IndexedDB/Dexie y, si configurás Supabase, también permite autenticación, sincronización remota, adjuntos remotos y calendarios compartidos con roles. Desde Fase 7 también queda preparada como proyecto Android con Capacitor.

## Instalación y ejecución web

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

## Android / Capacitor

Fase 7 integra Capacitor y crea la plataforma Android, pero todavía no implementa notificaciones nativas, alarmas nativas, APK/AAB final ni publicación en Play Store.

### Requisitos

- Node.js y npm.
- Android Studio.
- JDK compatible con la versión de Android Gradle Plugin incluida por Capacitor.
- Android SDK instalado desde Android Studio.

### Comandos útiles

```bash
npm install
npm run build
npx cap sync android
npx cap open android
```

Scripts npm equivalentes:

```bash
npm run android:build:web
npm run android:sync
npm run cap:sync
npm run cap:open:android
```

### Generar APK de prueba

1. Ejecutá `npm run android:sync`.
2. Abrí Android Studio con `npm run cap:open:android` o `npx cap open android`.
3. Esperá a que Gradle sincronice el proyecto.
4. Desde Android Studio, usá **Build > Build Bundle(s) / APK(s) > Build APK(s)** para una APK de prueba.

### Notas Android

- `capacitor.config.ts` usa `appId: com.adryrc13.auracalendar`, `appName: Aura Calendar` y `webDir: dist`.
- La carpeta `android/` es el proyecto nativo generado por Capacitor.
- El manifest Android queda en orientación portrait y solo declara el permiso `INTERNET`.
- El micrófono actual usa Web Speech API. En Android WebView puede no comportarse igual que en Chrome; una integración nativa de voz queda fuera de esta fase.
- Supabase sigue usando `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. No uses `service_role` en Android ni en frontend.
- Si en el futuro se agregan flujos OAuth/deep links, habrá que revisar redirect URLs en Supabase. El flujo actual email/password no requiere valores secretos nuevos.

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
| Android | Capacitor + plataforma `android/` preparada para Android Studio |
| Tests internos | `npm run test:internal` |

## Seguridad y permisos

- Usar solo `VITE_SUPABASE_ANON_KEY` en frontend/Android WebView.
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

## PWA

La app sigue funcionando como web/PWA. Capacitor no reemplaza la versión web: consume el build de Vite desde `dist` y lo sincroniza dentro de `android/`.

## Stack

| Área | Decisión |
|---|---|
| UI | React + TypeScript + Vite |
| Estilos | Tailwind CSS, diseño mobile-first |
| Persistencia local | IndexedDB con Dexie |
| Backend opcional | Supabase Auth, Postgres y Storage |
| Android | Capacitor |
| PWA | Manifest + service worker manual |
| Voz | Web Speech API cuando está disponible |
| IA externa | No se usa; el asistente es local |

## Pendiente

- Fase 8: notificaciones/alarmas nativas Android.
- Build APK/AAB final y firma de release.
- Publicación en Play Store si aplica.
