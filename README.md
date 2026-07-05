# Vela — App móvil de alerta de heladas (PWA)

Versión móvil del sistema experto, como **PWA** (Progressive Web App):
un solo `index.html` autocontenido con toda la lógica de factores de
certeza en JavaScript. No usa librerías, ni CDN, ni servidor: funciona
sin conexión.

## Qué incluye

- **index.html** — la app completa (lógica + interfaz)
- **manifest.webmanifest** — para instalarla en la pantalla de inicio
- **sw.js** — service worker (cacheo offline cuando está alojada)
- **icon-192.png / icon-512.png** — íconos de la app
- **icono.svg** — fuente vectorial del ícono

## Dos formas de usarla

### 1. Rápida (para probar y para la demo)

Abre `index.html` con doble clic o arrástralo a una pestaña del navegador.
Funciona igual en la computadora y en el celular. Toda la lógica corre en
el dispositivo, así que **no necesita internet**.

Tiene dos pestañas:

- **Ahora** — mueve los deslizadores (temperatura, humedad, viento,
  nubosidad, hora) y el orbe de riesgo se actualiza en vivo, con el punto
  de rocío derivado y las reglas que se dispararon.
- **La noche** — carga la noche de ejemplo o pega un JSON horario del SMN
  para ver la evolución del riesgo hora por hora y el dictamen del pico.

### 2. Como app instalable en el celular (PWA real)

Para que se instale en la pantalla de inicio y quede 100 % offline con
service worker, hay que servirla por HTTPS. La vía gratis más simple es
**GitHub Pages** (ya tienes cuenta de GitHub):

1. Sube esta carpeta `app_movil` a un repositorio.
2. En *Settings → Pages*, publica la rama `main`, carpeta raíz.
3. Abre la URL `https://<usuario>.github.io/<repo>/` en el celular.
4. En el menú del navegador: **"Agregar a pantalla de inicio"**.

Queda como una app con su ícono; al abrirla sin señal, sigue funcionando.

## Nota honesta sobre jalar datos del SMN en vivo

La app deja **pegar** el JSON del SMN, que es la vía robusta. Una descarga
automática en vivo desde el navegador suele chocar con **CORS**: el
servidor del SMN no autoriza peticiones desde otro origen, y el navegador
las bloquea por seguridad. Por eso la app se centra en:

- **entrada manual** (pestaña *Ahora*), y
- **pegar el JSON** que copiaste del SMN (pestaña *La noche*).

Si más adelante quieres descarga automática, se resuelve con un pequeño
backend propio que consulte al SMN y reenvíe el dato a la app — eso ya
sale del alcance de una PoC de materia.

## Relación con la versión de escritorio

Es exactamente el mismo sistema experto: las 13 reglas, los factores de
certeza y la fórmula de Magnus son idénticos a los de la versión Python de
la carpeta superior. Se verificó que ambas producen el mismo dictamen para
la noche de ejemplo (CRÍTICA, pico a las 03:00, CF +0.99).
