export interface Publication {
  id: string;
  title: string;
  date: string;
  category: string;
  href: string;
}

const DAY = 86_400_000;
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
export const dayKey = (date: Date) => date.toISOString().slice(0, 10);
export const shanghaiDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
export const addDays = (day: string, amount: number) => dayKey(new Date(asDate(day).valueOf() + amount * DAY));
export const weekStart = (day: string) => addDays(day, -asDate(day).getUTCDay());
export const monthRange = (day: string) => {
  const date = asDate(day);
  return {
    start: dayKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))),
    end: dayKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))),
  };
};
export const shiftMonth = (day: string, amount: number) => {
  const date = asDate(day);
  return dayKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1)));
};
export const monthGrid = (day: string) => {
  const { start, end } = monthRange(day);
  const gridStart = weekStart(start);
  const count = Math.ceil((asDate(start).getUTCDay() + Number(end.slice(8))) / 7) * 7;
  return Array.from({ length: count }, (_, index) => addDays(gridStart, index));
};
// Sunday–Saturday columns; number each column using its Monday's ISO week.
export const weekLabel = (day: string) => {
  const monday = asDate(addDays(weekStart(day), 1));
  monday.setUTCDate(monday.getUTCDate() + 3);
  const year = monday.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((monday.valueOf() - first.valueOf()) / DAY + 1) / 7);
  return { year, week };
};
export const inRange = (day: string, start: string, end: string) => day >= start && day <= end;
export const summarize = (publications: Publication[], start: string, end: string, category: string | null = null) => {
  const matching = publications.filter(item => inRange(item.date, start, end) && (category === null || item.category === category));
  const days = [...new Set(matching.map(item => item.date))].sort();
  let longest = 0;
  let streak = 0;
  let previous = '';
  for (const day of days) {
    streak = previous && addDays(previous, 1) === day ? streak + 1 : 1;
    longest = Math.max(longest, streak);
    previous = day;
  }
  return { count: matching.length, activeDays: days.length, longest };
};
export const countByDay = (publications: Publication[], category: string | null = null) => {
  const counts = new Map<string, number>();
  for (const item of publications) if (category === null || item.category === category) {
    counts.set(item.date, (counts.get(item.date) ?? 0) + 1);
  }
  return counts;
};
export const activityLevel = (count: number) => count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
