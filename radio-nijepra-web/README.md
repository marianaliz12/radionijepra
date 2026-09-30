# Radio NIJEPRA · Plataforma de la hoja de ruta

Aplicación web del Colegio Niño Jesús de Praga (NIJEPRA) para seguir la hoja de ruta de la emisora, con el acompañamiento de la Universidad Santo Tomás, seccional Bucaramanga.

## Qué hace

- **Inicio de sesión institucional** con tres roles:

  | Rol | Qué puede hacer |
  |---|---|
  | Administrador | Crea usuarios y hace todo lo que hacen los demás roles. |
  | Coordinador | Verifica entregables. |
  | Estudiante | Marca pasos, escribe notas y sube enlaces de evidencia. |

- **Hoja de ruta por fases** con los pasos de cada fase:
  - Fase 1 · Emisora digital: 14 pasos.
  - Fase 2 · Alianza FM: 4 pasos.
  - Fase 3 · Independencia: 8 pasos.

  Cada paso tiene su entregable, una guía de cómo hacerlo, notas y enlace a la evidencia.
- **Chuleo y verificación en dos momentos:** quien termina un paso lo marca, y la coordinación revisa el entregable y lo verifica. Al verificar todos los pasos de una fase, la plataforma lo celebra.
- **Tablero de inicio** con el porcentaje verificado, el avance de cada fase, lo que sigue, lo que espera verificación y la actividad reciente.
- **Registro de actividad:** quién marcó, verificó o actualizó cada paso, y cuándo.
- **Informe imprimible** de todas las fases desde "Hoja de ruta", con el botón "Imprimir informe". Sirve también para guardarlo en PDF.
- **Asistente de dudas:**
  - Con una clave de API de Anthropic responde con Claude y conoce el estado real del avance.
  - Sin clave, responde con las preguntas frecuentes del proyecto: fases, cabina, fibra, radioenlace, UPS, música y licencia FM.
- Diseño adaptable a celular, tableta y computador.

## Cómo está hecha

| Parte | Tecnología |
|---|---|
| Backend | Node.js 22 y Express 5 |
| Base de datos | SQLite integrada en Node (`node:sqlite`); no requiere instalar un motor aparte |
| Seguridad | Contraseñas cifradas con scrypt, sesiones con cookie httpOnly, límite de intentos de inicio de sesión y cabeceras de seguridad |
| Frontend | HTML, CSS y JavaScript sin frameworks, en la carpeta `public/` |

```
radio-nijepra-web/
├── server/
│   ├── index.js       API y servidor web
│   ├── db.js          base de datos y carga inicial
│   ├── roadmap.js     fases, pasos y entregables (editable)
│   ├── auth.js        inicio de sesión y permisos
│   ├── auth-utils.js  cifrado de contraseñas
│   ├── chat.js        asistente (Claude o preguntas frecuentes)
│   └── reset.js       borra la base de datos
├── public/            página web (index.html, styles.css, app.js, logo.svg)
├── .env.example       configuración de ejemplo
└── Dockerfile         para publicar con Docker
```

## Instalación en un computador

**Requisito:** Node.js 22.5 o superior (<https://nodejs.org>).

1. Abre una terminal en la carpeta del proyecto y ejecuta:

   ```bash
   npm install
   cp .env.example .env      # en Windows: copy .env.example .env
   npm start
   ```

2. Abre <http://localhost:3000> en el navegador.
3. Entra con el correo y la contraseña de `ADMIN_EMAIL` y `ADMIN_PASSWORD` del archivo `.env`.
   - Si no creaste el `.env`, el administrador por defecto es `admin@nijepra.edu.co` con la contraseña `Nijepra2026!`.
   - La plataforma pide cambiar la contraseña en el primer ingreso.
4. En **Usuarios**, crea las cuentas de docentes y estudiantes, cada una con una contraseña temporal.

## Activar el asistente con inteligencia artificial

1. Crea una clave en <https://console.anthropic.com>.
2. Pégala en `ANTHROPIC_API_KEY` dentro del archivo `.env`.
3. Reinicia la aplicación con `npm start`.

Tienes que saber tres cosas sobre la clave:

- **Dónde vive:** queda solo en el servidor; el navegador nunca la ve.
- **Costo:** el uso de la API se cobra por consumo. El modelo por defecto, Claude Haiku 4.5, es el más económico; puedes cambiarlo en `ANTHROPIC_MODEL`.
- **Si falla:** si la clave no funciona, el asistente vuelve solo a las preguntas frecuentes.

## Publicarla en internet

**Opción 1: el mismo VPS de AzuraCast (recomendada).**

1. Instala Node.js 22.
2. Copia la carpeta y ejecuta `npm install --omit=dev`.
3. Déjala corriendo como servicio con `pm2` o `systemd`.
4. Publícala con Nginx como proxy inverso y un certificado HTTPS de Let's Encrypt, por ejemplo en `ruta.radio.colnijepra.edu.co`.
5. Con HTTPS activo, pon `COOKIE_SECURE=true` en el `.env`.

**Opción 2: Docker.**

```bash
docker build -t radio-nijepra .
docker run -d -p 3000:3000 --env-file .env -v radio-nijepra-data:/app/data radio-nijepra
```

**Opción 3: un servicio de aplicaciones** como Render o Railway.

- Configura un disco persistente para la carpeta `data/`.
- Carga las variables del `.env` en el panel del servicio.

## Copias de seguridad

Todo el avance vive en `data/radio-nijepra.db`. Basta con copiar ese archivo periódicamente, por ejemplo una vez por semana a Google Drive.

## Cambiar la hoja de ruta

1. Edita `server/roadmap.js` y reinicia la aplicación.
2. Los pasos se identifican por su `key`, así que el avance ya registrado se conserva.
3. Para empezar de cero, ejecuta `npm run reset-db`. Esto borra usuarios y avance.

## API (referencia)

| Método | Ruta | Quién |
|---|---|---|
| POST | `/api/login`, `/api/logout` | Todos |
| GET | `/api/me` · POST `/api/me/password` | Usuario con sesión |
| GET | `/api/roadmap` | Usuario con sesión |
| POST | `/api/steps/:id/done` | Usuario con sesión |
| POST | `/api/steps/:id/verify` | Coordinador o administrador |
| PUT | `/api/steps/:id/notes` | Usuario con sesión |
| GET | `/api/activity` | Usuario con sesión |
| GET · POST · DELETE | `/api/users`, `/api/users/:id`, `/api/users/:id/reset` | Administrador |
| GET · POST · DELETE | `/api/chat` | Usuario con sesión |
