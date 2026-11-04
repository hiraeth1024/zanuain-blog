import { useEffect, useState } from 'react';
import { api, errorMessage, loginLink, safeNext, type Session } from './api';
import BookmarkList from './BookmarkList';
import BookmarkForm from './BookmarkForm';
import BookmarkReader from './BookmarkReader';
import BookmarkSettings from './BookmarkSettings';
import '../../styles/bookmarks.css';

export default function Bookmarks({mode}: {mode: 'list' | 'new' | 'edit' | 'read' | 'login' | 'settings' | 'close'}) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    api<Session>('/session').then(setSession).catch(error => setError(errorMessage(error)));
  }, [retry]);
  useEffect(() => {if (mode === 'close') window.close();}, [mode]);
  if (mode === 'close') return <div className="bm-empty"><h1>书签已保存</h1><p>可以关闭此页面，继续阅读。</p><a className="primary-button" href="/bookmarks/">返回书签</a></div>;
  if (!session) return <div className="bm-loading" role="status">{error || '正在连接书签…'}{error && <button className="bm-button" onClick={() => {setError(''); setRetry(value => value + 1);}}>重试</button>}</div>;
  if (mode === 'login') return <div className="bm-login"><a className="back-link" href="/bookmarks/">← 返回公开书签</a><h1>管理员登录</h1><p className="bm-muted">登录后管理你的收藏。</p>
    {error && <p role="alert" className="bm-feedback">{error}</p>}
    {session.authenticated ? <><p>已登录为 {session.username}。</p><a className="primary-button" href={safeNext(new URLSearchParams(location.search).get('next'))}>继续</a></> : session.configured === false ? <p className="bm-feedback">管理员账户尚未配置。请由站点所有者在服务器运行管理员初始化命令。</p> : <form className="bm-form" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      const values = new FormData(event.currentTarget);
      try {await api('/login', 'POST', {username: values.get('username'), password: values.get('password')}); location.assign(safeNext(new URLSearchParams(location.search).get('next')));}
      catch (error) {setError(errorMessage(error)); setBusy(false);}
    }}><div className="bm-field"><label htmlFor="bm-username">用户名</label><input id="bm-username" name="username" autoComplete="username" required maxLength={64} /></div><div className="bm-field"><label htmlFor="bm-password">密码</label><input id="bm-password" name="password" type="password" autoComplete="current-password" required maxLength={256} /></div><button className="primary-button" disabled={busy}>{busy ? '正在登录…' : '登录'}</button></form>}
  </div>;
  if (['new', 'edit', 'settings'].includes(mode) && !session.authenticated) return <div className="bm-login"><h1>请先登录</h1><p className="bm-muted">管理书签需要管理员权限。登录后将回到当前页面。</p><a className="primary-button" href={loginLink()}>管理员登录</a></div>;
  if (mode === 'new' || mode === 'edit') return <BookmarkForm session={session} editing={mode === 'edit'} />;
  if (mode === 'read') return <BookmarkReader session={session} />;
  if (mode === 'settings') return <BookmarkSettings session={session} />;
  return <BookmarkList session={session} />;
}
