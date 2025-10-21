async function api(path: string, body?: any, method: string = 'GET') {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: any = {}, children: (Node | string)[] = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') (el as any).className = v;
    else if (k.startsWith('on') && typeof v === 'function') (el as any)[k.toLowerCase()] = v;
    else if (v !== undefined) el.setAttribute(k, v);
  });
  children.forEach(ch => el.append(ch instanceof Node ? ch : document.createTextNode(String(ch))));
  return el;
}

let dragSrcEl: HTMLElement | null = null;
function makeDraggable(item: HTMLElement) {
  item.draggable = true;
  item.addEventListener('dragstart', (e) => {
    dragSrcEl = item;
    e.dataTransfer?.setData('text/plain', 'drag');
    item.style.opacity = '0.5';
  });
  item.addEventListener('dragend', () => {
    item.style.opacity = '';
  });
  item.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  item.addEventListener('drop', (e) => {
    e.preventDefault();
    const list = item.parentElement!;
    const children = Array.from(list.children);
    const srcIndex = children.indexOf(dragSrcEl!);
    const destIndex = children.indexOf(item);
    if (srcIndex < destIndex) list.insertBefore(dragSrcEl!, item.nextSibling);
    else list.insertBefore(dragSrcEl!, item);
  });
}

async function load() {
  const linksList = document.getElementById('links')!;
  const usersDiv = document.getElementById('users')!;
  const resetMonday = document.getElementById('reset-monday') as HTMLSelectElement;
  const notifyEmail = document.getElementById('notify-email') as HTMLInputElement;

  const data = await api('/api/admin/state');
  linksList.innerHTML = '';
  for (const link of data.links) {
    const li = h('li', { className: 'item' }, [
      h('span', { className: 'handle' }, ['⠿']),
      h('input', { value: link.url, style: 'flex:2' }, []),
      h('input', { type: 'number', value: String(link.threshold), min: '1', step: '1', style: 'flex:0.6' }, []),
      h('span', { className: 'pill' }, [`${link.uses}/${link.threshold}`]),
      h('button', { className: 'danger', onClick: async () => { await api('/api/admin/link', { id: link.id }, 'DELETE'); await load(); } }, ['Delete'])
    ]);
    makeDraggable(li);
    linksList.appendChild(li);
  }

  resetMonday.value = String(!!data.settings.resetMonday);
  notifyEmail.value = data.settings.notifyEmail || '';

  const users = data.recentUsers as any[];
  usersDiv.textContent = '';
  usersDiv.appendChild(h('div', {}, [
    ...users.map(u => h('div', {}, [
      h('div', {}, [`${u.created_at} — ${u.phone} — ${u.status} — paid via ${u.payout_method}${u.payout_handle ? ' ('+u.payout_handle+')' : ''}`])
    ]))
  ]));
}

async function saveOrder() {
  const list = document.getElementById('links')!;
  const items = Array.from(list.children) as HTMLElement[];
  const payload = items.map(el => {
    const [handle, urlEl, thrEl] = Array.from(el.children) as HTMLElement[];
    return { url: (urlEl as HTMLInputElement).value, threshold: Number((thrEl as HTMLInputElement).value) };
  });
  await api('/api/admin/reorder', { links: payload }, 'POST');
  await load();
}

async function addLink() {
  const urlEl = document.getElementById('new-url') as HTMLInputElement;
  const thrEl = document.getElementById('new-threshold') as HTMLInputElement;
  if (!urlEl.value || !thrEl.value) return;
  await api('/api/admin/link', { url: urlEl.value, threshold: Number(thrEl.value) }, 'POST');
  urlEl.value = '';
  thrEl.value = '';
  await load();
}

async function saveSettings() {
  const resetMonday = document.getElementById('reset-monday') as HTMLSelectElement;
  const notifyEmail = document.getElementById('notify-email') as HTMLInputElement;
  const newAdminPw = document.getElementById('new-admin-password') as HTMLInputElement;
  await api('/api/admin/settings', {
    resetMonday: resetMonday.value === 'true',
    notifyEmail: notifyEmail.value || null,
    newAdminPassword: newAdminPw.value || null,
  }, 'POST');
  newAdminPw.value = '';
  await load();
}

(document.getElementById('add-link') as HTMLButtonElement).addEventListener('click', addLink);
(document.getElementById('save-order') as HTMLButtonElement).addEventListener('click', saveOrder);
(document.getElementById('save-settings') as HTMLButtonElement).addEventListener('click', saveSettings);

load().catch(err => {
  console.error(err);
  alert('Failed to load admin data: ' + err.message);
});
