/* ============================================================
   NÚCLEO EXPERTO (idéntico a la versión Python)
   Lógica pura, sin DOM: se comparte entre la app (index.html,
   vía <script src="logic.js">) y las pruebas unitarias (Node).
   ============================================================ */
function combinarCF(a,b){
  if(a>=0 && b>=0) return a + b*(1-a);
  if(a<0 && b<0)   return a + b*(1+a);
  return (a+b)/(1 - Math.min(Math.abs(a),Math.abs(b)));
}
function combinarLista(cfs){
  if(!cfs.length) return 0;
  let acc=cfs[0];
  for(let i=1;i<cfs.length;i++) acc=combinarCF(acc,cfs[i]);
  return Math.max(-1, Math.min(1, acc));
}
function magnusTd(temp,hr){
  hr=Math.max(1,Math.min(100,hr));
  const g=Math.log(hr/100)+(17.27*temp)/(237.7+temp);
  return (237.7*g)/(17.27-g);
}
const REGLAS=[
  {id:"R1",cf:+0.80,desc:"Punto de rocío ≤ 0 °C (piso térmico bajo cero)", cond:h=>h.td<=0},
  {id:"R2",cf:+0.45,desc:"Punto de rocío entre 0 y +2 °C",                 cond:h=>h.td>0&&h.td<=2},
  {id:"R3",cf:+0.20,desc:"Punto de rocío entre +2 y +4 °C",                cond:h=>h.td>2&&h.td<=4},
  {id:"R4",cf:+0.70,desc:"Cielo despejado (nubosidad ≤ 25 %)",            cond:h=>h.nubosidad<=25},
  {id:"R5",cf:+0.70,desc:"Viento en calma (≤ 5 km/h)",                    cond:h=>h.viento<=5},
  {id:"R6",cf:+0.30,desc:"Aire seco (HR ≤ 40 %)",                         cond:h=>h.hr<=40},
  {id:"R7",cf:+0.40,desc:"Atardecer frío (18–20 h y T ≤ 6 °C)",          cond:h=>[18,19,20].includes(h.hora)&&h.temp<=6},
  {id:"R8",cf:+0.55,desc:"Madrugada crítica (03–07 h y T ≤ 4 °C)",        cond:h=>h.hora>=3&&h.hora<=7&&h.temp<=4},
  {id:"R9",cf:+0.35,desc:"Huerto en parte baja / cañada (drenaje de aire frío)", cond:h=>!!h.parte_baja},
  {id:"R10",cf:-0.65,desc:"Nubosidad alta (≥ 75 %): las nubes atrapan la radiación", cond:h=>h.nubosidad>=75},
  {id:"R11",cf:-0.65,desc:"Viento moderado/fuerte (≥ 15 km/h): mezcla el aire",      cond:h=>h.viento>=15},
  {id:"R12",cf:-0.50,desc:"Atardecer templado (T ≥ 12 °C)",              cond:h=>h.temp>=12},
  {id:"R13",cf:-0.55,desc:"Punto de rocío alto (≥ +5 °C)",               cond:h=>h.td>=5},

  // ===== Reglas extendidas (R14–R20): usan telemetría adicional del SMN =====
  // Si el dato no está disponible (p. ej. entrada manual), la regla no se dispara.
  {id:"R16",cf:+0.50,desc:"Margen T−Td ≤ 2 °C al atardecer (18–20 h)",     cond:h=>[18,19,20].includes(h.hora) && (h.temp-h.td)<=2},
  {id:"R20",cf:+0.30,desc:"Saturación con punto de rocío bajo cero (HR ≥ 90 % y Td ≤ 0)", cond:h=>h.hr>=90 && h.td<=0},
  {id:"R17",cf:+0.10,desc:"Temporada de heladas (nov–feb): factor de fondo", cond:h=>[11,12,1,2].includes(h.mes)},
  {id:"R18",cf:+0.40,desc:"Enfriamiento rápido con aire ya frío (descenso ≥ 2 °C y T ≤ 6 °C)", cond:h=>h.delta_t!=null && h.delta_t<=-2 && h.temp<=6},
  {id:"R19",cf:+0.25,desc:"Viento del cuadrante norte (advección de aire frío)", cond:h=>h.dir_viento!=null && (h.dir_viento>=315||h.dir_viento<=45)},
  {id:"R14",cf:-0.55,desc:"Probabilidad de precipitación alta (≥ 60 %)",   cond:h=>h.prob_prec!=null && h.prob_prec>=60},
  {id:"R15",cf:-0.45,desc:"Ráfagas fuertes (≥ 20 km/h): mezcla la capa de aire", cond:h=>h.rafaga!=null && h.rafaga>=20},
];
const NIVELES=[
  {min:0.70, nivel:"CRÍTICA",    color:"var(--rojo)",    hex:"#e8503f", accion:"Activa riego por aspersión o calentadores y pon alarma nocturna."},
  {min:0.40, nivel:"ALERTA",     color:"var(--naranja)", hex:"#ef8a3c", accion:"Prepara las medidas de protección y monitorea de forma continua."},
  {min:0.15, nivel:"VIGILANCIA", color:"var(--amarillo)",hex:"#f4c430", accion:"Observa la evolución hacia la madrugada."},
  {min:-2,   nivel:"NULO",       color:"var(--verde)",   hex:"#37c07a", accion:"Sin riesgo relevante de helada radiativa."},
];
function clasificar(cf){ return NIVELES.find(n=>cf>=n.min); }

function inferir(h){
  h.td = Math.round(magnusTd(h.temp,h.hr)*10)/10;
  const disparadas = REGLAS.filter(r=>r.cond(h));
  const cf = combinarLista(disparadas.map(r=>r.cf));
  return {cf, disparadas, nivel:clasificar(cf), td:h.td};
}

/* ============================================================
   Adaptador SMN -> hechos internos
   ============================================================ */

// El servicio por hora del SMN no da nubosidad numérica, sino una
// descripción de cielo en texto. La traducimos a un % aproximado.
function nubosidadDesdeCielo(desc){
  const d = (desc || "").toLowerCase();
  if (d.includes("cubierto"))            return 100;
  if (d.includes("mayormente nublado"))  return 80;
  if (d.includes("medio nublado") || d.includes("parcial")) return 50;
  if (d.includes("intervalos") || d.includes("dispersas") || d.includes("poco nublado")) return 30;
  if (d.includes("mayormente despejado")) return 15;
  if (d.includes("nublado"))             return 90;
  if (d.includes("despejado"))           return 5;
  return 40;  // descripción no reconocida: valor intermedio
}

// El SMN entrega la hora como marca de tiempo '20260708T18'; extraemos la hora.
function horaDesdeHloc(hloc){
  const s = String(hloc);
  if (s.includes("T")) return parseInt(s.split("T")[1].slice(0, 2)) || 0;
  return parseInt(s) || 0;   // formato simple: ya es la hora
}

// Extrae el mes (1-12) de la marca '20260708T18' o de una fecha '2026-07-08'.
function mesDesdeHloc(hloc, dloc){
  const s = String(hloc);
  if (s.includes("T") && s.length >= 6) return parseInt(s.slice(4,6)) || null;
  if (dloc && String(dloc).includes("-")) return parseInt(String(dloc).split("-")[1]) || null;
  return null;
}

function normalizar(reg, parteBaja){
  const num = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
  const numN = v => { if (v===undefined||v===null||v==="") return null; const x=parseFloat(v); return isNaN(x)?null:x; };
  // Nubosidad: usa 'cc' numérico si viene; si no, deriva del texto del cielo.
  const nub = (reg.cc !== undefined && reg.cc !== null && reg.cc !== "")
    ? num(reg.cc)
    : nubosidadDesdeCielo(reg.desciel || reg.cielo);
  return {
    temp: num(reg.temp), hr: num(reg.hr), viento: num(reg.velvien),
    nubosidad: nub, hora: horaDesdeHloc(reg.hloc), parte_baja: parteBaja,
    mes: mesDesdeHloc(reg.hloc, reg.dloc),
    prob_prec: numN(reg.probprec),   // R14
    rafaga: numN(reg.raf),           // R15
    dir_viento: numN(reg.dirvieng),  // R19
  };
}

// El SMN entrega la fecha/hora como marca '20260708T18'; la convertimos
// a un Date local (usado para elegir la lectura más cercana a "ahora").
function fechaDesdeHloc(hloc){
  const s = String(hloc);
  if (!s.includes("T")) return null;
  const [f, hh] = s.split("T");
  if (f.length < 8) return null;
  const y=+f.slice(0,4), m=+f.slice(4,6), d=+f.slice(6,8), hora=parseInt(hh.slice(0,2))||0;
  return new Date(y, m-1, d, hora);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    combinarCF, combinarLista, magnusTd, REGLAS, NIVELES, clasificar, inferir,
    nubosidadDesdeCielo, horaDesdeHloc, mesDesdeHloc, normalizar, fechaDesdeHloc,
    escapeHtml,
  };
}
