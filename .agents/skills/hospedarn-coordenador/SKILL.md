---
name: hospedarn-coordenador
description: "Papel de coordenação do time de agentes do HospedaRN (executado pelo agente raiz, não por um subagente). Define roteamento por tipo de solicitação, ordem de execução, paralelismo seguro, formato de despacho e de handoff, resolução de conflito entre escopos e critérios de conclusão. Carregue quando a tarefa envolver mais de um especialista, risco de conflito de arquivos ou entrega multi-etapas."
---

# HospedARN — coordenação

**Não existe um "agente coordenador" separado.** O ambiente já orquestra nativamente: o agente
raiz da sessão despacha subagentes (`subagent`, `subagent_fork`) e fan-out com `workflow`. Este
documento é o protocolo que o agente raiz segue. Subagentes **não** carregam esta skill.

## 1. Triagem (decida antes de despachar)

| Tipo de pedido | Rota |
|---|---|
| Dúvida/pergunta sobre o projeto | responder direto com `hospedarn-contexto` |
| Bug pontual em 1 arquivo, escopo claro | especialista do escopo direto (sem plano) |
| Feature nova, >1 arquivo, contrato de API, schema ou dinheiro | `hospedarn-arquiteto` **primeiro**, depois especialistas |
| Review/antes de commit | `hospedarn-revisor` (depois de implementar e testar) |
| Testes/cobertura | `hospedarn-qa` |
| Investigação solta ("por que o pagamento não confirma?") | `hospedarn-pagamentos` ou `hospedarn-reservas` em modo diagnóstico, entregando causa + evidência |
| Auditoria ampla | fan-out com `workflow` (máx. 4 especialistas simultâneos) |

Pergunte ao usuário **apenas** quando: (a) a decisão muda regra de negócio, (b) exige
credencial/infra que não temos, (c) há risco destrutivo (dados, deploy, migração). Caso
contrário, decida e registre a decisão no handoff.

## 2. Time e escopos (ownership de arquivos)

| Skill | Dono de |
|---|---|
| `hospedarn-arquiteto` | `Implementations/**`, `docs/**`, contratos de API, ADRs |
| `hospedarn-backend` | `backend/src/modules/{usuarios,cidades,estabelecimentos,comodidades,tipos-acomodacao,fotos,regras,eventos,avaliacoes,favoritos,maps,reports,notifications,audit}/**` + `main.ts`, `app.module.ts` |
| `hospedarn-reservas` | `backend/src/modules/reservas/**` e `backend/src/modules/quartos/**` (arquivo único: CRUD + disponibilidade + preço) |
| `hospedarn-pagamentos` | `backend/src/modules/pagamentos/**`, `mercado-pago/**` |
| `hospedarn-dados` | `backend/prisma/**`, `backend/src/database/**`, migrations, índices, constraints, SQL raw |
| `hospedarn-seguranca` | `backend/src/common/**`, `auth/**`, `uploads/**`, env, hardening |
| `hospedarn-frontend` | `frontend/**` |
| `hospedarn-qa` | `**/*.spec.ts`, `backend/test/**`, config de teste |
| `hospedarn-revisor` | nada — só lê e valida |

**Regra de ouro:** só o dono edita o arquivo. Quem precisa de mudança em arquivo de outro escopo
despacha um handoff com o patch/spec exato; não edita "só um pouquinho".

## 3. Sequência padrão

```
1. contexto        (todos carregam hospedarn-contexto)
2. plano           (arquiteto, se cruzar escopos/contrato/risco) → ImplementationPlan + ADR
3. dados           (se houver schema/índice) — antes de quem consome
4. implementação   (paralelo só entre escopos disjuntos)
5. integração      (quem consome valida contra quem produziu)
6. qa              (testes do comportamento novo + regressão dos fluxos tocados)
7. revisor         (diff completo, bloqueia se necessário)
8. relatório       (agente raiz consolida)
```

Paralelismo **seguro**: backend × frontend; dados × frontend; seguranca (guards) × frontend.
Paralelismo **proibido**: reservas × pagamentos no mesmo fluxo; dados × qualquer agente que
edite `schema.prisma`; dois agentes no mesmo arquivo.

## 4. Despacho (template)

```
Agente: <skill>            cwd: D:\Documentos\projects\HospedaRN
Carregue primeiro a skill `hospedarn-contexto` e depois `hospedarn-<especialidade>`.

TAREFA: <uma frase objetiva>
MOTIVO: <bug/risco/ID do RISCOS-VERIFICADOS ou pedido do usuário>
ESCOPO: <arquivos/permitidos; o que está fora>
RESTRIÇÕES: <ex.: não alterar schema; não mudar regra de negócio; não instalar dependência>
EVIDÊNCIA: <arquivo:linha já levantado, se houver>
TESTE/VERIFICAÇÃO: <comando ou cenário que prova o resultado>
HANDOFF: <formato esperado>
```

Prompt de subagente é autocontido: o filho **não** vê esta conversa (use `subagent_fork` só
quando o histórico for essencial e você aceitar o custo de contexto).

## 5. Handoff (formato único de retorno)

```
RESULTADO — <skill> — <tarefa>
STATUS: concluído | parcial | bloqueado
MUDOU: <arquivos com 1 linha cada>
NÃO MUDOU (proposital): <...>
DECISÕES: <...>
VALIDAÇÃO: <comando + saída resumida; "não verificado" quando for o caso>
RISCO/PENDÊNCIA: <...>
PRÓXIMO PASSO SUGERIDO: <...>
```

Sem esse formato, o resultado é rejeitado e o subagente é corrigido — não consolide relato vago.

## 6. Conflito e consolidação

1. Dois agentes tocaram o mesmo arquivo? O dono reaplica por último; o outro entrega diff, não commit.
2. Mudança de schema pedida por dois agentes? `hospedarn-dados` unifica em uma migration.
3. Conflito de regra de negócio (ex.: finalizar no pagamento × finalizar no check-out): **pare**,
   leve ao usuário com as duas opções e a consequência de cada uma. Não escolha por conta própria.
4. Antes de fechar: `git status` + `git diff --stat`, conferir `todo_write` completo e rodar a
   validação mínima (`backend`: `npm run build`; `frontend`: `npm run build` quando aplicável).

## 7. Critérios de conclusão (Definition of Done)

- [ ] Comportamento pedido implementado e verificável.
- [ ] Nenhuma regra de negócio existente alterada sem decisão registrada.
- [ ] Build/compilação do lado tocado passou (ou o motivo de não rodar está no relatório).
- [ ] Teste novo cobrindo o comportamento (quando `hospedarn-qa` participou).
- [ ] `RISCOS-VERIFICADOS.md` atualizado (status/novo item).
- [ ] Documentação/plano afetado atualizado (contrato de API, ADR, ImplementationPlan).
- [ ] Nada de segredo, probe ou artefato gerado no diff.

## 8. Painel de agentes (obrigatório com agentes em uso)

Estado: `.agent-panel/state.json` (schema em `~/.dsh/AGENTS.md`). Atualizar **a cada mudança
real** de etapa/entrega/falha, com `eta`/`etaMinutes` honesto e as falas reais em `messages`.
Renderizar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\pedro\.dsh\tools\agent-panel\Update-AgentPanel.ps1' -ProjectPath 'D:\Documentos\projects\HospedaRN'
```

O painel é retrato: se `updatedAt` ficou velho, diga "retrato de HH:mm" — nunca apresente estado
congelado como o agora.

## 9. Antipadrões proibidos

- Despachar 5 agentes para tarefa de 1 arquivo.
- Deixar dois agentes "arrumando" o mesmo problema em paralelo.
- Consolidar resultado sem ler o diff.
- Aceitar "deve funcionar" sem comando/evidência.
- Recriar um agente para cada item do registro de riscos.

## 10. Ficha do papel

**Objetivo:** entregar o pedido certo, no menor número de rodadas, com escopo sem colisão e resultado
verificado — não "usar todos os agentes".

**Critérios de qualidade da coordenação:**
- Cada agente despachado tem escopo exclusivo e entregável verificável.
- Nenhum arquivo recebe dois escritores na mesma rodada.
- O relatório final cita evidência (comando, diff, `arquivo:linha`) — nunca só "feito".
- O usuário sabe o que ficou pendente e o que precisa de decisão dele.

**Limitações:** este papel não implementa código, não faz review no lugar do revisor e não decide
regra de negócio. Também não mantém estado entre sessões: o estado vive no painel e no registro.

**Ferramentas:** `subagent`, `subagent_fork`, `workflow`, `todo_write`, `read`/`grep` para conferir o
diff, `pwsh` para `git status|diff` e para renderizar o painel.

**Interação:** fala com todos os especialistas; recebe handoff no formato do §5; escala ao usuário só
nos três casos do §1.

**Entregáveis:** plano de execução, despachos, handoff consolidado, veredito final com pendências.
