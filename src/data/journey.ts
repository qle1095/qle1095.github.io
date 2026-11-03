// ---------------------------------------------------------------------------
// The single source of truth for the journey. Updating the resume = editing
// this file. Horizontal positions are computed from dates in lib/layout.ts —
// nothing here is hand-placed.
//
// Copy conventions: title = the role or the thing built; subtitle =
// "Company · context"; stories ≤ 35 words in resume voice with ONE **bold**
// highlight; numbers a recruiter should skim go in `metric`.
// ---------------------------------------------------------------------------

export type Skill = {
  id: string;
  label: string;
  /** Key into the icon registry in components/SkillIcon.tsx (brand logo or UI glyph). */
  icon: string;
};

export type MilestoneKind = 'job' | 'education' | 'achievement' | 'launch';

/** A headline number pulled out of the story so it can be read at a glance. */
export type Metric = { value: string; label: string };

export type Milestone = {
  id: string;
  /** Layout-only chronological anchor — NEVER shown. Set `display` to show a date. */
  date: string;
  /** The date text shown on the card. Omit when the real date is unknown. */
  display?: string;
  title: string;
  subtitle?: string;
  story: string;
  /** Extra highlights for a flagship card, behind a "more" toggle under the story. */
  details?: string[];
  metric?: Metric;
  kind: MilestoneKind;
  celebrate?: boolean; // character celebrates on arrival
  skills?: Skill[]; // pickups placed on the path just before this milestone
};

export type Chapter = {
  id: string;
  label: string;
  /** Shown in the sticky company badge at the top of the stage. */
  company: string;
  theme: 'sunrise' | 'bank' | 'ascent' | 'platform' | 'frontier';
  milestones: Milestone[];
};

export type SideQuest = {
  id: string;
  date: string;
  title: string;
  story: string;
  metric?: Metric;
  /** Optional link out (e.g. to the Playground), shown under the story. */
  link?: { href: string; label: string };
};

export const profile = {
  name: 'Levi Q Le',
  tagline: 'Staff Software Engineer · AI Inference & Platform',
  location: 'Tampa, FL',
  clearance: 'Active TS/SCI',
  email: 'qle1095@gmail.com',
  linkedin: 'https://linkedin.com/in/levi-q-le',
  resumePdf: '/resume.pdf',
  intro:
    'A generalist trusted to drop into whatever matters most: data platforms, air-gapped delivery, and now **self-hosted LLM inference on Kubernetes**. I led Data Fabric, the data platform central to Raft’s $450M acquisition by Leonardo DRS.',
  /** The hero proof strip: four facts a recruiter should leave with. */
  stats: [
    { value: '$450M', label: 'acquisition, Data Fabric at its center' },
    { value: '3 → 12', label: 'engineers: team rebuilt and led' },
    { value: '1 yr', label: 'Associate → Staff, skipping Senior' },
    { value: 'TS/SCI', label: 'active U.S. clearance' },
  ] satisfies Metric[],
};

export const chapters: Chapter[] = [
  {
    id: 'foundations',
    label: 'Foundations',
    company: 'FIU · JPMorgan Chase intern',
    theme: 'sunrise',
    milestones: [
      {
        id: 'intern-2018',
        date: '2018-06',
        display: '2018–2019',
        title: 'Software Engineering Intern, Twice',
        subtitle: 'JPMorgan Chase · Tampa, FL',
        story:
          'Built a React + Spring Boot labeling app that produced **human-labeled training data for an OCR model**, then was invited back to ship an Integrated Receivables client-onboarding app that version-tracks every configuration file.',
        kind: 'job',
        skills: [
          { id: 'javascript', label: 'JavaScript', icon: 'javascript' },
          { id: 'react', label: 'React', icon: 'react' },
          { id: 'java', label: 'Java', icon: 'java' },
          { id: 'git', label: 'Git', icon: 'git' },
        ],
      },
      {
        id: 'fiu-grad',
        date: '2019-12',
        display: 'Dec 2019',
        title: 'B.S., IT Software Development',
        subtitle: 'Florida International University · Miami, FL',
        story:
          'Graduated **magna cum laude** with a second focus in cybersecurity and two JPMorgan Chase internships already done.',
        kind: 'education',
        celebrate: true,
        skills: [{ id: 'sql', label: 'SQL', icon: 'sql' }],
      },
    ],
  },
  {
    id: 'the-bank',
    label: 'The Bank',
    company: 'JPMorgan Chase',
    theme: 'bank',
    milestones: [
      {
        id: 'jpmc-sep',
        date: '2020-02',
        display: 'Feb 2020',
        title: 'Software Engineer',
        subtitle: 'JPMorgan Chase · Billing & Pricing platform',
        story:
          'Went full-time building **Java/Spring Boot REST services** for client charge processing, load-tested with JMeter and BlazeMeter. Single-handedly built two messaging utilities, for **Kafka and IBM MQ**, to read and publish messages.',
        kind: 'job',
        skills: [
          { id: 'spring', label: 'Spring Boot', icon: 'springboot' },
          { id: 'rest', label: 'REST APIs', icon: 'rest' },
          { id: 'kafka', label: 'Kafka', icon: 'kafka' },
          { id: 'ibmmq', label: 'IBM MQ', icon: 'ibmmq' },
          { id: 'jmeter', label: 'JMeter', icon: 'jmeter' },
        ],
      },
      {
        id: 'service-container',
        date: '2020-11',
        title: 'Service Container Platform',
        subtitle: 'JPMorgan Chase · Payments infrastructure',
        story:
          'Built four utilities for a shared payments library **adopted by ~30 teams org-wide**: messaging toolkit, failure handler, retry, and validation suite. Also helped containerize ~10 legacy Java apps and move them onto the bank’s internal Kubernetes platform.',
        metric: { value: '~30', label: 'teams adopted the shared library' },
        kind: 'launch',
        skills: [
          { id: 'docker', label: 'Docker', icon: 'docker' },
          { id: 'kubernetes', label: 'Kubernetes', icon: 'kubernetes' },
        ],
      },
      {
        id: 'sep-fast-track',
        date: '2021-08',
        display: '18 months in',
        title: 'Fast-Tracked',
        subtitle: 'JPMorgan Chase · Software Engineer Program',
        story:
          'Graduated the bank’s two-year program in 18 months, **six months early**, while mentoring four junior engineers.',
        metric: { value: '18 mo', label: 'to finish a two-year program' },
        kind: 'achievement',
        celebrate: true,
      },
    ],
  },
  {
    id: 'startup-ascent',
    label: 'Startup Ascent',
    company: 'Raft',
    theme: 'ascent',
    milestones: [
      {
        id: 'joined-raft',
        date: '2022-04',
        display: 'Apr 2022',
        title: 'Associate Software Engineer',
        subtitle: 'Raft · Remote · Employee #62',
        story:
          'Joined as employee #62 (now 350+) and started building **Data Fabric from scratch**: Kubernetes Operators and CRDs (Kubebuilder) for data ingestion, plus a Next.js/TypeScript web app on a Go REST service with Cypress end-to-end tests.',
        metric: { value: '#62', label: 'employee number; Raft is now 350+' },
        kind: 'job',
        skills: [
          { id: 'go', label: 'Go', icon: 'go' },
          { id: 'typescript', label: 'TypeScript', icon: 'typescript' },
          { id: 'cypress', label: 'Cypress', icon: 'cypress' },
        ],
      },
      {
        id: 'live-demo',
        date: '2022-09',
        title: 'The Live Demo',
        subtitle: 'Raft · Multi-million-dollar contract win',
        story:
          'Helped **win a multi-million-dollar contract** by building a customer-requested feature live during the executive demo. Repeatedly picked for the hackathon teams behind Raft’s contract wins, and the customer’s engineering counterpart, turning their requirements into technical designs.',
        kind: 'achievement',
        celebrate: true,
        skills: [
          { id: 'helm', label: 'Helm', icon: 'helm' },
          { id: 'gitlab', label: 'GitLab CI/CD', icon: 'gitlab' },
        ],
      },
      {
        id: 'air-gap',
        date: '2022-12',
        title: 'Air-Gap Specialist',
        subtitle: 'High-security delivery · Active TS/SCI',
        story:
          'Go-to engineer for **air-gapped customer networks**: lead deployments, rescuing several ahead of scheduled demos, and debug production on-site in restricted facilities with no internet or standard tooling.',
        kind: 'achievement',
        skills: [
          { id: 'linux', label: 'Linux', icon: 'linux' },
          { id: 'bash', label: 'Bash', icon: 'bash' },
          { id: 'istio', label: 'Istio', icon: 'istio' },
        ],
      },
      {
        id: 'staff-promo',
        date: '2023-04',
        display: 'Apr 2023',
        title: 'Associate → Staff → Team Lead',
        subtitle: 'Raft · Skipped Senior · Rebuilt the Data Fabric team',
        story:
          'Promoted **directly from Associate to Staff in one year**, skipping Senior, with multiple spot bonuses. When a reorg left Data Fabric with ~3 engineers, stepped up as team lead, interviewing and mentoring most of the hires that **rebuilt it to 12**.',
        metric: { value: '3 → 12', label: 'engineers: team rebuilt after a reorg' },
        kind: 'achievement',
        celebrate: true,
      },
    ],
  },
  {
    id: 'platform-era',
    label: 'Platform Era',
    company: 'Raft',
    theme: 'platform',
    milestones: [
      {
        id: 'data-fabric',
        date: '2023-07',
        display: '2023',
        title: 'Data Fabric: “Google over your data”',
        subtitle: 'Raft · Tech lead, 12-engineer cross-functional team',
        story:
          '**Hundreds of users** search thousands of datasets across 200+ sources, seeing only the rows and columns their access allows. Led it end to end, from data engineering to DevSecOps: onboarded ~10 data vendors and deployed to air-gapped networks.',
        details: [
          'Built **ABAC** row- and column-level access control with custom Trino and Superset plugins and OPA rules.',
          'Wrote a **dynamic Avro Kafka producer** that infers schemas at consume time, so users run SQL over Kafka with no per-topic setup, plus the internal engineering blog post on it.',
          'Integrated Strimzi Kafka, Trino, Delta Lake, MinIO, Keycloak, Superset, JupyterHub and cert-manager into **one self-service stack**.',
        ],
        metric: { value: '200+', label: 'data sources, one search' },
        kind: 'launch',
        skills: [
          { id: 'trino', label: 'Trino', icon: 'trino' },
          { id: 'delta', label: 'Delta Lake', icon: 'deltalake' },
          { id: 'keycloak', label: 'Keycloak', icon: 'keycloak' },
          { id: 'minio', label: 'MinIO', icon: 'minio' },
          { id: 'superset', label: 'Superset', icon: 'superset' },
          { id: 'avro', label: 'Avro', icon: 'avro' },
          { id: 'opa', label: 'OPA / Rego', icon: 'opa' },
        ],
      },
      {
        id: 'cbc2',
        date: '2024-03',
        title: 'CBC2: Real-Time Data Pipeline',
        subtitle: 'Raft · Government customer · ~6-engineer team',
        story:
          'Grew out of a hackathon win: a real-time pipeline turning **live field data into objects on an operational map**, streamed to the browser over WebSockets. Designed Raft’s initial architecture at kickoff while still leading Data Fabric.',
        details: [
          'Built the **ingest, validation and enrichment** stages with Kafka Streams in Scala.',
          'Met the contract’s **10,000 messages/sec** requirement by optimizing every stage and redesigning the bottleneck components.',
        ],
        metric: { value: '10,000', label: 'messages/sec, contract requirement met' },
        kind: 'launch',
        skills: [
          { id: 'scala', label: 'Scala', icon: 'scala' },
          { id: 'kafkastreams', label: 'Kafka Streams', icon: 'kafka' },
          { id: 'websockets', label: 'WebSockets', icon: 'websockets' },
        ],
      },
      {
        id: 'backstage',
        date: '2024-10',
        title: 'Platform Multiplier',
        subtitle: 'Raft · Org-wide CI/CD for 30+ applications',
        story:
          'Onboarded **~30 teams** to the org-wide CI/CD flow through Backstage, writing custom plugins that pull more platform data into it, so each team gets one view of project status, security posture, and compliance readiness. Also automated previously manual deployment steps.',
        details: [
          'Led **pipeline observability**: integrated GitLab APIs, S3, and Superset to publish metrics on jobs, security, and operations.',
        ],
        metric: { value: '~30', label: 'teams onboarded to one CI/CD flow' },
        kind: 'launch',
        skills: [
          { id: 'backstage', label: 'Backstage', icon: 'backstage' },
        ],
      },
      {
        id: 'ckad',
        date: '2025-03',
        display: '2025',
        title: 'CKAD Certified',
        subtitle: 'Kubernetes · Security+ (SY0-701)',
        story:
          'Earned the **Certified Kubernetes Application Developer** credential, alongside CompTIA Security+ (SY0-701), backing the platform and security work with certifications.',
        kind: 'achievement',
        celebrate: true,
      },
    ],
  },
  {
    id: 'ai-frontier',
    label: 'The AI Frontier',
    company: 'Raft → Leonardo DRS',
    theme: 'frontier',
    milestones: [
      {
        id: 'vuln-platform',
        date: '2025-07',
        title: 'Vulnerability Assessment Platform',
        subtitle: 'Raft · New contract · Full-stack',
        story:
          'Moved to a new contract and jumped into its web app, where security analysts review releases carrying **tens of thousands of CVE findings**, with automated risk scoring and an auditable accept/reject record.',
        details: [
          'Go/MongoDB backend pulls and aggregates CVE findings for every Docker image in a release, **replacing hand-compiled scanner reports**.',
          'TypeScript/React frontend: dashboards, drill-down views, and CVE justification workflows.',
        ],
        metric: { value: '5', label: 'analysts review each release' },
        kind: 'launch',
        skills: [
          { id: 'mongodb', label: 'MongoDB', icon: 'mongodb' },
        ],
      },
      {
        id: 'ai-use-cases',
        date: '2026-01',
        title: 'Took the Lead on AI',
        subtitle: 'Raft · AI initiative lead',
        story:
          'The org asked teams to bring AI into their apps and workflows, with no playbook. **Took the lead** and built the proofs of concept; the flagship drafts CVE justifications from a knowledge base for human review.',
        details: [
          'Multi-agent workflow on **fully self-hosted models** (Ollama, Gemma): one agent drafts from analyst-approved precedent, another curates the knowledge base.',
          'Attacks a ~5-minute-per-CVE research burden. **No customer data leaves** the environment, and a human analyst approves every draft.',
        ],
        kind: 'launch',
        skills: [
          { id: 'agents', label: 'Multi-Agent AI', icon: 'agents' },
        ],
      },
      {
        id: 'acquisition',
        date: '2026-07',
        display: 'Jul 2026',
        title: 'The $450M Acquisition',
        subtitle: 'Leonardo DRS · Announced July 2026',
        story:
          'The payoff: **Data Fabric** anchors the multi-domain data-fusion capability cited in Leonardo DRS’s $450M acquisition of Raft.',
        metric: { value: '$450M', label: 'acquisition of Raft' },
        kind: 'achievement',
        celebrate: true,
      },
      {
        // Last on purpose: the walk ends on the work he wants to do next.
        id: 'ai-inference',
        date: '2026-09',
        display: 'Now',
        title: 'AI Inference Platform Lead',
        subtitle: 'Raft · Self-hosted LLMs on EKS GPUs',
        story:
          'With no inference expertise on the team, **switched in to lead and build the self-hosted LLM platform** end to end: GPU model serving on EKS, an OpenAI-compatible gateway, chat, and coding assistants for IL4 developers.',
        details: [
          'Serves models on on-demand **NVIDIA L4** EKS nodes within GPU-allocation and budget limits.',
          'Moved from Muse Glimmer (30B dense, with speculative decoding) to **Flint (40B MoE, 4-bit)** for faster decoding, with an FP8 KV cache to fit L4 memory.',
          'Rolled out **Open WebUI, LiteLLM, and OpenCode**, with RBAC and SSO for every new AI tool.',
          'Serving on Ollama under environment constraints, with a **vLLM migration** ahead, rehearsed in a homelab vLLM-on-Kubernetes stack and published GPU benchmarks.',
        ],
        kind: 'launch',
        skills: [
          { id: 'ollama', label: 'Ollama', icon: 'ollama' },
          { id: 'litellm', label: 'LiteLLM', icon: 'litellm' },
          { id: 'openwebui', label: 'Open WebUI', icon: 'openwebui' },
          { id: 'gpu', label: 'GPU inference', icon: 'gpu' },
        ],
      },
    ],
  },
];

export const sideQuests: SideQuest[] = [
  {
    id: 'tea-shop',
    date: '2024-06',
    title: 'Side Quest: Tea Shop Automation',
    story:
      'Full-stack ops platform for a local tea shop, in production at up to 100 orders/day: Square POS linked to standardized recipes, a self-service kiosk, and a live prep queue. **New-hire ramp-up: a month → a few days.**',
    metric: { value: '100/day', label: 'orders in production' },
  },
  {
    id: 'health-coach',
    date: '2025-11',
    title: 'Side Quest: AI Health Coach',
    story:
      'Multi-agent Fitbit assistant on the Google Agent Development Kit and OpenAI API: **nutrition, exercise, and sleep agents** collaborate on Fitbit data, and users chat with each to log meals and workouts.',
  },
  {
    id: 'inference-lab',
    date: '2026-08',
    title: 'Side Quest: AI Inference Lab',
    story:
      'A homelab rehearsing production LLM serving: **vLLM behind KServe, llm-d, and an Envoy AI Gateway** on Kubernetes, plus real-GPU benchmarks on rented cards, written up in the Playground.',
    metric: { value: '64 vs 16', label: 'requests within SLO: MoE vs dense, one GPU' },
    link: { href: '/playground/', label: 'Open the Playground →' },
  },
];

/** The full technology list, grouped exactly as the resume groups it. The
 *  skill pickups during the journey are a game mechanic; this is the
 *  scannable inventory a recruiter actually reads. Clearance first: it is
 *  the first thing a cleared-role recruiter filters on. */
export type TechGroup = { label: string; items: string[] };

export const techStack: TechGroup[] = [
  {
    label: 'Clearance & Certifications',
    items: ['Active TS/SCI clearance', 'CKAD (2025)', 'CompTIA Security+ (SY0-701)'],
  },
  {
    label: 'Languages',
    items: ['Go', 'Java', 'Python', 'Scala', 'TypeScript', 'JavaScript', 'SQL', 'Bash'],
  },
  {
    label: 'AI',
    items: [
      'LLM inference on Kubernetes',
      'EKS GPU nodes (NVIDIA L4)',
      'Ollama',
      'vLLM, KServe, llm-d (homelab)',
      'MoE vs dense model selection',
      'LiteLLM',
      'Open WebUI',
      'OpenCode',
      '4-bit quantization',
      'FP8 KV cache',
      'Speculative decoding',
      'LLM integration & tool calling',
      'Multi-agent workflows',
      'Gemma',
      'OpenAI API',
    ],
  },
  {
    label: 'Platform & Cloud',
    items: ['Kubernetes', 'Operators / CRDs', 'Kubebuilder', 'Docker', 'Helm', 'Istio', 'AWS (EKS, S3)', 'Azure (AKS)', 'MinIO', 'Linux'],
  },
  {
    label: 'Data & Streaming',
    items: ['Kafka', 'Kafka Streams', 'IBM MQ', 'Kafka Connect', 'Strimzi', 'Avro', 'Trino', 'Delta Lake', 'Superset', 'PostgreSQL', 'MongoDB'],
  },
  {
    label: 'Architecture',
    items: ['Distributed systems', 'Microservices', 'Event-driven streaming', 'ETL'],
  },
  {
    label: 'Backend & Frontend',
    items: ['Spring Boot', 'Quarkus', 'REST APIs', 'WebSockets', 'React', 'Next.js', 'Material UI'],
  },
  {
    label: 'Security & Identity',
    items: ['Keycloak', 'OPA / Rego', 'OAuth', 'SSO', 'ABAC', 'DevSecOps'],
  },
  {
    label: 'Testing & CI/CD',
    items: ['JUnit', 'Mockito', 'Hamcrest', 'Cypress', 'JMeter', 'GitLab CI/CD', 'Backstage', 'Git'],
  },
];

/** Rendered as a single line under the toolkit rather than a chip group. */
export const spokenLanguages = ['English (bilingual proficiency)', 'Vietnamese (native)'];

export const allMilestones: Milestone[] = chapters.flatMap((c) => c.milestones);
export const allSkills: Skill[] = allMilestones.flatMap((m) => m.skills ?? []);
