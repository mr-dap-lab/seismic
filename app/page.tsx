"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ParameterLabel } from "./components/ParameterTooltip";
import RegionalSimulator from "./components/RegionalSimulator";
import { createSeismicPdf } from "./lib/pdf-report.mjs";

type StructureType = "concrete" | "steel" | "masonry" | "timber";
type SiteClass = "A" | "B" | "C" | "D" | "E" | "F";
type StructureKind = "building" | "house" | "garage" | "shed" | "skyscraper" | "warehouse" | "mall" | "bridge" | "tower" | "tunnel" | "parkingGarage" | "parkingStructure" | "carPark";
type ViewAction = "in" | "out" | "fit";
type ViewCommand = { id: number; action: ViewAction };
type HelpTab = "guide" | "walkthrough" | "contact";

const LINKEDIN_URL = "https://www.linkedin.com/in/diego-avella/";

const TOUR_STEPS = [
  { target: "inputs", eyebrow: "Step 1 of 5", title: "Define the scenario", body: "Use Ground motion for the earthquake and soil inputs. Open Structure to choose the asset, framing system, floors, damping, and design factors." },
  { target: "viewport", eyebrow: "Step 2 of 5", title: "Inspect the response", body: "Drag the model to orbit it, scroll or pinch to zoom, and watch each story respond to the selected frequency and amplitude." },
  { target: "playback", eyebrow: "Step 3 of 5", title: "Control the simulation", body: "Pause, restart, or change playback speed. The +, −, and fit buttons provide precise camera control." },
  { target: "results", eyebrow: "Step 4 of 5", title: "Read the engineering metrics", body: "MMI, PGA, spectral acceleration, fundamental period, base shear, drift, and damage update automatically as inputs change." },
  { target: "report", eyebrow: "Step 5 of 5", title: "Export the current study", body: "Download a plain-language analysis report containing the complete configuration, calculated results, and professional-use disclaimer." },
] as const;

type SimulationConfig = {
  magnitude: number;
  intensity: number;
  amplitude: number;
  frequency: number;
  floors: number;
  floorHeight: number;
  structure: StructureType;
  structureKind: StructureKind;
  vehicleOccupancy: number;
  siteClass: SiteClass;
  damping: number;
  driftLimit: number;
  responseFactor: number;
  importanceFactor: number;
  reliability: number;
};

type Metrics = {
  mmi: number;
  mmiRoman: string;
  mmiTitle: string;
  mmiLegend: string;
  pga: number;
  spectralAcceleration: number;
  period: number;
  drift: number;
  baseShear: number;
  damageScore: number;
  damageLabel: string;
  damageColor: string;
  resonance: number;
};

const DEFAULT_CONFIG: SimulationConfig = {
  magnitude: 7.2,
  intensity: 8,
  amplitude: 0.34,
  frequency: 1.1,
  floors: 14,
  floorHeight: 3.2,
  structure: "concrete",
  structureKind: "building",
  vehicleOccupancy: 65,
  siteClass: "D",
  damping: 5,
  driftLimit: 2,
  responseFactor: 5,
  importanceFactor: 1,
  reliability: 1,
};

const SITE_FACTORS: Record<SiteClass, number> = {
  A: 0.72,
  B: 0.85,
  C: 1,
  D: 1.22,
  E: 1.48,
  F: 1.75,
};

const STRUCTURES: Record<StructureType, { label: string; periodC: number; stiffness: number; defaultR: number }> = {
  concrete: { label: "RC moment frame", periodC: 0.075, stiffness: 1, defaultR: 5 },
  steel: { label: "Steel braced frame", periodC: 0.068, stiffness: 1.22, defaultR: 6 },
  masonry: { label: "Reinforced masonry", periodC: 0.05, stiffness: 1.32, defaultR: 3.5 },
  timber: { label: "Timber frame", periodC: 0.048, stiffness: 0.78, defaultR: 6.5 },
};

const STRUCTURE_KINDS: Record<StructureKind, {
  label: string;
  minFloors: number;
  maxFloors: number;
  defaultFloors: number;
  width: number;
  depth: number;
  periodFactor: number;
  massFactor: number;
  recommendedSystem: StructureType;
}> = {
  building: { label: "Building", minFloors: 3, maxFloors: 40, defaultFloors: 14, width: 10.6, depth: 7.8, periodFactor: 1, massFactor: 1, recommendedSystem: "concrete" },
  house: { label: "House", minFloors: 1, maxFloors: 3, defaultFloors: 2, width: 10, depth: 8, periodFactor: 0.72, massFactor: 0.72, recommendedSystem: "timber" },
  garage: { label: "Garage", minFloors: 1, maxFloors: 2, defaultFloors: 1, width: 11, depth: 8.5, periodFactor: 0.62, massFactor: 0.7, recommendedSystem: "masonry" },
  shed: { label: "Shed", minFloors: 1, maxFloors: 1, defaultFloors: 1, width: 9, depth: 7, periodFactor: 0.55, massFactor: 0.48, recommendedSystem: "steel" },
  skyscraper: { label: "Skyscraper", minFloors: 20, maxFloors: 60, defaultFloors: 32, width: 8.6, depth: 6.8, periodFactor: 1.32, massFactor: 1.08, recommendedSystem: "steel" },
  warehouse: { label: "Warehouse", minFloors: 1, maxFloors: 4, defaultFloors: 2, width: 20, depth: 13, periodFactor: 0.78, massFactor: 1.18, recommendedSystem: "steel" },
  mall: { label: "Mall", minFloors: 2, maxFloors: 8, defaultFloors: 4, width: 18, depth: 13, periodFactor: 0.9, massFactor: 1.32, recommendedSystem: "concrete" },
  bridge: { label: "Bridge", minFloors: 1, maxFloors: 2, defaultFloors: 1, width: 29, depth: 7, periodFactor: 1.25, massFactor: 1.38, recommendedSystem: "steel" },
  tower: { label: "Tower", minFloors: 5, maxFloors: 35, defaultFloors: 16, width: 5.5, depth: 5.5, periodFactor: 1.18, massFactor: 0.58, recommendedSystem: "steel" },
  tunnel: { label: "Tunnel", minFloors: 1, maxFloors: 1, defaultFloors: 1, width: 18, depth: 12, periodFactor: 0.5, massFactor: 1.5, recommendedSystem: "concrete" },
  parkingGarage: { label: "Parking garage", minFloors: 2, maxFloors: 12, defaultFloors: 5, width: 16, depth: 11, periodFactor: 0.92, massFactor: 1.12, recommendedSystem: "concrete" },
  parkingStructure: { label: "Parking structure", minFloors: 2, maxFloors: 15, defaultFloors: 7, width: 17, depth: 12, periodFactor: 0.96, massFactor: 1.08, recommendedSystem: "concrete" },
  carPark: { label: "Multi-story car park", minFloors: 2, maxFloors: 15, defaultFloors: 6, width: 17, depth: 12, periodFactor: 1, massFactor: 1.08, recommendedSystem: "concrete" },
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const MMI_LEGENDS = [
  ["Not felt", "Detected only by sensitive instruments."],
  ["Very weak", "Felt by a few people at rest, especially upstairs."],
  ["Weak", "Noticeable indoors; hanging objects may swing."],
  ["Light", "Felt by many; dishes and windows rattle."],
  ["Moderate", "Felt by nearly everyone; unstable objects may fall."],
  ["Strong", "Slight damage; plaster may crack and furniture moves."],
  ["Very strong", "Moderate damage in vulnerable buildings."],
  ["Severe", "Considerable damage in ordinary structures."],
  ["Violent", "Heavy damage; buildings can shift off foundations."],
  ["Extreme", "Many structures destroyed; rails may bend."],
  ["Extreme", "Few masonry structures remain standing."],
  ["Extreme", "Near-total destruction; ground surface distorted."],
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function calculateMetrics(config: SimulationConfig): Metrics {
  const height = config.floors * config.floorHeight;
  const structure = STRUCTURES[config.structure];
  const kind = STRUCTURE_KINDS[config.structureKind];
  const vehicleMassFactor = config.structureKind === "carPark" ? 1 + (config.vehicleOccupancy / 100) * 0.2 : 1;
  const effectiveMassFactor = kind.massFactor * vehicleMassFactor;
  const period = clamp(structure.periodC * Math.pow(height, 0.75) * kind.periodFactor * Math.sqrt(effectiveMassFactor) / Math.sqrt(structure.stiffness), 0.12, 4.5);
  const siteFactor = SITE_FACTORS[config.siteClass];
  const magnitudeFactor = clamp(0.76 + (config.magnitude - 5) * 0.085, 0.55, 1.12);
  const intensityFactor = 0.72 + config.intensity * 0.035;
  const pga = clamp(config.amplitude * siteFactor * magnitudeFactor * intensityFactor, 0.005, 2.5);
  const damping = config.damping / 100;
  const resonanceRatio = config.frequency * period;
  const dynamicAmplification = 1 / Math.sqrt(
    Math.pow(1 - resonanceRatio * resonanceRatio, 2) + Math.pow(2 * damping * resonanceRatio, 2),
  );
  const spectralAcceleration = clamp(pga * Math.min(dynamicAmplification, 4.25), pga * 0.35, 4);
  const spectralDisplacement = (spectralAcceleration * 9.81 * period * period) / (4 * Math.PI * Math.PI);
  const modalParticipation = 1.18 / Math.sqrt(config.reliability);
  const drift = clamp(
    (spectralDisplacement / height) * 100 * 1.5 * modalParticipation * (1.1 / structure.stiffness),
    0.03,
    12,
  );
  const baseShear = clamp((spectralAcceleration * config.importanceFactor * effectiveMassFactor * 100) / config.responseFactor, 0.1, 100);
  const pgaCms = pga * 980.665;
  const instrumentalMmi = pgaCms > 80
    ? 3.66 * Math.log10(pgaCms) - 1.66
    : 2.2 * Math.log10(pgaCms) + 1;
  const mmi = clamp(instrumentalMmi * 0.58 + config.intensity * 0.42, 1, 12);
  const mmiIndex = clamp(Math.round(mmi), 1, 12) - 1;
  const driftDemand = drift / config.driftLimit;
  const rawDamage = (driftDemand * 57 + Math.max(0, pga - 0.25) * 36 + Math.max(0, config.magnitude - 7) * 7) * Math.sqrt(effectiveMassFactor) /
    config.reliability;
  const damageScore = clamp(rawDamage, 0, 100);
  let damageLabel = "Operational";
  let damageColor = "#56d68b";
  if (damageScore >= 75) {
    damageLabel = "Severe / collapse risk";
    damageColor = "#ff5f56";
  } else if (damageScore >= 50) {
    damageLabel = "Extensive damage";
    damageColor = "#ff8a50";
  } else if (damageScore >= 25) {
    damageLabel = "Moderate damage";
    damageColor = "#f1c75b";
  } else if (damageScore >= 10) {
    damageLabel = "Slight damage";
    damageColor = "#9bd071";
  }

  return {
    mmi,
    mmiRoman: ROMAN[mmiIndex],
    mmiTitle: MMI_LEGENDS[mmiIndex][0],
    mmiLegend: MMI_LEGENDS[mmiIndex][1],
    pga,
    spectralAcceleration,
    period,
    drift,
    baseShear,
    damageScore,
    damageLabel,
    damageColor,
    resonance: dynamicAmplification,
  };
}

function formatNumber(value: number, digits = 2) {
  return value.toFixed(digits);
}

function RangeControl({
  label,
  symbol,
  value,
  min,
  max,
  step,
  unit,
  description,
  onChange,
}: {
  label: string;
  symbol?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  description: string;
  onChange: (value: number) => void;
}) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <label className="control-block">
      <span className="control-heading">
        <ParameterLabel label={label} symbol={symbol} description={description} />
        <strong>{value}{unit}</strong>
      </span>
      <input
        aria-label={label}
        className="range-control"
        style={{ "--range-progress": `${progress}%` } as React.CSSProperties}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="range-labels"><small>{min}{unit}</small><small>{max}{unit}</small></span>
    </label>
  );
}

function SelectControl({
  label,
  value,
  options,
  description,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  description: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="select-control">
      <ParameterLabel label={label} description={description} />
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function MetricCard({ label, value, unit, note, accent = false }: { label: string; value: string; unit?: string; note: string; accent?: boolean }) {
  return (
    <div className={`metric-card${accent ? " metric-card-accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}<small>{unit}</small></strong>
      <p>{note}</p>
    </div>
  );
}

function EarthquakeScene({
  config,
  metrics,
  running,
  speed,
  resetSignal,
  viewCommand,
  onTime,
}: {
  config: SimulationConfig;
  metrics: Metrics;
  running: boolean;
  speed: number;
  resetSignal: number;
  viewCommand: ViewCommand;
  onTime: (time: number) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef({ config, metrics, running, speed, resetSignal, viewCommand, onTime });

  useEffect(() => {
    liveRef.current = { config, metrics, running, speed, resetSignal, viewCommand, onTime };
  }, [config, metrics, running, speed, resetSignal, viewCommand, onTime]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const profile = STRUCTURE_KINDS[config.structureKind];
    const storyHeight = 1.45;
    const width = profile.width;
    const depth = profile.depth;
    const isWide = ["bridge", "tunnel", "warehouse", "mall"].includes(config.structureKind);
    const visualHeight = config.structureKind === "bridge" ? 7.2 : config.structureKind === "tunnel" ? 6.4 : config.floors * storyHeight + 2.1;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#17211f");
    scene.fog = new THREE.Fog("#17211f", 50, 165);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 320);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 180;
    controls.maxPolarAngle = Math.PI * 0.49;

    const modelTargetHeight = config.structureKind === "bridge" ? 2.8 : config.structureKind === "tunnel" ? 2.5 : Math.max(1.4, visualHeight * 0.44);
    const fitCamera = () => {
      const mobile = mount.clientWidth < 560;
      const span = Math.max(width * (isWide ? 1.15 : 1), depth, visualHeight * (mobile ? 1.18 : 0.82));
      const distance = clamp(span * (mobile ? 1.82 : 1.48), 17, 140);
      controls.target.set(0, modelTargetHeight, 0);
      const direction = isWide ? new THREE.Vector3(0.58, 0.34, 0.76) : new THREE.Vector3(0.55, 0.34, 0.78);
      direction.normalize().multiplyScalar(distance);
      camera.position.copy(controls.target).add(direction);
      camera.lookAt(controls.target);
      controls.update();
    };

    scene.add(new THREE.HemisphereLight("#eaf5ee", "#293530", 2.6));
    const keyLight = new THREE.DirectionalLight("#fff3cf", 4.6);
    keyLight.position.set(-24, 38, 25);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -38;
    keyLight.shadow.camera.right = 38;
    keyLight.shadow.camera.top = 60;
    keyLight.shadow.camera.bottom = -10;
    scene.add(keyLight);

    const groundGroup = new THREE.Group();
    scene.add(groundGroup);
    const groundSize = Math.max(58, width * 2.45);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: "#34413c", roughness: 0.94, metalness: 0.02 });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(groundSize, 0.7, Math.max(46, depth * 2.5)), groundMaterial);
    ground.position.y = -0.55;
    ground.receiveShadow = true;
    groundGroup.add(ground);

    const grid = new THREE.GridHelper(groundSize, 24, "#6b786f", "#44514b");
    grid.position.y = -0.18;
    (grid.material as THREE.Material).opacity = 0.42;
    (grid.material as THREE.Material).transparent = true;
    groundGroup.add(grid);

    const structureColors: Record<StructureType, { frame: string; slab: string; facade: string; glass: string }> = {
      concrete: { frame: "#d5cfb8", slab: "#9d9787", facade: "#d8d4c3", glass: "#82a8a2" },
      steel: { frame: "#c36c43", slab: "#696e68", facade: "#c1bbb0", glass: "#6f9d9a" },
      masonry: { frame: "#b77a5a", slab: "#8b8176", facade: "#c99a78", glass: "#7d9d97" },
      timber: { frame: "#aa744f", slab: "#7f5d44", facade: "#c7996f", glass: "#7f9f99" },
    };
    const palette = structureColors[config.structure];
    const frameMaterial = new THREE.MeshStandardMaterial({ color: palette.frame, roughness: 0.63, metalness: config.structure === "steel" ? 0.42 : 0.04 });
    const slabMaterial = new THREE.MeshStandardMaterial({ color: palette.slab, roughness: 0.83 });
    const facadeMaterial = new THREE.MeshStandardMaterial({ color: palette.facade, roughness: 0.72 });
    const glassMaterial = new THREE.MeshPhysicalMaterial({ color: palette.glass, roughness: 0.2, metalness: 0.08, transmission: 0.14, transparent: true, opacity: 0.84 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: "#303b37", roughness: 0.78, metalness: 0.08 });
    const roadMaterial = new THREE.MeshStandardMaterial({ color: "#252d2a", roughness: 0.92 });
    const lineMaterial = new THREE.MeshStandardMaterial({ color: "#dfd3a6", roughness: 0.8 });
    const damageMaterial = new THREE.MeshStandardMaterial({ color: metrics.damageColor, emissive: metrics.damageColor, emissiveIntensity: 0.32, roughness: 0.6 });
    const carMaterials = ["#c95f43", "#d2c8aa", "#5c8780", "#54708b", "#8e6c55", "#393f3d"].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.28 }));

    const model = new THREE.Group();
    groundGroup.add(model);
    const floorGroups: THREE.Group[] = [];
    const box = (w: number, h: number, d: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };
    const addCar = (parent: THREE.Group, x: number, y: number, z: number, index: number, rotation = 0) => {
      const car = new THREE.Group();
      const body = box(0.82, 0.28, 1.55, carMaterials[index % carMaterials.length]);
      body.position.y = 0.22;
      const roof = box(0.58, 0.23, 0.82, carMaterials[index % carMaterials.length]);
      roof.position.set(0, 0.46, -0.06);
      car.add(body, roof);
      car.position.set(x, y, z);
      car.rotation.y = rotation;
      parent.add(car);
    };

    const foundationMaterial = new THREE.MeshStandardMaterial({ color: "#a59b82", roughness: 0.82 });
    if (config.structureKind !== "bridge" && config.structureKind !== "tunnel") {
      const foundation = box(width + 1.8, 0.8, depth + 1.8, foundationMaterial);
      foundation.position.y = 0.22;
      groundGroup.add(foundation);
    }

    if (config.structureKind === "bridge") {
      [-10, 0, 10].forEach((x) => {
        const pier = box(1.35, 4.8, 3.7, foundationMaterial);
        pier.position.set(x, 2.15, 0);
        groundGroup.add(pier);
      });
      const bridge = new THREE.Group();
      bridge.position.y = 4.55;
      model.add(bridge);
      floorGroups.push(bridge);
      bridge.add(box(width, 0.65, depth, slabMaterial));
      const roadway = box(width - 0.5, 0.08, depth - 1, roadMaterial);
      roadway.position.y = 0.37;
      bridge.add(roadway);
      [-depth / 2 + 0.35, depth / 2 - 0.35].forEach((z) => {
        const rail = box(width, 0.42, 0.12, frameMaterial);
        rail.position.set(0, 0.7, z);
        bridge.add(rail);
      });
      for (let i = -12; i <= 12; i += 3) {
        const lane = box(0.08, 0.02, 1.2, lineMaterial);
        lane.position.set(i, 0.43, 0);
        bridge.add(lane);
      }
      [-9, 9].forEach((x) => {
        [-2.5, 2.5].forEach((z) => {
          const mast = box(0.42, 5.1, 0.42, frameMaterial);
          mast.position.set(x, 2.9, z);
          bridge.add(mast);
        });
      });
      addCar(bridge, -4, 0.43, -1.5, 0, Math.PI / 2);
      addCar(bridge, 5, 0.43, 1.5, 2, Math.PI / 2);
    } else if (config.structureKind === "tunnel") {
      const tunnel = new THREE.Group();
      tunnel.position.y = 0.25;
      model.add(tunnel);
      floorGroups.push(tunnel);
      const road = box(width, 0.22, depth, roadMaterial);
      road.position.y = 0.05;
      tunnel.add(road);
      for (let z = -depth / 2; z <= depth / 2; z += 1.5) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(5.1, 0.32, 8, 36, Math.PI), frameMaterial);
        arch.position.set(0, 0.2, z);
        arch.castShadow = true;
        tunnel.add(arch);
      }
      [-2.3, 2.3].forEach((x) => {
        const curb = box(0.18, 0.16, depth, lineMaterial);
        curb.position.set(x, 0.22, 0);
        tunnel.add(curb);
      });
      addCar(tunnel, -1.2, 0.24, -2.2, 1);
      addCar(tunnel, 1.2, 0.24, 2.6, 4, Math.PI);
    } else {
      const parkingKind = ["parkingGarage", "parkingStructure", "carPark"].includes(config.structureKind);
      const lowRiseEnvelope = ["house", "garage", "shed", "warehouse"].includes(config.structureKind);
      const towerKind = config.structureKind === "tower";

      for (let floor = 0; floor < config.floors; floor += 1) {
        const floorGroup = new THREE.Group();
        floorGroup.position.y = 0.72 + floor * storyHeight;
        floorGroup.userData.floorIndex = floor;
        model.add(floorGroup);
        floorGroups.push(floorGroup);

        floorGroup.add(box(width, 0.16, depth, slabMaterial));
        const insetX = width / 2 - 0.55;
        const insetZ = depth / 2 - 0.55;
        const columnSize = config.structure === "steel" ? 0.2 : config.structure === "timber" ? 0.24 : 0.32;
        const columnPositions = towerKind
          ? [[-insetX, -insetZ], [insetX, -insetZ], [-insetX, insetZ], [insetX, insetZ]]
          : [[-insetX, -insetZ], [insetX, -insetZ], [-insetX, insetZ], [insetX, insetZ], [0, -insetZ], [0, insetZ]];
        columnPositions.forEach(([x, z]) => {
          const column = box(columnSize, storyHeight - 0.06, columnSize, frameMaterial);
          column.position.set(x, storyHeight / 2, z);
          floorGroup.add(column);
        });

        if (towerKind) {
          [-1, 1].forEach((side) => {
            const brace = box(0.12, storyHeight * 1.22, 0.12, frameMaterial);
            brace.position.set(side * insetX * 0.52, storyHeight / 2, insetZ + 0.05);
            brace.rotation.z = side * 0.78;
            floorGroup.add(brace);
          });
        } else if (parkingKind) {
          [-depth / 2 + 0.2, depth / 2 - 0.2].forEach((z) => {
            const rail = box(width - 0.5, 0.25, 0.1, frameMaterial);
            rail.position.set(0, 0.45, z);
            floorGroup.add(rail);
          });
          if (config.structureKind === "parkingStructure") {
            const ramp = box(width * 0.42, 0.14, 2.25, slabMaterial);
            ramp.position.set(width * 0.2, 0.72, 0);
            ramp.rotation.z = -0.11;
            floorGroup.add(ramp);
          }
          if (config.structureKind === "carPark") {
            const totalSpaces = 8;
            const occupied = Math.round(totalSpaces * config.vehicleOccupancy / 100);
            for (let car = 0; car < occupied; car += 1) {
              const row = car % 2;
              const slot = Math.floor(car / 2);
              addCar(floorGroup, -width * 0.32 + slot * (width * 0.21), 0.12, row === 0 ? -depth * 0.26 : depth * 0.26, floor * 8 + car, row === 0 ? 0 : Math.PI);
            }
          }
        } else if (lowRiseEnvelope) {
          const frontWall = box(width - 0.5, 1.05, 0.12, facadeMaterial);
          frontWall.position.set(0, 0.68, depth / 2 - 0.12);
          floorGroup.add(frontWall);
          const sideWall = box(0.12, 1.05, depth - 0.5, facadeMaterial);
          sideWall.position.set(-width / 2 + 0.12, 0.68, 0);
          floorGroup.add(sideWall);
          if (config.structureKind === "garage") {
            const door = box(width * 0.58, 0.78, 0.08, darkMaterial);
            door.position.set(0.8, 0.56, depth / 2);
            floorGroup.add(door);
          }
        } else {
          const facadeWidth = width * 0.43;
          const frontFacade = box(facadeWidth, 1.05, 0.08, facadeMaterial);
          frontFacade.position.set(-width * 0.25, 0.72, depth / 2 - 0.12);
          floorGroup.add(frontFacade);
          const frontGlass = box(facadeWidth, 0.82, 0.09, glassMaterial);
          frontGlass.position.set(width * 0.25, 0.72, depth / 2 - 0.09);
          floorGroup.add(frontGlass);
          const sideGlass = box(0.08, 0.82, depth * 0.42, glassMaterial);
          sideGlass.position.set(width / 2 - 0.1, 0.72, 0);
          floorGroup.add(sideGlass);
        }

        if (config.structure === "steel" && !parkingKind && !towerKind) {
          [-1, 1].forEach((side) => {
            const brace = box(0.13, 1.65, 0.13, frameMaterial);
            brace.position.set(side * width * 0.24, 0.7, depth / 2 + 0.02);
            brace.rotation.z = side * 1.15;
            floorGroup.add(brace);
          });
        }

        if (floor === config.floors - 1) {
          const roof = box(width + 0.35, 0.24, depth + 0.35, slabMaterial);
          roof.position.y = storyHeight;
          floorGroup.add(roof);
          if (["house", "shed", "garage", "warehouse"].includes(config.structureKind)) {
            const roofShape = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.58, 2, 4), facadeMaterial);
            roofShape.position.y = storyHeight + 1.08;
            roofShape.rotation.y = Math.PI / 4;
            roofShape.scale.z = depth / width;
            roofShape.castShadow = true;
            floorGroup.add(roofShape);
          } else if (towerKind || config.structureKind === "skyscraper") {
            const antenna = box(0.09, towerKind ? 3.8 : 2.4, 0.09, frameMaterial);
            antenna.position.set(0, storyHeight + (towerKind ? 2 : 1.3), 0);
            floorGroup.add(antenna);
          }
        }

        const damageThreshold = 100 - metrics.damageScore;
        if (((floor * 31 + 17) % 100) > damageThreshold && floor > 0) {
          const crack = box(0.08, 0.78, 0.1, damageMaterial);
          crack.position.set(-width * 0.18 + ((floor * 7) % 30) / 10, 0.67, depth / 2 + 0.02);
          crack.rotation.z = 0.56;
          floorGroup.add(crack);
        }
      }
    }

    const neighboringMaterial = new THREE.MeshStandardMaterial({ color: "#2a3431", roughness: 0.9 });
    if (!isWide) {
      [[-20, 2.5, -12, 8, 5, 7], [19, 4, -14, 10, 8, 8], [-17, 1.7, 14, 7, 3.4, 6]].forEach(([x, y, z, w, h, d]) => {
        const block = box(w, h, d, neighboringMaterial);
        block.position.set(x, y - 0.2, z);
        groundGroup.add(block);
      });
    }

    let elapsed = 0;
    let previousTime = performance.now();
    let lastReset = liveRef.current.resetSignal;
    let lastViewCommand = liveRef.current.viewCommand.id;
    let animationFrame = 0;
    let lastTimeNotify = 0;
    let lastBreakpoint = "";

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
      const breakpoint = clientWidth < 560 ? "mobile" : clientWidth < 900 ? "compact" : "wide";
      if (breakpoint !== lastBreakpoint) {
        lastBreakpoint = breakpoint;
        fitCamera();
      }
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();
    fitCamera();

    const animate = (now: number) => {
      animationFrame = requestAnimationFrame(animate);
      const delta = Math.min((now - previousTime) / 1000, 0.05);
      previousTime = now;
      const live = liveRef.current;
      if (live.resetSignal !== lastReset) {
        elapsed = 0;
        lastReset = live.resetSignal;
      }
      if (live.viewCommand.id !== lastViewCommand) {
        lastViewCommand = live.viewCommand.id;
        if (live.viewCommand.action === "fit") fitCamera();
        else {
          const offset = camera.position.clone().sub(controls.target);
          const nextDistance = clamp(offset.length() * (live.viewCommand.action === "in" ? 0.78 : 1.28), controls.minDistance, controls.maxDistance);
          camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(nextDistance));
        }
      }
      if (live.running) elapsed += delta * live.speed;

      const omega = live.config.frequency * Math.PI * 2;
      const envelope = 0.72 + Math.sin(elapsed * 0.37) * 0.18;
      const groundWave = Math.sin(elapsed * omega) + 0.32 * Math.sin(elapsed * omega * 1.81 + 0.7);
      const occupancyLoad = live.config.structureKind === "carPark" ? 1 + live.config.vehicleOccupancy / 240 : 1;
      const visualAmplitude = Math.min(1.25, live.config.amplitude * 1.9) * envelope * occupancyLoad;
      const activeAmplitude = live.running ? visualAmplitude : 0;
      groundGroup.position.x = groundWave * activeAmplitude * 0.18;
      groundGroup.position.z = Math.sin(elapsed * omega * 0.71 + 1.1) * activeAmplitude * 0.08;

      floorGroups.forEach((floorGroup, index) => {
        const normalizedHeight = (index + 1) / Math.max(floorGroups.length, 1);
        const modalShape = Math.pow(normalizedHeight, 1.42);
        const phaseLag = normalizedHeight * 0.36 * live.metrics.period;
        const sway = Math.sin((elapsed - phaseLag) * omega) * activeAmplitude * modalShape;
        const amplifiedSway = sway * Math.min(2.15, 0.42 + live.metrics.resonance * 0.31);
        const torsion = Math.sin(elapsed * omega * 0.53 + index * 0.08) * activeAmplitude * modalShape * 0.012;
        floorGroup.position.x = amplifiedSway;
        floorGroup.position.z = Math.sin((elapsed - phaseLag) * omega * 0.74) * activeAmplitude * modalShape * 0.14;
        floorGroup.rotation.z = amplifiedSway * 0.012;
        floorGroup.rotation.y = torsion;
      });

      if (now - lastTimeNotify > 150) {
        live.onTime(elapsed);
        lastTimeNotify = now;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else if (material) material.dispose();
      });
      renderer.domElement.remove();
    };
  }, [config.floors, config.structure, config.structureKind, config.vehicleOccupancy, metrics.damageScore, metrics.damageColor]);

  return <div className="scene-mount" ref={mountRef} aria-label={`Interactive 3D ${STRUCTURE_KINDS[config.structureKind].label} earthquake simulation`} />;
}

export default function Home() {
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [introVisible, setIntroVisible] = useState(true);
  const [introLeaving, setIntroLeaving] = useState(false);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [viewCommand, setViewCommand] = useState<ViewCommand>({ id: 0, action: "fit" });
  const [appMode, setAppMode] = useState<"structure" | "regional">("structure");
  const [activeTab, setActiveTab] = useState<"motion" | "structure">("motion");
  const [infoOpen, setInfoOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<HelpTab>("guide");
  const [tourStep, setTourStep] = useState(-1);
  const [reportBusy, setReportBusy] = useState(false);
  const metrics = useMemo(() => calculateMetrics(config), [config]);
  const kindProfile = STRUCTURE_KINDS[config.structureKind];

  useEffect(() => {
    const leavingTimer = window.setTimeout(() => setIntroLeaving(true), 1800);
    const hideTimer = window.setTimeout(() => setIntroVisible(false), 2500);
    return () => {
      window.clearTimeout(leavingTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (tourStep >= 0) setTourStep(-1);
      else setInfoOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [tourStep]);

  useEffect(() => {
    if (tourStep < 0) return;
    const timer = window.setTimeout(() => document.querySelector(".tour-focus")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    return () => window.clearTimeout(timer);
  }, [tourStep]);

  const update = <K extends keyof SimulationConfig>(key: K, value: SimulationConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const restart = () => {
    setElapsed(0);
    setResetSignal((value) => value + 1);
    setRunning(true);
  };

  const resetAll = () => {
    setConfig(DEFAULT_CONFIG);
    setElapsed(0);
    setSpeed(1);
    setResetSignal((value) => value + 1);
    setRunning(true);
  };

  const handleTime = useCallback((time: number) => setElapsed(time), []);
  const driftPasses = metrics.drift <= config.driftLimit;

  const changeStructureKind = (value: StructureKind) => {
    const selected = STRUCTURE_KINDS[value];
    setConfig((current) => ({
      ...current,
      structureKind: value,
      floors: selected.defaultFloors,
      structure: selected.recommendedSystem,
      responseFactor: STRUCTURES[selected.recommendedSystem].defaultR,
    }));
    setViewCommand((current) => ({ id: current.id + 1, action: "fit" }));
  };

  const changeFloors = (value: number) => {
    update("floors", value);
    setViewCommand((current) => ({ id: current.id + 1, action: "fit" }));
  };

  const sendViewCommand = (action: ViewAction) => {
    setViewCommand((current) => ({ id: current.id + 1, action }));
  };

  const downloadReport = async () => {
    setReportBusy(true);
    try {
      await createSeismicPdf({
        filename: `seismic-${config.structureKind}-report.pdf`,
        structure: kindProfile.label,
        system: STRUCTURES[config.structure].label,
        stories: config.floors,
        storyHeight: config.floorHeight,
        totalHeight: config.floors * config.floorHeight,
        vehicleOccupancy: config.structureKind === "carPark" ? config.vehicleOccupancy : undefined,
        siteClass: config.siteClass,
        magnitude: config.magnitude,
        intensity: config.intensity,
        amplitude: config.amplitude,
        frequency: config.frequency,
        mmiRoman: metrics.mmiRoman,
        mmi: metrics.mmi,
        mmiTitle: metrics.mmiTitle,
        mmiLegend: metrics.mmiLegend,
        pga: metrics.pga,
        spectralAcceleration: metrics.spectralAcceleration,
        period: metrics.period,
        drift: metrics.drift,
        driftLimit: config.driftLimit,
        baseShear: metrics.baseShear,
        damageScore: metrics.damageScore,
        damageLabel: metrics.damageLabel,
        responseFactor: config.responseFactor,
        importanceFactor: config.importanceFactor,
        damping: config.damping,
        reliability: config.reliability,
      });
    } finally {
      setReportBusy(false);
    }
  };

  const startTour = () => {
    setAppMode("structure");
    setInfoOpen(false);
    setTourStep(0);
  };

  return (
    <main className="app-shell">
      {introVisible && (
        <div className={`intro-screen${introLeaving ? " intro-leaving" : ""}`} role="status" aria-label="Loading SEISMIC Structural Response Lab">
          {/* The launch artwork must render immediately and is already preloaded by the server. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/og.png" alt="SEISMIC Structural Response Lab — a structural frame under seismic load" />
          <div className="intro-progress"><i /><span>INITIALIZING RESPONSE MODEL</span></div>
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><i /><i /><i /></span>
          <div><strong>SEISMIC</strong><small>STRUCTURAL RESPONSE LAB</small></div>
        </div>
        <nav className="mode-nav" aria-label="Simulator mode">
          <button type="button" className={appMode === "structure" ? "active" : ""} onClick={() => setAppMode("structure")}>Structure lab</button>
          <button type="button" className={appMode === "regional" ? "active" : ""} onClick={() => { setTourStep(-1); setAppMode("regional"); }}>Regional map</button>
        </nav>
        <div className="topbar-status">
          <span className="live-dot" /> LIVE MODEL
          <button className="icon-button has-tooltip" type="button" onClick={() => setInfoOpen(true)} aria-label="Open help center">?<span className="tooltip-bubble" aria-hidden="true">Help, walkthrough &amp; contact</span></button>
        </div>
      </header>

      {infoOpen && (
        <div className="help-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setInfoOpen(false); }}>
          <aside className="help-center" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <header className="help-header">
              <div><span className="eyebrow">SEISMIC SUPPORT</span><h2 id="help-title">Help center</h2></div>
              <button className="help-close" type="button" onClick={() => setInfoOpen(false)} aria-label="Close help center">×</button>
            </header>
            <nav className="help-tabs" aria-label="Help sections">
              <button className={helpTab === "guide" ? "active" : ""} onClick={() => setHelpTab("guide")}>How to use</button>
              <button className={helpTab === "walkthrough" ? "active" : ""} onClick={() => setHelpTab("walkthrough")}>Walkthrough</button>
              <button className={helpTab === "contact" ? "active" : ""} onClick={() => setHelpTab("contact")}>Contact</button>
            </nav>

            <div className="help-content">
              {helpTab === "guide" && (
                <section className="help-guide">
                  <div className="help-intro">
                    <span className="help-number">01</span>
                    <div><h3>Build a seismic scenario</h3><p>Set magnitude, perceived intensity, peak amplitude, dominant frequency, and site class. Every change recalculates the response immediately.</p></div>
                  </div>
                  <div className="help-intro">
                    <span className="help-number">02</span>
                    <div><h3>Configure the structure</h3><p>Choose an asset and framing system, then refine its floors, height, damping, drift limit, response coefficient, importance, and reliability.</p></div>
                  </div>
                  <div className="help-intro">
                    <span className="help-number">03</span>
                    <div><h3>Observe and interpret</h3><p>Orbit and zoom the model while comparing its movement with live MMI, PGA, spectral acceleration, period, base shear, drift, and damage.</p></div>
                  </div>
                  <div className="help-intro">
                    <span className="help-number">04</span>
                    <div><h3>Export the study</h3><p>Download a report of the current inputs and outputs. Treat it as an educational summary, never as a professional engineering assessment.</p></div>
                  </div>
                  <div className="help-glossary">
                    <h3>Quick reference</h3>
                    <div><span><b>MMI</b> Observed shaking effects</span><span><b>PGA</b> Maximum ground acceleration</span><span><b>Sa</b> Oscillator acceleration response</span><span><b>T</b> Fundamental vibration period</span><span><b>Δ</b> Relative story displacement</span><span><b>R</b> Inelastic response reduction</span></div>
                  </div>
                  <div className="scope-note"><strong>Model scope</strong><p>This tool uses simplified equivalent-response relationships for exploration. It is not a substitute for code-compliant analysis or review by a licensed engineer.</p></div>
                </section>
              )}

              {helpTab === "walkthrough" && (
                <section className="walkthrough-start">
                  <span className="walkthrough-icon">↗</span>
                  <h3>Take the guided tour</h3>
                  <p>A five-step walkthrough will point out the scenario inputs, 3D model, playback tools, response metrics, and report export. It takes about one minute.</p>
                  <ol><li>Inputs and structural configuration</li><li>3D navigation and live motion</li><li>Playback and camera controls</li><li>Engineering metrics and damage</li><li>Report download and disclaimer</li></ol>
                  <button type="button" className="primary-help-button" onClick={startTour}>Start walkthrough</button>
                  <small>You can exit at any time with Escape.</small>
                </section>
              )}

              {helpTab === "contact" && (
                <section className="contact-section">
                  <div className="contact-heading"><span>in</span><div><h3>Connect with Diego Avella</h3><p>Questions, feedback, and professional inquiries are welcome on LinkedIn.</p></div></div>
                  <a className="linkedin-link" href={LINKEDIN_URL} target="_blank" rel="noreferrer">
                    <span><b>LinkedIn</b><small>linkedin.com/in/diego-avella</small></span>
                    <strong aria-hidden="true">↗</strong>
                  </a>
                  <p className="privacy-note">This link opens Diego’s LinkedIn profile in a new tab.</p>
                </section>
              )}
            </div>
          </aside>
        </div>
      )}

      {appMode === "structure" ? <section className="workspace">
        <aside className={`control-panel left-panel${tourStep >= 0 && TOUR_STEPS[tourStep].target === "inputs" ? " tour-focus" : ""}`}>
          <div className="panel-title-row">
            <div><span className="eyebrow">INPUT PARAMETERS</span><h1>Earthquake profile</h1></div>
            <button className="text-button" type="button" onClick={resetAll}>Reset</button>
          </div>

          <div className="tab-list" role="tablist" aria-label="Configuration group">
            <button className={`${activeTab === "motion" ? "active " : ""}has-tooltip`} onClick={() => setActiveTab("motion")} role="tab">Ground motion<span className="tooltip-bubble" aria-hidden="true">Earthquake and soil inputs</span></button>
            <button className={`${activeTab === "structure" ? "active " : ""}has-tooltip`} onClick={() => setActiveTab("structure")} role="tab">Structure<span className="tooltip-bubble" aria-hidden="true">Asset, frame and design inputs</span></button>
          </div>

          {activeTab === "motion" ? (
            <div className="controls-stack">
              <RangeControl label="Magnitude" symbol="M" description="A logarithmic measure of the earthquake's released energy. Each whole-number increase represents substantially stronger shaking." value={config.magnitude} min={3} max={9.5} step={0.1} onChange={(value) => update("magnitude", value)} />
              <RangeControl label="Perceived intensity" symbol="I" description="The expected severity of shaking and observed effects at the structure, expressed on the 1–12 Modified Mercalli scale." value={config.intensity} min={1} max={12} step={1} onChange={(value) => update("intensity", value)} />
              <RangeControl label="Peak amplitude" symbol="A" description="The maximum modeled ground acceleration, expressed as a fraction of gravity (g). It directly influences inertial force." value={config.amplitude} min={0.02} max={1.5} step={0.01} unit=" g" onChange={(value) => update("amplitude", value)} />
              <RangeControl label="Dominant frequency" symbol="f" description="The principal repetition rate of ground motion. Response can increase when it approaches the structure's natural frequency." value={config.frequency} min={0.2} max={5} step={0.1} unit=" Hz" onChange={(value) => update("frequency", value)} />
              <SelectControl
                label="Site class"
                description="A–F soil and rock classification used to estimate how local ground conditions amplify shaking. Class A is hard rock; softer classes generally amplify more."
                value={config.siteClass}
                options={(Object.keys(SITE_FACTORS) as SiteClass[]).map((site) => ({ value: site, label: `${site} — ${site === "A" ? "Hard rock" : site === "B" ? "Rock" : site === "C" ? "Dense soil" : site === "D" ? "Stiff soil" : site === "E" ? "Soft clay" : "Site-specific"}` }))}
                onChange={(value) => update("siteClass", value as SiteClass)}
              />
              <div className="site-note"><span>Site amplification</span><strong>× {SITE_FACTORS[config.siteClass].toFixed(2)}</strong></div>
            </div>
          ) : (
            <div className="controls-stack">
              <SelectControl
                label="Structure type"
                description="The asset geometry being modeled. This selection changes allowed floor counts, dimensions, mass, stiffness assumptions, and the 3D representation."
                value={config.structureKind}
                options={(Object.keys(STRUCTURE_KINDS) as StructureKind[]).map((kind) => ({ value: kind, label: STRUCTURE_KINDS[kind].label }))}
                onChange={(value) => changeStructureKind(value as StructureKind)}
              />
              <SelectControl
                label="Structural system"
                description="The primary lateral-force-resisting material and framing system used to estimate stiffness, period, and energy-dissipation behavior."
                value={config.structure}
                options={(Object.keys(STRUCTURES) as StructureType[]).map((type) => ({ value: type, label: STRUCTURES[type].label }))}
                onChange={(value) => update("structure", value as StructureType)}
              />
              <RangeControl label="Number of floors" description="The number of occupied or modeled levels. It controls total height, approximate mass distribution, period, and the rendered model." value={config.floors} min={kindProfile.minFloors} max={kindProfile.maxFloors} step={1} onChange={changeFloors} />
              <RangeControl label="Floor height" description="The vertical distance between consecutive floor levels. Together with floor count, it determines total structural height." value={config.floorHeight} min={2.6} max={4.5} step={0.1} unit=" m" onChange={(value) => update("floorHeight", value)} />
              {config.structureKind === "carPark" && (
                <RangeControl label="Vehicle occupancy" description="The estimated percentage of parking spaces occupied. More vehicles increase the modeled seismic mass and structural demand." value={config.vehicleOccupancy} min={0} max={100} step={5} unit="%" onChange={(value) => update("vehicleOccupancy", value)} />
              )}
              <RangeControl label="Damping ratio" symbol="ζ" description="The percentage of critical damping used to represent how quickly the structure dissipates vibration energy." value={config.damping} min={2} max={15} step={0.5} unit="%" onChange={(value) => update("damping", value)} />
              <RangeControl label="Drift limit" symbol="Δ" description="The maximum acceptable relative horizontal displacement between adjacent floors, expressed as a percentage of story height." value={config.driftLimit} min={0.5} max={3} step={0.1} unit="%" onChange={(value) => update("driftLimit", value)} />
              <RangeControl label="Response modification" symbol="R" description="A design coefficient representing ductility, overstrength, and energy dissipation. Higher values reduce the equivalent elastic design force." value={config.responseFactor} min={1} max={8} step={0.5} onChange={(value) => update("responseFactor", value)} />
              <RangeControl label="Importance factor" description="A multiplier that increases design demand for structures whose continued operation or occupancy is especially important." value={config.importanceFactor} min={1} max={1.5} step={0.05} onChange={(value) => update("importanceFactor", value)} />
              <RangeControl label="Material reliability" description="A simplified confidence factor for material condition and construction quality. Lower reliability increases estimated response and damage." value={config.reliability} min={0.65} max={1.35} step={0.05} onChange={(value) => update("reliability", value)} />
            </div>
          )}
        </aside>

        <section className={`viewport-panel${tourStep >= 0 && TOUR_STEPS[tourStep].target === "viewport" ? " tour-focus" : ""}`}>
          <div className="viewport-toolbar">
            <div><span className="toolbar-label">MODEL</span><strong>{config.floors}-story {kindProfile.label} · {STRUCTURES[config.structure].label}</strong></div>
            <div className="view-hint"><span>↗</span> Drag to orbit · Scroll to zoom</div>
          </div>
          <div className="scene-wrap">
            <EarthquakeScene config={config} metrics={metrics} running={running} speed={speed} resetSignal={resetSignal} viewCommand={viewCommand} onTime={handleTime} />
            <div className="scene-vignette" />
            <div className="zoom-tools" aria-label="Viewport zoom controls">
              <button className="has-tooltip tooltip-right" type="button" onClick={() => sendViewCommand("in")} aria-label="Zoom in">+<span className="tooltip-bubble" aria-hidden="true">Zoom in</span></button>
              <button className="has-tooltip tooltip-right" type="button" onClick={() => sendViewCommand("out")} aria-label="Zoom out">−<span className="tooltip-bubble" aria-hidden="true">Zoom out</span></button>
              <button className="has-tooltip tooltip-right" type="button" onClick={() => sendViewCommand("fit")} aria-label="Fit structure to view">⌗<span className="tooltip-bubble" aria-hidden="true">Fit model to view</span></button>
            </div>
            <div className="height-tag"><span>H</span>{formatNumber(config.floors * config.floorHeight, 1)} m</div>
            <div className="motion-indicator">
              <span>GROUND MOTION</span>
              <div className="waveform"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
              <strong>{config.frequency.toFixed(1)} Hz</strong>
            </div>
            <div className="damage-badge" style={{ "--damage-color": metrics.damageColor } as React.CSSProperties}>
              <span><i /> STRUCTURAL STATE</span>
              <strong>{metrics.damageLabel}</strong>
              <div><i style={{ width: `${metrics.damageScore}%` }} /></div>
              <small>{Math.round(metrics.damageScore)}% damage index</small>
            </div>
          </div>
          <div className={`playback-bar${tourStep >= 0 && TOUR_STEPS[tourStep].target === "playback" ? " tour-focus" : ""}`}>
            <button type="button" className="play-button has-tooltip tooltip-top" onClick={() => setRunning((value) => !value)} aria-label={running ? "Pause simulation" : "Play simulation"}>{running ? "Ⅱ" : "▶"}<span className="tooltip-bubble" aria-hidden="true">{running ? "Pause simulation" : "Resume simulation"}</span></button>
            <button type="button" className="restart-button has-tooltip tooltip-top" onClick={restart} aria-label="Restart simulation">↺<span className="tooltip-bubble" aria-hidden="true">Restart from zero</span></button>
            <div className="timeline"><span style={{ width: `${(elapsed % 20) * 5}%` }} /><i /></div>
            <time>{Math.floor(elapsed / 60).toString().padStart(2, "0")}:{Math.floor(elapsed % 60).toString().padStart(2, "0")}</time>
            <div className="speed-buttons" aria-label="Simulation speed">
              {[0.5, 1, 2].map((value) => <button key={value} className={speed === value ? "active" : ""} onClick={() => setSpeed(value)}>{value}×</button>)}
            </div>
          </div>
        </section>

        <aside className={`results-panel${tourStep >= 0 && TOUR_STEPS[tourStep].target === "results" ? " tour-focus" : ""}`}>
          <div className="panel-title-row results-title"><div><span className="eyebrow">LIVE ANALYSIS</span><h2>Response metrics</h2></div><span className="calc-chip">AUTO</span></div>
          <section className="mmi-card">
            <div className="mmi-gauge" style={{ "--mmi-value": `${(metrics.mmi / 12) * 360}deg` } as React.CSSProperties}>
              <div><small>MMI</small><strong>{metrics.mmiRoman}</strong><span>{metrics.mmi.toFixed(1)}</span></div>
            </div>
            <div className="mmi-copy"><span>MODIFIED MERCALLI</span><strong>{metrics.mmiTitle}</strong><p>{metrics.mmiLegend}</p></div>
          </section>

          <div className="metrics-grid">
            <MetricCard label="PGA" value={formatNumber(metrics.pga, 3)} unit=" g" note={`${formatNumber(metrics.pga * 9.81, 2)} m/s² peak ground`} accent />
            <MetricCard label="SPECTRAL ACCEL." value={formatNumber(metrics.spectralAcceleration, 2)} unit=" g" note={`At T = ${formatNumber(metrics.period)} s`} />
            <MetricCard label="FUNDAMENTAL PERIOD" value={formatNumber(metrics.period, 2)} unit=" s" note={`${formatNumber(1 / metrics.period, 2)} Hz natural frequency`} />
            <MetricCard label="BASE SHEAR" value={formatNumber(metrics.baseShear, 1)} unit=" %W" note="Equivalent lateral force" />
          </div>

          <section className="drift-card">
            <div className="drift-heading"><span>INTERSTORY DRIFT <i>Δ</i></span><strong className={driftPasses ? "pass" : "fail"}>{driftPasses ? "PASS" : "EXCEEDS"}</strong></div>
            <div className="drift-value"><strong>{formatNumber(metrics.drift, 2)}%</strong><span>limit {config.driftLimit.toFixed(1)}%</span></div>
            <div className="drift-track"><i style={{ width: `${clamp((metrics.drift / 5) * 100, 0, 100)}%` }} /><b style={{ left: `${clamp((config.driftLimit / 5) * 100, 0, 100)}%` }} /></div>
          </section>

          <section className="coefficients">
            <div className="section-heading"><span>DESIGN COEFFICIENTS</span><small>CONFIGURABLE</small></div>
            <div className="coefficient-row"><span>Response modification</span><strong>R {config.responseFactor.toFixed(1)}</strong></div>
            <div className="coefficient-row"><span>Importance factor</span><strong>Iₑ {config.importanceFactor.toFixed(2)}</strong></div>
            <div className="coefficient-row"><span>Damping ratio</span><strong>ζ {config.damping.toFixed(1)}%</strong></div>
            <div className="coefficient-row"><span>Reliability factor</span><strong>φ {config.reliability.toFixed(2)}</strong></div>
          </section>

          <section className={`report-section${tourStep >= 0 && TOUR_STEPS[tourStep].target === "report" ? " tour-focus" : ""}`}>
            <button className="report-button has-tooltip tooltip-top" type="button" onClick={downloadReport} disabled={reportBusy}><span>↓</span> {reportBusy ? "Generating PDF..." : "Download PDF report"}<span className="tooltip-bubble" aria-hidden="true">Export current inputs and results as PDF</span></button>
            <p><strong>Professional-use disclaimer:</strong> This report does not replace the expertise or judgment of a licensed engineer. No liability is accepted for decisions or outcomes based on generated results.</p>
          </section>

          <p className="model-note">Indicative educational model · Simplified response spectrum · Values update continuously</p>
        </aside>
      </section> : <RegionalSimulator />}

      {tourStep >= 0 && (
        <>
          <div className="tour-shade" aria-hidden="true" />
          <div className="tour-layer" data-target={TOUR_STEPS[tourStep].target} aria-live="polite">
            <section className="tour-card" role="dialog" aria-modal="true" aria-label={`Guided walkthrough, ${TOUR_STEPS[tourStep].eyebrow}`}>
              <button className="tour-close" type="button" onClick={() => setTourStep(-1)} aria-label="Exit walkthrough">×</button>
              <span>{TOUR_STEPS[tourStep].eyebrow}</span>
              <h3>{TOUR_STEPS[tourStep].title}</h3>
              <p>{TOUR_STEPS[tourStep].body}</p>
              <div className="tour-progress" aria-hidden="true">{TOUR_STEPS.map((_, index) => <i key={index} className={index <= tourStep ? "active" : ""} />)}</div>
              <div className="tour-actions">
                <button type="button" className="tour-skip" onClick={() => setTourStep(-1)}>Exit tour</button>
                <div>
                  {tourStep > 0 && <button type="button" className="tour-back" onClick={() => setTourStep((step) => step - 1)}>Back</button>}
                  <button type="button" className="tour-next" onClick={() => tourStep === TOUR_STEPS.length - 1 ? setTourStep(-1) : setTourStep((step) => step + 1)}>{tourStep === TOUR_STEPS.length - 1 ? "Finish" : "Next"}</button>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
