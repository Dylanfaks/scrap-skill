// Detección del binario de Chrome/Chromium en Mac, Windows y Linux, para que la
// skill funcione en la máquina de cualquiera sin editar rutas. Se puede forzar
// con la variable de entorno CHROME_PATH.

const fs = require("fs");
const os = require("os");

const CANDIDATES = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ],
};

function findChrome() {
  // CHROME_PATH es estricto: si el usuario lo seteó y no existe, avisamos en vez
  // de caer en silencio a otro navegador (esconde el error de configuración).
  if (process.env.CHROME_PATH) {
    return fs.existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
  }
  const list = CANDIDATES[os.platform()] || CANDIDATES.linux;
  for (const p of list) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

// Lanza un error claro y accionable si no hay navegador disponible.
function requireChrome() {
  const path = findChrome();
  if (!path) {
    throw new Error(
      process.env.CHROME_PATH
        ? `CHROME_PATH apunta a "${process.env.CHROME_PATH}" pero ahí no hay nada. Corregí la ruta o borrá la variable.`
        : "No encontré Google Chrome / Chromium en este sistema.\n" +
          "Instalá Chrome (https://www.google.com/chrome/) o seteá la variable\n" +
          "de entorno CHROME_PATH apuntando al ejecutable del navegador."
    );
  }
  return path;
}

module.exports = { findChrome, requireChrome };
