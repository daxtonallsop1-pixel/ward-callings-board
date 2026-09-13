/*
 * Demo data with obviously fictional names, for development, screenshots and
 * trying the board out. It goes through the same CSV path as a real import.
 */

const MALE = ['Aaron', 'Benjamin', 'Caleb', 'Daniel', 'Ethan', 'Franklin', 'Gideon', 'Henry', 'Isaac', 'Jonah', 'Kyle', 'Levi', 'Micah', 'Nathan', 'Owen', 'Parker', 'Quinn', 'Reid', 'Samuel', 'Tanner', 'Wesley', 'Yates', 'Emmett', 'Lincoln', 'Spencer', 'Cooper', 'Ruben', 'Dallin'];
const FEMALE = ['Abigail', 'Brooke', 'Clara', 'Delia', 'Eliza', 'Faye', 'Grace', 'Hannah', 'Ivy', 'June', 'Kate', 'Lydia', 'Mara', 'Nora', 'Olive', 'Paige', 'Rose', 'Sadie', 'Tessa', 'Violet', 'Willa', 'Hazel', 'Emery', 'Lucy', 'Maren', 'Aubrey', 'Camille', 'Esther'];
const LAST = ['Ashby', 'Barlow', 'Calder', 'Draper', 'Ellsworth', 'Fenwick', 'Garrity', 'Holloway', 'Ingram', 'Jessop', 'Kimball', 'Larkin', 'Merrill', 'Nordquist', 'Oakes', 'Pendleton', 'Quayle', 'Rowley', 'Sorensen', 'Thackeray', 'Underwood', 'Vance', 'Whitaker', 'Yardley', 'Ashworth', 'Brinkerhoff', 'Crandall', 'Dunford', 'Everton', 'Farnsworth', 'Gale', 'Hatch'];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

interface Person {
  name: string;
  gender: 'M' | 'F';
  age: number;
}

// [organization, calling, gender (or '*'), count, youth?]
type Spec = [string, string, 'M' | 'F' | '*', number, boolean?];

const CALLINGS: Spec[] = [
  ['Bishopric', 'Bishop', 'M', 1],
  ['Bishopric', 'Bishopric First Counselor', 'M', 1],
  ['Bishopric', 'Bishopric Second Counselor', 'M', 1],
  ['Bishopric', 'Ward Executive Secretary', 'M', 1],
  ['Bishopric', 'Ward Clerk', 'M', 1],
  ['Bishopric', 'Ward Assistant Clerk', 'M', 2],
  ['Elders Quorum', 'Elders Quorum President', 'M', 1],
  ['Elders Quorum', 'Elders Quorum First Counselor', 'M', 1],
  ['Elders Quorum', 'Elders Quorum Second Counselor', 'M', 1],
  ['Elders Quorum', 'Elders Quorum Secretary', 'M', 1],
  ['Elders Quorum', 'Elders Quorum Instructor', 'M', 2],
  ['Relief Society', 'Relief Society President', 'F', 1],
  ['Relief Society', 'Relief Society First Counselor', 'F', 1],
  ['Relief Society', 'Relief Society Second Counselor', 'F', 1],
  ['Relief Society', 'Relief Society Secretary', 'F', 1],
  ['Relief Society', 'Relief Society Teacher', 'F', 2],
  ['Relief Society', 'Relief Society Compassionate Service Coordinator', 'F', 1],
  ['Young Women', 'Young Women President', 'F', 1],
  ['Young Women', 'Young Women First Counselor', 'F', 1],
  ['Young Women', 'Young Women Secretary', 'F', 1],
  ['Young Women', 'Young Women Class Adviser', 'F', 2],
  ['Young Women', 'Young Women Class President', 'F', 1, true],
  ['Young Women', 'Young Women Class First Counselor', 'F', 1, true],
  ['Aaronic Priesthood Quorums', 'Aaronic Priesthood Adviser', 'M', 2],
  ['Aaronic Priesthood Quorums', 'Deacons Quorum President', 'M', 1, true],
  ['Aaronic Priesthood Quorums', 'Deacons Quorum First Counselor', 'M', 1, true],
  ['Aaronic Priesthood Quorums', 'Teachers Quorum President', 'M', 1, true],
  ['Aaronic Priesthood Quorums', 'Priests Quorum First Assistant', 'M', 1, true],
  ['Primary', 'Primary President', 'F', 1],
  ['Primary', 'Primary First Counselor', 'F', 1],
  ['Primary', 'Primary Second Counselor', 'F', 1],
  ['Primary', 'Primary Secretary', 'F', 1],
  ['Primary', 'Primary Music Leader', 'F', 1],
  ['Primary', 'Primary Pianist', '*', 1],
  ['Primary', 'Nursery Leader', '*', 2],
  ['Primary', 'Primary Teacher', '*', 6],
  ['Sunday School', 'Sunday School President', 'M', 1],
  ['Sunday School', 'Gospel Doctrine Teacher', '*', 2],
  ['Sunday School', 'Youth Sunday School Teacher', '*', 2],
  ['Ward Missionaries', 'Ward Mission Leader', 'M', 1],
  ['Ward Missionaries', 'Ward Missionary', '*', 3],
  ['Temple and Family History', 'Ward Temple and Family History Leader', '*', 1],
  ['Temple and Family History', 'Temple and Family History Consultant', '*', 2],
  ['Music', 'Ward Music Coordinator', '*', 1],
  ['Music', 'Music Director', '*', 1],
  ['Music', 'Organist', '*', 1],
  ['Other Callings', 'Ward Activities Coordinator', '*', 1],
  ['Other Callings', 'Building Representative', 'M', 1],
  ['Other Callings', 'Ward Technology Specialist', '*', 1],
  ['Stake High Council', 'High Councilor', 'M', 1],
  ['Stake Primary', 'Stake Primary Second Counselor', 'F', 1],
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function lcrDate(d: Date) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function csv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

/** The three LCR reports: with callings, without callings, stake callings. */
export function demoCsvs(today: Date = new Date()): { callings: string; members: string; stake: string } {
  const rand = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

  const people: Person[] = [];
  const used = new Set<string>();
  function make(gender: 'M' | 'F', age: number): Person {
    let name = '';
    do name = `${pick(LAST)}, ${pick(gender === 'M' ? MALE : FEMALE)}`;
    while (used.has(name));
    used.add(name);
    const p = { name, gender, age };
    people.push(p);
    return p;
  }
  for (let i = 0; i < 58; i++) make('M', 19 + Math.floor(rand() * 55));
  for (let i = 0; i < 62; i++) make('F', 19 + Math.floor(rand() * 55));
  for (let i = 0; i < 9; i++) make('M', 11 + Math.floor(rand() * 7));
  for (let i = 0; i < 9; i++) make('F', 11 + Math.floor(rand() * 7));
  for (let i = 0; i < 20; i++) make(rand() < 0.5 ? 'M' : 'F', 1 + Math.floor(rand() * 10));

  const free = people.filter((p) => p.age >= 11);
  const take = (g: 'M' | 'F' | '*', youth: boolean) => {
    const i = free.findIndex((p) => (g === '*' || p.gender === g) && (youth ? p.age < 18 : p.age >= 18));
    return i >= 0 ? free.splice(i, 1)[0] : undefined;
  };

  const callingRows: (string | number)[][] = [['Name', 'Gender', 'Age', 'Organization', 'Calling', 'Sustained', 'Set Apart']];
  const stakeRows: (string | number)[][] = [['Name', 'Organization', 'Calling', 'Sustained', 'Set Apart']];
  const called = new Set<string>();
  for (const [org, calling, g, count, youth] of CALLINGS) {
    for (let i = 0; i < count; i++) {
      const p = take(g, !!youth);
      if (!p) continue;
      called.add(p.name);
      const monthsAgo = Math.floor(rand() * (youth ? 12 : 30));
      const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1 + Math.floor(rand() * 27));
      const setApart = rand() < 0.9 ? 'Yes' : '';
      if (org.startsWith('Stake')) stakeRows.push([p.name, org, calling, lcrDate(d), setApart]);
      else callingRows.push([p.name, p.gender === 'M' ? 'Male' : 'Female', p.age, org, calling, lcrDate(d), setApart]);
    }
  }

  // "Members without Callings": everyone not called above.
  const memberRows: (string | number)[][] = [['Name', 'Gender', 'Age']];
  for (const p of [...people].sort((a, b) => a.name.localeCompare(b.name))) {
    if (!called.has(p.name)) memberRows.push([p.name, p.gender === 'M' ? 'M' : 'F', p.age]);
  }

  return { callings: csv(callingRows), members: csv(memberRows), stake: csv(stakeRows) };
}
