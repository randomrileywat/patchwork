// Exam catalogue — add new certs here as question banks are built.
// `available: false` entries show as "Coming soon" on the onboarding screen.
export const EXAMS = [
  {
    id: 'CTS-D',
    name: 'CTS-D',
    fullName: 'Certified Technology Specialist – Design',
    org: 'AVIXA',
    description: 'AV system design: space analysis, signal flow, control, and project documentation.',
    available: true,
    accent: 'var(--accent-teal)',
  },
  {
    id: 'CTS',
    name: 'CTS',
    fullName: 'Certified Technology Specialist',
    org: 'AVIXA',
    description: 'Broad audiovisual industry knowledge for working AV professionals.',
    available: false,
    accent: 'var(--accent-amber)',
  },
  {
    id: 'CTS-I',
    name: 'CTS-I',
    fullName: 'Certified Technology Specialist – Installation',
    org: 'AVIXA',
    description: 'AV system installation, cabling, commissioning, and handover.',
    available: false,
    accent: 'var(--accent-coral)',
  },
];

export const getExam = (id) => EXAMS.find((e) => e.id === id);
