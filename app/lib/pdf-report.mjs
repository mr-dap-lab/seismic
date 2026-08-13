const DISCLAIMER = "This report is generated from a simplified educational simulation. It does not replace the expertise, inspection, calculations, or professional judgment of a licensed structural or civil engineer. The website and its creators accept no responsibility or liability for decisions, designs, losses, injuries, or damages based on this report. Do not use this report for construction, code compliance, emergency planning, property transactions, or life-safety decisions.";
const LANGUAGE_LOCALES = { en: "en-US", es: "es-ES", fr: "fr-FR", yue: "zh-HK", hi: "hi-IN", ar: "ar-SA" };

function localizeOptions(options) {
  const language = options.language ?? "en";
  return {
    language,
    locale: LANGUAGE_LOCALES[language] ?? LANGUAGE_LOCALES.en,
    t: typeof options.translate === "function" ? options.translate : (value) => value,
  };
}

// jsPDF's built-in Helvetica font cannot represent Cantonese, Devanagari, or
// Arabic. For those reports, render text through the browser's native Unicode
// shaping engine and place it as sharp transparent PNG text on the PDF. This
// keeps the report self-contained without shipping a very large font bundle.
function enableUnicodeText(doc, language) {
  if (!["yue", "hi", "ar"].includes(language) || typeof document === "undefined") return;
  const nativeText = doc.text.bind(doc);
  doc.text = (text, x, y, options = {}, transform) => {
    if (text === undefined || text === null) return doc;
    const values = (Array.isArray(text) ? text : [text]).map(String);
    if (values.every((value) => /^[\x00-\x7F]*$/.test(value))) return nativeText(text, x, y, options, transform);
    const scale = 4;
    const fontSize = doc.getFontSize();
    const font = doc.getFont();
    const weight = /bold/i.test(font.fontStyle) ? 700 : 400;
    const lineHeight = fontSize * 1.22;
    const probe = document.createElement("canvas");
    const probeContext = probe.getContext("2d");
    if (!probeContext) return nativeText(text, x, y, options, transform);
    probeContext.font = `${weight} ${fontSize * scale}px Arial, "Noto Sans", sans-serif`;
    const width = Math.max(2, ...values.map((value) => probeContext.measureText(value).width / scale)) + 4;
    const height = Math.max(lineHeight, values.length * lineHeight) + 3;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext("2d");
    if (!context) return nativeText(text, x, y, options, transform);
    context.scale(scale, scale);
    context.font = `${weight} ${fontSize}px Arial, "Noto Sans", sans-serif`;
    context.fillStyle = doc.getTextColor();
    context.textBaseline = "alphabetic";
    context.direction = language === "ar" ? "rtl" : "ltr";
    context.textAlign = language === "ar" ? "right" : "left";
    values.forEach((value, index) => context.fillText(value, language === "ar" ? width - 2 : 2, fontSize + index * lineHeight));
    const align = options?.align ?? "left";
    const drawX = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
    doc.addImage(canvas.toDataURL("image/png"), "PNG", drawX, y - fontSize, width, height, undefined, "FAST");
    return doc;
  };
}

/**
 * Build the downloadable structural-response PDF.
 * @param {{filename?: string, generated?: string, structure: string, system: string, stories: number, storyHeight: number, totalHeight: number, vehicleOccupancy?: number, siteClass: string, magnitude: number, intensity: number, amplitude: number, frequency: number, mmiRoman: string, mmi: number, mmiTitle: string, mmiLegend: string, pga: number, spectralAcceleration: number, period: number, drift: number, driftLimit: number, baseShear: number, damageScore: number, damageLabel: string, responseFactor: number, importanceFactor: number, damping: number, reliability: number}} data
 * @param {{save?: boolean, language?: string, translate?: (value: string) => string}} options
 */
export async function createSeismicPdf(data, options = {}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const { language, locale, t } = localizeOptions(options);
  enableUnicodeText(doc, language);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;
  const generated = data.generated ?? new Date().toLocaleString(locale);

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
  doc.text(t("STRUCTURAL RESPONSE REPORT"), margin + 16, 61);
  doc.setTextColor(181, 193, 187);
  doc.text(`${t("Generated")} ${generated}`, pageWidth - margin, 61, { align: "right" });

  const tableTheme = {
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, textColor: [42, 55, 50] },
    headStyles: { fillColor: [37, 59, 53], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 247, 245] },
    margin: { left: margin, right: margin },
  };

  autoTable(doc, {
    ...tableTheme,
    startY: 108,
    head: [[t("MODEL CONFIGURATION"), t("VALUE")]],
    body: [
      [t("Structure"), data.structure],
      [t("Structural system"), data.system],
      [t("Stories"), String(data.stories)],
      [t("Story / total height"), `${data.storyHeight.toFixed(1)} m / ${data.totalHeight.toFixed(1)} m`],
      ...(data.vehicleOccupancy === undefined ? [] : [[t("Vehicle occupancy"), `${data.vehicleOccupancy}%`]]),
      [t("Site class"), data.siteClass],
    ],
    columnStyles: { 0: { cellWidth: 175, fontStyle: "bold" } },
  });

  autoTable(doc, {
    ...tableTheme,
    startY: doc.lastAutoTable.finalY + 10,
    head: [[t("GROUND MOTION"), t("VALUE")]],
    body: [
      [t("Magnitude (M)"), data.magnitude.toFixed(1)],
      [t("Input intensity (I)"), data.intensity.toFixed(0)],
      [t("Peak amplitude (A)"), `${data.amplitude.toFixed(2)} g`],
      [t("Dominant frequency (f)"), `${data.frequency.toFixed(1)} Hz`],
    ],
    columnStyles: { 0: { cellWidth: 175, fontStyle: "bold" } },
  });

  autoTable(doc, {
    ...tableTheme,
    startY: doc.lastAutoTable.finalY + 10,
    head: [[t("CALCULATED RESPONSE"), t("RESULT")]],
    body: [
      [t("Modified Mercalli Intensity"), `${data.mmiRoman} (${data.mmi.toFixed(1)}) - ${data.mmiTitle}`],
      [t("MMI meaning"), data.mmiLegend],
      [t("Peak Ground Acceleration"), `${data.pga.toFixed(3)} g (${(data.pga * 9.81).toFixed(2)} m/s2)`],
      [t("Spectral Acceleration"), `${data.spectralAcceleration.toFixed(2)} g`],
      [t("Fundamental Period"), `${data.period.toFixed(2)} s`],
      [t("Interstory Drift"), `${data.drift.toFixed(2)}% (${t("limit")} ${data.driftLimit.toFixed(1)}%)`],
      [t("Base Shear"), `${data.baseShear.toFixed(1)} %W`],
      [t("Damage Index"), `${Math.round(data.damageScore)}% - ${data.damageLabel}`],
    ],
    columnStyles: { 0: { cellWidth: 175, fontStyle: "bold" } },
  });

  autoTable(doc, {
    ...tableTheme,
    startY: doc.lastAutoTable.finalY + 10,
    head: [[t("DESIGN COEFFICIENT"), t("VALUE")]],
    body: [
      [t("Response Modification (R)"), data.responseFactor.toFixed(1)],
      [t("Importance Factor (Ie)"), data.importanceFactor.toFixed(2)],
      [t("Damping ratio"), `${data.damping.toFixed(1)}%`],
      [t("Reliability factor"), data.reliability.toFixed(2)],
    ],
    columnStyles: { 0: { cellWidth: 175, fontStyle: "bold" } },
  });

  let disclaimerY = doc.lastAutoTable.finalY + 14;
  const disclaimerLines = doc.splitTextToSize(t(DISCLAIMER), pageWidth - margin * 2 - 20);
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
  doc.text(t("IMPORTANT PROFESSIONAL-USE DISCLAIMER"), margin + 12, disclaimerY + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(disclaimerLines, margin + 12, disclaimerY + 29);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setTextColor(125, 137, 131);
    doc.setFontSize(7);
    doc.text(t("Indicative educational model - simplified response relationships"), margin, doc.internal.pageSize.getHeight() - 20);
    doc.text(`${page} / ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }

  if (options.save !== false) doc.save(data.filename ?? "seismic-analysis-report.pdf");
  return doc;
}

/**
 * Build the downloadable regional-impact PDF.
 * @param {{filename?: string, generated?: string, location: string, latitude: number, longitude: number, magnitude: number, focalDepth: number, analysisRadius: number, siteClass: string, siteFactor: number, mmi: number, epicenterPga: number, edgePga: number, highRadius: number, moderateRadius: number, lowRadius: number, mapImage?: string}} data
 * @param {{save?: boolean, language?: string, translate?: (value: string) => string}} options
 */
export async function createRegionalPdf(data, options = {}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape", compress: true });
  const { language, locale, t } = localizeOptions(options);
  enableUnicodeText(doc, language);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 38;
  const generated = data.generated ?? new Date().toLocaleString(locale);

  const drawHeader = (subtitle) => {
    doc.setFillColor(23, 33, 31);
    doc.rect(0, 0, pageWidth, 74, "F");
    doc.setDrawColor(230, 102, 63);
    doc.setLineWidth(4);
    doc.line(margin, 18, margin, 57);
    doc.setTextColor(247, 248, 245);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("SEISMIC", margin + 15, 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(subtitle, margin + 15, 52);
    doc.setTextColor(181, 193, 187);
    doc.text(`${t("Generated")} ${generated}`, pageWidth - margin, 48, { align: "right" });
  };

  drawHeader(t("REGIONAL EARTHQUAKE IMPACT REPORT"));
  doc.setTextColor(34, 48, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(data.location, margin, 98, { maxWidth: pageWidth - margin * 2 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(103, 118, 111);
  doc.text(`${t("Epicenter")} ${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)} · ${t("Map data © OpenStreetMap contributors")}`, margin, 113);

  const mapX = margin;
  const mapY = 127;
  const mapWidth = 470;
  const mapHeight = 315;
  doc.setFillColor(232, 237, 234);
  doc.setDrawColor(194, 204, 199);
  doc.rect(mapX, mapY, mapWidth, mapHeight, "FD");
  if (data.mapImage) {
    try { doc.addImage(data.mapImage, "JPEG", mapX, mapY, mapWidth, mapHeight, undefined, "FAST"); } catch { /* retain map placeholder */ }
  } else {
    doc.setTextColor(101, 116, 109);
    doc.setFontSize(9);
    doc.text(t("Map image unavailable in this browser"), mapX + mapWidth / 2, mapY + mapHeight / 2, { align: "center" });
  }

  autoTable(doc, {
    startY: mapY,
    margin: { left: 530, right: margin },
    tableWidth: pageWidth - 530 - margin,
    head: [[t("SCENARIO INPUT"), t("VALUE")]],
    body: [
      [t("Magnitude"), data.magnitude.toFixed(1)],
      [t("Focal depth"), `${data.focalDepth.toFixed(0)} km`],
      [t("Analysis radius"), `${data.analysisRadius.toFixed(0)} km`],
      [t("Representative site class"), `${t("Class")} ${data.siteClass} (× ${data.siteFactor.toFixed(2)})`],
      [t("Epicenter MMI"), `${data.mmi.toFixed(1)}`],
      [t("Epicenter PGA"), `${data.epicenterPga.toFixed(3)} g`],
      [t("Outer-edge PGA"), `${data.edgePga.toFixed(3)} g`],
    ],
    styles: { font: "helvetica", fontSize: 8, cellPadding: 5, textColor: [42, 55, 50] },
    headStyles: { fillColor: [37, 59, 53], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [244, 247, 245] },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 12,
    margin: { left: 530, right: margin },
    tableWidth: pageWidth - 530 - margin,
    head: [[t("IMPACT RING"), t("MODELED RADIUS")]],
    body: [
      [t("Highest motion"), `${data.highRadius.toFixed(1)} km`],
      [t("Moderate motion"), `${data.moderateRadius.toFixed(1)} km`],
      [t("Lower motion"), `${data.lowRadius.toFixed(1)} km`],
      [t("Modeled area"), `${Math.round(Math.PI * data.lowRadius ** 2).toLocaleString(locale)} km²`],
    ],
    styles: { font: "helvetica", fontSize: 8, cellPadding: 5, textColor: [42, 55, 50] },
    headStyles: { fillColor: [84, 105, 96], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [244, 247, 245] },
  });

  doc.addPage("letter", "landscape");
  drawHeader(t("MODEL SCOPE & PROFESSIONAL-USE NOTICE"));
  doc.setFillColor(249, 240, 235);
  doc.setDrawColor(230, 102, 63);
  doc.setLineWidth(2);
  doc.rect(margin, 105, pageWidth - margin * 2, 126, "FD");
  doc.setTextColor(109, 64, 49);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(t("IMPORTANT PROFESSIONAL-USE DISCLAIMER"), margin + 16, 128);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(t(DISCLAIMER), pageWidth - margin * 2 - 32), margin + 16, 148);
  doc.setTextColor(64, 79, 72);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(t("Regional model limitations"), margin, 270);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(t("Impact rings use simplified attenuation, a uniform representative site class, and screening thresholds. They do not account for fault geometry, topography, basin effects, liquefaction, landslides, infrastructure condition, building inventory, or official hazard products. Location detection is used only in the browser to select an initial area."), pageWidth - margin * 2), margin, 292);

  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    doc.setTextColor(125, 137, 131);
    doc.setFontSize(7);
    doc.text(t("Indicative educational screening model · Not for engineering or emergency decisions"), margin, pageHeight - 19);
    doc.text(`${page} / ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 19, { align: "right" });
  }

  if (options.save !== false) doc.save(data.filename ?? "seismic-regional-impact-report.pdf");
  return doc;
}
