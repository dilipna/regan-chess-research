// Cheap client-side exports (CSV / JSON downloads).

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? String(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(name: string, header: string[], rows: unknown[][]) {
  const text = [header.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
  download(name, text + "\n", "text/csv;charset=utf-8");
}

export function downloadJson(name: string, obj: unknown) {
  download(name, JSON.stringify(obj, null, 2), "application/json");
}
