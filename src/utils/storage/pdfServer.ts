// Dev-only helpers for saving/removing PDFs on a local server or Vite dev middleware

export async function savePdfToServer(
  file: Blob,
  opts: { filename: string; id?: string; timeoutMs?: number }
): Promise<string | null> {
  try {
    if (typeof fetch === 'undefined') return null;
    const params = new URLSearchParams();
    params.set('filename', opts.filename || 'upload.pdf');
    if (opts.id) params.set('id', opts.id);
    const base = ((import.meta as any)?.env?.VITE_API_URL as string) || '';
    const token = ((import.meta as any)?.env?.VITE_API_TOKEN as string) || '';
    const url = `${base ? base.replace(/\/$/, '') : ''}/api/upload?${params.toString()}`;
    const headers: Record<string, string> = { 'Content-Type': (file as any)?.type || 'application/pdf' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timeout = Math.max(1000, Number(opts.timeoutMs ?? 12000));
    let timer: any;
    if (ctrl) timer = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(url, { method: 'POST', headers, body: file, signal: ctrl?.signal as any });
    if (timer) clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({} as any));
    return (data && (data.path || data.filePath)) ? (data.path || data.filePath) : null;
  } catch {
    return null;
  }
}

export async function deletePdfFromServerById(id: string): Promise<boolean> {
  try {
    if (!id || typeof fetch === 'undefined') return false;
    const base = ((import.meta as any)?.env?.VITE_API_URL as string) || '';
    const token = ((import.meta as any)?.env?.VITE_API_TOKEN as string) || '';
    const url = `${base ? base.replace(/\/$/, '') : ''}/api/upload?id=${encodeURIComponent(id)}`;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { method: 'DELETE', headers });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deletePdfFromServerByPath(p: string): Promise<boolean> {
  try {
    if (!p || typeof fetch === 'undefined') return false;
    const base = ((import.meta as any)?.env?.VITE_API_URL as string) || '';
    const token = ((import.meta as any)?.env?.VITE_API_TOKEN as string) || '';
    const url = `${base ? base.replace(/\/$/, '') : ''}/api/upload?path=${encodeURIComponent(p)}`;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { method: 'DELETE', headers });
    return res.ok;
  } catch {
    return false;
  }
}

