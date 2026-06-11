# Plano de Implementação - Funcionalidade de Alterar Senha nos Módulos

Este plano detalha a criação e implementação da funcionalidade que permite aos usuários (Hóspedes, Estabelecimentos e Gestores) alterarem suas senhas de acesso diretamente em seus respectivos painéis do sistema.

## Mudanças Propostas

### 1. Componente Compartilhado de Perfil (`ProfileSettings`)
Criaremos um componente visual moderno e unificado chamado `ProfileSettings` que exibirá:
- **Resumo do Perfil**: Nome, E-mail, Telefone e Cargo do usuário conectado, renderizados com estilo premium (cards com gradientes e sombras sutis).
- **Formulário de Alteração de Senha**:
  - Senha Atual (com botão de exibir/ocultar senha)
  - Nova Senha (com botão de exibir/ocultar senha)
  - Confirmar Nova Senha (com botão de exibir/ocultar senha)
  - Validações básicas (tamanho mínimo, correspondência entre as novas senhas).
  - Feedback visual de carregamento (loading spinner) e alertas via `toast` (sucesso/erro).

### 2. Integração nos Módulos

#### [NEW] [ProfileSettings.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/components/profile/ProfileSettings.tsx)
- Implementar a interface do formulário de perfil e alteração de senha utilizando Material UI e React Hook Form/Zod.
- Conectar com o endpoint `usersApi.changePassword`.

#### [MODIFY] [GuestProfile.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/guest/GuestProfile.tsx)
- Importar e renderizar o componente `ProfileSettings`.

#### [NEW] [EstProfile.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/establishment/EstProfile.tsx)
- Criar a página de perfil do Estabelecimento importando o `ProfileSettings`.

#### [NEW] [AdminProfile.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/admin/AdminProfile.tsx)
- Criar a página de perfil do Administrador importando o `ProfileSettings`.

#### [MODIFY] [DashboardLayout.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/components/layout/DashboardLayout.tsx)
- Adicionar o link de "Meu Perfil" no menu lateral dos painéis de `establishment` (Estabelecimento) e `admin` (Gestor).

#### [MODIFY] [App.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/App.tsx)
- Registrar as rotas:
  - `/estabelecimento/perfil` apontando para `EstProfile`
  - `/admin/perfil` apontando para `AdminProfile`

---

## Plano de Verificação

### Testes Manuais
1. **Módulo Hóspede**:
   - Fazer login como hóspede.
   - Navegar em "Meu Perfil".
   - Tentar alterar a senha digitando a senha atual errada -> Deve exibir erro.
   - Alterar com dados corretos -> Deve exibir mensagem de sucesso.
   - Fazer logout e login novamente com a nova senha.
2. **Módulo Estabelecimento**:
   - Fazer login como estabelecimento.
   - Navegar até o menu "Meu Perfil".
   - Repetir o teste de alteração de senha.
3. **Módulo Administrador**:
   - Fazer login como gestor (`gestor@hospedarn.com.br`).
   - Ir em "Meu Perfil".
   - Repetir o teste de alteração de senha.
