# CyberFlex AR 🦾

Juego **AR (realidad aumentada) para el navegador del celular** que convierte en tiempo real tu cuerpo y tus
manos en un **exoesqueleto robótico**, usando únicamente la cámara (frontal o trasera) y **100 % en el
dispositivo** — sin servidores, sin subir imágenes.

Construido con **React + Vite + Tailwind CSS + MediaPipe Tasks Vision** (Pose Landmarker de 33 puntos y
Hand Landmarker de 21 puntos por mano).

## Qué hace

- **Skin robótico sobre el cuerpo real**: placas cromadas, servos, articulaciones esféricas, columna y
  reactor de pecho con núcleo de energía, casco con visor y antenas, dedos segmentados con puntas energizadas.
- **Solo se robotiza lo captado por la cámara**: cada hueso/articación se dibuja únicamente si ambos puntos
  tienen suficiente `visibility` (si solo asomas la mano, solo la mano se vuelve robótica). Las etiquetas AR y
  los corchetes de detección muestran qué partes fueron "capturadas".
- **Cámara frontal y trasera**: botón 🤳/📷 para alternar. La frontal se muestra en espejo; la trasera se usa
  para escanear a otra persona.
- **Modos de escaneo**: `Cuerpo + manos`, `Solo manos` (máxima fluidez) y `Solo cuerpo`.
- **Minijuego con puntaje**: aparecen elementos aleatorios en pantalla:
  - 🔵 **Núcleo** (+10 × combo) — mantenlo dentro de tu pinza hasta cargarlo.
  - ⭐ **Estrella** (+30 × combo) — dura muy poco.
  - ☠️ **Virus** (−25, rompe el combo) — no lo toques.
  - El "captor" es tu **pinza** (pulgar + índice); también funciona con puntero/touch como respaldo.
- Combo multiplicador, niveles de dificultad progresivos, cronómetro de 60 s, récord guardado en
  `localStorage`, `modo práctica` sin cronómetro, FX de partículas, vibración háptica y sonidos sintetizados
  con WebAudio (sin archivos de audio).

## Correrlo en GitHub Pages

1. Sube este repositorio a GitHub.
2. En **Settings → Pages → Build and deployment → Source** elige **GitHub Actions**.
3. El workflow `.github/workflows/deploy.yml` compila y publica automáticamente en cada push a `main`.
4. Abre `https://<usuario>.github.io/<repo>/`.

La cámara solo funciona en contexto seguro: `github.io` ya sirve por **HTTPS**, así que `getUserMedia`
funciona sin configuración extra. Gracias a `vite-plugin-singlefile`, el resultado es **un único
`dist/index.html`** autocontenido (JS, CSS y la imagen van incrustados), por lo que funciona igual en la raíz
(`user.github.io/repo/`) o en un subdirectorio, sin tocar `base`.

> Los modelos de MediaPipe (`.task`) y el runtime WASM se descargan desde CDN la primera vez, luego quedan en
> la caché del navegador.

### Desarrollo local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/index.html
```

Para probar la cámara en el celular durante el desarrollo puedes usar `npm run dev -- --host` y abrir la URL
que expone en la red local (requiere HTTPS para `getUserMedia`; en `localhost` funciona directo).

## Privacidad

Todo el procesamiento de imagen ocurre en el dispositivo con WebAssembly/WebGL. Ningún frame sale del celular.
