import { z } from "zod";
import { scaleRanges } from "./params";

export const iupacDNA = /^[ACGTURYKMSWBDHVN]+$/i;

export const oligoParamsSchema = z.object({
  scale: z.enum(["25nm", "100nm", "250nm", "1um", "2um", "5um", "10um", "4nmU", "20nmU", "PU", "25nmS"]),
  purification: z.enum(["STD", "PAGE", "HPLC", "IEHPLC", "RNASE", "DUALHPLC", "PAGEHPLC"]),
});

export const probeParamsSchema = z.object({
  scale: z.enum(["25nm", "100nm", "250nm", "1um", "2um", "5um", "10um", "4nmU", "20nmU", "PU", "25nmS"]),
  purification: z.enum(["STD", "PAGE", "HPLC", "IEHPLC", "RNASE", "DUALHPLC", "PAGEHPLC"]),
  fivePrime: z.string(),
  threePrime: z.string(),
  dye: z.string(),
  quencher: z.string(),
});

// name & sequence can start empty to avoid immediate red errors; we validate populated rows later
const baseLine = z.object({
  id: z.string().min(1),
  name: z.string().default(""),
  sequence: z.string()
    .max(200, "Sequence too long")
    .regex(/^$|[ACGTURYKMSWBDHVN]+$/i, "Sequence must be DNA IUPAC letters (A,C,G,T + ambiguity)"),
}).refine((data) => {
  if (!data.sequence) return true; // empty row allowed
  // dynamic min/max if scale known later; baseLine alone can't see scale – handled in union refinement below
  return true;
});

const oligoLine = z.object({ kind: z.literal("oligo") }).merge(baseLine).extend({ params: oligoParamsSchema });
const probeLine = z.object({ kind: z.literal("probe") }).merge(baseLine).extend({ params: probeParamsSchema });

export const lineItemSchema = z.discriminatedUnion("kind", [oligoLine, probeLine])
  .superRefine((val, ctx) => {
    const seq = (val.sequence || "").trim();
    const scale = val.params.scale;
    const range = scaleRanges[scale];
    if (!val.name && !seq) return; // blank row allowed
    if (!val.name) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Name required", path: ["name"] });
    }
    if (!seq) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Sequence required", path: ["sequence"] });
      return;
    }
    if (range) {
      if (seq.length < range.min || seq.length > range.max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Length ${range.min}-${range.max}`, path: ["sequence"] });
      }
    }
  });

export type LineItem = z.infer<typeof lineItemSchema>;

export const OrderPayloadSchema = z.object({
  items: z.array(lineItemSchema).min(1),
});

export type OrderPayload = z.infer<typeof OrderPayloadSchema>;
