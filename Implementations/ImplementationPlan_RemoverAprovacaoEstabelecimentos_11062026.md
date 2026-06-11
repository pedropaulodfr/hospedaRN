# Remover Aprovação de Estabelecimentos

Este plano de implementação visa remover todas as referências, campos e endpoints relacionados à aprovação de estabelecimentos do sistema, uma vez que o auto-cadastro foi removido e os estabelecimentos são cadastrados diretamente pelo Gestor (portanto, já nascendo aprovados e ativos).

## User Review Required

> [!IMPORTANT]
> A remoção da coluna `aprovado` da tabela `Estabelecimento` no banco de dados exige uma migração Prisma. A migração executará comandos SQL estruturais (`ALTER TABLE`). Para garantir a integridade dos dados durante testes locais, todos os estabelecimentos existentes foram marcados como aprovados e ativos previamente no banco de dados.

## Proposed Changes

---

### Banco de Dados (Database)

#### [MODIFY] [schema.prisma](file:///d:/Documentos/projects/HospedaRN/backend/prisma/schema.prisma)
- Remover o campo `aprovado Boolean @default(false)` do modelo `Estabelecimento`.

---

### Backend API

#### [MODIFY] [estabelecimentos.service.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/estabelecimentos/estabelecimentos.service.ts)
- Remover `aprovado: true` da constante `ESTABLISHMENT_SELECT`.
- Simplificar as verificações na busca pública de estabelecimentos (`findAll`) para remover o campo `aprovado` (filtrando apenas por `ativo`).
- Remover a cláusula `e.aprovado = true` no método `findNearby`.
- Remover a função `approve(id: string)` inteiramente.

#### [MODIFY] [estabelecimentos.controller.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/estabelecimentos/estabelecimentos.controller.ts)
- Remover o endpoint `@Patch(':id/approve')` e o método `approve()`.

#### [MODIFY] [estabelecimento.dto.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/estabelecimentos/dto/estabelecimento.dto.ts)
- Remover o campo `aprovado` da classe DTO `BuscaEstabelecimentosDto`.

#### [MODIFY] [cidades.service.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/cidades/cidades.service.ts)
- Remover a cláusula `aprovado: true` na contagem de estabelecimentos por cidade no método `findOne`.

#### [MODIFY] [maps.service.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/maps/maps.service.ts)
- Remover a cláusula `e.aprovado = true` na consulta nativa SQL de estabelecimentos próximos no método `getNearbyEstablishments`.
- Remover a cláusula `aprovado: true` na contagem de estabelecimentos no método `getCitiesMap`.

#### [MODIFY] [notifications.service.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/notifications/notifications.service.ts)
- Remover a função `sendEstablishmentApproved(data)` e suas referências.

#### [MODIFY] [email.worker.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/notifications/workers/email.worker.ts)
- Remover o template `'estabelecimento-approved'` e seu respectivo processamento.

---

### Frontend

#### [MODIFY] [api.ts](file:///d:/Documentos/projects/HospedaRN/frontend/src/services/api.ts)
- Remover o método `approve: (id: string) => ...` do objeto `establishmentsApi`.

#### [MODIFY] [AdminEstablishments.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/admin/AdminEstablishments.tsx)
- Remover o campo `aprovado` da interface local `Establishment`.

## Verification Plan

### Automated Tests
- Executar `npm run build` na pasta `backend` para validar se todos os módulos compilam e não há erros de tipagem.
- Executar `npm run build` na pasta `frontend` para garantir que as remoções não quebraram nenhuma integração.

### Manual Verification
- Executar a migração Prisma (`npx prisma migrate dev --name remove_aprovado_column`).
- Navegar pela tela de administração de estabelecimentos e validar que novos estabelecimentos são criados normalmente.
- Validar se a pesquisa na página inicial e o mapa continuam funcionando sem erros.
