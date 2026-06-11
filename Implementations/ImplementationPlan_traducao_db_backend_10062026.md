# ImplementationPlan_traducao_db_backend_10062026.md

# Plano de Implementação — Tradução do Banco de Dados e Backend para Português

Este plano detalha a tradução de todas as tabelas, colunas, enums e relações do banco de dados (Prisma PostgreSQL) e de toda a lógica do backend (NestJS) para utilizar nomenclatura exclusivamente em Português do Brasil (PT-BR), garantindo uniformidade técnica.

## User Review Required

> [!WARNING]
> **Perda de Dados Local / Reset de Banco**: A alteração dos nomes de todas as tabelas e colunas exigirá recriar as tabelas no banco de dados. Em ambiente de desenvolvimento local, executaremos `npx prisma db push --force-reset` para aplicar o novo esquema limpo no Neon PostgreSQL. Isso apagará quaisquer registros de teste existentes.
>
> **Refatoração do Frontend**: A alteração do contrato de API do backend (já que as propriedades dos objetos JSON retornados passarão de inglês para português, ex: `cityId` -> `cidadeId`, `notaMedia` continuará igual, mas `rooms` -> `quartos`) exige que adaptemos os arquivos correspondentes no frontend para evitar que a aplicação quebre. Detalharemos esta etapa no plano para garantir que o sistema continue funcionando perfeitamente de ponta a ponta.

---

## Proposed Changes

### 1. Banco de Dados (`schema.prisma`)

#### [MODIFY] [schema.prisma](file:///d:/Documentos/projects/HospedaRN/backend/prisma/schema.prisma)
Traduzir todas as tabelas, enums e colunas. Abaixo estão as principais correspondências a serem implementadas:

* **Enums**:
  * `UserRole` -> `PerfilUsuario` (`GUEST` -> `HOSPEDE`, `ESTABLISHMENT` -> `ESTABELECIMENTO`, `ADMIN` -> `ADMIN`)
  * `ReservationStatus` -> `StatusReserva` (Já em PT-BR)
  * `PaymentMethod` -> `MetodoPagamento` (Já em PT-BR)
  * `PaymentStatus` -> `StatusPagamento` (Já em PT-BR)

* **Tabelas e Relações (Modelos)**:
  * `User` -> `Usuario` (Mapeado com `@@map("Usuario")`)
    * Traduzir colunas: `role` -> `perfil`, `refreshTokenHash` -> `tokenAtualizacaoHash`, `resetPasswordToken` -> `tokenRecuperacaoSenha`, `resetPasswordExpires` -> `expiracaoRecuperacaoSenha`, `createdAt` -> `criadoEm`, `updatedAt` -> `atualizadoEm`.
  * `City` -> `Cidade` (Mapeado com `@@map("Cidade")`)
    * Traduzir colunas: `location` -> `localizacao`, `imagemUrl` -> `imagemUrl`, `createdAt` -> `criadoEm`, `updatedAt` -> `atualizadoEm`.
  * `Establishment` -> `Estabelecimento` (Mapeado com `@@map("Estabelecimento")`)
    * Traduzir colunas: `cityId` -> `cidadeId`, `ownerId` -> `proprietarioId`, `location` -> `localizacao`, `createdAt` -> `criadoEm`, `updatedAt` -> `atualizadoEm`.
  * `Amenity` -> `Comodidade` (Mapeado com `@@map("Comodidade")`)
    * Traduzir colunas: `createdAt` -> `criadoEm`.
  * `EstablishmentAmenity` -> `EstabelecimentoComodidade` (Mapeado com `@@map("EstabelecimentoComodidade")`)
    * Traduzir colunas: `establishmentId` -> `estabelecimentoId`, `amenityId` -> `comodidadeId`.
  * `AccommodationType` -> `TipoAcomodacao` (Mapeado com `@@map("TipoAcomodacao")`)
    * Traduzir colunas: `createdAt` -> `criadoEm`.
  * `Room` -> `Quarto` (Mapeado com `@@map("Quarto")`)
    * Traduzir colunas: `establishmentId` -> `estabelecimentoId`, `accommodationTypeId` -> `tipoAcomodacaoId`, `createdAt` -> `criadoEm`, `updatedAt` -> `atualizadoEm`.
  * `Season` -> `Temporada` (Mapeado com `@@map("Temporada")`)
    * Traduzir colunas: `createdAt` -> `criadoEm`, `updatedAt` -> `atualizadoEm`.
  * `RoomPrice` -> `PrecoQuarto` (Mapeado com `@@map("PrecoQuarto")`)
    * Traduzir colunas: `roomId` -> `quartoId`, `seasonId` -> `temporadaId`.
  * `Photo` -> `Foto` (Mapeado com `@@map("Foto")`)
    * Traduzir colunas: `createdAt` -> `criadoEm`.
  * `Reservation` -> `Reserva` (Mapeado com `@@map("Reserva")`)
    * Traduzir colunas: `hospedeId` -> `hospedeId`, `establishmentId` -> `estabelecimentoId`, `roomId` -> `quartoId`, `valorTotal` -> `valorTotal`, `createdAt` -> `criadoEm`, `updatedAt` -> `atualizadoEm`.
  * `Payment` -> `Pagamento` (Mapeado com `@@map("Pagamento")`)
    * Traduzir colunas: `reservationId` -> `reservaId`, `transactionCode` -> `codigoTransacao`, `createdAt` -> `criadoEm`, `updatedAt` -> `atualizadoEm`.
  * `Event` -> `Evento` (Mapeado com `@@map("Evento")`)
    * Traduzir colunas: `createdAt` -> `criadoEm`, `updatedAt` -> `atualizadoEm`.
  * `EventCity` -> `EventoCidade` (Mapeado com `@@map("EventoCidade")`)
    * Traduzir colunas: `eventId` -> `eventoId`, `cityId` -> `cidadeId`.
  * `Review` -> `Avaliacao` (Mapeado com `@@map("Avaliacao")`)
    * Traduzir colunas: `reservationId` -> `reservaId`, `createdAt` -> `criadoEm`, `updatedAt` -> `atualizadoEm`.
  * `Favorite` -> `Favorito` (Mapeado com `@@map("Favorito")`)
    * Traduzir colunas: `usuarioId` -> `usuarioId`, `establishmentId` -> `estabelecimentoId`, `createdAt` -> `criadoEm`.
  * `AuditLog` -> `LogAuditoria` (Mapeado com `@@map("LogAuditoria")`)
    * Traduzir colunas: `usuarioId` -> `usuarioId`, `entidadeId` -> `entidadeId`, `ipAddress` -> `enderecoIp`, `userAgent` -> `agenteUsuario`, `createdAt` -> `criadoEm`.
  * `DateBlock` -> `BloqueioData` (Mapeado com `@@map("BloqueioData")`)
    * Traduzir colunas: `roomId` -> `quartoId`, `createdAt` -> `criadoEm`.

---

### 2. Backend (NestJS Modules)

Refatorar todos os arquivos TypeScript do backend que interagem com o Prisma para utilizar os modelos e propriedades traduzidos.

#### [MODIFY] [Todos os Módulos do Backend](file:///d:/Documentos/projects/HospedaRN/backend/src/)
- **DTOs**: Atualizar os campos em DTOs de criação, atualização e busca (ex: `cityId` -> `cidadeId`, `ownerId` -> `proprietarioId`).
- **Services & Controllers**: Atualizar todas as consultas do Prisma (`this.prisma.establishment` -> `this.prisma.estabelecimento`, `select` e `where` com novos nomes de campos).
- **Guards e Interceptors**: Atualizar referências a propriedades como `user.role` -> `user.perfil` ou `UserRole` -> `PerfilUsuario`.
- **Estratégias de Autenticação (Passport JWT/Local)**: Ajustar a validação e mapeamento dos payloads.

---

### 3. Frontend (Contratos e Consumo de API)

#### [MODIFY] [Tipos e Requisições no Frontend](file:///d:/Documentos/projects/HospedaRN/frontend/src/)
- **[api.ts](file:///d:/Documentos/projects/HospedaRN/frontend/src/services/api.ts)**: Atualizar propriedades de payloads de envio e propriedades das respostas mapeadas.
- **[SearchPage.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/public/SearchPage.tsx)**: Alterar acessos a propriedades (ex: `est.city` -> `est.cidade`, `est.rooms` -> `est.quartos`, `est.photos` -> `est.fotos`).
- **[HomePage.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/public/HomePage.tsx)**: Alterar propriedades dos cards (ex: `city` -> `cidade`, `establishments` -> `estabelecimentos`).
- **Outras páginas (Dashboard, Reservas, Admin)**: Mapear propriedades de resposta que mudaram devido à tradução.

---

## Verification Plan

### Passo 1: Validação do Banco de Dados
- Executar `npx prisma db push --force-reset` para limpar e aplicar o novo esquema traduzido no banco.
- Executar `npx prisma generate` para recriar o Prisma Client com os novos tipos traduzidos em PT-BR.

### Passo 2: Validação de Compilação
- Certificar-se de que o backend NestJS compila sem erros com `npm run build`.
- Certificar-se de que o frontend Vite compila sem erros com `npm run build`.

### Passo 3: Verificação Manual
- Acessar o sistema, verificar se a autenticação continua funcionando (agora sob o enum `PerfilUsuario` e campos em português).
- Realizar a busca de cidades e estabelecimentos na página de busca e certificar-se de que o fluxo continua funcional e sem erros de propriedades indefinidas.
