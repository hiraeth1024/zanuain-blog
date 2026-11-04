import { useState } from 'react';
import { activityLevel, addDays, monthGrid, monthRange, shanghaiDay, shiftMonth, weekStart, weekLabel } from '../../lib/publications';

export default function BookmarkDashboard({ activity, onDay }: {activity: {date: string; id: number}[]; onDay: (day: string) => void}) {
  const [view, setView] = useState<'heatmap' | 'calendar'>('heatmap');
  const [anchor, setAnchor] = useState(shanghaiDay);
  const today = shanghaiDay();
  const start = weekStart(anchor);
  const month = monthRange(anchor);
  const counts = new Map<string, number>();
  activity.forEach(item => counts.set(item.date, (counts.get(item.date) ?? 0) + 1));
  const dates = view === 'calendar' ? monthGrid(anchor) : Array.from({length: 105}, (_, index) => addDays(start, index - 98));
  const range = view === 'calendar' ? month : {start, end: addDays(start, 6)};
  const days = [...counts.keys()].filter(day => day >= range.start && day <= range.end).sort();
  const total = days.reduce((sum, day) => sum + (counts.get(day) ?? 0), 0);
  let longest = 0;
  let streak = 0;
  days.forEach((day, index) => { streak = index > 0 && day === addDays(days[index - 1], 1) ? streak + 1 : 1; longest = Math.max(longest, streak); });
  const label = weekLabel(anchor);
  const nextDisabled = view === 'calendar' ? anchor.slice(0, 7) >= today.slice(0, 7) : start >= weekStart(today);
  return <section className="bm-panel">
    <h2>收藏看板</h2>
    <div className="bm-segmented" role="group" aria-label="收藏统计视图">
      <button aria-pressed={view === 'heatmap'} onClick={() => setView('heatmap')}>热力图</button>
      <button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>日历图</button>
    </div>
    <div className="bm-chart-nav">
      <button aria-label={view === 'calendar' ? '上个月' : '上一周'} onClick={() => setAnchor(view === 'calendar' ? shiftMonth(anchor, -1) : addDays(start, -7))}>‹</button>
      <button aria-label="回到今天" onClick={() => setAnchor(today)}>{view === 'calendar' ? `${anchor.slice(0, 4)} / ${anchor.slice(5, 7)}` : `${label.year} / W${String(label.week).padStart(2, '0')}`}</button>
      <button disabled={nextDisabled} aria-label={view === 'calendar' ? '下个月' : '下一周'} onClick={() => setAnchor(view === 'calendar' ? shiftMonth(anchor, 1) : addDays(start, 7))}>›</button>
    </div>
    <div className={`bm-chart ${view}`} aria-label={view === 'calendar' ? '每月收藏日历' : '十五周收藏热力图'}>
      {view === 'calendar' && ['日', '一', '二', '三', '四', '五', '六'].map(day => <span key={day}>{day}</span>)}
      {dates.map(day => view === 'calendar' && day.slice(0, 7) !== anchor.slice(0, 7) ? <span key={day} /> : <button key={day} data-level={activityLevel(counts.get(day) ?? 0)} disabled={day > today} aria-label={`${day}，收藏 ${counts.get(day) ?? 0} 个`} title={`${day} · ${counts.get(day) ?? 0} 个`} onClick={() => onDay(day)}>{view === 'calendar' && Number(day.slice(8))}</button>)}
    </div>
    <p className="bm-chart-summary">{view === 'calendar' ? '所选月' : '所选周'}收藏 <strong>{total}</strong> 个，活跃 <strong>{days.length}</strong> 天，最长连续 <strong>{longest}</strong> 天。</p>
  </section>;
}
