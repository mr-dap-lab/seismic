"use client";

import { useCallback } from "react";
import { translateText, type Language } from "../lib/i18n";

const REFERENCES = [
  "Aki (1965) · Gutenberg & Richter (1944)",
  "Gardner & Knopoff (1974) · Hanks & Kanamori (1979)",
  "Kagan & Jackson (1994) · Helmstetter, Kagan & Jackson (2007)",
  "Ogata (1983, 1988, 1998) · Utsu (1961)",
  "Reasenberg & Jones (1989) · Page et al. (2016)",
  "Argus, Gordon & DeMets (2011) · DeMets, Gordon & Argus (2010)",
  "Wiemer & Wyss (2000) · Zechar, Gerstenberger & Rhoades (2010)",
];

export default function DisclaimerPanel({ language }: { language: Language }) {
  const t = useCallback((value: string) => translateText(value, language), [language]);

  return (
    <article className="disclaimer-panel" data-i18n-managed="true" aria-labelledby="disclaimer-title">
      <header>
        <span className="eyebrow">{t("LEGAL NOTICE")}</span>
        <h3 id="disclaimer-title">{t("Disclaimer and methodology disclosure")}</h3>
        <p>{t("Software: Probabilistic Seismicity Forecasting Toolkit · Version: as delivered · Document date: 16 August 2026")}</p>
      </header>

      <section className="disclaimer-alert" role="note">
        <strong>{t("LEGAL NOTICE")}</strong>
        <p>{t("This document is not legal advice. It was prepared by an AI assistant, not an attorney. Its liability language must be reviewed by qualified legal counsel before commercial, published, or client-facing use.")}</p>
      </section>

      <section>
        <h4>{t("PRIMARY DISCLAIMER")}</h4>
        <p><strong>{t("This software does not predict earthquakes.")}</strong></p>
        <p>{t("It produces probabilistic forecasts: an estimated chance of at least one event at or above a selected magnitude, inside a region and time window. It cannot state the exact place, time, or magnitude of the next earthquake.")}</p>
        <p>{t("Forecasts are statistical estimates from historical catalogs and carry substantial uncertainty. A low probability does not mean an earthquake will not occur, and a high probability does not mean one will.")}</p>
      </section>

      <section>
        <h4>{t("NON-DETERMINISM AND DATA REVISION")}</h4>
        <p>{t("Outputs use stochastic Poisson and Omori–Utsu families. Simulation, optimization, software versions, platforms, and continuously revised USGS catalog records can change results between runs.")}</p>
      </section>

      <section>
        <h4>{t("PROHIBITED AND INAPPROPRIATE USES")}</h4>
        <p>{t("For research and education only. Do not use this software for life-safety or evacuation decisions, public warnings, structural design or certification, insurance, financial products, regulatory filings, or any decision where error could cause injury or loss.")}</p>
      </section>

      <section>
        <h4>{t("METHODS AND ASSUMPTIONS")}</h4>
        <p>{t("The disclosed toolkit combines Gutenberg–Richter magnitude scaling, Aki b-values, Omori–Utsu and Reasenberg–Jones aftershock models, ETAS triggering, smoothed seismicity, declustering, tidal phase tests, plate-motion priors, Poisson models, information gain, N-tests, S-tests, and walk-forward validation.")}</p>
        <p>{t("Every default is a modeling choice, not a measurement. Different reasonable completeness magnitudes, time windows, kernels, coupling values, and training periods can produce different forecasts.")}</p>
      </section>

      <section>
        <h4>{t("SOFTWARE AND DATA")}</h4>
        <p>{t("The supplied research foundation uses Python scientific libraries and optional R packages. The website uses a simplified browser model and official USGS FDSN catalog data; it is not a full execution of every disclosed research module.")}</p>
      </section>

      <section>
        <h4>{t("KNOWN LIMITATIONS")}</h4>
        <p>{t("Important limitations include changing catalog completeness after large events, extrapolation to large magnitudes, heterogeneous magnitude types, rigid-plate assumptions, Poisson stationarity violations during aftershock sequences, approximate tidal stress, and unverified plate-motion values.")}</p>
      </section>

      <section>
        <h4>{t("VALIDATION STATUS")}</h4>
        <p>{t("The uploaded toolkit reports successful simulation checks, parameter recovery, cross-language agreement, astronomical-period checks, moment-budget comparisons, and null calibration.")}</p>
        <p className="disclaimer-validation-warning">{t("It also states that no component of that toolkit was validated against the live USGS catalog and that formal prospective CSEP testing, peer review, operational-model comparison, and full sensitivity analysis were not performed. Real-world predictive skill is unknown.")}</p>
      </section>

      <section>
        <h4>{t("LIMITATION OF LIABILITY")}</h4>
        <p>{t("The software and its outputs are provided as is, without warranties of accuracy, completeness, merchantability, fitness for a purpose, or non-infringement. The author disclaims liability to the extent permitted by applicable law.")}</p>
        <p>{t("Users are solely responsible for validating outputs, determining fitness for an intended use, and accepting the consequences of reliance.")}</p>
      </section>

      <section>
        <h4>{t("DATA ATTRIBUTION")}</h4>
        <p>{t("Earthquake data come from the United States Geological Survey Earthquake Hazards Program through the FDSN event service. Catalog data are preliminary and may be revised. The USGS does not endorse this software.")}</p>
      </section>

      <section>
        <h4>{t("REFERENCES AND CITATION CAVEAT")}</h4>
        <p>{t("The uploaded disclosure lists primary literature for the methods above. Its citation details were compiled without database verification and must be checked against the original publications before publication or filing.")}</p>
        <ul className="disclaimer-references">{REFERENCES.map((reference) => <li key={reference}>{reference}</li>)}</ul>
      </section>
    </article>
  );
}
