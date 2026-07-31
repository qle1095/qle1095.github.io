// ---------------------------------------------------------------------------
// The single source of truth for the journey. Updating the resume = editing
// this file. Horizontal positions are computed from dates in lib/layout.ts —
// nothing here is hand-placed.
// ---------------------------------------------------------------------------

export type Skill = {
  id: string;
  label: string;
  icon: string; // emoji for now; swapped for real logos in the polish phase
};

export type MilestoneKind = 'job' | 'education' | 'achievement' | 'launch';

export type Milestone = {
  id: string;
  /** Layout-only chronological anchor — NEVER shown. Set `display` to show a date. */
  date: string;
  /** The date text shown on the card. Omit when the real date is unknown. */
  display?: string;
  title: string;
  subtitle?: string;
  story: string;
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
};

export const profile = {
  name: 'Levi Q Le',
  tagline: 'Staff Software Engineer',
  location: 'Tampa, FL',
  email: 'qle1095@gmail.com',
  linkedin: 'https://linkedin.com/in/levi-q-le',
  resumePdf: '/resume.pdf',
  intro:
    'From intern to Staff Engineer — leading the data platform behind a $450M acquisition. Scroll to walk the journey.',
};

export const chapters: Chapter[] = [
  {
    id: 'foundations',
    label: 'Foundations',
    company: 'Florida International University',
    theme: 'sunrise',
    milestones: [
      {
        id: 'intern-2018',
        date: '2018-06',
        display: 'Jun 2018',
        title: 'First Internship',
        subtitle: 'JPMorgan Chase — Tampa, FL',
        story:
          'Built a web app that collects **human-labeled training data** for an OCR model. **First taste of shipping real software.**',
        kind: 'job',
        skills: [
          { id: 'javascript', label: 'JavaScript', icon: '🟨' },
          { id: 'git', label: 'Git', icon: '🌿' },
        ],
      },
      {
        id: 'intern-2019',
        date: '2019-06',
        display: '2019',
        title: 'Second Internship',
        subtitle: 'JPMorgan Chase — Integrated Receivables',
        story:
          'Built a **full-stack web app** that onboards new clients to the program and **version-tracks every configuration file**.',
        kind: 'job',
        skills: [
          { id: 'java', label: 'Java', icon: '☕' },
          { id: 'react', label: 'React', icon: '⚛️' },
        ],
      },
      {
        id: 'fiu-grad',
        date: '2019-12',
        display: 'Dec 2019',
        title: 'B.S. — IT Software Development',
        subtitle: 'Florida International University · magna cum laude',
        story: 'Graduated **magna cum laude** from FIU in Miami, already with **two internships** in the bag.',
        kind: 'education',
        celebrate: true,
        skills: [{ id: 'sql', label: 'SQL', icon: '🗄️' }],
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
        subtitle: 'JPMorgan Chase — Software Engineer Program',
        story:
          'Joined the bank full-time, building **backend REST services** for client charge processing on the **Billing & Pricing platform**.',
        kind: 'job',
        skills: [
          { id: 'spring', label: 'Spring Boot', icon: '🍃' },
          { id: 'rest', label: 'REST APIs', icon: '🔌' },
        ],
      },
      {
        id: 'service-container',
        date: '2020-11',
        title: 'Service Container Platform',
        subtitle: 'Payments infrastructure',
        story:
          'Built **four shared utilities** — messaging toolkit, failure handler, retry, validation suite — and **containerized legacy Java apps** for the cloud migration.',
        kind: 'launch',
        skills: [
          { id: 'docker', label: 'Docker', icon: '🐳' },
          { id: 'jmeter', label: 'JMeter', icon: '📈' },
        ],
      },
      {
        id: 'sep-fast-track',
        date: '2021-08',
        display: '18 months in',
        title: 'Fast-Tracked',
        subtitle: 'SEP graduated in 18 months',
        story:
          'Finished the bank’s two-year program **six months early** — and **mentored four junior engineers** along the way.',
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
        title: 'Joined Raft',
        subtitle: 'Employee #47 · Associate Software Engineer',
        story:
          'Joined as **employee #47** — now **350+** — trading big-bank guardrails for **startup speed**, building **cloud-native systems** for government customers.',
        kind: 'job',
        skills: [
          { id: 'go', label: 'Go', icon: '🐹' },
          { id: 'kubernetes', label: 'Kubernetes', icon: '☸️' },
        ],
      },
      {
        id: 'live-demo',
        date: '2022-09',
        title: 'The Live Demo',
        subtitle: 'Multi-million-dollar contract win',
        story:
          'Built a customer-requested feature **live during an executive demo** — helping **win the multi-million-dollar contract** on the spot.',
        kind: 'achievement',
        celebrate: true,
        skills: [
          { id: 'helm', label: 'Helm', icon: '⎈' },
          { id: 'gitlab', label: 'GitLab CI/CD', icon: '🦊' },
        ],
      },
      {
        id: 'air-gap',
        date: '2022-12',
        title: 'Air-Gap Specialist',
        subtitle: 'High-security delivery',
        story:
          'Became the go-to engineer for **air-gapped networks**: debugging production on-site in restricted facilities — **no internet, no standard tooling**.',
        kind: 'job',
      },
      {
        id: 'staff-promo',
        date: '2023-04',
        display: 'Apr 2023',
        title: 'Associate → Staff',
        subtitle: 'Skipped Senior entirely',
        story:
          'Promoted from Associate **directly to Staff** in one year — **skipping the Senior level entirely**, with multiple spot bonuses en route.',
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
        subtitle: 'Cross-functional platform team of 12',
        story:
          '**“Google over your data”**: search thousands of datasets across **200+ sources**, serving **hundreds of users** with **row- and column-level access control**. **Helped drive it end to end** — data engineering, software, and DevSecOps — onboarding **~10 data vendors**.',
        kind: 'launch',
        skills: [
          { id: 'kafka', label: 'Kafka', icon: '🌀' },
          { id: 'trino', label: 'Trino', icon: '🐰' },
          { id: 'delta', label: 'Delta Lake', icon: '🔺' },
        ],
      },
      {
        id: 'cbc2',
        date: '2024-03',
        title: 'CBC2 — 10,000 msg/s',
        subtitle: 'Real-time mission pipeline',
        story:
          'Born from a **hackathon win**. Designed Raft’s initial architecture, streamed live data over **WebSockets**, and hit the contract’s **10,000 messages-per-second** requirement with **Kafka Streams**.',
        kind: 'launch',
        skills: [{ id: 'scala', label: 'Scala', icon: '🌶️' }],
      },
      {
        id: 'backstage',
        date: '2024-10',
        title: 'Platform Multiplier',
        subtitle: '~30 teams onboarded',
        story:
          'Deployed **Backstage with custom plugins**, giving **~30 teams** one view of project status, security posture, and compliance readiness.',
        kind: 'launch',
        skills: [
          { id: 'backstage', label: 'Backstage', icon: '🎭' },
          { id: 'opa', label: 'OPA / Rego', icon: '🛡️' },
        ],
      },
      {
        id: 'ckad',
        date: '2025-03',
        display: '2025',
        title: 'CKAD Certified',
        subtitle: '+ CompTIA Security+ (SY0-701)',
        story:
          '**Certified Kubernetes Application Developer**, stacked on **CompTIA Security+ (SY0-701)** and an active **TS/SCI clearance** held since 2022.',
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
        subtitle: 'Full-stack owner',
        story:
          'The platform security analysts use to clear releases carrying **tens of thousands of CVE findings** — automated aggregation, **risk scoring**, and auditable decisions letting **five analysts** clear a release.',
        kind: 'launch',
        skills: [
          { id: 'typescript', label: 'TypeScript', icon: '🟦' },
          { id: 'mongodb', label: 'MongoDB', icon: '🍃' },
        ],
      },
      {
        id: 'ai-agents',
        date: '2026-01',
        title: 'Self-Hosted AI Agents',
        subtitle: 'Privacy-preserving LLM workflows',
        story:
          'Cut a **~5-minute-per-CVE** research burden: **multi-agent workflows** on **fully self-hosted models** (Ollama, Gemma) draft justifications from analyst-approved precedent, every one human-approved. **No customer data ever leaves the environment.**',
        kind: 'launch',
        skills: [
          { id: 'ollama', label: 'Ollama', icon: '🦙' },
          { id: 'agents', label: 'Multi-Agent AI', icon: '🤖' },
        ],
      },
      {
        id: 'securityx',
        date: '2026-05',
        display: 'In progress',
        title: 'CompTIA SecurityX',
        subtitle: 'CAS-005 — in progress',
        story:
          'Levelling up the security credentials that back the vulnerability work: **CompTIA SecurityX (CAS-005)**, currently in progress.',
        kind: 'education',
      },
      {
        id: 'acquisition',
        date: '2026-07',
        display: 'Jul 2026',
        title: 'The $450M Exit',
        subtitle: 'Leonardo DRS acquires Raft',
        story:
          '**Data Fabric anchors** the multi-domain data-fusion capability cited in Leonardo DRS’s **$450M acquisition** of Raft.',
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
      'Full-stack ops platform for a local tea shop — **in production at up to 100 orders/day**. Links **Square POS** to standardized recipes, with a self-service kiosk and live prep queue; **new-hire ramp-up cut from a month to days**.',
  },
  {
    id: 'health-coach',
    date: '2025-11',
    title: 'Side Quest: AI Health Coach',
    story:
      'Multi-agent Fitbit assistant built on the **Google Agent Development Kit** — **nutrition, exercise, and sleep agents** collaborate on your data for personalized coaching.',
  },
];

export const allMilestones: Milestone[] = chapters.flatMap((c) => c.milestones);
export const allSkills: Skill[] = allMilestones.flatMap((m) => m.skills ?? []);
