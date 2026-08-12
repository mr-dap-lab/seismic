const DISCLAIMER = "This report is generated from a simplified educational simulation. It does not replace the expertise, inspection, calculations, or professional judgment of a licensed structural or civil engineer. The website and its creators accept no responsibility or liability for decisions, designs, losses, injuries, or damages based on this report. Do not use this report for construction, code compliance, emergency planning, property transactions, or life-safety decisions.";

/**
 * Build the downloadable structural-response PDF.
 * @param {{filename?: string, generated?: string, structure: string, system: string, stories: number, storyHeight: number, totalHeight: number, vehicleOccupancy?: number, siteClass: string, magnitude: number, intensity: number, amplitude: number, frequency: number, mmiRoman: string, mmi: number, mmiTitle: string, mmiLegend: string, pga: number, spectralAcceleration: number, period: number, drift: number, driftLimit: number, baseShear: number, damageScore: number, damageLabel: string, responseFactor: number, importanceFactor: number, damping: number, reliability: number}} data
 * @param {{save?: boolean}} options
 */
export async function createSeismicPdf(data, options = {}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;
  const generated = data.generated ?? new Date().toLocaleString();

  doc.setFillColor(23, 33, 31);
  doc.rect(0, 0, pageWidth, 92, "F");
  doc.setDrawColor(230, 102, 63);
  doc.setLineWidth(4);
  doc.line(margin, 22, margin, 69);
  doc.setTextColor(247, 248, 245);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("SEISMIC", margin + 16, 43);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("STRUCTURAL RESPONSE REPORT", margin + 16, 61);
  doc.setTextColor(181, 193, 187);
  doc.text(`Generated ${generated}`, pageWidth - margin, 61, { align: "right" });

  const tableTheme = {
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, textColor: [42, 55, 50] },
    headStyles: { fillColor: [37, 59, 53], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 247, 245] },
    margin: { left: margin, right: margin },
  };

  autoTable(doc, {
    ...tableTheme,
    startY: 108,
    head: [["MODEL CONFIGURATION", "VALUE"]],
    body: [
      ["Structure", data.structure],
      ["Structural system", data.system],
      ["Stories", String(data.stories)],
      ["Story / total height", `${data.storyHeight.toFixed(1)} m / ${data.totalHeight.toFixed(1)} m`],
      ...(data.vehicleOccupancy === undefined ? [] : [["Vehicle occupancy", `${data.vehicleOccupancy}%`]]),
      ["Site class", data.siteClass],
    ],
    columnStyles: { 0: { cellWidth: 175, fontStyle: "bold" } },
  });

  autoTable(doc, {
    ...tableTheme,
    startY: doc.lastAutoTable.finalY + 10,
    head: [["GROUND MOTION", "VALUE"]],
    body: [
      ["Magnitude (M)", data.magnitude.toFixed(1)],
      ["Input intensity (I)", data.intensity.toFixed(0)],
      ["Peak amplitude (A)", `${data.amplitude.toFixed(2)} g`],
      ["Dominant frequency (f)", `${data.frequency.toFixed(1)} Hz`],
    ],
    columnStyles: { 0: { cellWidth: 175, fontStyle: "bold" } },
  });

  autoTable(doc, {
    ...tableTheme,
    startY: doc.lastAutoTable.finalY + 10,
    head: [["CALCULATED RESPONSE", "RESULT"]],
    body: [
      ["Modified Mercalli Intensity", `${data.mmiRoman} (${data.mmi.toFixed(1)}) - ${data.mmiTitle}`],
      ["MMI meaning", data.mmiLegend],
      ["Peak Ground Acceleration", `${data.pga.toFixed(3)} g (${(data.pga * 9.81).toFixed(2)} m/s2)`],
      ["Spectral Acceleration", `${data.spectralAcceleration.toFixed(2)} g`],
      ["Fundamental Period", `${data.period.toFixed(2)} s`],
      ["Interstory Drift", `${data.drift.toFixed(2)}% (limit ${data.driftLimit.toFixed(1)}%)`],
      ["Base Shear", `${data.baseShear.toFixed(1)} %W`],
      ["Damage Index", `${Math.round(data.damageScore)}% - ${data.damageLabel}`],
    ],
    columnStyles: { 0: { cellWidth: 175, fontStyle: "bold" } },
  });

  autoTable(doc, {
    ...tableTheme,
    startY: doc.lastAutoTable.finalY + 10,
    head: [["DESIGN COEFFICIENT", "VALUE"]],
    body: [
      ["Response Modification (R)", data.responseFactor.toFixed(1)],
      ["Importance Factor (Ie)", data.importanceFactor.toFixed(2)],
      ["Damping Ratio", `${data.damping.toFixed(1)}%`],
      ["Reliability Factor", data.reliability.toFixed(2)],
    ],
    columnStyles: { 0: { cellWidth: 175, fontStyle: "bold" } },
  });

  let disclaimerY = doc.lastAutoTable.finalY + 14;
  const disclaimerLines = doc.splitTextToSize(DISCLAIMER, pageWidth - margin * 2 - 20);
  if (disclaimerY + disclaimerLines.length * 11 + 50 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    disclaimerY = 52;
  }
  doc.setFillColor(249, 240, 235);
  doc.setDrawColor(230, 102, 63);
  doc.setLineWidth(2);
  doc.rect(margin, disclaimerY, pageWidth - margin * 2, disclaimerLines.length * 11 + 34, "FD");
  doc.setTextColor(109, 64, 49);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("IMPORTANT PROFESSIONAL-USE DISCLAIMER", margin + 12, disclaimerY + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(disclaimerLines, margin + 12, disclaimerY + 29);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setTextColor(125, 137, 131);
    doc.setFontSize(7);
    doc.text("Indicative educational model - simplified response relationships", margin, doc.internal.pageSize.getHeight() - 20);
    doc.text(`${page} / ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }

  if (options.save !== false) doc.save(data.filename ?? "seismic-analysis-report.pdf");
  return doc;
}
