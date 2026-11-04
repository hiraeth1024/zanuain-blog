export interface Session { authenticated: boolean; csrf?: string; username?: string; configured?: boolean; }
export interface BookmarkFields {
  url: string; title: string; description: string; author: string; notes: string;
  tag_string: string; preview_image_remote_url: string; unread: boolean; shared: boolean;
}
export interface Bookmark extends BookmarkFields {
  id: number; tags: string[]; is_archived: boolean; is_deleted: boolean;
  date_added: string; date_modified: string; has_article: boolean; has_snapshot: boolean;
  favicon: string; preview: string; capture_status: string; capture_error?: string;
}
export interface Settings { default_unread: boolean; default_shared: boolean; automatic_snapshots: boolean; auto_tags: string; }
export interface BookmarkList {
  items: Bookmark[]; total: number; page: number; pages: number; counts: Record<string, number>;
  tags: {name: string; count: number}[]; activity: {date: string; id: number}[];
}
export async function api<Result>(path = '', method = 'GET', data?: unknown, csrf?: string, signal?: AbortSignal): Promise<Result> {
  let response: Response;
  const [pathname, query] = path.split('?', 2);
  const endpoint = `${pathname.replace(/\/+$/, '')}/` + (query ? `?${query}` : '');
  try {
    response = await fetch(`/api/bookmarks${endpoint}`, {
      method, credentials: 'same-origin', signal,
      headers: { ...(data !== undefined ? {'Content-Type': 'application/json'} : {}), ...(csrf ? {'X-CSRF-Token': csrf} : {}) },
      ...(data !== undefined ? {body: JSON.stringify(data)} : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('无法连接书签服务，请稍后重试。');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || '书签服务暂时不可用，请稍后重试。');
  return result;
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : '操作未完成，请重试。';
export function safeNext(value: string | null) {
  return value && /^\/bookmarks\/(?:[a-z]+\/)?(?:\?[^#]*)?$/.test(value) ? value : '/bookmarks/';
}
export function loginLink() {
  return `/bookmarks/login/?next=${encodeURIComponent(location.pathname + location.search)}`;
}
