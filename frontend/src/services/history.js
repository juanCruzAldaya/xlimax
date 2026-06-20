/* Históricos — fetch on-demand al endpoint downsampled del backend.
   NO usa onSnapshot: se consulta sólo cuando el usuario elige un rango,
   para no quemar el quota de lecturas de Firestore. */
import { vpdLeaf, vpdAir } from '../utils/vpd'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? 'https://xlimax.onrender.com'

/** Agrega VPD (foliar + aire) a cada nodo, calculado de su t/h promedio. */
function withVpd(nodes) {
  const out = {}
  for (const [name, s] of Object.entries(nodes ?? {})) {
    out[name] = {
      ...s,
      v:    s.t != null && s.h != null ? vpdLeaf(s.t, s.h) : null,
      vair: s.t != null && s.h != null ? vpdAir(s.t, s.h)  : null,
    }
  }
  return out
}

/**
 * Trae el histórico promediado en buckets (hora o día).
 * @returns {{ bucket, totalDocs, points: [{ epoch, count, nodes }] }}
 */
export async function fetchHistory(fromEpoch, toEpoch, bucket = 'hour') {
  const url = `${BACKEND}/readings/history`
    + `?from=${encodeURIComponent(new Date(fromEpoch).toISOString())}`
    + `&to=${encodeURIComponent(new Date(toEpoch).toISOString())}`
    + `&bucket=${bucket}`

  const r = await fetch(url)
  if (!r.ok) {
    let detail = `HTTP ${r.status}`
    try { detail = (await r.json()).detail ?? detail } catch { /* noop */ }
    throw new Error(detail)
  }

  const j = await r.json()
  return {
    bucket:    j.bucket,
    totalDocs: j.total_docs,
    points: (j.points ?? []).map(p => ({
      epoch: Date.parse(p.ts),
      count: p.count,
      nodes: withVpd(p.nodes),
    })),
  }
}
