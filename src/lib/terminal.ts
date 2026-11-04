// Adapted from TermFolio's command model (MIT, Copyright (c) 2020 simonma).
// https://github.com/SimonAKing/TermFolio — public/licenses/termfolio-LICENSE.txt
export interface TerminalNote { title: string; description: string; date: string; category: string; href: string; tags: string[]; }
export interface TerminalTag { name: string; count: number; href: string; }
export interface TerminalContext { name: string; description: string; notes: TerminalNote[]; tags: TerminalTag[]; repository: string; }
export interface TerminalLine { text: string; label?: string; type?: 'system' | 'info' | 'success' | 'error'; href?: string; }
export interface CommandResult { lines: TerminalLine[]; clear?: boolean; navigate?: string; }

const commands = [
  ['help', '查看所有命令'], ['about', '关于我和这个站点'],
  ['notes', '列出公开笔记'], ['tags', '查看标签和篇数'],
  ['search <关键词>', '搜索笔记标题、摘要和标签'], ['stack', '技术与写作方式'],
  ['links', '站点目录和快捷入口'], ['open <入口>', '打开 notes / tags / search / rss / write / source'],
  ['history', '查看本次命令历史'], ['clear', '清空终端输出'],
  ['pwd', '显示当前位置'], ['whoami', '当前访客'],
  ['date', '显示上海时间'], ['echo <文字>', '原样显示文字'], ['exit', '返回首页'],
];
const aliases: Record<string, string> = { h: 'help', '?': 'help', ls: 'help', intro: 'about', cls: 'clear', quit: 'exit' };
export const completionCommands = [...commands.map(([name]) => name.split(' ')[0]), 'ls', 'intro', 'cls'];
export const completeCommand = (input: string) => {
  const prefix = input.trimStart();
  const choices = prefix.toLowerCase().startsWith('open ')
    ? ['notes', 'tags', 'search', 'rss', 'write', 'source'].map(name => `open ${name}`) : completionCommands;
  return prefix ? choices.filter(name => name.startsWith(prefix.toLowerCase())) : [];
};
const text = (content: string): TerminalLine => ({ text: content });
const tagged = (label: string, content: string, type: TerminalLine['type'] = 'info'): TerminalLine => ({ label, text: content, type });
const error = (content: string): CommandResult => ({ lines: [tagged('Error', content, 'error')] });
const link = (title: string, href: string, label?: string): TerminalLine => ({ text: title, href, label, type: 'info' });

export function introduction(context: TerminalContext): TerminalLine[] {
  return [
    tagged('System', '欢迎来到我的学习笔记站。', 'system'),
    tagged('Name', context.name), text(context.description),
    text('学习中的理解、实践中的问题，以及留给未来自己的备忘。'),
    tagged('Content', `${context.notes.length} 篇公开笔记 · ${context.tags.length} 个标签`),
    tagged('Workflow', 'Markdown → Git → 静态网页'),
    tagged('Ready', '输入 help 查看命令，或试试 notes。', 'success'),
  ];
}

export function executeCommand(input: string, context: TerminalContext, history: string[] = [], now = new Date()): CommandResult {
  const match = input.trim().match(/^(\S+)(?:\s+([\s\S]*))?$/);
  if (!match) return { lines: [] };
  const action = aliases[match[1].toLowerCase()] ?? match[1].toLowerCase();
  const argument = (match[2] ?? '').trim();
  const directories: Record<string, { href: string; description: string }> = {
    notes: { href: '/#feed', description: `${context.notes.length} 篇笔记，按时间倒序` },
    tags: { href: '/tags/', description: `${context.tags.length} 个标签` },
    search: { href: '/search/', description: '搜索标题、摘要和标签' },
    rss: { href: '/rss.xml', description: '订阅笔记更新' },
    write: { href: '/admin/', description: 'Markdown 写作入口' },
    source: { href: context.repository, description: '站点源码' },
  };
  switch (action) {
    case 'help': return { lines: commands.map(([label, content]) => tagged(label, content, 'system')) };
    case 'about': return { lines: [...introduction(context), text('不追求大而全，只把日常真正会用到的东西放进来。')] };
    case 'notes': return { lines: context.notes.length ? context.notes.map(note => link(note.title, note.href, note.date)) : [text('还没有公开笔记。')] };
    case 'tags': return { lines: context.tags.length ? context.tags.map(tag => link(`#${tag.name} · ${tag.count} 篇`, tag.href)) : [text('还没有标签。')] };
    case 'search': {
      if (!argument) return error('请输入关键词，例如 search Markdown。');
      const terms = argument.toLocaleLowerCase().split(/\s+/);
      const matches = context.notes.filter(note => {
        const searchable = `${note.title} ${note.description} ${note.tags.join(' ')}`.toLocaleLowerCase();
        return terms.every(term => searchable.includes(term));
      });
      return { lines: [tagged('Search', `“${argument}” · ${matches.length} 篇`), ...(matches.length ? matches.map(note => link(note.title, note.href, note.date)) : [text('没有找到笔记，试试其他关键词。')])] };
    }
    case 'stack': return { lines: [tagged('Build', 'Astro + TypeScript · 纯静态生成'), tagged('Content', 'Markdown 写笔记，Git 记录每次修改'), tagged('Deploy', '配置 GitHub Actions 后发布到自己的服务器'), tagged('Server', '无需数据库与运行时后端')] };
    case 'links': return { lines: [
      ...Object.entries(directories).filter(([, value]) => value.href).map(([name, value]) => link(value.description, value.href, name)),
      text('任意页面按 / 或 Ctrl / ⌘ K 打开搜索。'), ...(!context.repository ? [text('源码仓库尚未配置。')] : []),
    ] };
    case 'open': {
      const target = directories[argument.toLowerCase()];
      if (!target) return error('入口不存在。可用：notes、tags、search、rss、write、source。');
      if (!target.href) return error('源码仓库尚未配置，可先输入 links 查看站点入口。');
      return { lines: [tagged('Open', target.description, 'success')], navigate: target.href };
    }
    case 'clear': return { lines: [], clear: true };
    case 'history': return { lines: history.length ? history.map((command, index) => text(`${index + 1}  ${command}`)) : [text('本次还没有命令记录。')] };
    case 'pwd': return { lines: [text('/about')] };
    case 'whoami': return { lines: [text(`guest · ${context.name} 的访客`)] };
    case 'date': return { lines: [text(`${new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'full', timeStyle: 'medium', hour12: false }).format(now)} · Asia/Shanghai`)] };
    case 'echo': return { lines: [text(argument)] };
    case 'exit': return { lines: [], navigate: '/' };
    default: return error(`未知命令“${match[1]}”。输入 help 查看可用命令。`);
  }
}
