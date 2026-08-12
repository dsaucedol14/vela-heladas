# Protocolo de helada

Módulo de respuesta operativa de VELA. Toma el lugar del "¿y ahora qué hago?"
que queda después de la alerta: el productor captura lo que mide en el huerto y
obtiene un protocolo priorizado según el tipo de helada y los recursos que
tenga esa noche.

## Qué resuelve

El motor de VELA emite la alerta. Este módulo decide la respuesta.

- Clasifica la helada como radiativa, advectiva o incierta a partir de viento y cielo.
- Estima el bulbo húmedo con la aproximación de Stull (2011), válida entre 5 % y 99 % de HR.
- Calcula el margen entre la temperatura del brote y el umbral de daño del estado fenológico.
- Devuelve acciones separadas en dos ventanas: las que todavía se pueden hacer con luz
  (calentar el suelo) y las de madrugada (aspersión, calentadores, cubiertas).

## Cómo se instala

Archivo único, sin dependencias, sin fuentes externas ni llamadas de red. Funciona
offline, que es la condición real de uso: madrugada, huerto, sin señal.

```
web/protocolo-helada.html
```

Se puede abrir directo, enlazar desde la pantalla de alerta o registrar como ruta
de la PWA. Si se agrega al `service worker`, basta con incluirlo en la lista de
precache; no tiene recursos asociados.

## Reglas que no son evidentes

| Condición | Comportamiento |
|---|---|
| Bulbo húmedo < −3 °C | Desaconseja la aspersión: el enfriamiento evaporativo al arrancar puede bajar la temperatura por debajo del umbral. |
| Viento ≥ 8 km/h | Clasifica advectiva y suprime aspersión y calentadores; solo deja cubiertas. |
| Estado ≥ cuajado | Anula el ajuste por variedad: después de la caída de pétalos todas son igual de sensibles. |
| Horas a amanecer ≤ 3 | Suprime las medidas de acumulación de calor en suelo, que ya no alcanzan a rendir. |

## Umbrales

Los umbrales de daño provienen de las tablas de Washington State University
(Prosser, 1964–76) para Red Delicious, convertidos a grados Celsius, sobre 30
minutos de exposición. Golden Delicious y Winesap resisten alrededor de 0.5 °C
más y Rome Beauty alrededor de 1.1 °C más antes de la caída de pétalos.

**Limitación conocida.** No existen umbrales publicados para las variedades
criollas de la Sierra Norte de Puebla —panochera, rayada, carreta, tonoxócotl—.
El módulo aplica los de Red Delicious como referencia conservadora y lo declara
en pantalla. Levantar una tabla local a partir de registro de campo es trabajo
pendiente y sería una contribución en sí misma.

## Pendientes

- [ ] Consumir los certainty factors de `motor_vela_v2.py` en lugar de umbrales duros.
- [ ] Registrar cada evaluación (temperatura, hora, acción tomada) para construir el histórico del huerto.
- [ ] Calibrar umbrales por bloque con datos propios de varias temporadas.
