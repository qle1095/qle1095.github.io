import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : new THREE.Color(typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F'),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clamp01(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: Math.max(1, readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: Math.max(1, readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clamp01(readLayerNumber(spec.specularIntensity, ['base'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    if (bumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = bumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    if (displacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = displacementScale;
      material.displacementBias = -displacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Levi Chibi
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createLeviChibiModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Levi Chibi";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["hidden"] = createSculptMaterial(
    "hidden",
    {"id": "hidden", "name": "Hidden rig helper", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#000000", "color": "#000000", "albedo": {"dominant": "#000000", "secondary": ["#000000"], "samplingNotes": "Never rendered; root/pivot group helper material."}, "colorVariation": {"palette": ["#000000"], "pattern": "mottled", "amplitude": 0.04, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 1.0, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.12, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes."},
    options
  );
  materialMap["skin"] = createSculptMaterial(
    "skin",
    {"id": "skin", "name": "Warm light skin", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#F2C39B", "color": "#F2C39B", "albedo": {"dominant": "#F2C39B", "secondary": ["#E8B48C", "#F7D3B0"], "samplingNotes": "Warm light skin from face/hands; full rounded cheeks; slightly desaturated shadow tint, no SSS."}, "colorVariation": {"palette": ["#F2C39B", "#E8B48C", "#F7D3B0"], "pattern": "mottled", "amplitude": 0.04, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.55, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.12, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes."},
    options
  );
  materialMap["hair"] = createSculptMaterial(
    "hair",
    {"id": "hair", "name": "Dark brown-black hair", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#26201B", "color": "#26201B", "albedo": {"dominant": "#26201B", "secondary": ["#1B1613", "#3A3028"], "samplingNotes": "Voluminous dark brown-black; soft specular band along quiff sweep, not glossy."}, "colorVariation": {"palette": ["#26201B", "#1B1613", "#3A3028"], "pattern": "mottled", "amplitude": 0.04, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.58, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.12, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes."},
    options
  );
  materialMap["jacket-wool"] = createSculptMaterial(
    "jacket-wool",
    {"id": "jacket-wool", "name": "Tuxedo jacket matte wool", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#1B1C20", "color": "#1B1C20", "albedo": {"dominant": "#1B1C20", "secondary": ["#141519", "#26272C"], "samplingNotes": "Matte black suiting wool; reads near-black with faint cool sheen in highlights."}, "colorVariation": {"palette": ["#1B1C20", "#141519", "#26272C"], "pattern": "mottled", "amplitude": 0.04, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.85, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.12, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "satin-lapel", "region": "peak lapel facing strips", "roughness": 0.28, "color": "#26272C", "note": "Satin lapel facings: markedly lower roughness than body wool so the lapel V reads as a separate sheen band."}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes."},
    options
  );
  materialMap["lapel-satin"] = createSculptMaterial(
    "lapel-satin",
    {"id": "lapel-satin", "name": "Satin peak lapel facing", "type": "physical", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#26272C", "color": "#26272C", "albedo": {"dominant": "#26272C", "secondary": ["#1B1C20", "#3B3D45"], "samplingNotes": "Black satin: low roughness, soft anisotropic-looking highlight; brighter than the wool under the key light."}, "colorVariation": {"palette": ["#26272C", "#1B1C20", "#3B3D45"], "pattern": "mottled", "amplitude": 0.04, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.28, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.12, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": 0.25},
    options
  );
  materialMap["shirt-cotton"] = createSculptMaterial(
    "shirt-cotton",
    {"id": "shirt-cotton", "name": "White dress shirt", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#F7F5EF", "color": "#F7F5EF", "albedo": {"dominant": "#F7F5EF", "secondary": ["#EAE7DE"], "samplingNotes": "Crisp white cotton; slightly warm white, matte."}, "colorVariation": {"palette": ["#F7F5EF", "#EAE7DE"], "pattern": "mottled", "amplitude": 0.04, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.7, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.12, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes."},
    options
  );
  materialMap["bowtie-satin"] = createSculptMaterial(
    "bowtie-satin",
    {"id": "bowtie-satin", "name": "Black satin butterfly bow tie", "type": "physical", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#191A1E", "color": "#191A1E", "albedo": {"dominant": "#191A1E", "secondary": ["#26272C"], "samplingNotes": "Satin bow tie under chin; slight sheen, darker than lapels."}, "colorVariation": {"palette": ["#191A1E", "#26272C"], "pattern": "mottled", "amplitude": 0.04, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.32, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.12, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": 0.2},
    options
  );
  materialMap["trouser-wool"] = createSculptMaterial(
    "trouser-wool",
    {"id": "trouser-wool", "name": "Black trouser wool", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#17181B", "color": "#17181B", "albedo": {"dominant": "#17181B", "secondary": ["#101114"], "samplingNotes": "Matte black trousers, same family as jacket but slightly darker."}, "colorVariation": {"palette": ["#17181B", "#101114"], "pattern": "mottled", "amplitude": 0.04, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.82, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.12, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes."},
    options
  );
  materialMap["shoe-leather"] = createSculptMaterial(
    "shoe-leather",
    {"id": "shoe-leather", "name": "Black dress shoe leather", "type": "physical", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#131316", "color": "#131316", "albedo": {"dominant": "#131316", "secondary": ["#000000", "#2A2A2E"], "samplingNotes": "Low-gloss black leather derby; soft toe highlight."}, "colorVariation": {"palette": ["#131316", "#000000", "#2A2A2E"], "pattern": "mottled", "amplitude": 0.04, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.34, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.12, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": 0.3},
    options
  );
  materialMap["eye-dark"] = createSculptMaterial(
    "eye-dark",
    {"id": "eye-dark", "name": "Dark iris/eye mass", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#221710", "color": "#221710", "albedo": {"dominant": "#221710", "secondary": ["#120C08"], "samplingNotes": "Large dark almond chibi eye: near-black warm brown, glossy."}, "colorVariation": {"palette": ["#221710", "#120C08"], "pattern": "mottled", "amplitude": 0.04, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.24, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.12, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes."},
    options
  );
  materialMap["catchlight"] = createSculptMaterial(
    "catchlight",
    {"id": "catchlight", "name": "Eye catchlight", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#FFFFFF", "color": "#FFFFFF", "albedo": {"dominant": "#FFFFFF", "secondary": ["#FFFFFF"], "samplingNotes": "Small white catchlight sphere offset up/inward toward key light; disproportionately important for appeal."}, "colorVariation": {"palette": ["#FFFFFF"], "pattern": "mottled", "amplitude": 0.04, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.15, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.12, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes."},
    options
  );
  materialMap["brow"] = createSculptMaterial(
    "brow",
    {"id": "brow", "name": "Brow hair", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#2A211A", "color": "#2A211A", "albedo": {"dominant": "#2A211A", "secondary": ["#2A211A"], "samplingNotes": "Thin dark natural brow arcs."}, "colorVariation": {"palette": ["#2A211A"], "pattern": "mottled", "amplitude": 0.04, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.7, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.12, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes."},
    options
  );
  materialMap["mouth"] = createSculptMaterial(
    "mouth",
    {"id": "mouth", "name": "Mouth line", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#9C5B49", "color": "#9C5B49", "albedo": {"dominant": "#9C5B49", "secondary": ["#7C4438"], "samplingNotes": "Small gentle closed smile; warm muted rose-brown line."}, "colorVariation": {"palette": ["#9C5B49", "#7C4438"], "pattern": "mottled", "amplitude": 0.04, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.6, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.12, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes."},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Levi chibi (root)__pivot";
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
    node_root_0.scale.set(1.0, 1.0, 1.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Levi chibi (root)", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Hidden root rig node; carries pivots and runtime metadata, no visible geometry.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.4, "height": 1.0, "depth": 0.3, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Root group at ground contact y=0; exposes userData.sculptRuntime."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 1.0)", "secondaryAlbedo": "rgba(0, 0, 0, 1.0)", "materialClass": "unknown", "materialClassConfidence": 0.5, "evidenceRefs": ["full-object"]}};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Levi chibi (root)";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Levi chibi (root)", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Hidden root rig node; carries pivots and runtime metadata, no visible geometry.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.4, "height": 1.0, "depth": 0.3, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Root group at ground contact y=0; exposes userData.sculptRuntime."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 1.0)", "secondaryAlbedo": "rgba(0, 0, 0, 1.0)", "materialClass": "unknown", "materialClassConfidence": 0.5, "evidenceRefs": ["full-object"]}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const attachment_pelvis_1 = {"parentId": "root", "parentSocket": "socket-pelvis", "contactType": "socket-join", "localStart": [0, 0.34, 0], "localEnd": [0, 0.24, 0], "contactNormal": [0, 1, 0], "overlap": 0.05, "embedDepth": 0.02, "gapTolerance": 0.005};
  const endpoint_pelvis_1 = makeAttachmentEndpoint(attachment_pelvis_1);
  const node_pelvis_1 = new THREE.Group();
  node_pelvis_1.name = "Pelvis / trouser hip mass__pivot";
  if (endpoint_pelvis_1) {
    node_pelvis_1.position.copy(endpoint_pelvis_1.start);
    node_pelvis_1.rotation.set(0, 0, 0);
    node_pelvis_1.scale.set(1, 1, 1);
  } else {
    node_pelvis_1.position.set(0.0, 0.295, 0.0);
    node_pelvis_1.rotation.set(0.0, 0.0, 0.0);
    node_pelvis_1.scale.set(1.0, 1.0, 1.0);
  }
  node_pelvis_1.userData.sculptComponent = {"id": "pelvis", "name": "Pelvis / trouser hip mass", "level": "macro", "role": "body", "importance": 0.85, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Pelvis / trouser hip mass: discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "socket-pelvis", "contactType": "socket-join", "localStart": [0, 0.34, 0], "localEnd": [0, 0.24, 0], "contactNormal": [0, 1, 0], "overlap": 0.05, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.235, "height": 0.16, "depth": 0.175, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0, 0.295, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "body-segment", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "trouser-wool", "materialLayers": ["trouser-wool"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Rounded black trouser hip mass bridging torso to legs; overlaps jacket hem."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 24, 27, 1.0)", "secondaryAlbedo": "rgba(16, 17, 20, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_pelvis_1.userData.actionProfile = {"animationRole": "body-segment", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["root"] ?? root).add(node_pelvis_1);
  nodes["pelvis"] = node_pelvis_1;
  const mesh_pelvis_1Geometry = endpoint_pelvis_1
    ? new THREE.CylinderGeometry(endpoint_pelvis_1.endRadius, endpoint_pelvis_1.baseRadius, endpoint_pelvis_1.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_pelvis_1 = new THREE.Mesh(
    mesh_pelvis_1Geometry,
    materialMap["trouser-wool"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pelvis_1.name = "Pelvis / trouser hip mass";
  if (endpoint_pelvis_1) {
    mesh_pelvis_1.position.copy(endpoint_pelvis_1.midpoint);
    mesh_pelvis_1.quaternion.copy(endpoint_pelvis_1.quaternion);
  }
  mesh_pelvis_1.castShadow = options.castShadow ?? true;
  mesh_pelvis_1.receiveShadow = options.receiveShadow ?? true;
  mesh_pelvis_1.userData.sculptComponent = {"id": "pelvis", "name": "Pelvis / trouser hip mass", "level": "macro", "role": "body", "importance": 0.85, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Pelvis / trouser hip mass: discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "socket-pelvis", "contactType": "socket-join", "localStart": [0, 0.34, 0], "localEnd": [0, 0.24, 0], "contactNormal": [0, 1, 0], "overlap": 0.05, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.235, "height": 0.16, "depth": 0.175, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0, 0.295, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "body-segment", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "trouser-wool", "materialLayers": ["trouser-wool"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Rounded black trouser hip mass bridging torso to legs; overlaps jacket hem."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 24, 27, 1.0)", "secondaryAlbedo": "rgba(16, 17, 20, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_pelvis_1.add(mesh_pelvis_1);
  meshes["pelvis"] = mesh_pelvis_1;
  colliders["pelvis"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_pelvis_1);

  const attachment_leg_l_2 = {"parentId": "pelvis", "parentSocket": "socket-hip-l", "contactType": "socket-join", "localStart": [0.058, 0.3, 0], "localEnd": [0.058, 0.05, 0], "contactNormal": [0, -1, 0], "overlap": 0.05, "embedDepth": 0.02, "gapTolerance": 0.005};
  const endpoint_leg_l_2 = makeAttachmentEndpoint(attachment_leg_l_2);
  const node_leg_l_2 = new THREE.Group();
  node_leg_l_2.name = "Leg L (trouser)__pivot";
  if (endpoint_leg_l_2) {
    node_leg_l_2.position.copy(endpoint_leg_l_2.start);
    node_leg_l_2.rotation.set(0, 0, 0);
    node_leg_l_2.scale.set(1, 1, 1);
  } else {
    node_leg_l_2.position.set(0.058, 0.165, 0.0);
    node_leg_l_2.rotation.set(0.0, 0.0, 0.0);
    node_leg_l_2.scale.set(1.0, 1.0, 1.0);
  }
  node_leg_l_2.userData.sculptComponent = {"id": "leg-l", "name": "Leg L (trouser)", "level": "macro", "role": "limb", "importance": 0.9, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Leg L (trouser): discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pelvis", "attachment": {"parentId": "pelvis", "parentSocket": "socket-hip-l", "contactType": "socket-join", "localStart": [0.058, 0.3, 0], "localEnd": [0.058, 0.05, 0], "contactNormal": [0, -1, 0], "overlap": 0.05, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.096, "height": 0.27, "depth": 0.096, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0.058, 0.165, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "limb", "pivot": {"mode": "explicit", "localPosition": [0.058, 0.3, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "trouser-wool", "materialLayers": ["trouser-wool"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Black trouser leg; hangs from pivot-hip-l at (±0.058, 0.30, 0); swings ±35° without hitting pelvis."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 24, 27, 1.0)", "secondaryAlbedo": "rgba(16, 17, 20, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_leg_l_2.userData.actionProfile = {"animationRole": "limb", "pivot": {"mode": "explicit", "localPosition": [0.058, 0.3, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["pelvis"] ?? root).add(node_leg_l_2);
  nodes["leg-l"] = node_leg_l_2;
  const mesh_leg_l_2Geometry = endpoint_leg_l_2
    ? new THREE.CylinderGeometry(endpoint_leg_l_2.endRadius, endpoint_leg_l_2.baseRadius, endpoint_leg_l_2.length, 32, 12)
    : new THREE.CapsuleGeometry(0.35, 0.7, 16, 32);
  const mesh_leg_l_2 = new THREE.Mesh(
    mesh_leg_l_2Geometry,
    materialMap["trouser-wool"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leg_l_2.name = "Leg L (trouser)";
  if (endpoint_leg_l_2) {
    mesh_leg_l_2.position.copy(endpoint_leg_l_2.midpoint);
    mesh_leg_l_2.quaternion.copy(endpoint_leg_l_2.quaternion);
  }
  mesh_leg_l_2.castShadow = options.castShadow ?? true;
  mesh_leg_l_2.receiveShadow = options.receiveShadow ?? true;
  mesh_leg_l_2.userData.sculptComponent = {"id": "leg-l", "name": "Leg L (trouser)", "level": "macro", "role": "limb", "importance": 0.9, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Leg L (trouser): discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pelvis", "attachment": {"parentId": "pelvis", "parentSocket": "socket-hip-l", "contactType": "socket-join", "localStart": [0.058, 0.3, 0], "localEnd": [0.058, 0.05, 0], "contactNormal": [0, -1, 0], "overlap": 0.05, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.096, "height": 0.27, "depth": 0.096, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0.058, 0.165, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "limb", "pivot": {"mode": "explicit", "localPosition": [0.058, 0.3, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "trouser-wool", "materialLayers": ["trouser-wool"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Black trouser leg; hangs from pivot-hip-l at (±0.058, 0.30, 0); swings ±35° without hitting pelvis."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 24, 27, 1.0)", "secondaryAlbedo": "rgba(16, 17, 20, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_leg_l_2.add(mesh_leg_l_2);
  meshes["leg-l"] = mesh_leg_l_2;
  colliders["leg-l"] = {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_leg_l_2);

  const attachment_shoe_l_3 = {"parentId": "leg-l", "parentSocket": "socket-ankle-l", "contactType": "socket-join", "localStart": [0.058, 0.06, 0], "localEnd": [0.058, 0.03, 0.11], "contactNormal": [0, -1, 0], "overlap": 0.035, "embedDepth": 0.02, "gapTolerance": 0.005};
  const endpoint_shoe_l_3 = makeAttachmentEndpoint(attachment_shoe_l_3);
  const node_shoe_l_3 = new THREE.Group();
  node_shoe_l_3.name = "Dress shoe L__pivot";
  if (endpoint_shoe_l_3) {
    node_shoe_l_3.position.copy(endpoint_shoe_l_3.start);
    node_shoe_l_3.rotation.set(0, 0, 0);
    node_shoe_l_3.scale.set(1, 1, 1);
  } else {
    node_shoe_l_3.position.set(0.058, 0.034, 0.028);
    node_shoe_l_3.rotation.set(0.0, 0.0, 0.0);
    node_shoe_l_3.scale.set(1.0, 1.0, 1.0);
  }
  node_shoe_l_3.userData.sculptComponent = {"id": "shoe-l", "name": "Dress shoe L", "level": "meso", "role": "appendage", "importance": 0.75, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Dress shoe L: discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "leg-l", "attachment": {"parentId": "leg-l", "parentSocket": "socket-ankle-l", "contactType": "socket-join", "localStart": [0.058, 0.06, 0], "localEnd": [0.058, 0.03, 0.11], "contactNormal": [0, -1, 0], "overlap": 0.035, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.095, "height": 0.065, "depth": 0.175, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0.058, 0.034, 0.028], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "appendage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "shoe-leather", "materialLayers": ["shoe-leather"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Rounded black derby; toe extends +Z ~0.09 beyond trouser; sole flat at y=0."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 19, 22, 1.0)", "secondaryAlbedo": "rgba(42, 42, 46, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.6, "evidenceRefs": ["full-object"]}};
  node_shoe_l_3.userData.actionProfile = {"animationRole": "appendage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["leg-l"] ?? root).add(node_shoe_l_3);
  nodes["shoe-l"] = node_shoe_l_3;
  const mesh_shoe_l_3Geometry = endpoint_shoe_l_3
    ? new THREE.CylinderGeometry(endpoint_shoe_l_3.endRadius, endpoint_shoe_l_3.baseRadius, endpoint_shoe_l_3.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_shoe_l_3 = new THREE.Mesh(
    mesh_shoe_l_3Geometry,
    materialMap["shoe-leather"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shoe_l_3.name = "Dress shoe L";
  if (endpoint_shoe_l_3) {
    mesh_shoe_l_3.position.copy(endpoint_shoe_l_3.midpoint);
    mesh_shoe_l_3.quaternion.copy(endpoint_shoe_l_3.quaternion);
  }
  mesh_shoe_l_3.castShadow = options.castShadow ?? true;
  mesh_shoe_l_3.receiveShadow = options.receiveShadow ?? true;
  mesh_shoe_l_3.userData.sculptComponent = {"id": "shoe-l", "name": "Dress shoe L", "level": "meso", "role": "appendage", "importance": 0.75, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Dress shoe L: discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "leg-l", "attachment": {"parentId": "leg-l", "parentSocket": "socket-ankle-l", "contactType": "socket-join", "localStart": [0.058, 0.06, 0], "localEnd": [0.058, 0.03, 0.11], "contactNormal": [0, -1, 0], "overlap": 0.035, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.095, "height": 0.065, "depth": 0.175, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0.058, 0.034, 0.028], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "appendage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "shoe-leather", "materialLayers": ["shoe-leather"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Rounded black derby; toe extends +Z ~0.09 beyond trouser; sole flat at y=0."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 19, 22, 1.0)", "secondaryAlbedo": "rgba(42, 42, 46, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.6, "evidenceRefs": ["full-object"]}};
  node_shoe_l_3.add(mesh_shoe_l_3);
  meshes["shoe-l"] = mesh_shoe_l_3;
  colliders["shoe-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_shoe_l_3);

  const attachment_leg_r_4 = {"parentId": "pelvis", "parentSocket": "socket-hip-r", "contactType": "socket-join", "localStart": [-0.058, 0.3, 0], "localEnd": [-0.058, 0.05, 0], "contactNormal": [0, -1, 0], "overlap": 0.05, "embedDepth": 0.02, "gapTolerance": 0.005};
  const endpoint_leg_r_4 = makeAttachmentEndpoint(attachment_leg_r_4);
  const node_leg_r_4 = new THREE.Group();
  node_leg_r_4.name = "Leg R (trouser)__pivot";
  if (endpoint_leg_r_4) {
    node_leg_r_4.position.copy(endpoint_leg_r_4.start);
    node_leg_r_4.rotation.set(0, 0, 0);
    node_leg_r_4.scale.set(1, 1, 1);
  } else {
    node_leg_r_4.position.set(-0.058, 0.165, 0.0);
    node_leg_r_4.rotation.set(0.0, 0.0, 0.0);
    node_leg_r_4.scale.set(1.0, 1.0, 1.0);
  }
  node_leg_r_4.userData.sculptComponent = {"id": "leg-r", "name": "Leg R (trouser)", "level": "macro", "role": "limb", "importance": 0.9, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Leg R (trouser): discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pelvis", "attachment": {"parentId": "pelvis", "parentSocket": "socket-hip-r", "contactType": "socket-join", "localStart": [-0.058, 0.3, 0], "localEnd": [-0.058, 0.05, 0], "contactNormal": [0, -1, 0], "overlap": 0.05, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.096, "height": 0.27, "depth": 0.096, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [-0.058, 0.165, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "limb", "pivot": {"mode": "explicit", "localPosition": [-0.058, 0.3, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "trouser-wool", "materialLayers": ["trouser-wool"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Black trouser leg; hangs from pivot-hip-r at (±0.058, 0.30, 0); swings ±35° without hitting pelvis."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 24, 27, 1.0)", "secondaryAlbedo": "rgba(16, 17, 20, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_leg_r_4.userData.actionProfile = {"animationRole": "limb", "pivot": {"mode": "explicit", "localPosition": [-0.058, 0.3, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["pelvis"] ?? root).add(node_leg_r_4);
  nodes["leg-r"] = node_leg_r_4;
  const mesh_leg_r_4Geometry = endpoint_leg_r_4
    ? new THREE.CylinderGeometry(endpoint_leg_r_4.endRadius, endpoint_leg_r_4.baseRadius, endpoint_leg_r_4.length, 32, 12)
    : new THREE.CapsuleGeometry(0.35, 0.7, 16, 32);
  const mesh_leg_r_4 = new THREE.Mesh(
    mesh_leg_r_4Geometry,
    materialMap["trouser-wool"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leg_r_4.name = "Leg R (trouser)";
  if (endpoint_leg_r_4) {
    mesh_leg_r_4.position.copy(endpoint_leg_r_4.midpoint);
    mesh_leg_r_4.quaternion.copy(endpoint_leg_r_4.quaternion);
  }
  mesh_leg_r_4.castShadow = options.castShadow ?? true;
  mesh_leg_r_4.receiveShadow = options.receiveShadow ?? true;
  mesh_leg_r_4.userData.sculptComponent = {"id": "leg-r", "name": "Leg R (trouser)", "level": "macro", "role": "limb", "importance": 0.9, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Leg R (trouser): discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pelvis", "attachment": {"parentId": "pelvis", "parentSocket": "socket-hip-r", "contactType": "socket-join", "localStart": [-0.058, 0.3, 0], "localEnd": [-0.058, 0.05, 0], "contactNormal": [0, -1, 0], "overlap": 0.05, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.096, "height": 0.27, "depth": 0.096, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [-0.058, 0.165, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "limb", "pivot": {"mode": "explicit", "localPosition": [-0.058, 0.3, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "trouser-wool", "materialLayers": ["trouser-wool"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Black trouser leg; hangs from pivot-hip-r at (±0.058, 0.30, 0); swings ±35° without hitting pelvis."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 24, 27, 1.0)", "secondaryAlbedo": "rgba(16, 17, 20, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_leg_r_4.add(mesh_leg_r_4);
  meshes["leg-r"] = mesh_leg_r_4;
  colliders["leg-r"] = {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_leg_r_4);

  const attachment_shoe_r_5 = {"parentId": "leg-r", "parentSocket": "socket-ankle-r", "contactType": "socket-join", "localStart": [-0.058, 0.06, 0], "localEnd": [-0.058, 0.03, 0.11], "contactNormal": [0, -1, 0], "overlap": 0.035, "embedDepth": 0.02, "gapTolerance": 0.005};
  const endpoint_shoe_r_5 = makeAttachmentEndpoint(attachment_shoe_r_5);
  const node_shoe_r_5 = new THREE.Group();
  node_shoe_r_5.name = "Dress shoe R__pivot";
  if (endpoint_shoe_r_5) {
    node_shoe_r_5.position.copy(endpoint_shoe_r_5.start);
    node_shoe_r_5.rotation.set(0, 0, 0);
    node_shoe_r_5.scale.set(1, 1, 1);
  } else {
    node_shoe_r_5.position.set(-0.058, 0.034, 0.028);
    node_shoe_r_5.rotation.set(0.0, 0.0, 0.0);
    node_shoe_r_5.scale.set(1.0, 1.0, 1.0);
  }
  node_shoe_r_5.userData.sculptComponent = {"id": "shoe-r", "name": "Dress shoe R", "level": "meso", "role": "appendage", "importance": 0.75, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Dress shoe R: discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "leg-r", "attachment": {"parentId": "leg-r", "parentSocket": "socket-ankle-r", "contactType": "socket-join", "localStart": [-0.058, 0.06, 0], "localEnd": [-0.058, 0.03, 0.11], "contactNormal": [0, -1, 0], "overlap": 0.035, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.095, "height": 0.065, "depth": 0.175, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [-0.058, 0.034, 0.028], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "appendage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "shoe-leather", "materialLayers": ["shoe-leather"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Rounded black derby; toe extends +Z ~0.09 beyond trouser; sole flat at y=0."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 19, 22, 1.0)", "secondaryAlbedo": "rgba(42, 42, 46, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.6, "evidenceRefs": ["full-object"]}};
  node_shoe_r_5.userData.actionProfile = {"animationRole": "appendage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["leg-r"] ?? root).add(node_shoe_r_5);
  nodes["shoe-r"] = node_shoe_r_5;
  const mesh_shoe_r_5Geometry = endpoint_shoe_r_5
    ? new THREE.CylinderGeometry(endpoint_shoe_r_5.endRadius, endpoint_shoe_r_5.baseRadius, endpoint_shoe_r_5.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_shoe_r_5 = new THREE.Mesh(
    mesh_shoe_r_5Geometry,
    materialMap["shoe-leather"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shoe_r_5.name = "Dress shoe R";
  if (endpoint_shoe_r_5) {
    mesh_shoe_r_5.position.copy(endpoint_shoe_r_5.midpoint);
    mesh_shoe_r_5.quaternion.copy(endpoint_shoe_r_5.quaternion);
  }
  mesh_shoe_r_5.castShadow = options.castShadow ?? true;
  mesh_shoe_r_5.receiveShadow = options.receiveShadow ?? true;
  mesh_shoe_r_5.userData.sculptComponent = {"id": "shoe-r", "name": "Dress shoe R", "level": "meso", "role": "appendage", "importance": 0.75, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Dress shoe R: discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "leg-r", "attachment": {"parentId": "leg-r", "parentSocket": "socket-ankle-r", "contactType": "socket-join", "localStart": [-0.058, 0.06, 0], "localEnd": [-0.058, 0.03, 0.11], "contactNormal": [0, -1, 0], "overlap": 0.035, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.095, "height": 0.065, "depth": 0.175, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [-0.058, 0.034, 0.028], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "appendage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "shoe-leather", "materialLayers": ["shoe-leather"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Rounded black derby; toe extends +Z ~0.09 beyond trouser; sole flat at y=0."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 19, 22, 1.0)", "secondaryAlbedo": "rgba(42, 42, 46, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.6, "evidenceRefs": ["full-object"]}};
  node_shoe_r_5.add(mesh_shoe_r_5);
  meshes["shoe-r"] = mesh_shoe_r_5;
  colliders["shoe-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_shoe_r_5);

  const attachment_torso_jacket_6 = {"parentId": "root", "parentSocket": "socket-spine", "contactType": "socket-join", "localStart": [0, 0.3, 0], "localEnd": [0, 0.64, 0], "contactNormal": [0, 1, 0], "overlap": 0.05, "embedDepth": 0.02, "gapTolerance": 0.005};
  const endpoint_torso_jacket_6 = makeAttachmentEndpoint(attachment_torso_jacket_6);
  const node_torso_jacket_6 = new THREE.Group();
  node_torso_jacket_6.name = "Tuxedo jacket torso__pivot";
  if (endpoint_torso_jacket_6) {
    node_torso_jacket_6.position.copy(endpoint_torso_jacket_6.start);
    node_torso_jacket_6.rotation.set(0, 0, 0);
    node_torso_jacket_6.scale.set(1, 1, 1);
  } else {
    node_torso_jacket_6.position.set(0.0, 0.455, 0.0);
    node_torso_jacket_6.rotation.set(0.0, 0.0, 0.0);
    node_torso_jacket_6.scale.set(1.0, 1.0, 1.0);
  }
  node_torso_jacket_6.userData.sculptComponent = {"id": "torso-jacket", "name": "Tuxedo jacket torso", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Continuous rounded egg-like chibi torso shell wearing the jacket; single smooth closed volume with costume parts surface-mounted.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "socket-spine", "contactType": "socket-join", "localStart": [0, 0.3, 0], "localEnd": [0, 0.64, 0], "contactNormal": [0, 1, 0], "overlap": 0.05, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.31, "height": 0.37, "depth": 0.22, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0, 0.455, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "body-segment", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "jacket-wool", "materialLayers": ["jacket-wool"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "double-breasted-closure", "desc": "Double-breasted overlap: left panel crosses right; two visible dark buttons on the wearer-left column."}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Black tuxedo jacket; spans y 0.27-0.64, shoulder line y~0.575, width 0.31 (~0.95 HU)."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27, 28, 32, 1.0)", "secondaryAlbedo": "rgba(38, 39, 44, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_torso_jacket_6.userData.actionProfile = {"animationRole": "body-segment", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["root"] ?? root).add(node_torso_jacket_6);
  nodes["torso-jacket"] = node_torso_jacket_6;
  const mesh_torso_jacket_6Geometry = endpoint_torso_jacket_6
    ? new THREE.CylinderGeometry(endpoint_torso_jacket_6.endRadius, endpoint_torso_jacket_6.baseRadius, endpoint_torso_jacket_6.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_torso_jacket_6 = new THREE.Mesh(
    mesh_torso_jacket_6Geometry,
    materialMap["jacket-wool"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_torso_jacket_6.name = "Tuxedo jacket torso";
  if (endpoint_torso_jacket_6) {
    mesh_torso_jacket_6.position.copy(endpoint_torso_jacket_6.midpoint);
    mesh_torso_jacket_6.quaternion.copy(endpoint_torso_jacket_6.quaternion);
  }
  mesh_torso_jacket_6.castShadow = options.castShadow ?? true;
  mesh_torso_jacket_6.receiveShadow = options.receiveShadow ?? true;
  mesh_torso_jacket_6.userData.sculptComponent = {"id": "torso-jacket", "name": "Tuxedo jacket torso", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Continuous rounded egg-like chibi torso shell wearing the jacket; single smooth closed volume with costume parts surface-mounted.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "socket-spine", "contactType": "socket-join", "localStart": [0, 0.3, 0], "localEnd": [0, 0.64, 0], "contactNormal": [0, 1, 0], "overlap": 0.05, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.31, "height": 0.37, "depth": 0.22, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0, 0.455, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "body-segment", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "jacket-wool", "materialLayers": ["jacket-wool"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "double-breasted-closure", "desc": "Double-breasted overlap: left panel crosses right; two visible dark buttons on the wearer-left column."}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Black tuxedo jacket; spans y 0.27-0.64, shoulder line y~0.575, width 0.31 (~0.95 HU)."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27, 28, 32, 1.0)", "secondaryAlbedo": "rgba(38, 39, 44, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_torso_jacket_6.add(mesh_torso_jacket_6);
  meshes["torso-jacket"] = mesh_torso_jacket_6;
  colliders["torso-jacket"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_torso_jacket_6);

  const attachment_arm_l_7 = {"parentId": "torso-jacket", "parentSocket": "socket-shoulder-l", "contactType": "socket-join", "localStart": [0.135, 0.575, 0], "localEnd": [0.175, 0.365, 0], "contactNormal": [1, 0.4, 0], "overlap": 0.045, "embedDepth": 0.02, "gapTolerance": 0.005};
  const endpoint_arm_l_7 = makeAttachmentEndpoint(attachment_arm_l_7);
  const node_arm_l_7 = new THREE.Group();
  node_arm_l_7.name = "Arm L (jacket sleeve)__pivot";
  if (endpoint_arm_l_7) {
    node_arm_l_7.position.copy(endpoint_arm_l_7.start);
    node_arm_l_7.rotation.set(0, 0, 0);
    node_arm_l_7.scale.set(1, 1, 1);
  } else {
    node_arm_l_7.position.set(0.163, 0.468, 0.0);
    node_arm_l_7.rotation.set(0.0, 0.0, -0.1);
    node_arm_l_7.scale.set(1.0, 1.0, 1.0);
  }
  node_arm_l_7.userData.sculptComponent = {"id": "arm-l", "name": "Arm L (jacket sleeve)", "level": "macro", "role": "limb", "importance": 0.9, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Arm L (jacket sleeve): discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "torso-jacket", "attachment": {"parentId": "torso-jacket", "parentSocket": "socket-shoulder-l", "contactType": "socket-join", "localStart": [0.135, 0.575, 0], "localEnd": [0.175, 0.365, 0], "contactNormal": [1, 0.4, 0], "overlap": 0.045, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.074, "height": 0.235, "depth": 0.074, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0.163, 0.468, 0], "rotation": [0, 0, -0.1], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "limb", "pivot": {"mode": "explicit", "localPosition": [0.135, 0.575, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "jacket-wool", "materialLayers": ["jacket-wool"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Jacket sleeve; hangs from pivot-shoulder-l at (±0.135, 0.575, 0), splayed ~6° outward so it clears the torso when swinging ±40°."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27, 28, 32, 1.0)", "secondaryAlbedo": "rgba(38, 39, 44, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_arm_l_7.userData.actionProfile = {"animationRole": "limb", "pivot": {"mode": "explicit", "localPosition": [0.135, 0.575, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["torso-jacket"] ?? root).add(node_arm_l_7);
  nodes["arm-l"] = node_arm_l_7;
  const mesh_arm_l_7Geometry = endpoint_arm_l_7
    ? new THREE.CylinderGeometry(endpoint_arm_l_7.endRadius, endpoint_arm_l_7.baseRadius, endpoint_arm_l_7.length, 32, 12)
    : new THREE.CapsuleGeometry(0.35, 0.7, 16, 32);
  const mesh_arm_l_7 = new THREE.Mesh(
    mesh_arm_l_7Geometry,
    materialMap["jacket-wool"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_arm_l_7.name = "Arm L (jacket sleeve)";
  if (endpoint_arm_l_7) {
    mesh_arm_l_7.position.copy(endpoint_arm_l_7.midpoint);
    mesh_arm_l_7.quaternion.copy(endpoint_arm_l_7.quaternion);
  }
  mesh_arm_l_7.castShadow = options.castShadow ?? true;
  mesh_arm_l_7.receiveShadow = options.receiveShadow ?? true;
  mesh_arm_l_7.userData.sculptComponent = {"id": "arm-l", "name": "Arm L (jacket sleeve)", "level": "macro", "role": "limb", "importance": 0.9, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Arm L (jacket sleeve): discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "torso-jacket", "attachment": {"parentId": "torso-jacket", "parentSocket": "socket-shoulder-l", "contactType": "socket-join", "localStart": [0.135, 0.575, 0], "localEnd": [0.175, 0.365, 0], "contactNormal": [1, 0.4, 0], "overlap": 0.045, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.074, "height": 0.235, "depth": 0.074, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0.163, 0.468, 0], "rotation": [0, 0, -0.1], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "limb", "pivot": {"mode": "explicit", "localPosition": [0.135, 0.575, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "jacket-wool", "materialLayers": ["jacket-wool"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Jacket sleeve; hangs from pivot-shoulder-l at (±0.135, 0.575, 0), splayed ~6° outward so it clears the torso when swinging ±40°."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27, 28, 32, 1.0)", "secondaryAlbedo": "rgba(38, 39, 44, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_arm_l_7.add(mesh_arm_l_7);
  meshes["arm-l"] = mesh_arm_l_7;
  colliders["arm-l"] = {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_arm_l_7);

  const attachment_hand_l_8 = {"parentId": "arm-l", "parentSocket": "socket-wrist-l", "contactType": "socket-join", "localStart": [0.175, 0.375, 0], "localEnd": [0.178, 0.33, 0.005], "contactNormal": [0, -1, 0], "overlap": 0.03, "embedDepth": 0.02, "gapTolerance": 0.005};
  const endpoint_hand_l_8 = makeAttachmentEndpoint(attachment_hand_l_8);
  const node_hand_l_8 = new THREE.Group();
  node_hand_l_8.name = "Hand L (mitten)__pivot";
  if (endpoint_hand_l_8) {
    node_hand_l_8.position.copy(endpoint_hand_l_8.start);
    node_hand_l_8.rotation.set(0, 0, 0);
    node_hand_l_8.scale.set(1, 1, 1);
  } else {
    node_hand_l_8.position.set(0.178, 0.352, 0.004);
    node_hand_l_8.rotation.set(0.0, 0.0, 0.0);
    node_hand_l_8.scale.set(1.0, 1.0, 1.0);
  }
  node_hand_l_8.userData.sculptComponent = {"id": "hand-l", "name": "Hand L (mitten)", "level": "meso", "role": "appendage", "importance": 0.7, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Hand L (mitten): discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "arm-l", "attachment": {"parentId": "arm-l", "parentSocket": "socket-wrist-l", "contactType": "socket-join", "localStart": [0.175, 0.375, 0], "localEnd": [0.178, 0.33, 0.005], "contactNormal": [0, -1, 0], "overlap": 0.03, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.082, "height": 0.082, "depth": 0.082, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0.178, 0.352, 0.004], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "appendage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Skin-tone mitten sphere emerging from the sleeve cuff."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 195, 155, 1.0)", "secondaryAlbedo": "rgba(232, 180, 140, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_hand_l_8.userData.actionProfile = {"animationRole": "appendage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["arm-l"] ?? root).add(node_hand_l_8);
  nodes["hand-l"] = node_hand_l_8;
  const mesh_hand_l_8Geometry = endpoint_hand_l_8
    ? new THREE.CylinderGeometry(endpoint_hand_l_8.endRadius, endpoint_hand_l_8.baseRadius, endpoint_hand_l_8.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_hand_l_8 = new THREE.Mesh(
    mesh_hand_l_8Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hand_l_8.name = "Hand L (mitten)";
  if (endpoint_hand_l_8) {
    mesh_hand_l_8.position.copy(endpoint_hand_l_8.midpoint);
    mesh_hand_l_8.quaternion.copy(endpoint_hand_l_8.quaternion);
  }
  mesh_hand_l_8.castShadow = options.castShadow ?? true;
  mesh_hand_l_8.receiveShadow = options.receiveShadow ?? true;
  mesh_hand_l_8.userData.sculptComponent = {"id": "hand-l", "name": "Hand L (mitten)", "level": "meso", "role": "appendage", "importance": 0.7, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Hand L (mitten): discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "arm-l", "attachment": {"parentId": "arm-l", "parentSocket": "socket-wrist-l", "contactType": "socket-join", "localStart": [0.175, 0.375, 0], "localEnd": [0.178, 0.33, 0.005], "contactNormal": [0, -1, 0], "overlap": 0.03, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.082, "height": 0.082, "depth": 0.082, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0.178, 0.352, 0.004], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "appendage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Skin-tone mitten sphere emerging from the sleeve cuff."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 195, 155, 1.0)", "secondaryAlbedo": "rgba(232, 180, 140, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_hand_l_8.add(mesh_hand_l_8);
  meshes["hand-l"] = mesh_hand_l_8;
  colliders["hand-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_hand_l_8);

  const attachment_arm_r_9 = {"parentId": "torso-jacket", "parentSocket": "socket-shoulder-r", "contactType": "socket-join", "localStart": [-0.135, 0.575, 0], "localEnd": [-0.175, 0.365, 0], "contactNormal": [-1, 0.4, 0], "overlap": 0.045, "embedDepth": 0.02, "gapTolerance": 0.005};
  const endpoint_arm_r_9 = makeAttachmentEndpoint(attachment_arm_r_9);
  const node_arm_r_9 = new THREE.Group();
  node_arm_r_9.name = "Arm R (jacket sleeve)__pivot";
  if (endpoint_arm_r_9) {
    node_arm_r_9.position.copy(endpoint_arm_r_9.start);
    node_arm_r_9.rotation.set(0, 0, 0);
    node_arm_r_9.scale.set(1, 1, 1);
  } else {
    node_arm_r_9.position.set(-0.163, 0.468, 0.0);
    node_arm_r_9.rotation.set(0.0, 0.0, 0.1);
    node_arm_r_9.scale.set(1.0, 1.0, 1.0);
  }
  node_arm_r_9.userData.sculptComponent = {"id": "arm-r", "name": "Arm R (jacket sleeve)", "level": "macro", "role": "limb", "importance": 0.9, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Arm R (jacket sleeve): discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "torso-jacket", "attachment": {"parentId": "torso-jacket", "parentSocket": "socket-shoulder-r", "contactType": "socket-join", "localStart": [-0.135, 0.575, 0], "localEnd": [-0.175, 0.365, 0], "contactNormal": [-1, 0.4, 0], "overlap": 0.045, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.074, "height": 0.235, "depth": 0.074, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [-0.163, 0.468, 0], "rotation": [0, 0, 0.1], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "limb", "pivot": {"mode": "explicit", "localPosition": [-0.135, 0.575, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "jacket-wool", "materialLayers": ["jacket-wool"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Jacket sleeve; hangs from pivot-shoulder-r at (±0.135, 0.575, 0), splayed ~6° outward so it clears the torso when swinging ±40°."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27, 28, 32, 1.0)", "secondaryAlbedo": "rgba(38, 39, 44, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_arm_r_9.userData.actionProfile = {"animationRole": "limb", "pivot": {"mode": "explicit", "localPosition": [-0.135, 0.575, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["torso-jacket"] ?? root).add(node_arm_r_9);
  nodes["arm-r"] = node_arm_r_9;
  const mesh_arm_r_9Geometry = endpoint_arm_r_9
    ? new THREE.CylinderGeometry(endpoint_arm_r_9.endRadius, endpoint_arm_r_9.baseRadius, endpoint_arm_r_9.length, 32, 12)
    : new THREE.CapsuleGeometry(0.35, 0.7, 16, 32);
  const mesh_arm_r_9 = new THREE.Mesh(
    mesh_arm_r_9Geometry,
    materialMap["jacket-wool"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_arm_r_9.name = "Arm R (jacket sleeve)";
  if (endpoint_arm_r_9) {
    mesh_arm_r_9.position.copy(endpoint_arm_r_9.midpoint);
    mesh_arm_r_9.quaternion.copy(endpoint_arm_r_9.quaternion);
  }
  mesh_arm_r_9.castShadow = options.castShadow ?? true;
  mesh_arm_r_9.receiveShadow = options.receiveShadow ?? true;
  mesh_arm_r_9.userData.sculptComponent = {"id": "arm-r", "name": "Arm R (jacket sleeve)", "level": "macro", "role": "limb", "importance": 0.9, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Arm R (jacket sleeve): discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "torso-jacket", "attachment": {"parentId": "torso-jacket", "parentSocket": "socket-shoulder-r", "contactType": "socket-join", "localStart": [-0.135, 0.575, 0], "localEnd": [-0.175, 0.365, 0], "contactNormal": [-1, 0.4, 0], "overlap": 0.045, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.074, "height": 0.235, "depth": 0.074, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [-0.163, 0.468, 0], "rotation": [0, 0, 0.1], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "limb", "pivot": {"mode": "explicit", "localPosition": [-0.135, 0.575, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "jacket-wool", "materialLayers": ["jacket-wool"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Jacket sleeve; hangs from pivot-shoulder-r at (±0.135, 0.575, 0), splayed ~6° outward so it clears the torso when swinging ±40°."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27, 28, 32, 1.0)", "secondaryAlbedo": "rgba(38, 39, 44, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_arm_r_9.add(mesh_arm_r_9);
  meshes["arm-r"] = mesh_arm_r_9;
  colliders["arm-r"] = {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_arm_r_9);

  const attachment_hand_r_10 = {"parentId": "arm-r", "parentSocket": "socket-wrist-r", "contactType": "socket-join", "localStart": [-0.175, 0.375, 0], "localEnd": [-0.178, 0.33, 0.005], "contactNormal": [0, -1, 0], "overlap": 0.03, "embedDepth": 0.02, "gapTolerance": 0.005};
  const endpoint_hand_r_10 = makeAttachmentEndpoint(attachment_hand_r_10);
  const node_hand_r_10 = new THREE.Group();
  node_hand_r_10.name = "Hand R (mitten)__pivot";
  if (endpoint_hand_r_10) {
    node_hand_r_10.position.copy(endpoint_hand_r_10.start);
    node_hand_r_10.rotation.set(0, 0, 0);
    node_hand_r_10.scale.set(1, 1, 1);
  } else {
    node_hand_r_10.position.set(-0.178, 0.352, 0.004);
    node_hand_r_10.rotation.set(0.0, 0.0, 0.0);
    node_hand_r_10.scale.set(1.0, 1.0, 1.0);
  }
  node_hand_r_10.userData.sculptComponent = {"id": "hand-r", "name": "Hand R (mitten)", "level": "meso", "role": "appendage", "importance": 0.7, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Hand R (mitten): discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "arm-r", "attachment": {"parentId": "arm-r", "parentSocket": "socket-wrist-r", "contactType": "socket-join", "localStart": [-0.175, 0.375, 0], "localEnd": [-0.178, 0.33, 0.005], "contactNormal": [0, -1, 0], "overlap": 0.03, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.082, "height": 0.082, "depth": 0.082, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [-0.178, 0.352, 0.004], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "appendage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Skin-tone mitten sphere emerging from the sleeve cuff."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 195, 155, 1.0)", "secondaryAlbedo": "rgba(232, 180, 140, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_hand_r_10.userData.actionProfile = {"animationRole": "appendage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["arm-r"] ?? root).add(node_hand_r_10);
  nodes["hand-r"] = node_hand_r_10;
  const mesh_hand_r_10Geometry = endpoint_hand_r_10
    ? new THREE.CylinderGeometry(endpoint_hand_r_10.endRadius, endpoint_hand_r_10.baseRadius, endpoint_hand_r_10.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_hand_r_10 = new THREE.Mesh(
    mesh_hand_r_10Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hand_r_10.name = "Hand R (mitten)";
  if (endpoint_hand_r_10) {
    mesh_hand_r_10.position.copy(endpoint_hand_r_10.midpoint);
    mesh_hand_r_10.quaternion.copy(endpoint_hand_r_10.quaternion);
  }
  mesh_hand_r_10.castShadow = options.castShadow ?? true;
  mesh_hand_r_10.receiveShadow = options.receiveShadow ?? true;
  mesh_hand_r_10.userData.sculptComponent = {"id": "hand-r", "name": "Hand R (mitten)", "level": "meso", "role": "appendage", "importance": 0.7, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Hand R (mitten): discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "arm-r", "attachment": {"parentId": "arm-r", "parentSocket": "socket-wrist-r", "contactType": "socket-join", "localStart": [-0.175, 0.375, 0], "localEnd": [-0.178, 0.33, 0.005], "contactNormal": [0, -1, 0], "overlap": 0.03, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.082, "height": 0.082, "depth": 0.082, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [-0.178, 0.352, 0.004], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "appendage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Skin-tone mitten sphere emerging from the sleeve cuff."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 195, 155, 1.0)", "secondaryAlbedo": "rgba(232, 180, 140, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_hand_r_10.add(mesh_hand_r_10);
  meshes["hand-r"] = mesh_hand_r_10;
  colliders["hand-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_hand_r_10);

  const attachment_neck_11 = {"parentId": "torso-jacket", "parentSocket": "socket-neck", "contactType": "socket-join", "localStart": [0, 0.61, 0.005], "localEnd": [0, 0.67, 0.005], "contactNormal": [0, 1, 0], "overlap": 0.04, "embedDepth": 0.02, "gapTolerance": 0.005};
  const endpoint_neck_11 = makeAttachmentEndpoint(attachment_neck_11);
  const node_neck_11 = new THREE.Group();
  node_neck_11.name = "Neck__pivot";
  if (endpoint_neck_11) {
    node_neck_11.position.copy(endpoint_neck_11.start);
    node_neck_11.rotation.set(0, 0, 0);
    node_neck_11.scale.set(1, 1, 1);
  } else {
    node_neck_11.position.set(0.0, 0.635, 0.005);
    node_neck_11.rotation.set(0.0, 0.0, 0.0);
    node_neck_11.scale.set(1.0, 1.0, 1.0);
  }
  node_neck_11.userData.sculptComponent = {"id": "neck", "name": "Neck", "level": "meso", "role": "connector", "importance": 0.7, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Neck: discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "torso-jacket", "attachment": {"parentId": "torso-jacket", "parentSocket": "socket-neck", "contactType": "socket-join", "localStart": [0, 0.61, 0.005], "localEnd": [0, 0.67, 0.005], "contactNormal": [0, 1, 0], "overlap": 0.04, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.095, "height": 0.07, "depth": 0.095, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0, 0.635, 0.005], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "connector", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Short skin cylinder mostly hidden by collar and head; pivot-neck sits at (0, 0.645, 0)."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 195, 155, 1.0)", "secondaryAlbedo": "rgba(232, 180, 140, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_neck_11.userData.actionProfile = {"animationRole": "connector", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["torso-jacket"] ?? root).add(node_neck_11);
  nodes["neck"] = node_neck_11;
  const mesh_neck_11Geometry = endpoint_neck_11
    ? new THREE.CylinderGeometry(endpoint_neck_11.endRadius, endpoint_neck_11.baseRadius, endpoint_neck_11.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_neck_11 = new THREE.Mesh(
    mesh_neck_11Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_neck_11.name = "Neck";
  if (endpoint_neck_11) {
    mesh_neck_11.position.copy(endpoint_neck_11.midpoint);
    mesh_neck_11.quaternion.copy(endpoint_neck_11.quaternion);
  }
  mesh_neck_11.castShadow = options.castShadow ?? true;
  mesh_neck_11.receiveShadow = options.receiveShadow ?? true;
  mesh_neck_11.userData.sculptComponent = {"id": "neck", "name": "Neck", "level": "meso", "role": "connector", "importance": 0.7, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Neck: discrete stylized chibi body/costume part assembled onto the rig; a smooth closed primitive volume, not a continuous multi-part sculpt.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "torso-jacket", "attachment": {"parentId": "torso-jacket", "parentSocket": "socket-neck", "contactType": "socket-join", "localStart": [0, 0.61, 0.005], "localEnd": [0, 0.67, 0.005], "contactNormal": [0, 1, 0], "overlap": 0.04, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.095, "height": 0.07, "depth": 0.095, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0, 0.635, 0.005], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "connector", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Short skin cylinder mostly hidden by collar and head; pivot-neck sits at (0, 0.645, 0)."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 195, 155, 1.0)", "secondaryAlbedo": "rgba(232, 180, 140, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_neck_11.add(mesh_neck_11);
  meshes["neck"] = mesh_neck_11;
  colliders["neck"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_neck_11);

  const attachment_head_12 = {"parentId": "neck", "parentSocket": "socket-neck-top", "contactType": "socket-join", "localStart": [0, 0.66, 0.005], "localEnd": [0, 0.965, 0.005], "contactNormal": [0, 1, 0], "overlap": 0.045, "embedDepth": 0.02, "gapTolerance": 0.005};
  const endpoint_head_12 = makeAttachmentEndpoint(attachment_head_12);
  const node_head_12 = new THREE.Group();
  node_head_12.name = "Head__pivot";
  if (endpoint_head_12) {
    node_head_12.position.copy(endpoint_head_12.start);
    node_head_12.rotation.set(0, 0, 0);
    node_head_12.scale.set(1, 1, 1);
  } else {
    node_head_12.position.set(0.0, 0.8, 0.005);
    node_head_12.rotation.set(0.0, 0.0, 0.0);
    node_head_12.scale.set(1.0, 1.0, 1.0);
  }
  node_head_12.userData.sculptComponent = {"id": "head", "name": "Head", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Single smooth rounded head volume with full cheeks; features are surface-mounted children.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "neck", "attachment": {"parentId": "neck", "parentSocket": "socket-neck-top", "contactType": "socket-join", "localStart": [0, 0.66, 0.005], "localEnd": [0, 0.965, 0.005], "contactNormal": [0, 1, 0], "overlap": 0.045, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.35, "height": 0.33, "depth": 0.32, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0, 0.8, 0.005], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "body-segment", "pivot": {"mode": "explicit", "localPosition": [0, 0.645, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "face-layout", "desc": "Chibi face layout on head bbox y 0.635-0.965: eyeLine 0.58 (y=0.783), noseBase 0.72 (y=0.737), mouthLine 0.82 (y=0.705), hairline 0.25; round-oval face, full cheeks widest slightly below eye line."}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Oversized chibi head ~36% of total height (1.0 HU of 2.75); slightly wider than tall."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 195, 155, 1.0)", "secondaryAlbedo": "rgba(232, 180, 140, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_head_12.userData.actionProfile = {"animationRole": "body-segment", "pivot": {"mode": "explicit", "localPosition": [0, 0.645, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["neck"] ?? root).add(node_head_12);
  nodes["head"] = node_head_12;
  const mesh_head_12Geometry = endpoint_head_12
    ? new THREE.CylinderGeometry(endpoint_head_12.endRadius, endpoint_head_12.baseRadius, endpoint_head_12.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_head_12 = new THREE.Mesh(
    mesh_head_12Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_head_12.name = "Head";
  if (endpoint_head_12) {
    mesh_head_12.position.copy(endpoint_head_12.midpoint);
    mesh_head_12.quaternion.copy(endpoint_head_12.quaternion);
  }
  mesh_head_12.castShadow = options.castShadow ?? true;
  mesh_head_12.receiveShadow = options.receiveShadow ?? true;
  mesh_head_12.userData.sculptComponent = {"id": "head", "name": "Head", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Single smooth rounded head volume with full cheeks; features are surface-mounted children.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "neck", "attachment": {"parentId": "neck", "parentSocket": "socket-neck-top", "contactType": "socket-join", "localStart": [0, 0.66, 0.005], "localEnd": [0, 0.965, 0.005], "contactNormal": [0, 1, 0], "overlap": 0.045, "embedDepth": 0.02, "gapTolerance": 0.005}, "dimensions": {"width": 0.35, "height": 0.33, "depth": 0.32, "units": "world (total character height = 1.0)", "confidence": 0.8}, "transform": {"position": [0, 0.8, 0.005], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "body-segment", "pivot": {"mode": "explicit", "localPosition": [0, 0.645, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "face-layout", "desc": "Chibi face layout on head bbox y 0.635-0.965: eyeLine 0.58 (y=0.783), noseBase 0.72 (y=0.737), mouthLine 0.82 (y=0.705), hairline 0.25; round-oval face, full cheeks widest slightly below eye line."}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Oversized chibi head ~36% of total height (1.0 HU of 2.75); slightly wider than tall."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 195, 155, 1.0)", "secondaryAlbedo": "rgba(232, 180, 140, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.9, "evidenceRefs": ["full-object"]}};
  node_head_12.add(mesh_head_12);
  meshes["head"] = mesh_head_12;
  colliders["head"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_head_12);

  const attachment_hair_main_13 = {"parentId": "head", "parentSocket": "socket-skull", "contactType": "surface-mount", "localStart": [0, 0.8, -0.02], "localEnd": [0, 0.995, -0.02], "contactNormal": [0, 1, 0], "overlap": 0.03, "embedDepth": 0.06, "gapTolerance": 0.005};
  const endpoint_hair_main_13 = makeAttachmentEndpoint(attachment_hair_main_13);
  const node_hair_main_13 = new THREE.Group();
  node_hair_main_13.name = "Hair main mass__pivot";
  if (endpoint_hair_main_13) {
    node_hair_main_13.position.copy(endpoint_hair_main_13.start);
    node_hair_main_13.rotation.set(0, 0, 0);
    node_hair_main_13.scale.set(1, 1, 1);
  } else {
    node_hair_main_13.position.set(0.0, 0.845, -0.018);
    node_hair_main_13.rotation.set(0.0, 0.0, 0.0);
    node_hair_main_13.scale.set(1.0, 1.0, 1.0);
  }
  node_hair_main_13.userData.sculptComponent = {"id": "hair-main", "name": "Hair main mass", "level": "macro", "role": "hair", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Single sculpted swept-up hair mass capping the skull; silhouette matters more than strands.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "socket-skull", "contactType": "surface-mount", "localStart": [0, 0.8, -0.02], "localEnd": [0, 0.995, -0.02], "contactNormal": [0, 1, 0], "overlap": 0.03, "embedDepth": 0.06, "gapTolerance": 0.005}, "dimensions": {"width": 0.375, "height": 0.3, "depth": 0.35, "units": "world (total character height = 1.0)", "confidence": 0.85}, "transform": {"position": [0, 0.845, -0.018], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-detail", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "side-part", "desc": "Soft side part on the character-RIGHT (-x) side: front hairline dips lower at -x, quiff mass rises at +x."}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Dark swept-up-and-back volume; top of hair ~y 0.995; leaves face open below hairline 0.25 (y~0.89)."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 32, 27, 1.0)", "secondaryAlbedo": "rgba(58, 48, 40, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "evidenceRefs": ["full-object"]}};
  node_hair_main_13.userData.actionProfile = {"animationRole": "static-detail", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["head"] ?? root).add(node_hair_main_13);
  nodes["hair-main"] = node_hair_main_13;
  const mesh_hair_main_13Geometry = endpoint_hair_main_13
    ? new THREE.CylinderGeometry(endpoint_hair_main_13.endRadius, endpoint_hair_main_13.baseRadius, endpoint_hair_main_13.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_hair_main_13 = new THREE.Mesh(
    mesh_hair_main_13Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hair_main_13.name = "Hair main mass";
  if (endpoint_hair_main_13) {
    mesh_hair_main_13.position.copy(endpoint_hair_main_13.midpoint);
    mesh_hair_main_13.quaternion.copy(endpoint_hair_main_13.quaternion);
  }
  mesh_hair_main_13.castShadow = options.castShadow ?? true;
  mesh_hair_main_13.receiveShadow = options.receiveShadow ?? true;
  mesh_hair_main_13.userData.sculptComponent = {"id": "hair-main", "name": "Hair main mass", "level": "macro", "role": "hair", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Single sculpted swept-up hair mass capping the skull; silhouette matters more than strands.", "geometryDescriptor": {"topologyIntent": "stylized chibi character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "socket-skull", "contactType": "surface-mount", "localStart": [0, 0.8, -0.02], "localEnd": [0, 0.995, -0.02], "contactNormal": [0, 1, 0], "overlap": 0.03, "embedDepth": 0.06, "gapTolerance": 0.005}, "dimensions": {"width": 0.375, "height": 0.3, "depth": 0.35, "units": "world (total character height = 1.0)", "confidence": 0.85}, "transform": {"position": [0, 0.845, -0.018], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-detail", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "side-part", "desc": "Soft side part on the character-RIGHT (-x) side: front hairline dips lower at -x, quiff mass rises at +x."}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "Dark swept-up-and-back volume; top of hair ~y 0.995; leaves face open below hairline 0.25 (y~0.89)."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 32, 27, 1.0)", "secondaryAlbedo": "rgba(58, 48, 40, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "evidenceRefs": ["full-object"]}};
  node_hair_main_13.add(mesh_hair_main_13);
  meshes["hair-main"] = mesh_hair_main_13;
  colliders["hair-main"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_hair_main_13);

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "stylized-likeness", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "Deliberate stylized chibi mascot: material scalars are authored from observation of the reference (matte wool vs satin lapel sheen vs cotton vs skin), NOT extracted/projected. The single garden photo carries heavy baked foliage lighting, so per-crop PBR extraction would be below-threshold inference; documented here as the accepted limitation per the anti-shallow-spec rules."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createLeviChibiLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Levi Chibi look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = ["key light: warm soft directional from upper front character-left (+0.6, +1.0, +0.8), intensity ~1.1, color #FFF2E0 (garden daylight on the face in the reference)", "fill light: cool hemisphere/ambient fill, intensity ~0.5, faint green-cyan foliage tint; keeps the black tuxedo readable without flattening", "rim light: cool rim from upper rear (-0.4, +0.8, -1.0), intensity ~0.7, color #DCE8FF; separates dark hair and jacket shoulders from the background", "exposure 1.0 with ACES filmic tone mapping; neutral dark-grey #2A2D33 review background", "soft contact shadow (ground shadow) under the shoes at y=0, radius ~0.2, plus gentle ambient occlusion in the lapel/collar creases"];
  lights.userData.lookDevTargets = {"qualityPriority": "stylized-likeness", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "Deliberate stylized chibi mascot: material scalars are authored from observation of the reference (matte wool vs satin lapel sheen vs cotton vs skin), NOT extracted/projected. The single garden photo carries heavy baked foliage lighting, so per-crop PBR extraction would be below-threshold inference; documented here as the accepted limitation per the anti-shallow-spec rules."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createLeviChibiEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameLeviChibiCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createLeviChibiPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureLeviChibiRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createLeviChibiInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
