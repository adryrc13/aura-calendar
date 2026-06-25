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

Aura Calendar usa Capacitor para generar APK Android. La publicación en Play Store y la firma final quedan fuera de esta fase.

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
npm run android:assemble:debug
npm run android:assemble:release
npm run android:bundle:release
```

### Generar APK de prueba

1. Ejecutá `npm run android:sync`.
2. Abrí Android Studio con `npm run cap:open:android` o `npx cap open android`.
3. Esperá a que Gradle sincronice el proyecto.
4. Desde Android Studio, usá **Build > Build Bundle(s) / APK(s) > Build APK(s)** para una APK de prueba.

### Build Android release

Debug APK y release APK/AAB no son lo mismo:

- **Debug APK**: build de desarrollo, firmada con la clave debug local de Android. Sirve para probar en tu dispositivo.
- **Release APK**: build de release para distribución manual o pruebas cerradas. Debe firmarse con tu keystore de release.
- **Release AAB**: Android App Bundle para Play Store. Play Store queda para una fase posterior.

Comandos desde la raíz:

```bash
npm run android:sync
npm run android:assemble:debug
npm run android:assemble:release
npm run android:bundle:release
```

Abrir Android Studio:

```bash
npm run cap:open:android
```

Firma de release:

1. Creá una keystore desde Android Studio (**Build > Generate Signed Bundle / APK**) o con `keytool`.
2. Guardá la keystore fuera de Git.
3. Copiá `android/keystore.properties.example` como `android/keystore.properties`.
4. Completá localmente `storeFile`, `storePassword`, `keyAlias` y `keyPassword`.
5. No subas `android/keystore.properties`, `.jks` ni `.keystore`.

Si perdés la keystore de release, no vas a poder actualizar versiones firmadas con esa misma clave. Esto NO es un detalle menor: la firma es la identidad de la app.

Notas de seguridad:

- `.env.local` está ignorado por Git y no debe subirse.
- `VITE_SUPABASE_ANON_KEY` es una clave pública de frontend; no es `service_role`, pero tampoco conviene confundirla con una clave privada.
- Nunca uses ni subas `service_role` en frontend/Android.
- No se generan ni se suben APK/AAB, keystores ni contraseñas.
- Play Store queda para una fase posterior.

### Notas Android

- `capacitor.config.ts` usa `appId: com.adryrc13.auracalendar`, `appName: Aura Calendar` y `webDir: dist`.
- La carpeta `android/` es el proyecto nativo generado por Capacitor.
- El manifest Android queda en orientación portrait y declara `INTERNET`, `RECORD_AUDIO`, `POST_NOTIFICATIONS` y `SCHEDULE_EXACT_ALARM`.
- En navegador/PWA, el asistente por voz usa Web Speech API cuando está disponible.
- En Android Capacitor, el asistente por voz usa reconocimiento nativo mediante `@capgo/capacitor-speech-recognition`; requiere el permiso Android `RECORD_AUDIO`.
- En Android Capacitor, los recordatorios usan notificaciones locales nativas mediante `@capacitor/local-notifications`.
- Supabase sigue usando `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. No uses `service_role` en Android ni en frontend.
- Si en el futuro se agregan flujos OAuth/deep links, habrá que revisar redirect URLs en Supabase. El flujo actual email/password no requiere valores secretos nuevos.

### Notificaciones nativas Android

- Plugin usado: `@capacitor/local-notifications`.
- Permisos añadidos: `POST_NOTIFICATIONS` para Android 13+ y `SCHEDULE_EXACT_ALARM` para recordatorios exactos en Android 12+. Se mantienen `INTERNET` y `RECORD_AUDIO`.
- Desde **Ajustes > Notificaciones** podés pedir permiso de notificaciones, abrir el ajuste de alarma exacta y programar una notificación de prueba a 10 segundos.
- Cada tarea con recordatorio usa un ID numérico estable derivado de `task.id`; al editar se cancela y reprograma el mismo ID, y al eliminar/completar se cancela.
- Las tareas recurrentes programan solo la próxima ocurrencia futura; al abrir o sincronizar la app se reconcilia de forma idempotente.
- Limitaciones Android: Android 13 requiere permiso de notificaciones; Android 12+ puede requerir habilitar alarma exacta; Doze/ahorro de batería o fabricantes agresivos pueden retrasar notificaciones.
- No hay push notifications remotas, Firebase/FCM, Play Store ni APK firmada en esta fase.

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
| Asistente | Parser local ES/EN por texto, Web Speech API en navegador/PWA y voz nativa en Android Capacitor |
| Notificaciones Android | Recordatorios nativos locales con Capacitor Local Notifications |
| PWA | `manifest.webmanifest`, `offline.html` y service worker de producción |
| Android | Capacitor + versionado `0.9.0-beta` / `versionCode 9` preparado para APK/AAB release |
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

- Publicación en Play Store si aplica.
