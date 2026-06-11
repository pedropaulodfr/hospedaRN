# Plano de Implementação: Edição de Estabelecimentos e Remoção de Aprovação (Gestor)

## Descrição do Objetivo
Atualizar a tela de gerenciamento de estabelecimentos do módulo Gestor (`AdminEstablishments.tsx`), removendo as lógicas e colunas referentes ao status de "Aprovação" (incluindo as abas "Pendentes" e "Aprovados"). Além disso, implementar a nova ação de "Editar" para atualizar os dados de um estabelecimento existente.

## Alterações Propostas

### `frontend/src/pages/admin/AdminEstablishments.tsx`
- **Remoção de Abas e Filtros**: 
  - Remover as abas "Pendentes de Aprovação" e "Aprovados / Ativos". Manteremos apenas "Todos" e "Inativos".
  - Atualizar a função `fetchEstablishments` para lidar apenas com os filtros remanescentes.
- **Remoção de Colunas e Ações de Aprovação**: 
  - Remover a coluna "Aprovado" e a renderização do `Chip` de status.
  - Remover o ícone e a função `handleApprove` da listagem de ações.
- **Implementação da Ação "Editar"**:
  - Criar um estado para indicar se o modal atual é de "Criação" ou "Edição" (`isEditMode` e `editEstId`).
  - Adicionar o ícone de "Editar" (`Edit` do MUI) na coluna de Ações.
  - Criar a função `handleOpenEdit(est)` para preencher os formulários (Nome, Descrição, etc.) com os dados atuais do estabelecimento e abrir o Modal.
  - Ajustar o método de envio (que atualmente é `handleCreate`) para chamar `establishmentsApi.update` caso esteja no modo de edição, ou `establishmentsApi.create` caso seja um novo cadastro.
  - Ajustar o título do modal dinamicamente: "Cadastrar Novo Estabelecimento" ou "Editar Estabelecimento".

## Plano de Verificação
Após a aplicação das mudanças:
1. Verificar se a tela de Estabelecimentos (Admin) não exibe mais a aba nem a coluna "Aprovado".
2. Clicar no botão "Editar" de um estabelecimento e verificar se os dados são populados corretamente no formulário.
3. Submeter uma alteração e confirmar se ela reflete na listagem e não gera erro no backend.
