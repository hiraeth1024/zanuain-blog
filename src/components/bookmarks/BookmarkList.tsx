import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type Session, type BookmarkList as ListData } from './api';
import BookmarkDashboard from './BookmarkDashboard';

const views = [{key: 'all', name: '全部'}, {key: 'unread', name: '未读'}, {key: 'shared', name: '公开'}, {key: 'archived', name: '归档'}, {key: 'trash', name: '回收站'}];
type SavedFilter = {id: number; name: string; query: string; count: number};
export default function BookmarkList({ session }: {session: Session}) {
  const [query, setQuery] = useState(() => location.search);
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get('q') ?? '');
  const [data, setData] = useState<ListData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulk, setBulk] = useState('archive');
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [filterName, setFilterName] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const params = new URLSearchParams(query);
  const view = params.get('view') || 'all';
  function navigate(next: URLSearchParams) {
    const value = next.toString() ? `?${next}` : '';
    history.pushState(null, '', `/bookmarks/${value}`);
    setQuery(value); setSearch(next.get('q') ?? ''); setSelected([]);
  }
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(query);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    navigate(next);
  };
  useEffect(() => {
    const popstate = () => { setQuery(location.search); setSearch(new URLSearchParams(location.search).get('q') ?? ''); setSelected([]); };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === '/' && !(event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName))) { event.preventDefault(); event.stopImmediatePropagation(); searchInput.current?.focus(); }
    };
    window.addEventListener('popstate', popstate);
    document.addEventListener('keydown', keyboard, true);
    return () => { window.removeEventListener('popstate', popstate); document.removeEventListener('keydown', keyboard, true); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api<ListData>(`/${query}`, 'GET', undefined, undefined, controller.signal).then(setData).catch(error => {
      if (error.name !== 'AbortError') setError(errorMessage(error));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    if (session.authenticated) api<SavedFilter[]>('/filters', 'GET', undefined, undefined, controller.signal).then(setFilters).catch(() => {});
    return () => controller.abort();
  }, [query, refresh, session.authenticated]);
  const action = async (ids: number[], operation: string) => {
    setBusy(true); setError('');
    try { await api('/bulk', 'POST', {ids, action: operation}, session.csrf); setSelected([]); setRefresh(value => value + 1); }
    catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  };
  return <>
    <div className="bm-heading"><div><h1>书签</h1><p>{session.authenticated ? '收集、整理，再慢慢读。' : '值得留下的网页，与你分享。'}</p></div>
      <div className="bm-actions">{session.authenticated ? <><a className="bm-text-link" href="/bookmarks/settings/">管理设置</a><a className="primary-button" href="/bookmarks/new/">添加书签</a></> : <a className="bm-button" href="/bookmarks/login/">管理员登录</a>}</div>
    </div>
    <div className="bm-layout">
      <section className="bm-feed" aria-label="书签列表">
        <form className="bm-search" onSubmit={event => {event.preventDefault(); change('q', search);}}>
          <label className="sr-only" htmlFor="bookmark-search">搜索书签</label>
          <input ref={searchInput} id="bookmark-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索标题、网址或标签…" />
          <button type="submit">搜索</button>
        </form>
        <div className="bm-toolbar">
          {session.authenticated ? <nav className="bm-tabs" aria-label="书签场景">{views.map(item => <button key={item.key} aria-current={view === item.key ? 'page' : undefined} onClick={() => change('view', item.key)}>{item.name}<span>{data?.counts[item.key] ?? '—'}</span></button>)}</nav> : <span className="bm-muted">公开收藏</span>}
          <label className="bm-sort"><span className="sr-only">书签排序</span><select value={params.get('sort') ?? 'newest'} onChange={event => change('sort', event.target.value)}><option value="newest">最近收藏</option><option value="oldest">最早收藏</option><option value="title">标题顺序</option></select></label>
        </div>
        {(params.get('q') || params.get('tag') || params.get('date')) && <div className="bm-filter-summary"><span>筛选：{[params.get('q'), params.get('tag') && `#${params.get('tag')}`, params.get('date')].filter(Boolean).join(' · ')}</span><button onClick={() => navigate(new URLSearchParams({view}))}>清除筛选</button></div>}
        {session.authenticated && data && data.items.length > 0 && <div className="bm-selection">
          <label><input type="checkbox" aria-label="选择本页全部书签" checked={selected.length === data.items.length} onChange={event => setSelected(event.target.checked ? data.items.map(item => item.id) : [])} />本页全选</label>
          {selected.length > 0 && <><span>已选 {selected.length} 个</span><select aria-label="批量操作" value={bulk} onChange={event => setBulk(event.target.value)}>{[['archive', '归档'], ['unarchive', '取消归档'], ['read', '标为已读'], ['unread', '标为未读'], ['share', '设为公开'], ['unshare', '设为私密'], ['trash', '移入回收站'], ['restore', '恢复']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button disabled={busy} onClick={() => action(selected, bulk)}>应用</button></>}
        </div>}
        {error && <div className="bm-feedback" role="alert">{error}<button onClick={() => setRefresh(value => value + 1)}>重试</button></div>}
        {loading && !data ? <div className="bm-loading" role="status">正在读取书签…</div> : data && <div aria-busy={loading}>
          <p className="bm-result-count" aria-live="polite">{loading ? '正在更新…' : `共 ${data.total} 个书签`}</p>
          {!data.items.length && <div className="bm-empty"><h2>{params.get('q') || params.get('tag') || params.get('date') ? '没有找到匹配的书签' : view === 'trash' ? '回收站是空的' : session.authenticated ? '从一个值得留下的网址开始' : '还没有公开的书签'}</h2><p>{session.authenticated ? '粘贴网址即可获取标题、描述和作者，也可以使用浏览器收藏按钮。' : '公开的收藏会出现在这里，稍后再来看看。'}</p>{session.authenticated && view !== 'trash' && <a href="/bookmarks/new/" className="bm-text-link">添加第一个书签</a>}</div>}
          <ul>{data.items.map(bookmark => <li className="bm-item" key={bookmark.id}>
            {session.authenticated && <input type="checkbox" aria-label={`选择 ${bookmark.title || bookmark.url}`} checked={selected.includes(bookmark.id)} onChange={event => setSelected(items => event.target.checked ? [...items, bookmark.id] : items.filter(id => id !== bookmark.id))} />}
            <div className="bm-item-main">
              <div className="bm-item-source">{bookmark.favicon && <img src={bookmark.favicon} width="16" height="16" alt="" loading="lazy" />}<span>{new URL(bookmark.url).hostname}</span><span>{new Date(bookmark.date_added).toLocaleDateString('zh-CN', {timeZone: 'Asia/Shanghai'})}</span>{session.authenticated && <span>{bookmark.shared ? '公开' : '私密'}{bookmark.unread ? ' · 未读' : ''}</span>}</div>
              <h2><a href={bookmark.url} target="_blank" rel="noopener noreferrer">{bookmark.title || bookmark.url}</a></h2>
              {bookmark.description && <p>{bookmark.description}</p>}
              <div className="bm-item-tags">{bookmark.tags.map(tag => <button key={tag} onClick={() => change('tag', tag)}>#{tag}</button>)}</div>
              <div className="bm-item-actions">
                <a href={`/bookmarks/read/?id=${bookmark.id}`}>阅读</a>
                {bookmark.has_snapshot && <a href={`/api/bookmarks/${bookmark.id}/snapshot/`}>下载快照</a>}
                {session.authenticated && <><a href={`/bookmarks/edit/?id=${bookmark.id}`}>编辑</a>
                  {bookmark.is_deleted ? <><button disabled={busy} onClick={() => action([bookmark.id], 'restore')}>恢复</button><button disabled={busy} onClick={() => setConfirmDelete(bookmark.id)}>永久删除</button></> : <><button disabled={busy} onClick={() => action([bookmark.id], bookmark.unread ? 'read' : 'unread')}>{bookmark.unread ? '标为已读' : '标为未读'}</button><button disabled={busy} onClick={() => action([bookmark.id], bookmark.is_archived ? 'unarchive' : 'archive')}>{bookmark.is_archived ? '取消归档' : '归档'}</button><button disabled={busy} onClick={() => action([bookmark.id], 'trash')}>移入回收站</button></>}
                </>}
              </div>
              {confirmDelete === bookmark.id && <div className="bm-feedback">永久删除后无法恢复。<button disabled={busy} onClick={async () => {setBusy(true); try {await api(`/${bookmark.id}`, 'DELETE', undefined, session.csrf); setConfirmDelete(null); setRefresh(value => value + 1);} catch (error) {setError(errorMessage(error));} finally {setBusy(false);}}}>确认删除</button><button onClick={() => setConfirmDelete(null)}>取消</button></div>}
            </div>
          </li>)}</ul>
          {data.pages > 1 && <nav className="bm-pagination" aria-label="书签分页"><button disabled={data.page <= 1} onClick={() => change('page', String(data.page - 1))}>上一页</button><span>{data.page} / {data.pages}</span><button disabled={data.page >= data.pages} onClick={() => change('page', String(data.page + 1))}>下一页</button></nav>}
        </div>}
      </section>
      <aside className="bm-sidebar">
        {session.authenticated && <section className="bm-panel"><h2>我的筛选</h2>{filters.map(filter => <div className="bm-saved-filter" key={filter.id}><button onClick={() => navigate(new URLSearchParams(filter.query))}>{filter.name}<span>{filter.count}</span></button><button aria-label={`删除筛选 ${filter.name}`} onClick={async () => {try {await api(`/filters/${filter.id}`, 'DELETE', undefined, session.csrf); setRefresh(value => value + 1);} catch (error) {setError(errorMessage(error));}}}>×</button></div>)}<form className="bm-save-filter" onSubmit={async event => {event.preventDefault(); try {await api('/filters', 'POST', {name: filterName, query: params.toString()}, session.csrf); setFilterName(''); setRefresh(value => value + 1);} catch (error) {setError(errorMessage(error));}}}><label className="sr-only" htmlFor="filter-name">筛选名称</label><input id="filter-name" required maxLength={80} placeholder="保存当前筛选…" value={filterName} onChange={event => setFilterName(event.target.value)} /><button>保存</button></form></section>}
        <section className="bm-panel"><h2>标签<span>{data?.tags.length ?? 0}</span></h2><div className="bm-tag-cloud">{data?.tags.map(tag => <button key={tag.name} aria-pressed={params.get('tag') === tag.name} onClick={() => change('tag', params.get('tag') === tag.name ? '' : tag.name)}>#{tag.name}<span>{tag.count}</span></button>)}</div>{!data?.tags.length && <p className="bm-muted">收藏中的标签会显示在这里。</p>}</section>
        <BookmarkDashboard activity={data?.activity ?? []} onDay={day => change('date', day)} />
      </aside>
    </div>
  </>;
}
