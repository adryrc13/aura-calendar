# Aura Calendar

Aura Calendar es una PWA mobile-first para calendario personal y tareas. Funciona localmente con IndexedDB/Dexie y, desde Fase 4A, puede conectarse de forma opcional a Supabase Auth para preparar usuarios y sincronización futura.

## Quick path

```bash
npm install
npm run dev
npm run build
npm run preview
```

La app sigue funcionando sin Supabase configurado.

## Estado actual

| Área | Estado |
|---|---|
| Tareas locales | Crear, editar, eliminar, completar y persistir en IndexedDB |
| Repeticiones | Avanzadas: diaria, semanal, mensual, anual, días alternos, cada X días/semanas |
| Adjuntos | Locales en IndexedDB: archivos, links y notas |
| Asistente | Voz/texto con parser local en español |
| Tema | Modo claro/oscuro |
| Supabase | Auth opcional y schema SQL preparado |
| Sincronización remota | Pendiente para la siguiente fase |

## Configurar Supabase

### 1. Crear proyecto

1. Entrá a Supabase y creá un proyecto.
2. En **Project Settings → API**, copiá:
   - **Project URL**
   - **anon public key**

No uses ni subas claves privadas como `service_role`.

### 2. Crear `.env.local`

Copiá el ejemplo:

```bash
cp .env.local.example .env.local
```

Completá:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

`.env.local` está ignorado por Git. No lo subas al repositorio.

### 3. Ejecutar schema SQL

1. Abrí **SQL Editor** en Supabase.
2. Pegá y ejecutá `supabase/schema.sql`.
3. Verificá que existan:
   - `profiles`
   - `calendars`
   - `tasks`
   - `task_attachments`

El SQL activa RLS y crea políticas básicas para que cada usuario vea y modifique solo sus propios datos.

## Cuenta y sincronización

En **Ajustes → Cuenta y sincronización** la app muestra:

- Modo local activo.
- Supabase configurado / no configurado.
- Usuario conectado / no conectado.
- Acciones de registro, login y logout.

La sincronización remota de tareas todavía no está activa: Dexie sigue siendo la fuente de datos en Fase 4A.

## PWA Android

Para probar como PWA en Android:

1. Abrí la URL local o publicada en Chrome Android.
2. Tocá el menú del navegador.
3. Elegí **Agregar a pantalla principal** o **Instalar app**.

## Stack

| Área | Decisión |
|---|---|
| UI | React + TypeScript + Vite |
| Estilos | Tailwind CSS, diseño mobile-first |
| Persistencia local | IndexedDB con Dexie |
| Auth remoto | Supabase Auth opcional |
| DB remota | Schema preparado en Supabase Postgres |
| Storage remoto | Preparado con `storage_path`, pendiente de implementación |
| PWA | `manifest.webmanifest` + service worker manual |
| Voz | Web Speech API cuando el navegador la soporte |

## Seguridad

- Usar solo `VITE_SUPABASE_ANON_KEY` en frontend.
- Nunca subir `.env.local`.
- No usar `service_role` en Vite/React.
- RLS está activado en `profiles`, `calendars`, `tasks` y `task_attachments`.

## Próximas fases

| Fase | Pendiente |
|---|---|
| Fase 4B | Sincronización remota de tareas con Supabase Database |
| Fase 4C | Migración de adjuntos locales a Supabase Storage |
| Fase 5 | Calendario compartido y roles owner/editor/solo lectura |
| Fase 6 | Capacitor, APK/AAB y notificaciones nativas Android |
