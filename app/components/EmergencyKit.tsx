"use client";

import { useEffect, useMemo, useState } from "react";
import { translateText, type Language } from "../lib/i18n";
import { safeStorageGet, safeStorageSet } from "../lib/browser-compat";

type KitCategory = {
  id: string;
  title: string;
  description: string;
  items: { id: string; label: string }[];
};

const KIT_CATEGORIES: KitCategory[] = [
  {
    id: "water-food",
    title: "Water & food",
    description: "Store safe drinking water and food that can be prepared without utilities.",
    items: [
      { id: "water", label: "Drinking water" },
      { id: "food", label: "Non-perishable, easy-to-prepare food" },
      { id: "can-opener", label: "Manual can opener" },
      { id: "utensils", label: "Reusable cups, plates and utensils" },
    ],
  },
  {
    id: "health-hygiene",
    title: "Health & hygiene",
    description: "Prepare for injuries, routine health needs and limited sanitation.",
    items: [
      { id: "first-aid", label: "First aid kit" },
      { id: "medications", label: "Prescription medications and medical supplies" },
      { id: "hygiene", label: "Sanitation and personal hygiene items" },
      { id: "masks", label: "Protective masks" },
    ],
  },
  {
    id: "power-communication",
    title: "Light, power & communication",
    description: "Keep essential information and communication available during outages.",
    items: [
      { id: "flashlight", label: "Flashlights" },
      { id: "radio", label: "Battery-powered or hand-crank radio" },
      { id: "batteries", label: "Extra batteries and charged power banks" },
      { id: "chargers", label: "Mobile phone chargers" },
      { id: "whistle", label: "Emergency whistle" },
    ],
  },
  {
    id: "documents-money",
    title: "Documents & money",
    description: "Protect the information needed to identify, communicate and recover.",
    items: [
      { id: "documents", label: "Copies of identification, insurance and medical information" },
      { id: "contacts", label: "Family and emergency contact information" },
      { id: "cash", label: "Emergency cash in small denominations" },
      { id: "maps", label: "Local paper maps" },
    ],
  },
  {
    id: "shelter-tools",
    title: "Shelter, clothing & tools",
    description: "Include portable protection, practical tools and durable clothing.",
    items: [
      { id: "blankets", label: "Emergency blankets or sleeping bags" },
      { id: "clothing", label: "Seasonal clothing, rain gear and sturdy shoes" },
      { id: "tool", label: "Multi-purpose tool" },
      { id: "gloves", label: "Work gloves, duct tape and basic tools" },
      { id: "keys", label: "Spare home and vehicle keys" },
    ],
  },
  {
    id: "personal-needs",
    title: "Personal & household needs",
    description: "Adapt the kit for every person and animal in your household.",
    items: [
      { id: "accessibility", label: "Accessibility, mobility, hearing or vision supplies" },
      { id: "infant", label: "Infant, child or older-adult supplies" },
      { id: "pets", label: "Pet food, water, medications, leash and carrier" },
      { id: "comfort", label: "Comfort items and activities for children" },
    ],
  },
];

const STORAGE_KEY = "seismic-emergency-kit";

export default function EmergencyKit({ language }: { language: Language }) {
  const t = (value: string) => translateText(value, language);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [storageReady, setStorageReady] = useState(false);
  const [householdSize, setHouseholdSize] = useState(2);
  const [planningDays, setPlanningDays] = useState(14);

  const allItems = useMemo(() => KIT_CATEGORIES.flatMap((category) => category.items), []);
  const completedCount = allItems.filter((item) => checkedItems.has(item.id)).length;
  const progress = Math.round((completedCount / allItems.length) * 100);
  const waterLiters = Math.round(householdSize * planningDays * 3.8);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(safeStorageGet(STORAGE_KEY) ?? "[]") as string[];
        setCheckedItems(new Set(saved));
      } catch {
        setCheckedItems(new Set());
      }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    safeStorageSet(STORAGE_KEY, JSON.stringify([...checkedItems]));
  }, [checkedItems, storageReady]);

  const toggleItem = (itemId: string) => {
    setCheckedItems((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleCategory = (category: KitCategory) => {
    const complete = category.items.every((item) => checkedItems.has(item.id));
    setCheckedItems((current) => {
      const next = new Set(current);
      category.items.forEach((item) => complete ? next.delete(item.id) : next.add(item.id));
      return next;
    });
  };

  const resetChecklist = () => setCheckedItems(new Set());

  return (
    <section className="emergency-kit-shell">
      <div className="kit-hero-band">
        <header className="kit-hero">
          <div className="kit-hero-copy">
            <span className="kit-kicker"><i />{t("HOUSEHOLD PREPAREDNESS")}</span>
            <h1>{t("Emergency kit checklist")}</h1>
            <p>{t("Build a practical supply kit for disasters and outages. Your progress is saved on this device so you can prepare over time.")}</p>
            <div className="kit-hero-actions">
              <button type="button" onClick={resetChecklist} disabled={completedCount === 0}>{t("Reset checklist")}</button>
              <a href="https://www.redcross.org/get-help/how-to-prepare-for-emergencies/survival-kit-supplies.html" target="_blank" rel="noreferrer">{t("Official preparedness guidance")} ↗</a>
            </div>
          </div>

          <aside className="kit-progress-card" role="status" aria-live="polite" aria-atomic="true" aria-label={t("Emergency kit progress") }>
            <div className="kit-progress-ring" style={{ "--kit-progress": `${progress * 3.6}deg` } as React.CSSProperties}>
              <strong>{progress}%</strong>
              <span>{t("ready")}</span>
            </div>
            <div className="kit-progress-copy">
              <span>{t("Items collected")}</span>
              <strong>{completedCount} / {allItems.length}</strong>
              <div className="kit-progress-track"><i style={{ width: `${progress}%` }} /></div>
            </div>
          </aside>
        </header>
      </div>

      <div className="kit-body">
      <div className="kit-planning-bar">
        <div>
          <span className="eyebrow">{t("HOUSEHOLD PLAN")}</span>
          <strong>{t("Size your basic supplies")}</strong>
        </div>
        <label>
          <span>{t("People in household")}</span>
          <select value={householdSize} onChange={(event) => setHouseholdSize(Number(event.target.value))}>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>{t("Planning days")}</span>
          <select value={planningDays} onChange={(event) => setPlanningDays(Number(event.target.value))}>
            {[3, 7, 14].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <div className="kit-water-estimate">
          <span>{t("Water planning baseline")}</span>
          <strong>{waterLiters} L</strong>
          <small>{t("About 3.8 L per person per day")}</small>
        </div>
      </div>

      <div className="kit-content">
        <div className="kit-section-title">
          <div><span className="eyebrow">{t("CORE SUPPLIES")}</span><h2>{t("Prepare category by category")}</h2></div>
          <p>{t("Check each item when it is stored, usable and easy to reach. Review expiration dates regularly.")}</p>
        </div>

        <div className="kit-category-grid">
          {KIT_CATEGORIES.map((category, categoryIndex) => {
            const categoryCompleted = category.items.filter((item) => checkedItems.has(item.id)).length;
            const categoryIsComplete = categoryCompleted === category.items.length;
            return (
              <article className={`kit-category-card${categoryIsComplete ? " complete" : ""}`} key={category.id}>
                <header>
                  <span className="kit-category-number">{String(categoryIndex + 1).padStart(2, "0")}</span>
                  <div><h3>{t(category.title)}</h3><p>{t(category.description)}</p></div>
                  <strong>{categoryCompleted}/{category.items.length}</strong>
                </header>
                <div className="kit-checklist">
                  {category.items.map((item) => (
                    <label className={checkedItems.has(item.id) ? "checked" : ""} key={item.id}>
                      <input type="checkbox" checked={checkedItems.has(item.id)} onChange={() => toggleItem(item.id)} />
                      <i aria-hidden="true">✓</i>
                      <span>{t(item.label)}</span>
                    </label>
                  ))}
                </div>
                <button type="button" className="kit-category-toggle" onClick={() => toggleCategory(category)}>
                  {t(categoryIsComplete ? "Clear category" : "Mark category complete")}
                </button>
              </article>
            );
          })}
        </div>

        <aside className="kit-guidance-note">
          <strong>{t("Adapt this checklist to your household")}</strong>
          <p>{t("This educational checklist is a starting point, not emergency or medical advice. Add supplies for local hazards, climate, disabilities, prescriptions, infants, older adults and pets. Follow instructions from your local emergency authorities.")}</p>
        </aside>
      </div>
      </div>
    </section>
  );
}
