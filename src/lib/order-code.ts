import type { LineItem } from "./schema";

function parts(obj: Record<string, string | undefined>) {
  return Object.entries(obj)
    .filter(([, v]) => v && v !== "None")
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
}

/**
 * TEMP template:
 *  - Oligo:  OLI|<name>|<seq>|<scale/purif/mods>
 *  - Probe:  PRB|<name>|<seq>|<scale/purif/mods>|<dye/quencher>
 * Replace with your lab's real IDT code template later.
 */
export function generateOrderCode(item: LineItem) {
  const core = `${item.kind === "probe" ? "PRB" : "OLI"}|${item.name}|${item.sequence.toUpperCase()}`;
  if (item.kind === "oligo") {
    const p = item.params;
    const paramStr = parts({ scale: p.scale, purif: p.purification });
    return `${core}|${paramStr}`;
  }

  // probe
  const p = item.params;
  const paramStr = parts({ scale: p.scale, purif: p.purification, five: p.fivePrime, three: p.threePrime, dye: p.dye, quencher: p.quencher });
  return `${core}|${paramStr}`;
}

export function splitByKind<T extends { kind: LineItem["kind"] }>(items: T[]) {
  const oligos = items.filter((x) => x.kind === "oligo");
  const probes = items.filter((x) => x.kind === "probe");
  return { oligos, probes };
}
