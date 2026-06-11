# Adição de Sub-Usuários (Gestor e Estabelecimento)

Este plano descreve as alterações necessárias para permitir que usuários principais (Gestor/Admin ou Estabelecimento) criem e gerenciem "sub-usuários" com papéis e permissões específicas de tela.

## User Review Required

> [!WARNING]
> Isso exigirá uma alteração no banco de dados (`schema.prisma`) e a geração de uma nova migration. O Prisma adicionará os novos campos na tabela `Usuario`.

## Proposed Changes

### Backend (Banco de Dados e API)

#### [MODIFY] backend/prisma/schema.prisma
Adicionar os seguintes campos no model `Usuario`:
- `criadoPorId String? @db.Uuid`: Para referenciar o usuário que o criou.
- `estabelecimentoVinculadoId String? @db.Uuid`: Para referenciar o estabelecimento (caso seja usuário do estabelecimento).
- `subPerfil String?`: "Gerente", "Recepcionista", "Operacional", etc.
- `permissoes String[]`: Array de strings indicando as telas/ações permitidas (ex: `["ADMIN_CITIES", "EST_ROOMS"]`).

Adicionar as relações necessárias (`criadoPor`, `usuariosCriados`, `estabelecimentoVinculado`).

#### [NEW] backend/src/modules/usuarios/dto/sub-usuario.dto.ts
DTOs para criação e atualização de sub-usuários. **Não exigirá senha**, pois a criação gerará um e-mail com link de redefinição de senha para o novo usuário.

#### [MODIFY] backend/src/modules/usuarios/usuarios.controller.ts
Adicionar endpoints para gerenciar sub-usuários:
- `POST /usuarios/sub-users`
- `GET /usuarios/sub-users`
- `PATCH /usuarios/sub-users/:id`
- `DELETE /usuarios/sub-users/:id`

#### [MODIFY] backend/src/modules/usuarios/usuarios.service.ts
Lógica de negócios para criar os usuários vinculados (gerando senha aleatória e ativando o fluxo de "esqueci minha senha" enviando o link de reset para o email cadastrado).

#### [NEW] backend/src/common/decorators/permissions.decorator.ts
Criar um decorator para validar permissões granulares, além do perfil geral.

#### [MODIFY] backend/src/common/guards/roles.guard.ts
Atualizar o guard para verificar as `permissoes` do usuário, caso a rota exija uma permissão específica.

---

### Frontend

#### [NEW] frontend/src/pages/admin/AdminUsers.tsx
Tela de listagem de usuários do Gestor. Tabela com opções para editar permissões ou excluir/desativar.
Modal/Form para Adicionar/Editar usuário:
- Nome, Email. (Sem campo de senha)
- Seleção de Perfil (Operacional).
- Checkboxes de Permissões: Cidades, Estabelecimentos, Eventos, Relatórios, etc.

#### [NEW] frontend/src/pages/establishment/EstUsers.tsx
Tela de listagem de usuários do Estabelecimento.
Modal/Form para Adicionar/Editar usuário:
- Nome, Email. (Sem campo de senha)
- Seleção de Perfil (Gerente, Recepcionista).
- Checkboxes de Permissões: Dashboard, Fotos, Preços, Quartos, Reservas, Relatórios.

#### [MODIFY] frontend/src/components/admin/AdminLayout.tsx
Atualizar a Sidebar do Gestor para:
1. Incluir a aba "Usuários".
2. Renderizar condicionalmente os links com base nas permissões do usuário logado (se houver permissões específicas).

#### [MODIFY] frontend/src/components/establishment/EstLayout.tsx
Atualizar a Sidebar do Estabelecimento para:
1. Incluir a aba "Usuários".
2. Renderizar condicionalmente os links baseados nas permissões.

#### [MODIFY] frontend/src/App.tsx
Adicionar as novas rotas protegidas para `AdminUsers` e `EstUsers`.
Ajustar o `RequireAuth` se for necessário checar permissões por rota.

## Verification Plan

### Automated Tests
- N/A (Executar migrations para confirmar que não quebra o banco).

### Manual Verification
1. Login como ADMIN principal -> Acessar Usuários -> Criar um "Sub-Gestor" com acesso apenas a "Cidades".
2. Login com "Sub-Gestor" -> Verificar se apenas "Cidades" aparece na sidebar e pode ser acessado.
3. Login como Estabelecimento principal -> Acessar Usuários -> Criar "Recepcionista" com acesso a "Reservas".
4. Login como "Recepcionista" -> Verificar se apenas "Reservas" está disponível.
