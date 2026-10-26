export interface Tab {
  label: string;
  html: string;
}

/** Tab bar + panes inside `host`; the first tab starts open. Same component for every panel. */
export function renderTabs(host: HTMLElement, tabs: Tab[]): void {
  host.innerHTML = `
    <div class="tabs" role="tablist">${tabs.map((t, i) => `<button role="tab" class="tab${i ? '' : ' on'}" data-i="${i}">${t.label}</button>`).join('')}</div>
    ${tabs.map((t, i) => `<div class="pane" data-i="${i}"${i ? ' hidden' : ''}>${t.html}</div>`).join('')}`;
  host.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) =>
    b.addEventListener('click', () => {
      host.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b));
      host.querySelectorAll<HTMLElement>('.pane').forEach((p) => (p.hidden = p.dataset.i !== b.dataset.i));
    }),
  );
}
