# Plano de Implementação - Módulo do Gestor (Admin)

Este plano detalha a implementação das telas e funcionalidades do módulo do Gestor (Administrador Geral), tanto no frontend quanto no backend, conforme especificações do `Documento_Especificacao_Requisitos.md` e as regras de cadastro exclusivo de estabelecimentos com fluxo de envio de e-mail seguro para redefinição de senha.

## User Review Required

> [!IMPORTANT]
> - O estabelecimento não fará seu autocadastro. Quem realizará o cadastro de todos os estabelecimentos será exclusivamente o gestor.
> - O gestor **não** precisará selecionar um proprietário cadastrado para vincular ao estabelecimento.
> - Ao cadastrar um estabelecimento, se o usuário associado ao e-mail de contato do estabelecimento não existir, **o sistema criará automaticamente um usuário principal (tipo `ESTABELECIMENTO`)** com:
>   - E-mail = E-mail do Estabelecimento.
>   - Nome = Nome do Estabelecimento.
>   - Telefone = Telefone de contato do Estabelecimento.
>   - Senha = Senha temporária gerada de forma automática (segura e com hash bcrypt).
> - **Fluxo de Acesso do Proprietário**: A senha gerada **não** será exibida ao Gestor. O sistema gerará um token de recuperação de senha (`tokenRecuperacaoSenha`) e enviará um e-mail para o estabelecimento contendo um link para que o proprietário possa redefinir sua senha e ativar a conta.
> - **Robustez**: O disparo do e-mail de ativação será encapsulado em um bloco `try/catch` para garantir que, caso o serviço Redis local esteja inativo (o que impede o enfileiramento do BullMQ), a criação do estabelecimento ainda ocorra com sucesso e um aviso seja registrado no log do console.

## Proposed Changes

### Backend

#### [MODIFY] [estabelecimento.dto.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/estabelecimentos/dto/estabelecimento.dto.ts)
- Adicionar os campos opcionais `aprovado`, `ativo` e `adminView` ao `BuscaEstabelecimentosDto` com os respectivos decorators `@IsOptional()`, `@IsBoolean()` e `@Type(() => Boolean)`.

#### [MODIFY] [estabelecimentos.module.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/estabelecimentos/estabelecimentos.module.ts)
- Importar `NotificationsModule` de `../notifications/notifications.module` para permitir o envio do e-mail de redefinição de senha ao proprietário.

#### [MODIFY] [estabelecimentos.controller.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/estabelecimentos/estabelecimentos.controller.ts)
- Modificar o endpoint `POST /estabelecimentos` para chamar o serviço sem injetar o ID do atual usuário conectado como proprietário.

#### [MODIFY] [estabelecimentos.service.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/estabelecimentos/estabelecimentos.service.ts)
- Importar `bcrypt`, `randomUUID` (de `crypto`), `BadRequestException` e `NotificationsService`.
- Atualizar o construtor para receber `NotificationsService`.
- Modificar o método `create(dto)` para:
  - Lançar `BadRequestException` se `dto.emailContato` não for informado.
  - Verificar se já existe um `Usuario` com o e-mail cadastrado.
  - Se não existir:
    - Gerar uma senha aleatória segura temporária.
    - Criar o hash da senha usando `bcrypt.hash(...)`.
    - Gerar um token de recuperação (`resetToken = randomUUID()`) e a data de expiração (ex: 48 horas).
    - Criar o `Usuario` com perfil `ESTABELECIMENTO`, nome do estabelecimento, telefone, `tokenRecuperacaoSenha` e `expiracaoRecuperacaoSenha`.
    - Enviar o e-mail usando `notificationsService.sendForgotPassword` encapsulado em um bloco `try/catch`.
  - Se já existir:
    - Utilizar o ID desse usuário existente.
  - Salvar o estabelecimento vinculando-o ao ID do usuário.
  - Retornar o estabelecimento criado.
- Modificar o método `findAll` para:
  - Verificar se `adminView` está ativo.
  - Se `adminView` for `true`, respeitar filtros específicos de `aprovado` e `ativo` (se fornecidos), sem forçar o padrão `{ aprovado: true, ativo: true }`.
  - Se `adminView` não for enviado, manter o padrão de segurança `{ aprovado: true, ativo: true }` para consumo público de hóspedes.

---

### Frontend (Admin Pages)

Substituiremos os stubs das 5 páginas de administração por interfaces ricas, modernas e funcionais, utilizando MUI v9, Recharts para relatórios dinâmicos, e react-hot-toast para feedback visual.

---

#### [MODIFY] [AdminDashboard.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/admin/AdminDashboard.tsx)
- **KPIs**: Cards de resumo com design premium contendo Total de Usuários, Estabelecimentos Aprovados, Total de Reservas e Receita Acumulada.
- **Ações Rápidas**: Atalhos rápidos para cadastrar cidade, cadastrar evento e cadastrar estabelecimento.
- **Atividade Recente**: Tabela com os eventos mais próximos cadastrados no sistema.

#### [MODIFY] [AdminCities.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/admin/AdminCities.tsx)
- **Tabela de Cidades**: Lista todas as cidades com contagem de estabelecimentos associados.
- **Formulário de Cadastro/Edição**: Dialog para cadastrar e editar cidades com nome, estado (padrão RN), latitude, longitude e descrição.

#### [MODIFY] [AdminEstablishments.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/admin/AdminEstablishments.tsx)
- **Cadastro pelo Gestor**: Botão "Novo Estabelecimento" que abre um formulário completo.
  - O Gestor preenche dados de nome, descrição, endereço, CEP, contato, geolocalização e seleciona a Cidade associada.
  - A senha **não** é mostrada em tela.
  - Ao salvar, exibe uma mensagem de sucesso: `"Estabelecimento cadastrado com sucesso! Um e-mail de boas-vindas com instruções para criação de senha foi enviado para [emailContato]."`
- **Filtros por Abas**: Abas para segmentar estabelecimentos em "Todos", "Aprovados", "Pendentes de Aprovação" e "Inativos".
- **Ações**: Aprovar cadastro, alternar status ativo/inativo e excluir estabelecimento.

#### [MODIFY] [AdminEvents.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/admin/AdminEvents.tsx)
- **Listagem e CRUD Completo**: Dialog para adicionar e editar eventos contendo Nome, Descrição, Link Oficial, Data Início, Data Fim e seleção múltipla de Cidades Vinculadas.

#### [MODIFY] [AdminReports.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/admin/AdminReports.tsx)
- **Gráficos com Recharts**:
  - Reservas e Faturamento por Cidade.
  - Taxa de Cancelamento e Valor Perdido Mensal.
  - Distribuição das Reservas por Status.
- **Exportação de Dados**: Botão funcional para exportar os dados gerenciais para formato **CSV** e impressão estilizada.

---

## Verification Plan

### Automated Tests
- Executar build do backend: `npm run build` no diretório `/backend`.
- Executar build do frontend: `npm run build` no diretório `/frontend`.

### Manual Verification
1. Logar com o usuário Gestor (`gestor@hospedarn.com.br` / `GestorPassword123!`).
2. Cadastrar um Estabelecimento informando o e-mail de contato.
3. Verificar na tabela `Usuario` do banco de dados (ou através de logs) que o usuário do proprietário foi criado com perfil `ESTABELECIMENTO` e que possui o token de recuperação de senha atribuído.
4. Testar o CRUD completo de Cidades no menu "Cidades".
5. Cadastrar novos eventos vinculados a cidades cadastradas no menu "Eventos".
6. Testar aprovação e bloqueio de estabelecimentos no menu "Estabelecimentos".
7. Gerar e baixar relatórios gerenciais no formato CSV a partir da página "Relatórios".
