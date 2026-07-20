"""
actualizar_smn.py
------------------
Descarga el pronostico POR HORA del SMN (CONAGUA) para Huauchinango y
escribe "datos_smn.json" en la raiz del repo, en el formato que ya
consume `cargarDelSMN()` dentro de index.html.

No se reprocesan los campos del SMN aqui: el 'hloc' (marca de fecha+hora,
p. ej. "20260719T18") y los campos opcionales (probprec, raf, dirvieng)
se pasan tal cual, porque el JS de index.html (horaDesdeHloc, mesDesdeHloc,
normalizar) ya sabe interpretarlos directamente. Asi la logica de
adaptacion vive en un solo lugar.

Pensado para correr desde GitHub Actions cada hora: el archivo resultante
queda commiteado en el repo y, como GitHub Pages sirve desde la raiz de
main, la PWA lo puede pedir con fetch("datos_smn.json") sin problemas de
CORS (mismo origen).

Uso manual:
    python3 scripts/actualizar_smn.py
"""

import gzip
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = "https://smn.conagua.gob.mx/tools/GUI/webservices/index.php?method=3"
MUNICIPIO = "Huauchinango"
SALIDA = Path(__file__).resolve().parent.parent / "datos_smn.json"

# Campos del registro crudo del SMN que la app necesita; el resto (lat,
# lon, ides, idmun, nes, dsem, dh, nhor, dirvienc, dpt, prec...) se
# descarta porque index.html no los usa.
CAMPOS = ["hloc", "temp", "hr", "velvien", "desciel", "probprec", "raf", "dirvieng"]


def descargar(url: str) -> list:
    """Descarga y descomprime; el SMN entrega JSON en Latin-1 (ISO-8859-1)."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    crudo = urllib.request.urlopen(req, timeout=60).read()

    if crudo[:2] == b"\x1f\x8b":
        crudo = gzip.decompress(crudo)

    texto = None
    for enc in ("utf-8", "latin-1"):
        try:
            texto = crudo.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if texto is None:
        texto = crudo.decode("latin-1", errors="replace")
    texto = texto.strip()

    if texto[:1] not in "[{":
        raise SystemExit(
            "El enlace del SMN no devolvio JSON (primeros 300 caracteres):\n"
            f"{texto[:300]}"
        )

    datos = json.loads(texto)
    return datos if isinstance(datos, list) else datos.get("data", [])


def convertir(registros: list, municipio: str) -> list:
    objetivo = municipio.strip().lower()
    filtrados = [
        r for r in registros
        if str(r.get("nmun", "")).strip().lower() == objetivo
    ]
    if not filtrados:
        raise RuntimeError(
            f"No se encontraron registros de '{municipio}' en la respuesta del SMN."
        )

    convertidos = [{c: r.get(c, "") for c in CAMPOS} for r in filtrados]
    convertidos.sort(key=lambda r: str(r["hloc"]))
    return convertidos


def main():
    registros = descargar(URL)
    datos = convertir(registros, MUNICIPIO)

    paquete = {
        "municipio": MUNICIPIO,
        "actualizado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "datos": datos,
    }

    SALIDA.write_text(
        json.dumps(paquete, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"{len(datos)} registros de {MUNICIPIO} guardados en {SALIDA}")


if __name__ == "__main__":
    main()
