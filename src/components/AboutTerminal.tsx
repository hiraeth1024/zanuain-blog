/**
 * TermFolio adaptation for React 19 / TypeScript and an embedded Astro island.
 * Based on https://github.com/SimonAKing/TermFolio (termfolio@2.1.5).
 * MIT — Copyright (c) 2020 simonma. License: /licenses/termfolio-LICENSE.txt.
 * Visible native input, deterministic completion, scoped styles and SSR output
 * replace legacy lifecycle, transition-group and styled-components.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { completeCommand, executeCommand, introduction } from '../lib/terminal';
import type { TerminalContext, TerminalLine } from '../lib/terminal';
import '../styles/about-terminal.css';

interface Entry { command: string | null; lines: TerminalLine[]; }
export default function AboutTerminal({ context }: { context: TerminalContext }) {
  const titleId = useId();
  const inputId = useId();
  const hintId = useId();
  const [entries, setEntries] = useState<Entry[]>(() => [{ command: null, lines: introduction(context) }]);
  const [command, setCommand] = useState('');
  const [ready, setReady] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const history = useRef<string[]>([]);
  const historyIndex = useRef(0);
  const pending = useRef('');
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => setReady(true), []);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [entries]);

  const run = (value: string) => {
    if (!value.trim()) return;
    history.current.push(value.trim());
    history.current = history.current.slice(-100);
    historyIndex.current = history.current.length;
    pending.current = '';
    const result = executeCommand(value, context, history.current);
    setEntries(previous => result.clear ? [] : [...previous, { command: value, lines: result.lines }].slice(-100));
    setCommand(''); setSuggestion(''); input.current?.focus();
    if (result.navigate) window.location.assign(result.navigate);
  };
  const reset = () => {
    setEntries([{ command: null, lines: introduction(context) }]);
    setCommand(''); setSuggestion(''); history.current = []; historyIndex.current = 0; pending.current = ''; input.current?.focus();
  };
  const prompt = <span className="terminal-prompt" aria-hidden="true">guest<span>@</span>{context.name.toLowerCase()} <span>~</span> $</span>;

  return <section className="about-terminal" aria-labelledby={titleId}>
    <header className="terminal-titlebar">
      <span className="terminal-window-dots" aria-hidden="true"><i /><i /><i /></span>
      <h2 id={titleId}>{context.name.toLowerCase()} — about</h2>
      <button className="terminal-reset" type="button" onClick={reset} disabled={!ready} aria-label="重新开始终端" title="重新开始终端"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></svg></button>
    </header>
    <div className="terminal-screen">
      <div className="terminal-log" ref={log} role="log" aria-label="终端命令输出" aria-live="polite" aria-relevant="additions" tabIndex={0}>
        {entries.map((entry, index) => <div className="terminal-entry" key={index}>
          {entry.command !== null && <p className="terminal-echo">{prompt}<span>{entry.command}</span></p>}
          {entry.lines.map((line, lineIndex) => <p className="terminal-line" key={lineIndex}>{line.label && <span className={`terminal-label terminal-${line.type ?? 'info'}`}>{line.label}</span>}{line.href ? <a href={line.href}>{line.text}</a> : <span>{line.text}</span>}</p>)}
        </div>)}
        {entries.length === 0 && <p className="terminal-idle">屏幕已清空。输入 help 查看命令。</p>}
      </div>
      <form className="terminal-form" onSubmit={event => { event.preventDefault(); run(command); }}>
        <label className="sr-only" htmlFor={inputId}>终端命令</label>
        <div className="terminal-input-row">{prompt}<input id={inputId} ref={input} type="text" value={command} placeholder="输入 help 开始" disabled={!ready} aria-describedby={hintId} autoComplete="off" autoCapitalize="none" spellCheck={false} enterKeyHint="send" maxLength={1000}
          onChange={event => { setCommand(event.target.value); setSuggestion(''); historyIndex.current = history.current.length; }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              if (!history.current.length) return;
              event.preventDefault();
              if (historyIndex.current === history.current.length) pending.current = command;
              historyIndex.current = Math.max(0, Math.min(history.current.length, historyIndex.current + (event.key === 'ArrowUp' ? -1 : 1)));
              setCommand(history.current[historyIndex.current] ?? pending.current);
              requestAnimationFrame(() => input.current?.setSelectionRange(1000, 1000));
            } else if (event.key === 'Tab' && !event.shiftKey && command.trim()) {
              const matches = completeCommand(command);
              if (!matches.length) return;
              if (matches.length === 1 && matches[0] === command.trim().toLowerCase()) return;
              event.preventDefault();
              if (matches.length === 1) { setCommand(matches[0]); setSuggestion(''); }
              else setSuggestion(`可选命令：${matches.join(' · ')}`);
            } else if (event.key === 'Escape' || (event.ctrlKey && event.key.toLowerCase() === 'c')) {
              if (event.ctrlKey && input.current?.selectionStart !== input.current?.selectionEnd) return;
              event.preventDefault(); setCommand(''); setSuggestion('');
            } else if (event.ctrlKey && event.key.toLowerCase() === 'l') {
              event.preventDefault(); setEntries([]);
            }
          }}
        /><button className="terminal-submit" type="submit" disabled={!ready || !command.trim()} aria-label="执行命令" title="执行命令"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 5v9a3 3 0 0 1-3 3H4m5-5-5 5 5 5" /></svg></button></div>
        {suggestion && <p className="terminal-suggestions" role="status">{suggestion}</p>}
      </form>
      <div className="terminal-toolbar"><div className="terminal-quick" role="group" aria-label="常用命令">{['help', 'about', 'notes', 'tags', 'clear'].map(name => <button type="button" key={name} onClick={() => run(name)} disabled={!ready}>{name}</button>)}</div><p id={hintId}><span>↑↓ 历史</span><span>Tab 补全</span><span>Enter 执行</span></p></div>
      <noscript><p className="terminal-noscript">启用 JavaScript 后可输入命令。你也可以直接<a href="/#feed">浏览笔记</a>、<a href="/tags/">查看标签</a>或<a href="/rss.xml">订阅更新</a>。</p></noscript>
    </div>
  </section>;
}
