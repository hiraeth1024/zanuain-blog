import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type Bookmark, type BookmarkFields, type Session, type Settings } from './api';
import TagInput from './TagInput';

type Metadata = {url: string; title: string; description: string; author: string; preview_image: string};
type CheckResult = {bookmark: Bookmark | null; metadata: Metadata; auto_tags: string[]; warning: string};
const empty: BookmarkFields = {url: '', title: '', description: '', author: '', notes: '', tag_string: '', preview_image_remote_url: '', unread: true, shared: false};
export default function BookmarkForm({ session, editing }: {session: Session; editing: boolean}) {
  const params = useRef(new URLSearchParams(location.search)).current;
  const id = Number(params.get('id'));
  const fromClient = params.get('from_client') === '1';
  const autoClose = params.has('auto_close');
  const initial = {...empty, ...Object.fromEntries(['url', 'title', 'description', 'author', 'notes'].map(key => [key, params.get(key) ?? ''])), tag_string: params.get('tags') ?? ''} as BookmarkFields;
  const [fields, setFields] = useState(initial);
  const latest = useRef(fields); latest.current = fields;
  const dirty = useRef(new Set<string>(!fromClient ? ['title', 'description', 'author'].filter(key => !!params.get(key)) : []));
  const [undo, setUndo] = useState<Partial<BookmarkFields>>({});
  const [checking, setChecking] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [existing, setExisting] = useState<Bookmark | null>(null);
  const [automaticTags, setAutomaticTags] = useState<string[]>([]);
  const [tags, setTags] = useState<{name: string}[]>([]);
  const form = useRef<HTMLFormElement>(null);
  const sequence = useRef(0);
  const firstCheck = useRef(true);
  const pristine = useRef(JSON.stringify(initial));
  const update = (key: keyof BookmarkFields, value: string | boolean) => {
    dirty.current.add(key);
    setUndo(previous => { const next = {...previous}; delete next[key]; return next; });
    setFields(previous => ({...previous, [key]: value}));
  };
  useEffect(() => {
    let cancelled = false;
    Promise.all([api<Settings>('/settings'), api<{name: string}[]>('/tags'), editing ? api<Bookmark>(`/${id}`) : Promise.resolve(null)]).then(([settings, tagList, bookmark]) => {
      if (cancelled) return;
      setTags(tagList);
      setFields(previous => {
        const next = bookmark ? {...empty, ...bookmark, tag_string: bookmark.tags.join(' ')} : {...previous, unread: settings.default_unread, shared: settings.default_shared};
        pristine.current = JSON.stringify(next);
        return next;
      });
      setReady(true);
    }).catch(error => { if (!cancelled) setError(errorMessage(error)); });
    return () => {cancelled = true; sequence.current++;};
  }, [editing, id]);
  const check = async (refresh = false, client = false) => {
    const current = latest.current;
    if (!/^https?:\/\//i.test(current.url)) {setChecking(false); return;}
    const requestId = ++sequence.current;
    const query = new URLSearchParams({url: current.url});
    if (client) {query.set('from_client', '1'); for (const key of ['title', 'description', 'author'] as const) query.set(key, current[key]);}
    setChecking(true); setWarning('');
    try {
      const result = await api<CheckResult>(`/check?${query}`);
      if (requestId !== sequence.current || latest.current.url !== current.url) return;
      setWarning(result.warning); setExisting(result.bookmark); setAutomaticTags(result.auto_tags);
      const metadata = result.metadata;
      const candidate: Partial<BookmarkFields> = !refresh && result.bookmark ? {
        title: result.bookmark.title, description: result.bookmark.description, author: result.bookmark.author,
        notes: result.bookmark.notes, tag_string: result.bookmark.tags.join(' '),
        unread: result.bookmark.unread, shared: result.bookmark.shared,
        preview_image_remote_url: result.bookmark.preview_image_remote_url,
      } : {title: metadata.title, description: metadata.description, author: metadata.author, preview_image_remote_url: metadata.preview_image};
      if (!result.warning && metadata.url) candidate.url = metadata.url;
      const changes: Partial<BookmarkFields> = {};
      const snapshots: Partial<BookmarkFields> = {};
      for (const [key, value] of Object.entries(candidate)) {
        if (refresh || !dirty.current.has(key)) {
          Object.assign(changes, {[key]: value});
          if (refresh && value !== latest.current[key as keyof BookmarkFields]) Object.assign(snapshots, {[key]: latest.current[key as keyof BookmarkFields]});
        }
      }
      if (!result.warning || result.bookmark) {
        setFields(previous => ({...previous, ...changes}));
        if (refresh) setUndo(previous => ({...previous, ...snapshots}));
      }
    } catch (error) { if (requestId === sequence.current) setWarning(errorMessage(error)); }
    finally { if (requestId === sequence.current) setChecking(false); }
  };
  useEffect(() => {
    if (!ready || editing) return;
    sequence.current++;
    const timer = setTimeout(() => {
      const useClient = firstCheck.current && fromClient;
      firstCheck.current = false;
      void check(false, useClient);
    }, 300);
    return () => {clearTimeout(timer); sequence.current++;};
  }, [fields.url, ready, editing]);
  useEffect(() => {
    if (!ready) return;
    const target = form.current?.querySelector<HTMLInputElement>(editing || initial.url ? '[name="tag_string"]' : '[name="url"]');
    target?.focus();
  }, [ready]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!saving && dirty.current.size && JSON.stringify(latest.current) !== pristine.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saving]);
  const restore = (key: keyof BookmarkFields) => {
    setFields(previous => ({...previous, [key]: undo[key]}));
    setUndo(previous => {const next = {...previous}; delete next[key]; return next;});
  };
  const textField = (key: 'title' | 'url' | 'author' | 'preview_image_remote_url', label: string) => <div className="bm-field">
    <div className="bm-field-label"><label htmlFor={`bm-${key}`}>{label}{key === 'url' && <span>必填</span>}</label><div>{undo[key] !== undefined && <button type="button" onClick={() => restore(key)}>撤销抓取</button>}{key !== 'url' && <button type="button" onClick={() => update(key, '')}>清空</button>}</div></div>
    <input id={`bm-${key}`} name={key} type={key === 'url' || key === 'preview_image_remote_url' ? 'url' : 'text'} value={fields[key]} required={key === 'url'} autoComplete="off" maxLength={key === 'title' ? 4096 : key === 'author' ? 1024 : 2048} onChange={event => {update(key, event.target.value); if (key === 'url') setExisting(null);}} onPaste={key === 'url' ? event => {const text = event.clipboardData.getData('text'); const found = text.match(/https?:\/\/[^\s<>"]+/i); if (found && found[0] !== text.trim()) {event.preventDefault(); update('url', found[0]);}} : undefined} />
    {key === 'url' && <div className="bm-field-hint" aria-live="polite">{checking ? '正在查重并获取网页信息…' : existing ? existing.is_deleted ? '此网址已在回收站。保存将更新并恢复这个书签。' : '此网址已收藏。表单已预填，保存将更新已有书签。' : '粘贴网址，自动获取网页信息；也可以手动填写。'}</div>}
  </div>;
  return <div className="bm-form-page">
    <a className="back-link" href="/bookmarks/">← 返回书签</a>
    <div className="bm-heading"><h1>{editing ? '编辑书签' : '添加书签'}</h1><button type="button" className="bm-button" disabled={!fields.url || checking || !ready} onClick={() => check(true)}>重新抓取信息</button></div>
    {error && <div className="bm-feedback" role="alert">{error}</div>}
    {!ready ? !error && <p role="status">正在准备表单…</p> : <form ref={form} className="bm-form" onKeyDown={event => {if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {event.preventDefault(); form.current?.requestSubmit();}}} onSubmit={async event => {
      event.preventDefault(); if (saving) return;
      setSaving(true); setError('');
      try {
        await api(editing ? `/${id}` : '/', editing ? 'PUT' : 'POST', fields, session.csrf);
        dirty.current.clear();
        location.assign(autoClose ? '/bookmarks/close/' : '/bookmarks/');
      } catch (error) {setError(errorMessage(error)); setSaving(false);}
    }}>
      {textField('title', '标题')}
      <div className="bm-field"><label htmlFor="bm-tags">标签</label><TagInput value={fields.tag_string} onChange={value => update('tag_string', value)} tags={tags} /><p className="bm-field-hint">用空格分隔标签，不需要 #。支持拼音匹配；不存在的标签会自动创建。</p>{automaticTags.length > 0 && <p className="bm-field-hint">自动标签：{automaticTags.join(' ')}</p>}</div>
      {textField('url', 'URL')}
      {warning && <p className="bm-feedback" role="status">{warning} 你仍可手动填写并保存。</p>}
      {textField('author', '作者')}
      <details className="bm-field" open={!!fields.description || undefined}><summary>描述</summary><div className="bm-field-label"><label className="sr-only" htmlFor="bm-description">描述</label><div>{undo.description !== undefined && <button type="button" onClick={() => restore('description')}>撤销抓取</button>}<button type="button" onClick={() => update('description', '')}>清空</button></div></div><textarea id="bm-description" rows={3} maxLength={20000} value={fields.description} onChange={event => update('description', event.target.value)} /></details>
      <details className="bm-field" open={!!fields.notes || undefined}><summary>笔记</summary><label className="sr-only" htmlFor="bm-notes">笔记</label><textarea id="bm-notes" rows={7} maxLength={100000} value={fields.notes} onChange={event => update('notes', event.target.value)} /><p className="bm-field-hint">支持 Markdown。笔记仅管理员可见。</p></details>
      <details className="bm-field" open={!!fields.preview_image_remote_url || undefined}><summary>预览图</summary>{textField('preview_image_remote_url', '图片网址')}<p className="bm-field-hint">保存后由服务器缓存图片。</p></details>
      <label className="bm-checkbox"><input type="checkbox" checked={fields.unread} onChange={event => update('unread', event.target.checked)} /><span>标为未读<small>稍后阅读，再标为已读。</small></span></label>
      <label className="bm-checkbox"><input type="checkbox" checked={fields.shared} onChange={event => update('shared', event.target.checked)} /><span>公开分享<small>允许访客查看书签及保存的阅读正文和快照。</small></span></label>
      <div className="bm-form-actions"><button className="primary-button" disabled={saving}>{saving ? '正在保存…' : autoClose ? '保存并关闭' : '保存书签'}</button><a href="/bookmarks/">取消</a><span className="bm-muted">⌘ / Ctrl + Enter 保存</span></div>
    </form>}
  </div>;
}
