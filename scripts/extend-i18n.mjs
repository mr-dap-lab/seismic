import { readFile, writeFile } from "node:fs/promises";

const sourceUrl = new URL("../app/lib/i18n.tsx", import.meta.url);
const outputUrl = new URL("../app/lib/i18n-extended.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const startMarker = "const rows: Row[] = [";
const start = source.indexOf(startMarker);
const end = source.indexOf("\n];", start);
if (start < 0 || end < 0) throw new Error("Could not locate translation rows");

const arrayLiteral = source.slice(start + startMarker.length - 1, end + 2);
const rows = Function(`"use strict"; return (${arrayLiteral});`)();
const phrases = rows.map((row) => row[0]);
const targets = ["pt", "ru", "ja", "it", "de"];
const separator = "<<<SEISMIC_SEPARATOR>>>";
const manualOverrides = {
  "SPECTRAL ACCEL.": ["ACEL. ESPECTRAL", "СПЕКТРАЛЬНОЕ УСКОР.", "スペクトル加速度", "ACCEL. SPETTRALE", "SPEKTRALBESCHL."],
  "FUNDAMENTAL PERIOD": ["PERÍODO FUNDAMENTAL", "ОСНОВНОЙ ПЕРИОД", "固有周期", "PERIODO FONDAMENTALE", "GRUNDPERIODE"],
  "Fundamental Period": ["Período fundamental", "Основной период", "固有周期", "Periodo fondamentale", "Grundperiode"],
  "BASE SHEAR": ["CORTANTE BASAL", "БАЗОВАЯ ПОПЕРЕЧНАЯ СИЛА", "ベースシア", "TAGLIO ALLA BASE", "BASISSCHUB"],
  "Base Shear": ["Cortante basal", "Базовая поперечная сила", "ベースシア", "Taglio alla base", "Basisschub"],
  "INTERSTORY DRIFT": ["DERIVA ENTRE PAVIMENTOS", "МЕЖЭТАЖНЫЙ ДРЕЙФ", "層間変形角", "DERIVA INTERPIANO", "GESCHOSSDRIFT"],
  "Interstory Drift": ["Deriva entre pavimentos", "Межэтажный дрейф", "層間変形角", "Deriva interpiano", "Geschossdrift"],
  "Stories": ["Pavimentos", "Этажи", "階数", "Piani", "Geschosse"],
  "Story / total height": ["Altura do pavimento / total", "Высота этажа / общая", "階高／全高", "Altezza del piano / totale", "Geschoss- / Gesamthöhe"],
  "-story": [" andares", " этажей", "階", " piani", " Stockwerke"],
  "g, interstory drift": ["g, deriva entre pavimentos", "g, межэтажный дрейф", "g、層間変形角", "g, deriva interpiano", "g, Geschossdrift"],
  "PASS": ["APROVADO", "СООТВЕТСТВУЕТ", "合格", "SUPERATO", "BESTANDEN"],
  "EXCEEDS": ["EXCEDE", "ПРЕВЫШАЕТ", "超過", "SUPERA", "ÜBERSCHRITTEN"],
  "Peak Ground Acceleration": ["Aceleração máxima do solo", "Пиковое ускорение грунта", "最大地動加速度", "Accelerazione di picco del suolo", "Maximale Bodenbeschleunigung"],
  "Spectral Acceleration": ["Aceleração espectral", "Спектральное ускорение", "スペクトル加速度", "Accelerazione spettrale", "Spektralbeschleunigung"],
  "Damage Index": ["Índice de danos", "Индекс повреждений", "損傷指数", "Indice di danno", "Schadensindex"],
  "Hard rock": ["Rocha dura", "Твёрдая скальная порода", "硬岩", "Roccia dura", "Hartgestein"],
  "Rock": ["Rocha", "Скальная порода", "岩盤", "Roccia", "Fels"],
  "Very dense soil and soft rock": ["Solo muito denso e rocha branda", "Очень плотный грунт и мягкая скальная порода", "非常に密な地盤と軟岩", "Terreno molto denso e roccia tenera", "Sehr dichter Boden und weicher Fels"],
  "Stiff soil": ["Solo rígido", "Жёсткий грунт", "硬質地盤", "Terreno rigido", "Steifer Boden"],
  "Soft clay soil": ["Solo argiloso mole", "Мягкий глинистый грунт", "軟弱粘土地盤", "Terreno argilloso soffice", "Weicher Tonboden"],
  "m/s² peak ground": ["m/s² de aceleração máxima do solo", "м/с² пикового ускорения грунта", "m/s² 最大地動加速度", "m/s² di accelerazione di picco del suolo", "m/s² maximale Bodenbeschleunigung"],
  "Hz natural frequency": ["Hz de frequência natural", "Гц собственной частоты", "Hz 固有振動数", "Hz di frequenza naturale", "Hz Eigenfrequenz"],
  "EPICENTER MMI": ["MMI DO EPICENTRO", "MMI ЭПИЦЕНТРА", "震央MMI", "MMI DELL'EPICENTRO", "EPIZENTRUM-MMI"],
  "Indicative educational model · Simplified response spectrum · Values update continuously": ["Modelo educacional indicativo · Espectro de resposta simplificado · Valores atualizados continuamente", "Ориентировочная образовательная модель · Упрощённый спектр отклика · Значения обновляются непрерывно", "参考用教育モデル · 簡略化した応答スペクトル · 値は継続的に更新", "Modello educativo indicativo · Spettro di risposta semplificato · Valori aggiornati continuamente", "Orientierendes Lernmodell · Vereinfachtes Reaktionsspektrum · Werte werden fortlaufend aktualisiert"],
  "Light": ["Leve", "Лёгкая", "軽い", "Leggero", "Leicht"],
  "Violent": ["Violento", "Разрушительная", "激烈", "Violento", "Heftig"],
  "Extreme": ["Extremo", "Экстремальная", "極端", "Estremo", "Extrem"],
};

function makeBatches(values, maxCharacters = 3200) {
  const batches = [];
  let batch = [];
  let length = 0;
  for (const value of values) {
    const extra = value.length + separator.length + 2;
    if (batch.length && length + extra > maxCharacters) {
      batches.push(batch);
      batch = [];
      length = 0;
    }
    batch.push(value);
    length += extra;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

async function translateBatch(values, target) {
  const params = new URLSearchParams({
    client: "gtx",
    sl: "en",
    tl: target,
    dt: "t",
    q: values.join(`\n${separator}\n`),
  });
  const response = await fetch("https://translate.googleapis.com/translate_a/single", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: params,
  });
  if (!response.ok) throw new Error(`${target} translation failed: ${response.status}`);
  const payload = await response.json();
  const translated = payload[0].map((segment) => segment[0]).join("");
  const parts = translated.split(separator).map((value) => value.trim());
  if (parts.length !== values.length) throw new Error(`${target} batch returned ${parts.length} of ${values.length} phrases`);
  return parts;
}

const translatedByLanguage = {};
for (const target of targets) {
  const translated = [];
  for (const batch of makeBatches(phrases)) {
    let result;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        result = await translateBatch(batch, target);
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 600));
      }
    }
    translated.push(...result);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  translatedByLanguage[target] = translated;
}

const dictionary = Object.fromEntries(phrases.map((phrase, index) => [
  phrase,
  manualOverrides[phrase] ?? targets.map((target) => translatedByLanguage[target][index]),
]));

const output = `// Generated from the English source phrases in i18n.tsx.\n` +
  `// Order: Portuguese, Russian, Japanese, Italian, German.\n` +
  `export const extendedTranslations: Record<string, [string, string, string, string, string]> = ${JSON.stringify(dictionary, null, 2)};\n`;

await writeFile(outputUrl, output, "utf8");
console.log(`Generated ${phrases.length} phrases for ${targets.length} languages.`);
