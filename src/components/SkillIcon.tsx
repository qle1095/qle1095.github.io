import type { CSSProperties } from 'react';
import {
  siApachekafka,
  siApacheavro,
  siApachesuperset,
  siBackstage,
  siCypress,
  siDocker,
  siGit,
  siGitlab,
  siGnubash,
  siGo,
  siHelm,
  siIstio,
  siJavascript,
  siJunit5,
  siKeycloak,
  siKubernetes,
  siLinux,
  siMinio,
  siMongodb,
  siMui,
  siNvidia,
  siOllama,
  siPostgresql,
  siPython,
  siQuarkus,
  siReact,
  siScala,
  siSpringboot,
  siTrino,
  siTypescript,
  type SimpleIcon,
} from 'simple-icons';
import {
  Award,
  Bot,
  Coffee,
  Database,
  Gauge,
  Layers,
  MessagesSquare,
  Plug,
  Route,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { iconSize, rem } from '../lib/uiScale';

// One registry for every technology mark on the site: monochrome Simple Icons
// brand paths where a logo exists, Lucide glyphs where it doesn't (Java was
// removed from Simple Icons; "SQL" and "REST" aren't brands). `hex` only tints
// the tile behind the glyph — the glyph itself is always currentColor.
type IconDef = { title: string; hex: string; path?: string; Glyph?: LucideIcon };

const brand = (si: SimpleIcon): IconDef => ({ title: si.title, hex: `#${si.hex}`, path: si.path });
const glyph = (title: string, hex: string, Glyph: LucideIcon): IconDef => ({ title, hex, Glyph });

export const ICONS: Record<string, IconDef> = {
  javascript: brand(siJavascript),
  typescript: brand(siTypescript),
  python: brand(siPython),
  go: brand(siGo),
  scala: brand(siScala),
  bash: brand(siGnubash),
  java: glyph('Java', '#e76f00', Coffee),
  sql: glyph('SQL', '#336791', Database),
  rest: glyph('REST APIs', '#6a6f85', Plug),
  agents: glyph('Multi-Agent AI', '#7c3aed', Bot),
  deltalake: glyph('Delta Lake', '#00add4', Layers),
  opa: glyph('OPA / Rego', '#566366', ShieldCheck),
  clearance: glyph('Clearance', '#1f7a57', ShieldCheck),
  cert: glyph('Certification', '#c2410c', Award),
  git: brand(siGit),
  gitlab: brand(siGitlab),
  react: brand(siReact),
  mui: brand(siMui),
  springboot: brand(siSpringboot),
  quarkus: brand(siQuarkus),
  docker: brand(siDocker),
  kubernetes: brand(siKubernetes),
  helm: brand(siHelm),
  istio: brand(siIstio),
  minio: brand(siMinio),
  linux: brand(siLinux),
  kafka: brand(siApachekafka),
  avro: brand(siApacheavro),
  trino: brand(siTrino),
  superset: brand(siApachesuperset),
  postgresql: brand(siPostgresql),
  mongodb: brand(siMongodb),
  ollama: brand(siOllama),
  litellm: glyph('LiteLLM', '#0f766e', Route), // no brand mark; it's a model router
  openwebui: glyph('Open WebUI', '#3c4157', MessagesSquare),
  gpu: brand(siNvidia),
  backstage: brand(siBackstage),
  keycloak: brand(siKeycloak),
  junit: brand(siJunit5),
  cypress: brand(siCypress),
  jmeter: glyph('JMeter', '#d22128', Gauge), // the feather wordmark reads as a dash at 18px
};

/**
 * A technology mark. `icon` is a registry key (journey.ts `Skill.icon`).
 * With `tile`, it sits in a rounded square tinted with the brand colour,
 * sized via `--tile` (defaults to 1.75× the glyph). `size` is px at UI scale
 * 1; glyph and tile are sized in rem so they scale with the page.
 * Unknown keys render nothing rather than leaking the raw slug as text.
 */
export default function SkillIcon({
  icon,
  size = 18,
  tile = false,
  className,
}: {
  icon: string;
  size?: number;
  tile?: boolean;
  className?: string;
}) {
  const def = ICONS[icon];
  if (!def) return null;
  const sized = iconSize(size);
  const mark = def.Glyph ? (
    <def.Glyph {...sized} strokeWidth={2} aria-hidden="true" focusable="false" />
  ) : (
    <svg
      width={size}
      height={size}
      style={sized.style}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={def.path} />
    </svg>
  );
  if (!tile) return mark;
  return (
    <span
      className={['skill-tile', className].filter(Boolean).join(' ')}
      style={{ '--brand': def.hex, '--tile': rem(Math.round(size * 1.75)) } as CSSProperties}
    >
      {mark}
    </span>
  );
}
