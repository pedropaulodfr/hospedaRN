# HospedaRN — instruções do projeto

Marketplace de hospedagens do RN: **NestJS 11 + Prisma/PostgreSQL (Neon, PostGIS)** em `backend/`,
**React 19 + MUI 9 + Vite** em `frontend/`. Três perfis: `HOSPEDE`, `ESTABELECIMENTO`, `ADMIN`.
Fluxo central: hóspede solicita → estabelecimento confirma → pagamento (`PADRAO` com comprovante ou
`MERCADO_PAGO` automático) → finalização.

## 1. Antes de qualquer tarefa

1. Carregue a skill **`hospedarn-contexto`** (mapa, invariantes, comandos, armadilhas) — ela é a fonte
   de fatos do projeto.
2. Consulte **`docs/agents/RISCOS-VERIFICADOS.md`** (34 achados com `arquivo:linha` e dono). Se o que
   você ia "descobrir" já está lá, use o ID.
3. Para tarefa multi-arquivo/contrato/risco, carregue **`hospedarn-coordenador`** e siga o protocolo.

## 2. Time de agentes (skills do projeto)

| Skill | Papel | Escopo de arquivos |
|---|---|---|
| `hospedarn-contexto` | base de conhecimento (todos carregam) | leitura |
| `hospedarn-coordenador` | coordenação — **é o agente raiz**, não um subagente | protocolo |
| `hospedarn-arquiteto` | plano, ADR, contratos, `docs/` | `Implementations/**`, `docs/**` |
| `hospedarn-backend` | NestJS fora do núcleo financeiro | `backend/src/modules/{usuarios,cidades,estabelecimentos,comodidades,tipos-acomodacao,fotos,regras,eventos,avaliacoes,favoritos,maps,reports,notifications,audit}/**` + `backend/src/main.ts`, `app.module.ts` |
| `hospedarn-reservas` | reservas, disponibilidade, preço | `backend/src/modules/reservas/**` **e** `backend/src/modules/quartos/**` (arquivo único: CRUD + disponibilidade + preço) |
| `hospedarn-pagamentos` | pagamentos e Mercado Pago | `backend/src/modules/{pagamentos,mercado-pago}/**` |
| `hospedarn-dados` | Prisma, migrations, índices, SQL | `backend/prisma/**`, `backend/src/database/**`, `backend/scripts/**` |
| `hospedarn-seguranca` | autorização, JWT, segredos, hardening | `backend/src/common/**`, `auth/**`, `uploads/**`, env |
| `hospedarn-frontend` | React/MUI, dados, UX, a11y | `frontend/**` |
| `hospedarn-qa` | testes | `**/*.spec.ts`, `backend/test/**` |
| `hospedarn-revisor` | review pré-commit (read-only) | nenhum — só valida |

**Acionar um agente:**

```
subagent({
  name: "<prefixo>-<tarefa>", cwd: "D:\\Documentos\\projects\\HospedaRN",
  prompt: "Carregue as skills `hospedarn-contexto` e `hospedarn-<especialidade>`.
           TAREFA: ... ESCOPO: ... RESTRIÇÕES: ... VALIDAÇÃO: ... HANDOFF: formato do coordenador §5"
})
```

Cada arquivo tem **um dono**. `quartos/**`, `uploads/**` e `common/**` não se editam "de passagem":
precisa do dono. Registro de riscos: só o `hospedarn-arquiteto` cria/reestrutura item; quem corrige
atualiza **apenas** a célula `Status`/`Evidência` do `R-xx` correspondente.

Fan-out paralelo (auditoria, migração em vários módulos): ferramenta `workflow`, com skills
carregadas por agente. Paralelismo só entre escopos disjuntos — nunca dois agentes no mesmo arquivo.

## 3. Regras de trabalho

1. **Leia antes de editar**: controller + service + dto do módulo, não só a linha.
2. **Preserve a arquitetura e as regras de negócio**; mudança de regra (preço, cancelamento, pagamento,
   status) precisa de decisão explícita do usuário.
3. **Mudança mínima**: sem refactor/renomeação não pedidos; sem terceiro padrão para o mesmo problema.
4. **Não presuma**: sem código/evidência, escreva "não verificado".
5. **File ownership**: só o dono edita o arquivo; quem precisa de mudança em outro escopo envia a
   especificação exata.
6. **Valide sempre**: `cd backend; npm run build` (obrigatório no backend), `cd frontend; npm run build`
   quando tocar UI, `npm test` quando houver teste.
7. **Documente decisões** relevantes no handoff e, se for estrutural, em ADR/ImplementationPlan.
8. **Informe riscos, limitações e dependências** no handoff — inclusive o que não foi testado.
9. **Nada destrutivo sem autorização**: sem `prisma db push`, `migrate reset`, `DROP`, seed em produção,
   deploy, `git push`, rotação de chave ou uso de credencial real em teste.
10. **Autonomia no escopo**: não peça confirmação para passo trivial; peça quando a decisão muda regra de
    negócio ou exige acesso externo.
11. **Escrita restrita**: as ferramentas `write`/`edit` só valem dentro do seu escopo. Para alterar
    `.agents/**`, `AGENTS.md` ou reestruturar o registro de riscos, chame o `hospedarn-arquiteto`.

## 4. Fatos do ambiente que enganam

- `.start/backend.bat` usa `npm start dev` (script inexistente) → use `npm run start:dev`.
- `start:prod` roda `prisma db push --accept-data-loss` (destrutivo) — não reproduza.
- `backend/.env` tem credenciais **reais** (Neon, AWS, Resend, MP sandbox): nunca imprima, nunca versione.
- `backend/test/app.e2e-spec.ts` falha por causa do envelope `{success,data,timestamp}`.
- Frontend: não existe `src/types` nem `vite.config.ts`; `src/{main.ts,counter.ts,style.css}` são sobras do template.
- Windows + **PowerShell 5.1** (sem `pwsh`, sem `&&`; use `;`).
- `git status` do branch atual traz probes (`probe-mp.cjs`), scripts one-off (`query_db.js`,
  `refactor_backend.js`), PNGs e um `package.json` de raiz: **não** são base de código, não edite.

## 5. Comandos

```powershell
# backend
cd backend; npm run start:dev        # API em :3000/api, Swagger em /docs
npm run build                        # gate de compilação
npx eslint "src/**/*.ts"             # NUNCA `npm run lint`: ele roda --fix em todo src e reescreve arquivo de outro dono
npm test                             # jest
npx prisma generate                  # após mudar o schema
npx prisma migrate dev --name <slug> # dev; produção é migrate deploy

# frontend
cd frontend; npm run dev             # :5173
npm run build                        # tsc && vite build
```

Redis local: `docker compose up -d` (raiz, Redis + redis-commander).

## 6. Onde está a verdade

- Regras de produto: `Documento_Especificacao_Requisitos.md`, `Regra_Pagamento_Mercado_Pago.md`.
- Planejamento: `Implementations/ImplementationPlan_<slug>_<ddmmaaaa>.md`.
- Riscos e fila de trabalho: `docs/agents/RISCOS-VERIFICADOS.md`.
- Arquitetura dos agentes: `.agents/README.md`.
- Documentação técnica: `docs/{api,erd,flows}/` (hoje vazios — responsabilidade do arquiteto).

## 7. Painel de agentes

Ao trabalhar com agentes, mantenha `.agent-panel/state.json` atualizado e renderize:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\pedro\.dsh\tools\agent-panel\Update-AgentPanel.ps1' -ProjectPath 'D:\Documentos\projects\HospedaRN'
```

Artefatos gerados (`.agent-panel/`, `agent-panel.html`) não entram no commit.
