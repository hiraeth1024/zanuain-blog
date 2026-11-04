import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, countByDay, monthGrid, monthRange, shanghaiDay, shiftMonth, summarize, weekLabel, weekStart } from '../src/lib/publications.ts';

const posts = [
  { id: 'a', title: 'A', href: '/a/', date: '2026-10-30', category: '学习' },
  { id: 'b', title: 'B', href: '/b/', date: '2026-10-31', category: '学习' },
  { id: 'c', title: 'C', href: '/c/', date: '2026-10-31', category: '实践' },
  { id: 'd', title: 'D', href: '/d/', date: '2026-11-01', category: '实践' },
  { id: 'e', title: 'E', href: '/e/', date: '2026-11-03', category: '学习' },
];

test('Shanghai dates do not inherit the build machine timezone', () => {
  assert.equal(shanghaiDay(new Date('2026-11-02T17:00:00Z')), '2026-11-03');
});
test('date arithmetic crosses leap days, months and years', () => {
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2024-02-29', 1), '2024-03-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.deepEqual(monthRange('2024-02-15'), { start: '2024-02-01', end: '2024-02-29' });
  assert.equal(shiftMonth('2026-01-31', -1), '2025-12-01');
});
test('Sunday rows use the ISO week of the Monday in the column, including year boundaries', () => {
  assert.equal(weekStart('2026-11-03'), '2026-11-01');
  assert.deepEqual(weekLabel('2026-04-26'), { year: 2026, week: 18 });
  assert.deepEqual(weekLabel('2020-12-27'), { year: 2020, week: 53 });
  assert.deepEqual(weekLabel('2021-01-03'), { year: 2021, week: 1 });
});
test('calendar covers exactly the full weeks needed by four, five and six row months', () => {
  assert.equal(monthGrid('2026-02-15').length, 28);
  assert.equal(monthGrid('2026-11-03').length, 35);
  assert.equal(monthGrid('2026-08-15').length, 42);
  assert.equal(monthGrid('2024-02-15')[0], '2024-01-28');
  assert.equal(monthGrid('2024-02-15').at(-1), '2024-03-02');
});
test('counts include multiple posts on a day, while streaks count distinct consecutive days', () => {
  assert.deepEqual(summarize(posts, '2026-10-30', '2026-11-03'), { count: 5, activeDays: 4, longest: 3 });
  assert.equal(countByDay(posts).get('2026-10-31'), 2);
});
test('category filtering recalculates totals, activity and streaks together', () => {
  assert.deepEqual(summarize(posts, '2026-10-30', '2026-11-03', '学习'), { count: 3, activeDays: 3, longest: 2 });
  assert.equal(countByDay(posts, '学习').get('2026-10-31'), 1);
  assert.equal(countByDay(posts, '学习').get('2026-11-01'), undefined);
});
test('period boundaries are inclusive and an empty period has zero streaks', () => {
  assert.deepEqual(summarize(posts, '2026-11-01', '2026-11-03'), { count: 2, activeDays: 2, longest: 1 });
  assert.deepEqual(summarize(posts, '2026-12-01', '2026-12-31'), { count: 0, activeDays: 0, longest: 0 });
  assert.deepEqual(summarize([], '2026-10-30', '2026-11-03'), { count: 0, activeDays: 0, longest: 0 });
});
