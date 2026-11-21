# Arquitetura de agentes do HospedaRN

Estrutura implementada em **2026-11-19**, após análise somente-leitura de todo o repositório
(backend, frontend, infra, histórico do branch `feature/integracao-mercado-pago`).

## Como funciona (mecanismo nativo do DeepSeek Harness)

| Peça | Onde | Papel |
|---|---|---|
| Instruções do projeto | `AGENTS.md` (raiz) | carregado automaticamente em toda sessão: mapa, regras, time, comandos |
| Skills do projeto | `.agents/skills/<nome>/SKILL.md` | descobertas nativamente (`<projectRoot>/.agents/skills`, rank 200) e carregadas sob demanda pela ferramenta `skill` |
| Execução paralela | ferramentas `subagent` / `subagent_fork` / `workflow` | cada agente é um subagente com prompt autocontido que carrega suas skills |
| Coordenação | skill `hospedarn-coordenador` | o **agente raiz** é o coordenador; não existe subagente "coordenador" |
| Observabilidade | `.agent-panel/state.json` → `agent-panel.html` | painel ao vivo (fora do commit) |
| Fila de trabalho | `docs/agents/RISCOS-VERIFICADOS.md` | 34 achados verificados com dono e status |

Não há plugin, MCP nem preset customizado: a arquitetura usa apenas recursos nativos do harness,
o que mantém o repositório portátil entre máquinas e sessões.

## O time

| Skill | Especialidade | Por que existe |
|---|---|---|
| `hospedarn-contexto` | base de fatos | evita que cada agente redescubra stack, invariantes e armadilhas |
| `hospedarn-coordenador` | protocolo de orquestração | define roteamento, paralelismo seguro, handoff e DoD |
| `hospedarn-arquiteto` | plano/ADR/contrato/docs | o projeto já tem convenção de `ImplementationPlan`; decisões cruzadas precisam de dono |
| `hospedarn-backend` | NestJS geral | 14 módulos de catálogo/CRUD compartilham os mesmos padrões |
| `hospedarn-reservas` | núcleo do negócio | overbooking, máquina de estados e preço concentram o risco financeiro |
| `hospedarn-pagamentos` | dinheiro | Mercado Pago, webhook, idempotência e comprovante têm regras próprias e críticas |
| `hospedarn-dados` | Prisma/migrations/índices | schema sem histórico versionado e sem constraint anti-overbooking |
| `hospedarn-seguranca` | autorização/segredos/hardening | IDOR e escalada de privilégio encontrados no código |
| `hospedarn-frontend` | React/MUI/dados/a11y | 14,9k linhas, sem tipos, sem camada de dados, com formulário de cartão fictício |
| `hospedarn-qa` | testes | 1 teste de template e e2e quebrado; nenhuma rede de segurança |
| `hospedarn-revisor` | review pré-commit | único ponto que vê o diff inteiro antes do merge |

**Fora do time, de propósito:** UX/UI e acessibilidade foram incorporadas como critérios do
`hospedarn-frontend` (seria um agente que só revisa); documentação é entregável do `hospedarn-arquiteto`;
coordenação é papel do agente raiz (o harness já orquestra). Nada de agente duplicado.

## Como acionar

```text
subagent({
  name: "pag-wirehook",
  cwd: "D:\\Documentos\\projects\\HospedaRN",
  prompt: "Carregue as skills `hospedarn-contexto` e `hospedarn-pagamentos`.
           TAREFA: corrigir R-03 (assinatura fail-open no webhook).
           ESCOPO: backend/src/modules/mercado-pago/**, pagamentos/**.
           RESTRIÇÕES: não alterar status de reserva; sem instalar dependência.
           VALIDAÇÃO: npm run build + teste unitário do validateWebhookSignature.
           HANDOFF: formato do hospedarn-coordenador §5."
})
```

Uma tarefa pode usar vários agentes em paralelo **somente** com escopos disjuntos (backend × frontend,
dados × frontend). Fluxos acoplados (reservas × pagamentos) são sequenciais, com o `hospedarn-revisor`
no fim.

## Regras de manutenção

0. **Um arquivo, um dono.** Escopo em `.agents/README.md`, `AGENTS.md` §2 e `hospedarn-coordenador` §2
   tem que dizer a mesma coisa. Só o `hospedarn-arquiteto` edita `.agents/**`, `AGENTS.md` e
   reestrutura o registro de riscos; quem corrige atualiza apenas a célula `Status`/`Evidência`.
1. **Um agente = um escopo de arquivo.** Se dois agentes precisam do mesmo arquivo, o escopo está errado.
2. Antes de criar agente novo, verifique se é um item da fila de riscos que nenhum especialista cobre.
   Crie o arquivo em `.agents/skills/hospedarn-<nome>/SKILL.md` com frontmatter `name` + `description`
   (a `description` é o que roteia o agente; escreva "Carregue quando..." de forma específica).
3. Registre o novo agente na tabela de `AGENTS.md` §2 e na tabela de escopos do `hospedarn-coordenador` §2.
4. Remova agente que deixou de ter escopo real — agente ocioso só polui o roteamento.
5. `description` deve caber em ~1 linha e citar gatilhos concretos (nomes de módulo, sintomas).
6. Não coloque segredo, caminho absoluto de máquina ou credencial nas skills.
