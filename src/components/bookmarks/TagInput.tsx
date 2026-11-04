import { useId, useRef, useState } from 'react';
import { pinyin } from 'pinyin-pro';

export default function TagInput({value, onChange, tags}: {value: string; onChange: (value: string) => void; tags: {name: string}[]}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [cursor, setCursor] = useState(value.length);
  const start = value.lastIndexOf(' ', Math.max(0, cursor - 1)) + 1;
  const nextSpace = value.indexOf(' ', cursor);
  const end = nextSpace < 0 ? value.length : nextSpace;
  const word = value.slice(start, end).toLowerCase();
  const selected = value.split(/\s+/).filter(tag => tag.toLowerCase() !== word);
  const suggestions = tags.map(tag => {
    const name = tag.name.toLowerCase();
    const roman = pinyin(tag.name, {toneType: 'none', type: 'array'}).join('').toLowerCase();
    const initials = pinyin(tag.name, {pattern: 'first', toneType: 'none', type: 'array'}).join('').toLowerCase();
    const score = name.startsWith(word) ? 3 : name.includes(word) ? 2 : roman.includes(word) || initials.startsWith(word) ? 1 : 0;
    return {...tag, score};
  }).filter(tag => tag.score && !selected.includes(tag.name)).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'zh-CN')).slice(0, 100);
  const choose = (name: string) => {
    const next = value.slice(0, start) + name + ' ' + value.slice(end).trimStart();
    onChange(next); setOpen(false); setActive(0);
    requestAnimationFrame(() => {input.current?.focus(); const position = start + name.length + 1; input.current?.setSelectionRange(position, position); setCursor(position);});
  };
  return <div className="bm-tag-input">
    <input ref={input} id="bm-tags" name="tag_string" role="combobox" aria-expanded={open && suggestions.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && suggestions[active] ? `${listId}-${active}` : undefined} value={value} autoComplete="off"
      onFocus={() => {setCursor(input.current?.selectionStart ?? value.length); setOpen(true);}}
      onBlur={() => setOpen(false)}
      onClick={() => {setCursor(input.current?.selectionStart ?? value.length); setOpen(true);}}
      onChange={event => {onChange(event.target.value); setCursor(event.target.selectionStart ?? event.target.value.length); setActive(0); setOpen(true);}}
      onKeyDown={event => {
        if (event.key === 'Escape') {setOpen(false); event.stopPropagation();}
        if (open && suggestions.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {event.preventDefault(); setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);}
        if (open && suggestions[active] && (event.key === 'Enter' || event.key === 'Tab') && !event.ctrlKey && !event.metaKey) {event.preventDefault(); choose(suggestions[active].name);}
      }}
    />
    {open && suggestions.length > 0 && <ul className="bm-tag-suggestions" id={listId} role="listbox">{suggestions.map((tag, index) => <li id={`${listId}-${index}`} key={tag.name} role="option" aria-selected={active === index} onMouseDown={event => event.preventDefault()} onClick={() => choose(tag.name)}>{tag.name}</li>)}</ul>}
  </div>;
}
