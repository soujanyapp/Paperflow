export const PX_PER_MM = 96 / 25.4;
export const PX_PER_PT = 96 / 72;

export const mmToPx = (mm: number): number => mm * PX_PER_MM;
export const pxToMm = (px: number): number => px / PX_PER_MM;
export const ptToPx = (pt: number): number => pt * PX_PER_PT;
export const pxToPt = (px: number): number => px / PX_PER_PT;

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
