"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  combinarCF, combinarLista, magnusTd, REGLAS, NIVELES, clasificar, inferir,
  nubosidadDesdeCielo, horaDesdeHloc, mesDesdeHloc, normalizar, fechaDesdeHloc,
  escapeHtml,
} = require("../logic.js");

const cerca = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

/* ============================================================
   combinarCF — combinación de factores de certeza (estilo MYCIN)
   ============================================================ */
test("combinarCF: dos factores positivos se refuerzan (a+b*(1-a))", () => {
  assert.ok(cerca(combinarCF(0.5, 0.5), 0.75));
  assert.ok(cerca(combinarCF(0.8, 0), 0.8));
});

test("combinarCF: dos factores negativos se refuerzan hacia -1", () => {
  assert.ok(cerca(combinarCF(-0.5, -0.5), -0.75));
});

test("combinarCF: signos mixtos usan la fórmula de conflicto", () => {
  assert.ok(cerca(combinarCF(0.6, -0.3), 0.3 / 0.7));
});

test("combinarCF: cero se trata como no-negativo en la frontera con un negativo", () => {
  // a=0 no cae en la rama "ambos negativos"; usa la fórmula de conflicto.
  assert.ok(cerca(combinarCF(0, -0.5), -0.5));
});

test("combinarCF: es conmutativa para varios pares representativos", () => {
  const pares = [[0.4, 0.3], [-0.4, -0.3], [0.6, -0.2], [-0.6, 0.2], [0, 0]];
  for (const [a, b] of pares) {
    assert.ok(cerca(combinarCF(a, b), combinarCF(b, a)), `combinarCF(${a},${b})`);
  }
});

/* ============================================================
   combinarLista — pliegue secuencial de combinarCF
   ============================================================ */
test("combinarLista: lista vacía no aporta evidencia (0)", () => {
  assert.equal(combinarLista([]), 0);
});

test("combinarLista: un solo elemento se devuelve tal cual", () => {
  assert.equal(combinarLista([0.42]), 0.42);
  assert.equal(combinarLista([-0.42]), -0.42);
});

test("combinarLista: pliega en orden usando combinarCF", () => {
  const cfs = [0.5, 0.5, -0.9];
  let esperado = cfs[0];
  for (let i = 1; i < cfs.length; i++) esperado = combinarCF(esperado, cfs[i]);
  assert.ok(cerca(combinarLista(cfs), Math.max(-1, Math.min(1, esperado))));
});

test("combinarLista: el resultado siempre queda dentro de [-1, 1]", () => {
  const muchasPositivas = Array(20).fill(0.9);
  const muchasNegativas = Array(20).fill(-0.9);
  const r1 = combinarLista(muchasPositivas);
  const r2 = combinarLista(muchasNegativas);
  assert.ok(r1 <= 1 && r1 >= -1);
  assert.ok(r2 <= 1 && r2 >= -1);
});

/* ============================================================
   magnusTd — punto de rocío (fórmula de Magnus)
   ============================================================ */
test("magnusTd: la humedad relativa se acota a [1, 100]", () => {
  assert.equal(magnusTd(10, 150), magnusTd(10, 100));
  assert.equal(magnusTd(10, -5), magnusTd(10, 1));
  assert.equal(magnusTd(10, 0), magnusTd(10, 1));
});

test("magnusTd: el punto de rocío nunca supera la temperatura del aire", () => {
  for (const temp of [-5, -1, 0, 5, 15, 25, 35]) {
    for (const hr of [1, 10, 40, 70, 99, 100]) {
      assert.ok(magnusTd(temp, hr) <= temp + 1e-9, `temp=${temp} hr=${hr}`);
    }
  }
});

test("magnusTd: con 100% de humedad, el punto de rocío converge a la temperatura", () => {
  for (const temp of [-2, 5, 15, 22]) {
    assert.ok(cerca(magnusTd(temp, 100), temp, 0.05), `temp=${temp}`);
  }
});

test("magnusTd: a más humedad (misma temperatura), el punto de rocío sube", () => {
  const bajo = magnusTd(10, 30);
  const alto = magnusTd(10, 90);
  assert.ok(alto > bajo);
});

/* ============================================================
   REGLAS — estructura e identidad de cada regla
   ============================================================ */
test("REGLAS: todos los ids son únicos y bien formados", () => {
  const ids = REGLAS.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const r of REGLAS) {
    assert.equal(typeof r.id, "string");
    assert.equal(typeof r.cf, "number");
    assert.equal(typeof r.desc, "string");
    assert.equal(typeof r.cond, "function");
    assert.ok(r.cf >= -1 && r.cf <= 1);
  }
});

test("REGLAS: los factores de certeza conocidos no cambiaron sin querer", () => {
  const esperados = {
    R1: 0.80, R4: 0.70, R5: 0.70, R8: 0.55, R9: 0.35,
    R10: -0.65, R11: -0.65, R13: -0.55, R14: -0.55, R18: 0.40,
  };
  for (const [id, cf] of Object.entries(esperados)) {
    const regla = REGLAS.find(r => r.id === id);
    assert.ok(regla, `falta la regla ${id}`);
    assert.ok(cerca(regla.cf, cf), `${id} cf=${regla.cf}, esperado ${cf}`);
  }
});

function disparadasPara(hecho) {
  return REGLAS.filter(r => r.cond(hecho)).map(r => r.id);
}

test("REGLAS: casos representativos disparan exactamente las reglas esperadas", () => {
  const casos = [
    {
      nombre: "noche despejada, en calma y muy fría (piso térmico bajo cero)",
      hecho: { td: -1, temp: -1, hr: 80, viento: 2, nubosidad: 10, hora: 5, mes: 1 },
      incluye: ["R1", "R4", "R5", "R8", "R17"],
      excluye: ["R10", "R11", "R12", "R13"],
    },
    {
      nombre: "atardecer nublado y ventoso, templado (sin riesgo)",
      hecho: { td: 8, temp: 14, hr: 60, viento: 20, nubosidad: 90, hora: 19, mes: 7 },
      incluye: ["R10", "R11", "R12", "R13"],
      excluye: ["R1", "R4", "R5", "R7", "R8", "R17"],
    },
    {
      nombre: "huerto en parte baja con lluvia probable y ráfagas",
      hecho: {
        td: 3, temp: 5, hr: 65, viento: 3, nubosidad: 20, hora: 4,
        parte_baja: true, prob_prec: 70, rafaga: 25,
      },
      incluye: ["R9", "R14", "R15"],
      excluye: ["R1", "R13"],
    },
  ];
  for (const { nombre, hecho, incluye, excluye } of casos) {
    const disparadas = disparadasPara(hecho);
    for (const id of incluye) assert.ok(disparadas.includes(id), `${nombre}: falta ${id}`);
    for (const id of excluye) assert.ok(!disparadas.includes(id), `${nombre}: no debería disparar ${id}`);
  }
});

test("REGLAS: R18 y R19 solo se evalúan cuando hay telemetría extendida", () => {
  const sinTelemetria = { td: 1, temp: 3, hr: 70, viento: 4, nubosidad: 10, hora: 5 };
  assert.ok(!disparadasPara(sinTelemetria).includes("R18"));
  assert.ok(!disparadasPara(sinTelemetria).includes("R19"));

  const conEnfriamientoRapido = { ...sinTelemetria, delta_t: -3 };
  assert.ok(disparadasPara(conEnfriamientoRapido).includes("R18"));

  const conVientoNorte = { ...sinTelemetria, dir_viento: 350 };
  assert.ok(disparadasPara(conVientoNorte).includes("R19"));
  const conVientoSur = { ...sinTelemetria, dir_viento: 180 };
  assert.ok(!disparadasPara(conVientoSur).includes("R19"));
});

/* ============================================================
   clasificar — umbrales de nivel de riesgo
   ============================================================ */
test("clasificar: fronteras exactas de cada nivel", () => {
  assert.equal(clasificar(0.70).nivel, "CRÍTICA");
  assert.equal(clasificar(0.6999).nivel, "ALERTA");
  assert.equal(clasificar(0.40).nivel, "ALERTA");
  assert.equal(clasificar(0.3999).nivel, "VIGILANCIA");
  assert.equal(clasificar(0.15).nivel, "VIGILANCIA");
  assert.equal(clasificar(0.1499).nivel, "NULO");
  assert.equal(clasificar(-1).nivel, "NULO");
});

test("clasificar: NIVELES está ordenado de mayor a menor umbral", () => {
  for (let i = 1; i < NIVELES.length; i++) {
    assert.ok(NIVELES[i - 1].min > NIVELES[i].min);
  }
});

/* ============================================================
   inferir — pipeline completo (Td + reglas + combinación + nivel)
   ============================================================ */
test("inferir: calcula el punto de rocío y lo agrega al hecho recibido", () => {
  const h = { temp: 10, hr: 70, viento: 5, nubosidad: 20, hora: 5 };
  const res = inferir(h);
  assert.equal(h.td, res.td, "inferir debe mutar el hecho con su punto de rocío");
  assert.ok(res.td <= h.temp + 1e-9);
});

test("inferir: madrugada muy fría, despejada y en calma -> riesgo CRÍTICA", () => {
  const res = inferir({ temp: -0.3, hr: 86, viento: 1, nubosidad: 0, hora: 3 });
  assert.equal(res.nivel.nivel, "CRÍTICA");
  assert.ok(res.cf >= 0.70);
  assert.ok(res.disparadas.some(r => r.id === "R1"));
});

test("inferir: tarde templada, nublada y ventosa -> sin riesgo (NULO)", () => {
  const res = inferir({ temp: 18, hr: 55, viento: 25, nubosidad: 95, hora: 16 });
  assert.equal(res.nivel.nivel, "NULO");
  assert.ok(res.cf < 0.15);
});

test("REGLAS: un hecho neutro (fuera de todos los umbrales) no dispara ninguna regla", () => {
  const neutro = { td: 4.5, temp: 8, hr: 65, viento: 10, nubosidad: 50, hora: 12 };
  assert.deepEqual(disparadasPara(neutro), []);
  assert.equal(clasificar(combinarLista([])).nivel, "NULO");
});

/* ============================================================
   nubosidadDesdeCielo — texto de cielo -> % de nubosidad
   ============================================================ */
test("nubosidadDesdeCielo: mapea las descripciones conocidas del SMN", () => {
  assert.equal(nubosidadDesdeCielo("Cubierto"), 100);
  assert.equal(nubosidadDesdeCielo("Mayormente nublado"), 80);
  assert.equal(nubosidadDesdeCielo("Medio nublado"), 50);
  assert.equal(nubosidadDesdeCielo("Parcialmente nublado"), 50);
  assert.equal(nubosidadDesdeCielo("Intervalos nubosos"), 30);
  assert.equal(nubosidadDesdeCielo("Mayormente despejado"), 15);
  assert.equal(nubosidadDesdeCielo("Nublado"), 90);
  assert.equal(nubosidadDesdeCielo("Despejado"), 5);
});

test("nubosidadDesdeCielo: no distingue mayúsculas/minúsculas", () => {
  assert.equal(nubosidadDesdeCielo("DESPEJADO"), 5);
  assert.equal(nubosidadDesdeCielo("cUbIeRtO"), 100);
});

test("nubosidadDesdeCielo: texto no reconocido o ausente cae al valor intermedio", () => {
  assert.equal(nubosidadDesdeCielo("neblina espesa"), 40);
  assert.equal(nubosidadDesdeCielo(""), 40);
  assert.equal(nubosidadDesdeCielo(undefined), 40);
  assert.equal(nubosidadDesdeCielo(null), 40);
});

/* ============================================================
   horaDesdeHloc / mesDesdeHloc — parsers de las marcas del SMN
   ============================================================ */
test("horaDesdeHloc: extrae la hora de una marca de tiempo del SMN", () => {
  assert.equal(horaDesdeHloc("20260708T18"), 18);
  assert.equal(horaDesdeHloc("20260708T05"), 5);
});

test("horaDesdeHloc: acepta el formato simple (ya es la hora)", () => {
  assert.equal(horaDesdeHloc("7"), 7);
  assert.equal(horaDesdeHloc(0), 0);
});

test("horaDesdeHloc: entrada no numérica cae a 0", () => {
  assert.equal(horaDesdeHloc("abc"), 0);
});

test("mesDesdeHloc: extrae el mes de la marca con 'T'", () => {
  assert.equal(mesDesdeHloc("20260112T03"), 1);
  assert.equal(mesDesdeHloc("20261225T18"), 12);
});

test("mesDesdeHloc: usa dloc como respaldo cuando no hay 'T'", () => {
  assert.equal(mesDesdeHloc("18", "2026-07-08"), 7);
});

test("mesDesdeHloc: sin marca ni fecha, devuelve null", () => {
  assert.equal(mesDesdeHloc("18", undefined), null);
});

/* ============================================================
   normalizar — registro crudo del SMN -> hecho interno
   ============================================================ */
test("normalizar: usa 'cc' numérico cuando está presente", () => {
  const h = normalizar({ hloc: "20260708T20", temp: "5.5", hr: "66", velvien: "4", cc: "20" }, false);
  assert.equal(h.nubosidad, 20);
  assert.equal(h.temp, 5.5);
  assert.equal(h.hora, 20);
  assert.equal(h.mes, 7);
  assert.equal(h.parte_baja, false);
});

test("normalizar: deriva la nubosidad del texto del cielo cuando falta 'cc'", () => {
  const h = normalizar({ hloc: "18", temp: "12", hr: "52", velvien: "16", desciel: "Despejado" }, false);
  assert.equal(h.nubosidad, 5);
});

test("normalizar: campos numéricos ausentes o inválidos se vuelven 0", () => {
  const h = normalizar({ hloc: "18" }, false);
  assert.equal(h.temp, 0);
  assert.equal(h.hr, 0);
  assert.equal(h.viento, 0);
});

test("normalizar: la telemetría extendida ausente queda como null (no 0)", () => {
  const h = normalizar({ hloc: "18", temp: "5" }, false);
  assert.equal(h.prob_prec, null);
  assert.equal(h.rafaga, null);
  assert.equal(h.dir_viento, null);
});

test("normalizar: propaga la telemetría extendida cuando viene en el registro", () => {
  const h = normalizar({ hloc: "18", temp: "5", probprec: "80", raf: "22", dirvieng: "10" }, true);
  assert.equal(h.prob_prec, 80);
  assert.equal(h.rafaga, 22);
  assert.equal(h.dir_viento, 10);
  assert.equal(h.parte_baja, true);
});

/* ============================================================
   fechaDesdeHloc — marca de tiempo del SMN -> Date local
   ============================================================ */
test("fechaDesdeHloc: construye un Date local a partir de la marca del SMN", () => {
  const f = fechaDesdeHloc("20260305T14");
  assert.equal(f.getFullYear(), 2026);
  assert.equal(f.getMonth(), 2); // marzo = índice 2
  assert.equal(f.getDate(), 5);
  assert.equal(f.getHours(), 14);
});

test("fechaDesdeHloc: sin 'T' o con fecha incompleta, devuelve null", () => {
  assert.equal(fechaDesdeHloc("18"), null);
  assert.equal(fechaDesdeHloc("2026T18"), null);
});

/* ============================================================
   escapeHtml — saneado para el reporte HTML exportable
   ============================================================ */
test("escapeHtml: escapa los cinco caracteres especiales de HTML", () => {
  assert.equal(escapeHtml(`<b>"Vela" & 'heladas'</b>`),
    "&lt;b&gt;&quot;Vela&quot; &amp; &#39;heladas&#39;&lt;/b&gt;");
});

test("escapeHtml: texto sin caracteres especiales no cambia", () => {
  assert.equal(escapeHtml("Vigilancia nocturna"), "Vigilancia nocturna");
});

test("escapeHtml: convierte valores no-string antes de escapar", () => {
  assert.equal(escapeHtml(42), "42");
});
