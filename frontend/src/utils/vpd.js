/* VPD — Déficit de presión de vapor (Vapor Pressure Deficit)
 *
 * Métrica clave en cultivo: combina temperatura y humedad relativa en un solo
 * número (kPa) que indica cuánta "sed" tiene el aire. Determina la traspiración
 * de la planta y el riesgo de hongos (VPD bajo) o estrés hídrico (VPD alto).
 *
 * Fórmula de presión de vapor de saturación (Tetens), T en °C, resultado en kPa:
 *   SVP(T) = 0.6108 · e^(17.27·T / (T + 237.3))
 *
 * VPD de aire   = SVP(Taire) · (1 − HR/100)
 * VPD foliar    = SVP(Thoja) − SVP(Taire) · HR/100,   con Thoja = Taire − offset
 *
 * El offset foliar (default 2°C) modela que la hoja, por transpiración, suele
 * estar algo más fría que el aire. Es el VPD que "siente" la planta.
 */

export const LEAF_OFFSET_DEFAULT = 2 // °C que la hoja está por debajo del aire

/** Presión de vapor de saturación en kPa para una temperatura en °C. */
export function svp(tempC) {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3))
}

/** VPD de aire (kPa). Solo usa T y HR, sin supuestos sobre la hoja. */
export function vpdAir(tempC, rh) {
  if (tempC == null || rh == null) return null
  return +(svp(tempC) * (1 - rh / 100)).toFixed(2)
}

/** VPD foliar (kPa). Asume hoja = aire − offset. Clampa negativos a 0. */
export function vpdLeaf(tempC, rh, offset = LEAF_OFFSET_DEFAULT) {
  if (tempC == null || rh == null) return null
  const leaf = svp(tempC - offset) - svp(tempC) * (rh / 100)
  return +Math.max(0, leaf).toFixed(2)
}

/* Zonas objetivo por etapa de cultivo (kPa).
   Los límites son los habituales en cultivo indoor. */
export const VPD_ZONES = [
  { min: 0,    max: 0.4, label: 'Muy húmedo', stage: 'Riesgo de hongos',   color: '#3b82f6' }, // azul
  { min: 0.4,  max: 0.8, label: 'Propagación', stage: 'Clones / plántulas', color: '#22c55e' }, // verde
  { min: 0.8,  max: 1.2, label: 'Vegetativo',  stage: 'Crecimiento',        color: '#84cc16' }, // lima
  { min: 1.2,  max: 1.6, label: 'Floración',   stage: 'Flora',              color: '#eab308' }, // amarillo
  { min: 1.6,  max: 3.0, label: 'Muy seco',    stage: 'Estrés hídrico',     color: '#ef4444' }, // rojo
]

/** Escala superior del gauge de VPD (kPa). */
export const VPD_MAX = 2.0

/** Clasifica un valor de VPD en su zona. Devuelve la zona o null. */
export function classifyVpd(vpd) {
  if (vpd == null) return null
  return VPD_ZONES.find(z => vpd >= z.min && vpd < z.max) ?? VPD_ZONES[VPD_ZONES.length - 1]
}
