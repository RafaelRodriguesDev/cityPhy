import { fileStats, join, listDir, readText } from '../fileStats.ts';
import type { TowerBuilder } from '../towerBuilder.ts';
import { memoryIndexId } from './groundFloor.ts';
import type { ClaudeProjectSources } from './sources.ts';

/** `name:` from a memory file's frontmatter. */
function frontmatterName(text: string): string | null {
  return /^name:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? null;
}

/** Memory floors of one project: one per memory file; opened on demand, indexed by MEMORY.md. */
export function addMemoryFloors(t: TowerBuilder, p: ClaudeProjectSources): void {
  const memoryId = (file: string) => `claude.memory.${p.key}.${file.replace(/\.md$/, '')}`;
  const files = listDir(p.memoryDir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');
  const byName = new Map<string, string>();
  const texts = new Map<string, string>();

  for (const file of files) {
    const path = join(p.memoryDir, file);
    const s = fileStats(path);
    const text = readText(path);
    if (!s || text === null) continue;
    const id = memoryId(file);
    const name = frontmatterName(text) ?? file.replace(/\.md$/, '');
    byName.set(name, id);
    texts.set(id, text);
    t.addFloor({ id, label: name, section: 'memory', load: 'on-demand', sourceFile: path, bytes: s.bytes, updatedAt: s.updatedAt, project: p.path });
  }

  // MEMORY.md -> each memory it points to: "- [Title](file.md) — hook"
  const index = readText(join(p.memoryDir, 'MEMORY.md')) ?? '';
  for (const m of index.matchAll(/\]\(([^)]+\.md)\)/g)) t.link(memoryIndexId(p), memoryId(m[1]), 'indexes');

  // memory -> memory through [[name]]
  for (const [id, text] of texts) {
    for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const target = byName.get(m[1].trim());
      if (target) t.link(id, target, 'links_to');
    }
  }
}
