# Prompt padrão: construir a torre da sua IA no cityPhy

Copie o bloco abaixo para a IA (Codex, Antigravity, Gemini CLI, opencode...). Troque `<ia>` pelo id dela em minúsculas
(`codex`, `antigravity`...) e `<Ia>` pelo nome com maiúscula (`Codex`, `Antigravity`). Funciona em qualquer máquina:
os caminhos vêm do `cityphy.config.json`. O modelo de referência é a torre do Claude, em `src/towers/claude/`.

---

Você vai construir a **sua própria torre** no cityPhy, um projeto que mostra o contexto das IAs como uma cidade 3D:
cada IA é uma torre; cada andar é algo que você carrega ou guarda (regras, memória, skills, sessões). Responda em
português.

**Regras que não mudam:**
- Mexa **só** em `src/towers/<ia>/`. Outras IAs trabalham ao mesmo tempo em outras pastas. Não altere
  `src/towers/schema.ts`, `towerBuilder.ts`, `fileStats.ts`, `cli.ts` nem nada fora da sua pasta; se precisar, pergunte.
- **Só leitura** nas suas pastas de configuração. **Nunca copie conteúdo** para a torre: só nomes, tamanhos, datas e
  ligações. Título de sessão pode; mensagem, não.
- Não invente caminho nem formato. Se não tiver certeza de onde algo fica, diga que não sabe e pergunte.
- Código e comentários em inglês; uma peça por arquivo; ids estáveis `<ia>.<seção>.<chave-do-projeto>.<nome>`.
- **Não faça commit.** Quem revisa e commita é o Claude.

**Passos:**
1. Leia `AGENTS.md`, `docs/METAPHOR.md`, `docs/TOWER-SCHEMA.md`, `cityphy.config.json` (ou o `.example`) e todo
   `src/towers/` (`schema.ts`, `towerBuilder.ts`, `fileStats.ts`, `cli.ts` e a pasta `claude/`, que é o modelo).
2. **Levante onde você guarda o seu contexto nesta máquina**, só lendo: regras/instruções globais, as de cada projeto
   do `cityphy.config.json`, sua memória (se tiver), suas skills e seus registros de sessão. **Antes de programar**, me
   mostre uma tabela: caminho, o que é, seção (`ground` = carregado em toda sessão, `memory`, `skills`, `sessions`) e
   se é global ou de um projeto. Espere eu responder.
3. Crie `src/towers/<ia>/` com a mesma divisão do Claude: `sources.ts`, `groundFloor.ts`, `memoryFloor.ts`,
   `skillsFloor.ts`, `sessionsFloor.ts` e `build<Ia>Tower.ts`. No `build<Ia>Tower.ts` use
   `towerArgs('<ia>')` (de `../cli.ts`) para ler os projetos e a pasta de saída, e `new TowerBuilder('<ia>', '<Ia>', 8)`.
   Seção que você não tem (ex.: sem memória) simplesmente fica sem andares.
4. **Ligação com os projetos:** todo andar que pertence a um projeto leva `project: <caminho do projeto>` (o mesmo
   `path` do config). É isso que puxa o cabo de energia da sua torre até o condomínio do projeto.
5. O que não é arquivo (suas regras embutidas) entra com `bytes: null`.
6. **Gere e prove:** rode `node src/towers/<ia>/build<Ia>Tower.ts` e `npm run typecheck`, e
   `graphify explain "<um andar do seu térreo>" --graph <dataDir>/torre-<ia>/graphify-out/graph.json`. Cole as três
   saídas. Se o servidor estiver rodando (`npm run dev`, porta 5190), recarregue a página: sua torre aparece ao lado da
   do Claude.
7. **Guarde na sua memória/instruções persistentes:** "Minha torre no cityPhy é gerada por
   `src/towers/<ia>/build<Ia>Tower.ts` (ou por `npm run refresh`). Sempre que eu mudar minhas regras, memória ou skills,
   rodo de novo." Me diga onde salvou.
8. Entregue a lista de arquivos criados.
