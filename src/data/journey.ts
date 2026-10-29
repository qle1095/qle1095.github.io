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
};

export const profile = {
  name: 'Levi Q Le',
  tagline: 'Staff Software Engineer & Tech Lead',
  location: 'Tampa, FL',
  clearance: 'Active TS/SCI',
  email: 'qle1095@gmail.com',
  linkedin: 'https://linkedin.com/in/levi-q-le',
  resumePdf: '/resume.pdf',
  intro:
    '6+ years building cloud-native platforms, data systems, and self-hosted AI inference for government and financial-services customers. I led **Data Fabric**, the data platform central to Raft’s $450M acquisition by Leonardo DRS.',
  /** The hero proof strip: four facts a recruiter should leave with. */
  stats: [
    { value: '$450M', label: 'acquisition, Data Fabric at its center' },
    { value: '12', label: 'engineers led as tech lead' },
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
        display: 'Jun 2018',
        title: 'Software Engineering Intern',
        subtitle: 'JPMorgan Chase · Tampa, FL',
        story:
          'First shipped software: a web app collecting **human-labeled training data** for an OCR model.',
        kind: 'job',
        skills: [
          { id: 'javascript', label: 'JavaScript', icon: 'javascript' },
          { id: 'git', label: 'Git', icon: 'git' },
        ],
      },
      {
        id: 'intern-2019',
        date: '2019-06',
        display: 'Summer 2019',
        title: 'Return Internship',
        subtitle: 'JPMorgan Chase · Integrated Receivables',
        story:
          'Back for a second summer: built a full-stack web app that onboards new clients to Integrated Receivables and **version-tracks every configuration file**.',
        kind: 'job',
        skills: [
          { id: 'java', label: 'Java', icon: 'java' },
          { id: 'react', label: 'React', icon: 'react' },
        ],
      },
      {
        id: 'fiu-grad',
        date: '2019-12',
        display: 'Dec 2019',
        title: 'B.S., IT Software Development',
        subtitle: 'Florida International University · Miami, FL',
        story: 'Graduated **magna cum laude** with two JPMorgan Chase internships already done.',
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
        subtitle: 'JPMorgan Chase · Software Engineer Program',
        story:
          'Went full-time on the Billing & Pricing platform: built and maintained **backend REST services for client charge processing**, load-tested with JMeter and BlazeMeter.',
        kind: 'job',
        skills: [
          { id: 'spring', label: 'Spring Boot', icon: 'springboot' },
          { id: 'rest', label: 'REST APIs', icon: 'rest' },
        ],
      },
      {
        id: 'service-container',
        date: '2020-11',
        title: 'Service Container Platform',
        subtitle: 'JPMorgan Chase · Payments infrastructure',
        story:
          'Built four utilities for a shared payments library, so teams **adopt new tools without from-scratch integrations**: messaging toolkit, failure handler, retry, and validation suite. Also containerized legacy Java apps for the cloud migration.',
        kind: 'launch',
        skills: [
          { id: 'docker', label: 'Docker', icon: 'docker' },
          { id: 'jmeter', label: 'JMeter', icon: 'jmeter' },
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
        subtitle: 'Raft · Remote · Employee #56',
        story:
          'Traded big-bank guardrails for startup speed as employee #56 (now 350+), building **cloud-native systems for government customers**.',
        metric: { value: '#56', label: 'employee number; Raft is now 350+' },
        kind: 'job',
        skills: [
          { id: 'go', label: 'Go', icon: 'go' },
          { id: 'kubernetes', label: 'Kubernetes', icon: 'kubernetes' },
        ],
      },
      {
        id: 'live-demo',
        date: '2022-09',
        title: 'The Live Demo',
        subtitle: 'Raft · Multi-million-dollar contract win',
        story:
          'Helped **win a multi-million-dollar contract** by building a customer-requested feature live, during the executive demo.',
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
      },
      {
        id: 'staff-promo',
        date: '2023-04',
        display: 'Apr 2023',
        title: 'Associate → Staff',
        subtitle: 'Raft · Skipped Senior',
        story:
          'Promoted **directly from Associate to Staff in one year**, skipping Senior, with multiple spot bonuses. Now mentor every engineer who joins the team and interview candidates for every role.',
        metric: { value: '1 yr', label: 'from Associate to Staff' },
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
        title: 'Data Fabric',
        subtitle: 'Raft · Tech lead, 12-engineer cross-functional team',
        story:
          '“Google over your data”: **hundreds of users** search thousands of datasets across 200+ sources, seeing only the rows and columns their access allows. Led it end to end, from data engineering to DevSecOps, onboarding ~10 data vendors.',
        metric: { value: '200+', label: 'data sources, one search' },
        kind: 'launch',
        skills: [
          { id: 'kafka', label: 'Kafka', icon: 'kafka' },
          { id: 'trino', label: 'Trino', icon: 'trino' },
          { id: 'delta', label: 'Delta Lake', icon: 'deltalake' },
        ],
      },
      {
        id: 'cbc2',
        date: '2024-03',
        title: 'CBC2: 10,000 msg/s',
        subtitle: 'Raft · Real-time mission pipeline',
        story:
          'Met the contract’s 10,000 messages/sec requirement. Designed Raft’s initial architecture at kickoff and built the Kafka Streams pipeline in Scala, live over WebSockets, **while still leading Data Fabric**.',
        kind: 'launch',
        skills: [{ id: 'scala', label: 'Scala', icon: 'scala' }],
      },
      {
        id: 'backstage',
        date: '2024-10',
        title: 'Platform Multiplier',
        subtitle: 'Raft · CI/CD for 30+ applications',
        story:
          'Onboarded ~30 teams to the org-wide CI/CD flow with **Backstage and custom plugins**, giving each one view of status, security posture, and compliance. Also automated previously manual deployment steps.',
        metric: { value: '~30', label: 'teams onboarded to one CI/CD flow' },
        kind: 'launch',
        skills: [
          { id: 'backstage', label: 'Backstage', icon: 'backstage' },
          { id: 'opa', label: 'OPA / Rego', icon: 'opa' },
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
        display: 'Current',
        title: 'Vulnerability Assessment Platform',
        subtitle: 'Raft · Full-stack owner',
        story:
          'Replaced hand-compiled scanner reports: five analysts review releases carrying **tens of thousands of CVE findings**. Own it full-stack: Go/MongoDB aggregation, React dashboards, automated risk scoring, and an auditable accept/reject record.',
        metric: { value: '5', label: 'analysts review each release' },
        kind: 'launch',
        skills: [
          { id: 'typescript', label: 'TypeScript', icon: 'typescript' },
          { id: 'mongodb', label: 'MongoDB', icon: 'mongodb' },
        ],
      },
      {
        id: 'ai-inference',
        date: '2026-01',
        title: 'AI Inference Platform',
        subtitle: 'Raft · Platform lead · Kubernetes',
        story:
          'Lead the self-hosted platform serving LLMs on Kubernetes with Ollama, LiteLLM, and Open WebUI. **4-bit 30B-class models, an FP8 KV cache, and speculative decoding** serve three concurrent users at 22 tok/s on one small L4 GPU node.',
        kind: 'launch',
        metric: { value: '3 users', label: 'per L4 GPU node at 22 tok/s' },
        skills: [
          { id: 'ollama', label: 'Ollama', icon: 'ollama' },
          { id: 'litellm', label: 'LiteLLM', icon: 'litellm' },
          { id: 'gpu', label: 'GPU inference', icon: 'gpu' },
        ],
      },
      {
        id: 'ai-use-cases',
        date: '2026-03',
        title: 'AI Use-Case Lead',
        subtitle: 'Raft · AI across the organization',
        story:
          'Lead the org’s AI use cases: multi-agent workflows draft CVE justifications from analyst-approved precedent, attacking a ~5-minute-per-CVE research burden, while **AI automates tooling across the entire organization**. No customer data leaves.',
        kind: 'launch',
        skills: [
          { id: 'agents', label: 'Multi-Agent AI', icon: 'agents' },
          { id: 'openwebui', label: 'Open WebUI', icon: 'openwebui' },
        ],
      },
      {
        id: 'securityx',
        date: '2026-05',
        display: 'In progress',
        title: 'CompTIA SecurityX',
        subtitle: 'CAS-005',
        story:
          'Working toward CompTIA SecurityX (CAS-005) to deepen the security side of the vulnerability-assessment work.',
        kind: 'education',
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
];

/** The full technology list, grouped exactly as the resume groups it. The
 *  skill pickups during the journey are a game mechanic; this is the
 *  scannable inventory a recruiter actually reads. Clearance first: it is
 *  the first thing a cleared-role recruiter filters on. */
export type TechGroup = { label: string; items: string[] };

export const techStack: TechGroup[] = [
  {
    label: 'Clearance & Certifications',
    items: ['Active TS/SCI clearance', 'CKAD (2025)', 'CompTIA Security+ (SY0-701)', 'CompTIA SecurityX (in progress)'],
  },
  {
    label: 'Languages',
    items: ['Go', 'Java', 'Python', 'Scala', 'TypeScript', 'JavaScript', 'SQL', 'Bash'],
  },
  {
    label: 'AI',
    items: [
      'LLM inference on Kubernetes',
      'Ollama',
      'LiteLLM',
      'Open WebUI',
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
    items: ['Kafka', 'Kafka Streams', 'Kafka Connect', 'Strimzi', 'Avro', 'Trino', 'Delta Lake', 'Superset', 'PostgreSQL', 'MongoDB'],
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
