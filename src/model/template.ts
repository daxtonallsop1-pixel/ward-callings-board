import type { Organization, Slot } from './types';

/*
 * Built-in organizations and callings for a ward.
 *
 * This is a starting point. The LCR "Members with Callings" export is the
 * source of truth: any organization or calling it contains that isn't here is
 * added on import. When a ward's real export shows callings missing from this
 * list, add them here (with aliases) so they sort properly instead of landing
 * at the bottom of a card as "custom".
 *
 * Slot ids must stay stable – scenarios and settings reference them.
 */

type SlotSpec = [title: string, opts?: { multi?: boolean; aliases?: string[]; section?: string }];

interface OrgSpec extends Omit<Organization, 'order'> {
  slots: SlotSpec[];
}

const PRESIDENCY: SlotSpec[] = [
  ['President'],
  ['First Counselor', { aliases: ['1st Counselor'] }],
  ['Second Counselor', { aliases: ['2nd Counselor'] }],
  ['Secretary'],
];

function youthPresidency(section: string, top: string[] = ['President', 'First Counselor', 'Second Counselor', 'Secretary']): SlotSpec[] {
  return top.map((t) => [t, { section, aliases: [`${section.replace(/ Presidency$/, '')} ${t}`] }]);
}

const ORGS: OrgSpec[] = [
  {
    id: 'bishopric',
    name: 'Bishopric',
    group: 'ward',
    accent: '#14243B',
    slots: [
      ['Bishop'],
      ['First Counselor', { aliases: ['Bishopric First Counselor'] }],
      ['Second Counselor', { aliases: ['Bishopric Second Counselor'] }],
      ['Executive Secretary', { aliases: ['Ward Executive Secretary'] }],
      ['Assistant Executive Secretary', { multi: true, aliases: ['Ward Assistant Executive Secretary'] }],
      ['Ward Clerk'],
      ['Assistant Clerk', { multi: true, aliases: ['Ward Assistant Clerk', 'Assistant Ward Clerk', 'Assistant Clerk--Finance', 'Assistant Clerk--Membership'] }],
    ],
  },
  {
    id: 'eq',
    name: 'Elders Quorum',
    group: 'ward',
    accent: '#3B5B7A',
    slots: [...PRESIDENCY, ['Instructor', { multi: true, aliases: ['Elders Quorum Teacher', 'Teacher'] }]],
  },
  {
    id: 'rs',
    name: 'Relief Society',
    group: 'ward',
    accent: '#7A4E6B',
    slots: [
      ...PRESIDENCY,
      ['Teacher', { multi: true, aliases: ['Instructor'] }],
      ['Activity Coordinator', { aliases: ['Relief Society Activities Coordinator'] }],
    ],
  },
  {
    id: 'yw',
    name: 'Young Women',
    group: 'ward',
    accent: '#9A5263',
    slots: [
      ...PRESIDENCY,
      ['Class Adviser', { multi: true, aliases: ['Adviser', 'Young Women Class Adviser', 'Advisor'] }],
      ['Specialist', { multi: true, aliases: ['Young Women Specialist'] }],
      ...youthPresidency('Class Presidency'),
    ],
  },
  {
    id: 'ap',
    name: 'Aaronic Priesthood',
    group: 'ward',
    accent: '#56663A',
    aliases: ['Aaronic Priesthood Quorums', 'Young Men'],
    slots: [
      ['Quorum Adviser', { multi: true, aliases: ['Aaronic Priesthood Adviser', 'Adviser', 'Advisor', 'Deacons Quorum Adviser', 'Teachers Quorum Adviser', 'Priests Quorum Adviser'] }],
      ['Young Men Specialist', { multi: true, aliases: ['Specialist', 'Aaronic Priesthood Specialist'] }],
      ...youthPresidency('Deacons Quorum Presidency'),
      ...youthPresidency('Teachers Quorum Presidency'),
      ...youthPresidency('Priests Quorum', ['First Assistant', 'Second Assistant', 'Secretary']),
    ],
  },
  {
    id: 'primary',
    name: 'Primary',
    group: 'ward',
    accent: '#B5742B',
    slots: [
      ...PRESIDENCY,
      ['Music Leader', { aliases: ['Primary Music Leader', 'Primary Chorister'] }],
      ['Pianist', { aliases: ['Primary Pianist'] }],
      ['Nursery Leader', { multi: true, aliases: ['Nursery Leaders'] }],
      ['Teacher', { multi: true, aliases: ['Primary Teacher'] }],
      ['Activity Days Leader', { multi: true, aliases: ['Activity Days Leaders', 'Children and Youth Activity Days Leader'] }],
    ],
  },
  {
    id: 'ss',
    name: 'Sunday School',
    group: 'ward',
    accent: '#2F6F6A',
    slots: [
      ...PRESIDENCY,
      ['Adult Teacher', { multi: true, aliases: ['Gospel Doctrine Teacher', 'Gospel Principles Teacher', 'Sunday School Teacher', 'Teacher'] }],
      ['Youth Teacher', { multi: true, aliases: ['Youth Sunday School Teacher', 'Course 11 Teacher', 'Course 12 Teacher', 'Course 14 Teacher', 'Course 16 Teacher', 'Course 18 Teacher'] }],
    ],
  },
  {
    id: 'mission',
    name: 'Ward Mission',
    group: 'ward',
    accent: '#3E5C8A',
    aliases: ['Missionary', 'Ward Missionaries', 'Missionary Work', 'Strengthening New and Returning Members'],
    slots: [
      ['Ward Mission Leader'],
      ['Ward Missionary', { multi: true, aliases: ['Ward Missionaries'] }],
    ],
  },
  {
    id: 'tfh',
    name: 'Temple & Family History',
    group: 'ward',
    accent: '#6E5A3A',
    aliases: ['Temple and Family History', 'Family History'],
    slots: [
      ['Temple & Family History Leader', { aliases: ['Ward Temple and Family History Leader', 'Temple and Family History Leader'] }],
      ['Temple & Family History Consultant', { multi: true, aliases: ['Temple and Family History Consultant', 'Ward Temple and Family History Consultant', 'Family History Consultant'] }],
    ],
  },
  {
    id: 'music',
    name: 'Music',
    group: 'ward',
    accent: '#5F4A85',
    slots: [
      ['Music Coordinator', { aliases: ['Ward Music Coordinator', 'Music Chairman', 'Ward Music Chair'] }],
      ['Music Director', { aliases: ['Sacrament Meeting Music Director', 'Chorister'] }],
      ['Organist / Pianist', { multi: true, aliases: ['Organist', 'Pianist', 'Sacrament Meeting Organist', 'Organist or Pianist', 'Sacrament Meeting Pianist'] }],
      ['Choir Director'],
      ['Choir Accompanist'],
    ],
  },
  {
    id: 'other',
    name: 'Additional Callings',
    group: 'ward',
    accent: '#5C6573',
    aliases: ['Other Callings', 'Other', 'Additional', 'Activities', 'Ward Activities', 'Facilities', 'Self-Reliance', 'Technology', 'Communication'],
    slots: [
      ['Activities Coordinator', { aliases: ['Ward Activities Coordinator', 'Activities Committee Chair'] }],
      ['Building Representative', { aliases: ['Building Scheduler'] }],
      ['Emergency Preparedness Coordinator', { aliases: ['Emergency Plan Coordinator', 'Ward Emergency Coordinator'] }],
      ['Technology Specialist', { aliases: ['Ward Technology Specialist'] }],
      ['Communication Specialist', { aliases: ['Ward Communication Specialist'] }],
      ['Self-Reliance Specialist', { aliases: ['Ward Self-Reliance Specialist', 'Employment Specialist'] }],
      ['JustServe Specialist', { aliases: ['Ward JustServe Specialist'] }],
    ],
  },
  {
    id: 'stake',
    name: 'Stake Callings',
    group: 'stake',
    accent: '#857653',
    slots: [],
  },
  {
    id: 'missionaries',
    name: 'Serving Missions',
    group: 'mission',
    accent: '#2F5D50',
    slots: [],
  },
];

export function slotId(orgId: string, title: string, section?: string): string {
  return [orgId, section, title]
    .filter((x): x is string => !!x)
    .map(slug)
    .join('.');
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const TEMPLATE_ORGS: Organization[] = ORGS.map(({ slots: _slots, ...o }, i) => ({ ...o, order: i * 10 }));

export const TEMPLATE_SLOTS: Slot[] = ORGS.flatMap((o) =>
  o.slots.map(([title, opts], i) => ({
    id: slotId(o.id, title, opts?.section),
    orgId: o.id,
    title,
    order: i * 10,
    section: opts?.section,
    multi: opts?.multi,
    aliases: opts?.aliases,
  })),
);
