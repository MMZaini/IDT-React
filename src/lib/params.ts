export const kindOptions = [
  { value: "oligo", label: "Oligo" },
  { value: "probe", label: "Probe" },
] as const;

export const scaleOptions = [
  { value: "25nm", label: "25 nmole" },
  { value: "100nm", label: "100 nmole" },
  { value: "250nm", label: "250 nmole" },
  { value: "1um", label: "1 µmole" },
  { value: "2um", label: "2 µmole" },
  { value: "5um", label: "5 µmole" },
  { value: "10um", label: "10 µmole" },
  { value: "4nmU", label: "4 nmole Ultramer™" },
  { value: "20nmU", label: "20 nmole Ultramer™" },
  { value: "PU", label: "PAGE Ultramer™" },
  { value: "25nmS", label: "25 nmole Sameday" },
] as const;

// Central length constraints per synthesis scale (moved from UI page for single source of truth)
export const scaleRanges: Record<string, { min: number; max: number }> = {
  "25nm": { min: 15, max: 60 },
  "100nm": { min: 10, max: 90 },
  "250nm": { min: 5, max: 100 },
  "1um": { min: 5, max: 100 },
  "2um": { min: 5, max: 100 },
  "5um": { min: 5, max: 100 },
  "10um": { min: 5, max: 100 },
  "4nmU": { min: 45, max: 200 },
  "20nmU": { min: 45, max: 200 },
  "PU": { min: 60, max: 200 },
  "25nmS": { min: 15, max: 45 },
};

export const purificationOptions = [
  { value: "STD", label: "Standard Desalting" },
  { value: "PAGE", label: "PAGE" },
  { value: "HPLC", label: "HPLC" },
  { value: "IEHPLC", label: "IE HPLC" },
  { value: "RNASE", label: "RNase Free HPLC" },
  { value: "DUALHPLC", label: "Dual HPLC" },
  { value: "PAGEHPLC", label: "Dual PAGE & HPLC" },
] as const;

export const fivePrimeOptions = [
  { value: "None", label: "None" },
  { value: "Phos", label: "5′ Phosphate" },
  { value: "AminoC6", label: "Amino C6" },
] as const;

export const threePrimeOptions = [
  { value: "None", label: "None" },
  { value: "Phos", label: "3′ Phosphate" },
  { value: "AminoC7", label: "Amino C7" },
] as const;

export const dyeOptions = [
  { value: "None", label: "None" },
  { value: "FAM", label: "FAM" },
  { value: "HEX", label: "HEX" },
  { value: "Cy5", label: "Cy5" },
] as const;

export const quencherOptions = [
  { value: "None", label: "None" },
  { value: "BHQ1", label: "BHQ-1" },
  { value: "BHQ2", label: "BHQ-2" },
  { value: "IABkFQ", label: "Iowa Black FQ" },
] as const;
