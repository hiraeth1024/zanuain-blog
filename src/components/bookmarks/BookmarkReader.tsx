import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type Bookmark, type Session } from './api';
type Annotation = {id: number; quote: string; note: string; start: number; finish: number};
export default function BookmarkReader({session}: {session: Session}) {
  const id = Number(new URLSearchParams(location.search).get('id'));
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [html, setHtml] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selection, setSelection] = useState<{quote: string; start: number; finish: number} | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const article = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const [bookmark, result] = await Promise.all([api<Bookmark>(`/${id}`), api<{html: string; status: string; error?: string}>(`/${id}/article`)]);
        if (cancelled) return;
        setBookmark(bookmark); setHtml(result.html); setStatus(result.status);
        if (result.error) setError(result.error);
        if (result.status === 'pending') timer = setTimeout(load, 3000);
      } catch (error) { if (!cancelled) {setError(errorMessage(error)); setStatus('failed');} }
    };
    void load();
    if (session.authenticated) api<Annotation[]>(`/${id}/annotations`).then(value => {if (!cancelled) setAnnotations(value);}).catch(error => {if (!cancelled) setError(errorMessage(error));});
    return () => {cancelled = true; clearTimeout(timer);};
  }, [id, session.authenticated]);
  useEffect(() => {
    const root = article.current;
    if (!root || !html) return;
    root.querySelectorAll('mark[data-annotation]').forEach(mark => mark.replaceWith(...mark.childNodes));
    root.normalize();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: {node: Text; start: number; finish: number}[] = [];
    let offset = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {const length = node.textContent?.length ?? 0; nodes.push({node: node as Text, start: offset, finish: offset + length}); offset += length;}
    const valid = annotations.filter(annotation => root.textContent?.slice(annotation.start, annotation.finish) === annotation.quote);
    for (const entry of nodes.reverse()) {
      const segments = valid.map(annotation => ({start: Math.max(entry.start, annotation.start) - entry.start, finish: Math.min(entry.finish, annotation.finish) - entry.start})).filter(segment => segment.finish > segment.start).sort((left, right) => right.start - left.start);
      let lastStart = entry.finish - entry.start;
      for (const segment of segments) {
        const finish = Math.min(segment.finish, lastStart);
        if (finish <= segment.start) continue;
        const text = entry.node.splitText(segment.start);
        text.splitText(finish - segment.start);
        const mark = document.createElement('mark');
        mark.dataset.annotation = 'true';
        text.replaceWith(mark); mark.append(text); lastStart = segment.start;
      }
    }
  }, [html, annotations]);
  const selectText = () => {
    if (!session.authenticated) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed || !article.current) return;
    const range = selection.getRangeAt(0);
    if (!article.current.contains(range.startContainer) || !article.current.contains(range.endContainer)) return;
    const before = range.cloneRange(); before.selectNodeContents(article.current); before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    setSelection({quote: selection.toString(), start, finish: start + selection.toString().length});
  };
  return <div className="bm-reader"><a className="back-link" href="/bookmarks/">← 返回书签</a>
    {error && <p className="bm-feedback" role="alert">{error}</p>}
    {bookmark && <><h1>{bookmark.title || bookmark.url}</h1><div className="bm-reader-meta">{bookmark.author && <span>{bookmark.author}</span>}<a href={bookmark.url} target="_blank" rel="noopener noreferrer">打开原网页</a>{session.authenticated && <a href={`/bookmarks/edit/?id=${id}`}>编辑书签</a>}</div></>}
    {status === 'loading' && <p role="status">正在读取正文…</p>}
    {!html && status !== 'loading' && <div className="bm-empty"><h2>{status === 'pending' ? '正在整理阅读正文' : '还没有可用的阅读正文'}</h2><p>你可以先打开原网页阅读。</p></div>}
    {session.authenticated && bookmark && <div className="bm-reader-tools"><button className="bm-button" disabled={busy || status === 'pending'} onClick={async () => {setBusy(true); setError(''); try {await api(`/${id}/capture`, 'POST', {snapshot: true}, session.csrf); location.reload();} catch (error) {setError(errorMessage(error));} finally {setBusy(false);}}}>重新获取正文与快照</button><span className="bm-muted">选中文字可以添加私人高亮和批注。</span></div>}
    {html && <div ref={article} className="bm-article" onMouseUp={selectText} onKeyUp={selectText} onTouchEnd={selectText} dangerouslySetInnerHTML={{__html: html}} />}
    {session.authenticated && <section className="bm-settings-section"><h2>我的高亮与批注</h2>{selection && <form className="bm-form" onSubmit={async event => {event.preventDefault(); setBusy(true); try {setAnnotations(await api<Annotation[]>(`/${id}/annotations`, 'POST', {...selection, note}, session.csrf)); setSelection(null); setNote(''); window.getSelection()?.removeAllRanges();} catch (error) {setError(errorMessage(error));} finally {setBusy(false);}}}><blockquote>{selection.quote}</blockquote><label htmlFor="annotation-note">批注（可留空，仅保存高亮）</label><textarea id="annotation-note" value={note} onChange={event => setNote(event.target.value)} rows={3} /><div className="bm-actions"><button className="primary-button" disabled={busy}>保存高亮</button><button type="button" onClick={() => setSelection(null)}>取消</button></div></form>}{annotations.map(annotation => <div key={annotation.id} className="bm-annotation"><blockquote>{annotation.quote}</blockquote>{annotation.note && <p>{annotation.note}</p>}<button onClick={async () => {try {setAnnotations(await api(`/${id}/annotations?annotation=${annotation.id}`, 'DELETE', undefined, session.csrf));} catch (error) {setError(errorMessage(error));}}}>删除批注</button></div>)}</section>}
  </div>;
}
