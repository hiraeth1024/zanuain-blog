import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type Session, type Settings } from './api';

export default function BookmarkSettings({session}: {session: Session}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState<{id: number; name: string; count: number}[]>([]);
  const [deleting, setDeleting] = useState<number | null>(null);
  const serverBookmarklet = useRef<HTMLAnchorElement>(null);
  const clientBookmarklet = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    Promise.all([api<Settings>('/settings'), api<typeof tags>('/tags')]).then(([settings, tags]) => {setSettings(settings); setTags(tags);}).catch(error => setError(errorMessage(error)));
    const endpoint = JSON.stringify(`${location.origin}/bookmarks/new/`);
    const normal = `javascript:(()=>{window.open(${endpoint}+'?url='+encodeURIComponent(location.href)+'&auto_close=1')})()`;
    const client = `javascript:(()=>{const meta=(q)=>document.querySelector(q)?.getAttribute('content')||'';const p=new URLSearchParams({url:location.href,title:document.title||meta('meta[property="og:title"]'),description:meta('meta[name="description"]')||meta('meta[property="og:description"]'),author:meta('meta[name="author"]')||meta('meta[property="article:author"]'),from_client:'1',auto_close:'1'});window.open(${endpoint}+'?'+p)})()`;
    serverBookmarklet.current?.setAttribute('href', normal);
    clientBookmarklet.current?.setAttribute('href', client);
  }, []);
  return <div className="bm-form-page"><a className="back-link" href="/bookmarks/">← 返回书签</a><div className="bm-heading"><h1>管理设置</h1><button className="bm-button" onClick={async () => {try {await api('/logout', 'POST', {}, session.csrf); location.assign('/bookmarks/');} catch (error) {setError(errorMessage(error));}}}>退出登录</button></div>
    {error && <p className="bm-feedback" role="alert">{error}</p>}{message && <p className="bm-feedback" role="status">{message}</p>}
    <section className="bm-settings-section"><h2>浏览器收藏按钮</h2><p className="bm-muted">将按钮拖到浏览器书签栏。浏览网页时点击，即可打开本站的新增表单。</p><div className="bm-actions"><a ref={serverBookmarklet} className="bm-button" href="#bookmarklet" onClick={event => {event.preventDefault(); setMessage('请将这个按钮拖到浏览器书签栏，然后在要收藏的网页上使用。');}}>收藏到 Zanuain</a><a ref={clientBookmarklet} className="bm-button" href="#bookmarklet-client" onClick={event => {event.preventDefault(); setMessage('客户端收藏按钮会携带当前网页的标题、描述和作者，请拖到书签栏使用。');}}>收藏到 Zanuain（客户端）</a></div><p className="bm-field-hint">客户端方式从当前网页读取信息。未登录时会先登录，再回到完整预填表单。</p></section>
    {settings && <form className="bm-settings-section bm-form" onSubmit={async event => {event.preventDefault(); setBusy(true); setError(''); try {await api('/settings', 'PUT', settings, session.csrf); setMessage('设置已保存。');} catch (error) {setError(errorMessage(error));} finally {setBusy(false);}}}><h2>新书签默认设置</h2>
      <label className="bm-checkbox"><input type="checkbox" checked={settings.default_unread} onChange={event => setSettings({...settings, default_unread: event.target.checked})} />默认标为未读</label>
      <label className="bm-checkbox"><input type="checkbox" checked={settings.default_shared} onChange={event => setSettings({...settings, default_shared: event.target.checked})} />默认公开分享</label>
      <label className="bm-checkbox"><input type="checkbox" checked={settings.automatic_snapshots} onChange={event => setSettings({...settings, automatic_snapshots: event.target.checked})} />自动保存网页快照</label>
      <div className="bm-field"><label htmlFor="auto-tags">自动标签规则</label><textarea id="auto-tags" rows={4} value={settings.auto_tags} onChange={event => setSettings({...settings, auto_tags: event.target.value})} placeholder="developer.mozilla.org 开发 文档" /><p className="bm-field-hint">每行：域名 标签 标签。匹配该域名及子域名，保存书签时自动添加。</p></div>
      <button className="primary-button" disabled={busy}>{busy ? '正在保存…' : '保存设置'}</button>
    </form>}
    <section className="bm-settings-section"><h2>标签管理</h2><p className="bm-muted">重命名为已有标签会合并；删除标签不会删除书签。</p>{tags.map(tag => <form className="bm-tag-editor" key={tag.id} onSubmit={async event => {event.preventDefault(); setError(''); setBusy(true); try {const name = new FormData(event.currentTarget).get('name'); await api(`/tags/${tag.id}`, 'PUT', {name}, session.csrf); setTags(await api('/tags')); setMessage('标签已更新。');} catch (error) {setError(errorMessage(error));} finally {setBusy(false);}}}><input name="name" aria-label={`重命名标签 ${tag.name}`} defaultValue={tag.name} required maxLength={64} /><span>{tag.count}</span><button disabled={busy}>保存</button><button disabled={busy} type="button" onClick={async () => {if (deleting !== tag.id) {setDeleting(tag.id); return;} try {await api(`/tags/${tag.id}`, 'DELETE', undefined, session.csrf); setTags(await api('/tags')); setDeleting(null);} catch (error) {setError(errorMessage(error));}}}>{deleting === tag.id ? '确认删除' : '删除'}</button></form>)}{!tags.length && <p className="bm-muted">尚无标签。</p>}</section>
    <section className="bm-settings-section"><h2>导入与导出</h2><p className="bm-muted">使用浏览器或 linkding 导出的 Netscape HTML 文件。重复网址会更新；未明确公开的书签按私密导入。</p>
      <div className="bm-field"><label htmlFor="bookmarks-import">导入 HTML 书签</label><input id="bookmarks-import" type="file" accept=".html,.htm" disabled={busy} onChange={async event => {const file = event.target.files?.[0]; if (!file) return; setBusy(true); setError(''); try {if (file.size > 900000) throw new Error('请选择小于 900 KB 的文件，较大文件请拆分导入。'); const result = await api<{imported: number; skipped: number}>('/import', 'POST', {html: await file.text()}, session.csrf); setMessage(`已导入 ${result.imported} 条，跳过 ${result.skipped} 条。`); setTags(await api('/tags'));} catch (error) {setError(errorMessage(error));} finally {setBusy(false); event.target.value = '';}}} /></div>
      <a className="bm-text-link" href="/api/bookmarks/export/" download>导出全部有效书签</a>
    </section>
  </div>;
}
