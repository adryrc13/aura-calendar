# Aura Calendar

Aura Calendar es una PWA mobile-first para Android: calendario personal, tareas locales, modo claro/oscuro, asistente por voz sin IA externa y recordatorios básicos mientras la app está abierta.

## Quick path

```bash
npm install
npm run dev
npm run build
npm run preview
```

Para probar como PWA en Android:

1. Abrí la URL local o publicada en Chrome Android.
2. Tocá el menú del navegador.
3. Elegí **Agregar a pantalla principal** o **Instalar app**.

## Stack

| Área | Decisión |
|---|---|
| UI | React + TypeScript + Vite |
| Estilos | Tailwind CSS, diseño mobile-first |
| Persistencia | IndexedDB con Dexie |
| PWA | `manifest.webmanifest` + service worker manual |
| Voz | Web Speech API cuando el navegador la soporte |
| Notificaciones | Web Notifications API para permisos y prueba básica |

## Funciones de Fase 1

- Vista mensual, diaria y agenda.
- Crear, editar, eliminar y completar tareas.
- Persistencia local en IndexedDB.
- Modo claro/oscuro persistente.
- Asistente por voz y texto con parser local en español.
- Permisos y prueba básica de notificaciones.
- Recordatorios en memoria mientras la PWA está abierta.
- PWA básica con manifest, iconos, service worker y pantalla offline.

## Modelo mínimo de tarea

Cada tarea incluye: `id`, `title`, `description`, `date`, `time`, `endTime`, `completed`, `color`, `textColor`, `reminderEnabled`, `reminderMinutesBefore`, `reminderSilent`, `createdAt` y `updatedAt`.

## Notas técnicas importantes

- El asistente actual **no usa OpenAI, Gemini, Claude ni IA externa**: usa reconocimiento de voz del navegador + parser local en español.
- La activación por palabra clave fuera de la app no se implementa en esta fase.
- Las notificaciones fiables en Android con la app cerrada se implementarán más adelante con Capacitor Local Notifications.
- No hay Supabase, Firebase, login, calendario compartido, adjuntos, APK/AAB ni calendarios externos en Fase 1.

## Roadmap

| Fase | Pendiente |
|---|---|
| Fase 2 | Repeticiones avanzadas: diaria, semanal, mensual, días alternos, martes y jueves, cada X días. |
| Fase 3 | Adjuntos: foto, audio, vídeo, PDF y links. |
| Fase 4 | Supabase Auth, Database, Storage y calendario compartido. |
| Fase 5 | Capacitor, APK/AAB Android y notificaciones nativas fiables. |
