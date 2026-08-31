import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type Sheet = { name: string; columns: string[]; rows: (string | number)[][] };

const nf = (n: number, d = 0) =>
  new Intl.NumberFormat("sv-SE", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

export const num = (n: number, d = 0) => nf(n ?? 0, d);

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const csvEscape = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportCsv = (sheets: Sheet[], filename: string) => {
  const lines: string[] = [];
  sheets.forEach((s, i) => {
    if (i > 0) lines.push("");
    lines.push(csvEscape(s.name));
    lines.push(s.columns.map(csvEscape).join(";"));
    s.rows.forEach((r) => lines.push(r.map(csvEscape).join(";")));
  });
  download(
    new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }),
    `${filename}.csv`,
  );
};

export const exportXlsx = (sheets: Sheet[], filename: string) => {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = XLSX.utils.aoa_to_sheet([s.columns, ...s.rows]);
    ws["!cols"] = s.columns.map((c, i) => ({
      wch: Math.max(
        c.length + 2,
        ...s.rows.slice(0, 200).map((r) => String(r[i] ?? "").length + 2),
      ),
    }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportPdf = (
  sheets: Sheet[],
  filename: string,
  meta: { title: string; subtitle: string },
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const teal: [number, number, number] = [78, 130, 131];

  doc.setFillColor(...teal);
  doc.rect(0, 0, 595, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(meta.title, 40, 45);
  doc.setFontSize(11);
  doc.text(meta.subtitle, 40, 66);

  let y = 120;
  sheets.forEach((s, i) => {
    if (i > 0) y = (doc as any).lastAutoTable.finalY + 34;
    if (y > 700) {
      doc.addPage();
      y = 60;
    }
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(13);
    doc.text(s.name, 40, y);
    autoTable(doc, {
      startY: y + 10,
      head: [s.columns],
      body: s.rows.map((r) => r.map((c) => String(c))),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: teal, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 245] },
      margin: { left: 40, right: 40 },
    });
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Bråland Gård · sida ${p} av ${pages}`, 40, 820);
  }
  doc.save(`${filename}.pdf`);
};
