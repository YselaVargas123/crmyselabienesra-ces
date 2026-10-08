/** Descarga un CSV (con BOM para que Excel respete tildes y ñ). */
export function descargarCsv(nombre: string, filas: Record<string, string | number | null | undefined>[]): void {
  if (filas.length === 0) return;
  const cols = Object.keys(filas[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const texto = [cols.map(esc).join(","), ...filas.map((f) => cols.map((c) => esc(f[c])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}
