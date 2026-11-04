import { useEffect, useId, useState } from 'react';
import {
  activityLevel, addDays, countByDay, inRange, monthGrid, monthRange, shanghaiDay,
  shiftMonth, summarize, weekLabel, weekStart,
} from '../lib/publications';
import type { Publication } from '../lib/publications';
import '../styles/publication-dashboard.css';

type View = 'heatmap' | 'calendar';
type IconName = 'calendar' | 'heatmap' | 'today' | 'left' | 'right';
const paths: Record<IconName, string> = {
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  heatmap: 'M3 3h4v4H3zM10 3h4v4h-4zM17 3h4v4h-4zM3 10h4v4H3zM10 10h4v4h-4zM17 10h4v4h-4zM3 17h4v4H3zM10 17h4v4h-4zM17 17h4v4h-4z',
  today: 'M12 2v3m0 14v3M2 12h3m14 0h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  left: 'm14 6-6 6 6 6',
  right: 'm10 6 6 6-6 6',
};
const Glyph = ({ name }: { name: IconName }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const displayDate = (day: string) => day.replaceAll('-', '.');

interface Props { publications: Publication[]; referenceDate: string; }
export default function PublicationDashboard({ publications, referenceDate }: Props) {
  const headingId = useId();
  const [today, setToday] = useState(referenceDate);
  const [anchor, setAnchor] = useState(referenceDate);
  const [view, setView] = useState<View>('heatmap');
  const [category, setCategory] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  useEffect(() => {
    // A static build can be days old. Resolve the visitor's current Shanghai date.
    const current = shanghaiDay();
    setToday(current);
    setAnchor(current);
  }, []);

  const week = weekStart(anchor);
  const month = monthRange(anchor);
  const range = view === 'heatmap' ? { start: week, end: addDays(week, 6) } : month;
  const counts = countByDay(publications, category);
  const stats = summarize(publications, range.start, range.end, category);
  const allStats = summarize(publications, range.start, range.end);
  const categories = [...new Set(publications.map(item => item.category))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const label = weekLabel(anchor);
  const canGoNext = view === 'heatmap' ? week < weekStart(today) : month.start < monthRange(today).start;
  const isCurrent = view === 'heatmap' ? week === weekStart(today) : month.start === monthRange(today).start;
  const selectedPublications = selectedDay ? publications.filter(item => item.date === selectedDay && (category === null || item.category === category)) : [];
  const changePeriod = (direction: number) => {
    setAnchor(view === 'heatmap' ? addDays(week, direction * 7) : shiftMonth(anchor, direction));
    setSelectedDay(null);
  };
  const switchView = (next: View) => { setView(next); setSelectedDay(null); };
  const selectDay = (day: string) => {
    setSelectedDay(day);
    if (!inRange(day, range.start, range.end)) setAnchor(day);
  };
  const describeDay = (day: string) => `${displayDate(day)}，发布 ${counts.get(day) ?? 0} 篇${day > today ? '，未来日期' : ''}`;
  const dayButton = (day: string, calendar = false) => <button
    type="button" key={day}
    className={calendar ? 'publication-day' : 'publication-cell'}
    data-level={activityLevel(counts.get(day) ?? 0)}
    aria-label={describeDay(day)} title={describeDay(day)}
    aria-current={day === today ? 'date' : undefined}
    aria-pressed={selectedDay === day}
    disabled={day > today}
    onClick={() => selectDay(day)}
  >{calendar && <><span>{Number(day.slice(8))}</span>{(counts.get(day) ?? 0) > 0 && <small>{counts.get(day)} 篇</small>}</>}</button>;

  return <section className="publication-panel" aria-labelledby={headingId}>
    <div className="section-heading"><h2 id={headingId}>发布看板</h2><span className="heading-rule" /></div>
    <div className="publication-views" role="group" aria-label="发布数据视图">
      <button type="button" aria-pressed={view === 'heatmap'} onClick={() => switchView('heatmap')}><Glyph name="heatmap" />热力图</button>
      <button type="button" aria-pressed={view === 'calendar'} onClick={() => switchView('calendar')}><Glyph name="calendar" />日历</button>
    </div>
    <div className="publication-navigation">
      <button type="button" className="publication-icon" aria-label={view === 'heatmap' ? '回到本周' : '回到本月'} title="回到今天" onClick={() => { setAnchor(today); setSelectedDay(today); }}><Glyph name="today" /></button>
      <div className="publication-period">
        <button type="button" className="publication-icon" aria-label={view === 'heatmap' ? '上一周' : '上个月'} onClick={() => changePeriod(-1)}><Glyph name="left" /></button>
        <span aria-live="polite">{view === 'heatmap' ? `${label.year} / W${String(label.week).padStart(2, '0')}` : `${anchor.slice(0, 4)} / ${anchor.slice(5, 7)}`}</span>
        <button type="button" className="publication-icon" aria-label={view === 'heatmap' ? '下一周' : '下个月'} disabled={!canGoNext} onClick={() => changePeriod(1)}><Glyph name="right" /></button>
      </div>
      <span className="publication-navigation-spacer" aria-hidden="true" />
    </div>

    <div className="publication-chart">
      {view === 'heatmap' ? <div className="publication-heatmap" aria-label="最近十五周发布热力图">
        {Array.from({ length: 15 }, (_, index) => {
          const start = addDays(week, (index - 14) * 7);
          const info = weekLabel(start);
          return <div className="publication-week" key={start}>
            {Array.from({ length: 7 }, (_, day) => dayButton(addDays(start, day)))}
            <span className={start === week ? 'publication-week-current' : ''} title={`${info.year}年第${info.week}周`}>{String(info.week).padStart(2, '0')}</span>
          </div>;
        })}
        <div className="publication-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      </div> : <div className="publication-calendar" aria-label={`${anchor.slice(0, 7)}发布日历`}>
        {weekdays.map(day => <span className="publication-calendar-weekday" key={day} aria-hidden="true">{day}</span>)}
        {monthGrid(anchor).map(day => {
          return inRange(day, month.start, month.end) ? dayButton(day, true) : <span key={day} className="publication-day-outside" aria-hidden="true" />;
        })}
      </div>}
      <div className="publication-legend" aria-label="颜色越深，发布篇数越多"><span>少</span>{[0, 1, 2, 3, 4].map(level => <i key={level} data-level={level} aria-hidden="true" />)}<span>多</span></div>
    </div>

    <div className="publication-summary" aria-live="polite" aria-atomic="true">
      <p className="publication-range">{isCurrent ? (view === 'heatmap' ? '本周' : '本月') : (view === 'heatmap' ? '所选周' : '所选月')} · {range.start.slice(5).replace('-', '.')}–{range.end.slice(5).replace('-', '.')}</p>
      <p>发布 <strong>{stats.count}</strong> 篇，活跃 <strong>{stats.activeDays}</strong> 天<br />最长连续发布 <strong>{stats.longest}</strong> 天</p>
      {stats.count === 0 && <p className="publication-empty">该时段暂无发布记录</p>}
    </div>

    <div className="publication-categories">
      <h3>分类发布<span>{view === 'heatmap' ? '按周统计' : '按月统计'}</span></h3>
      <div role="group" aria-label="按分类查看发布数据">
        <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)}><span>全部</span><strong>{allStats.count}</strong></button>
        {categories.map(name => <button type="button" key={name} aria-pressed={category === name} onClick={() => setCategory(name)}><span>{name}</span><strong>{summarize(publications, range.start, range.end, name).count}</strong></button>)}
      </div>
    </div>

    {selectedDay && <div className="publication-selection" aria-live="polite">
      <p>{displayDate(selectedDay)}<span>{selectedPublications.length} 篇</span></p>
      {selectedPublications.length ? <ul>{selectedPublications.map(item => <li key={item.id}><a href={item.href}>{item.title}</a></li>)}</ul> : <span>当天暂无发布</span>}
    </div>}
    <noscript><p className="publication-noscript">启用 JavaScript 后可切换视图和日期。</p></noscript>
  </section>;
}
