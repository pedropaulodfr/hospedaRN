# HospedaRN — Plano de Implementação Completo

## Visão Geral

**HospedaRN** é uma plataforma web responsiva para busca e reserva de hospedagens em cidades turísticas do Rio Grande do Norte. O sistema atende três perfis: **Hóspede**, **Estabelecimento** (proprietário/gerente) e **Gestor** (administrador).

O desenvolvimento seguirá uma arquitetura Monolítica Modular com padrão MVC + Services, priorizando escalabilidade, organização e manutenção.

---

## User Review Required

> [!IMPORTANT]
> **Banco de Dados Neon**: Será criado um novo projeto Neon chamado `hospedarn`. Todas as tabelas e migrations serão executadas via MCP do Neon. Confirme se deseja usar a organização `Pedro` (org-flat-silence-34013796) já encontrada.

> [!IMPORTANT]
> **Filas**: O plano prevê Redis + BullMQ via Docker Compose local. Para produção, será preparada a integração com Upstash Redis. Confirme preferência para ambiente local.

> [!IMPORTANT]
> **AWS S3**: O serviço de upload será implementado mas requer credenciais AWS (ACCESS_KEY, SECRET_KEY, BUCKET_NAME, REGION). Estas devem ser fornecidas via variáveis de ambiente — o código será entregue completo e funcional, mas as credenciais são de responsabilidade do usuário.

> [!WARNING]
> **WhatsApp**: A camada de abstração para WhatsApp será criada com suporte a WhatsApp Cloud API e Evolution API, mas não estará ativa por padrão. Necessita configuração de credenciais para ativação.

> [!CAUTION]
> **Fase de implementação**: Dado o escopo extenso, o desenvolvimento será entregue em **fases sequenciais** (descritas abaixo). Cada fase gera código funcional e testável. A ordem pode ser ajustada conforme feedback.

---

## Open Questions

1. **Domínio/Deploy**: Há preferência de plataforma de deploy para produção? (Railway, Render, AWS, Vercel+Railway, etc.)
2. **Email**: Qual provedor SMTP deseja usar? (Gmail SMTP, SendGrid, Resend, Amazon SES)
3. **Pagamentos**: A simulação de pagamento é suficiente para a entrega inicial, ou deve-se integrar com algum gateway real? (Mercado Pago, PagSeguro, Stripe)
4. **Logo/Identidade Visual**: Há paleta de cores ou logo definidos para o HospedaRN? Caso não, será gerada uma identidade visual exclusiva.
5. **Autenticação Social**: Login com Google/Facebook é desejado além do e-mail/senha?

---

## Fases de Implementação

### FASE 1 — Infraestrutura e Banco de Dados

**Objetivo**: Criar toda a base estrutural do projeto.

**Entregas**:
- Estrutura de pastas do monorepo (`/backend`, `/frontend`, `/docs`)
- Projeto Neon criado via MCP
- Todas as tabelas criadas com PostGIS habilitado
- Schema Prisma completo e sincronizado
- Docker Compose para ambiente local (PostgreSQL local fallback, Redis, pgAdmin)
- Variáveis de ambiente configuradas (`.env.example`)

---

### FASE 2 — Backend Core: Auth + Usuários + Guards

**Objetivo**: Implementar o núcleo de autenticação e controle de acesso.

**Entregas**:
- `AuthModule`: Cadastro, Login, Logout, Refresh Token, Recuperação de Senha
- `UsersModule`: CRUD de usuários com roles
- JWT + Refresh Token com rotação
- Guards por perfil (GUEST, ESTABLISHMENT, ADMIN)
- `ValidationPipe` global, `Helmet`, `CORS`, Rate Limit
- Swagger configurado
- Exception Filters e Interceptors

---

### FASE 3 — Backend: Módulos de Negócio

**Objetivo**: Implementar todos os módulos de domínio.

**Entregas**:
- `CitiesModule`: CRUD com PostGIS
- `EstablishmentsModule`: CRUD, aprovação, busca geográfica
- `AmenitiesModule` + `AccommodationTypesModule`
- `RoomsModule`: Gestão de quartos e preços por temporada
- `ReservationsModule`: Fluxo completo de reserva
- `PaymentsModule`: Simulação de pagamento, comprovantes
- `EventsModule`: Eventos por cidade
- `ReviewsModule`: Avaliações com validação de reserva finalizada
- `FavoritesModule`
- `AuditModule`: AuditLog em todas as operações
- `MapsModule`: Endpoints PostGIS para busca por proximidade
- `ReportsModule`: Relatórios com exportação PDF/CSV

---

### FASE 4 — Backend: Infraestrutura Transversal

**Objetivo**: Implementar serviços de suporte e processamento assíncrono.

**Entregas**:
- `UploadsModule`: AWS S3 completo (upload, remoção, URLs assinadas, otimização)
- `NotificationsModule`: BullMQ + Redis
  - Workers: e-mail (Nodemailer), WhatsApp (abstração)
  - Filas para todos os eventos de negócio
- Todos os eventos assíncronos:
  - Reserva criada/aprovada/cancelada
  - Pagamento confirmado
  - Aprovação de estabelecimento
  - Recuperação de senha

---

### FASE 5 — Frontend: Estrutura e Autenticação

**Objetivo**: Criar a base do frontend com identidade visual e autenticação.

**Entregas**:
- Projeto React + Vite + TypeScript configurado
- Material UI com tema personalizado HospedaRN
- Zustand stores: auth, UI
- React Query configurado com interceptors Axios
- Roteamento: React Router com rotas protegidas por role
- Páginas públicas: Home, Busca, Detalhes de Hospedagem, Eventos
- Formulários de Login, Cadastro, Recuperação de Senha

---

### FASE 6 — Frontend: Área do Hóspede

**Objetivo**: Implementar toda a jornada do hóspede.

**Entregas**:
- Dashboard do Hóspede
- Pesquisa com filtros e ordenação
- Detecção automática de cidade (Geolocation API)
- Cards e listagem de hospedagens
- Visualização com fotos e avaliações
- Mapa Leaflet com hospedagens
- Calendário de disponibilidade
- Fluxo de reserva completo
- Simulação de pagamento
- Gerenciamento de reservas e favoritos

---

### FASE 7 — Frontend: Área do Estabelecimento

**Objetivo**: Implementar painel completo do estabelecimento.

**Entregas**:
- Dashboard com métricas
- Gestão de reservas (aprovar, cancelar, confirmar pagamento)
- Gestão de quartos (CRUD)
- Gestão de preços e temporadas
- Upload de fotos (S3)
- Bloqueio de datas
- Relatórios com gráficos Recharts
- Exportação PDF/CSV

---

### FASE 8 — Frontend: Área do Gestor

**Objetivo**: Implementar painel administrativo completo.

**Entregas**:
- Dashboard global com Recharts
- CRUD de cidades com mapa Leaflet
- CRUD de eventos
- Gestão e aprovação de estabelecimentos
- Relatórios globais (ocupação, reservas, cancelamentos)
- Exportação PDF/CSV

---

### FASE 9 — Testes, Documentação e Deploy

**Objetivo**: Garantir qualidade, documentação e prontidão para produção.

**Entregas**:
- Testes unitários e integração (Jest — backend)
- Testes frontend (Vitest)
- Swagger completo e publicado
- README detalhado (backend + frontend)
- Diagrama ERD
- Fluxos de negócio documentados
- Docker multi-stage para produção
- `docker-compose.prod.yml`
- Guia de deploy

---

## Proposed Changes

### Estrutura do Monorepo

```
HospedaRN/
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── cities/
│   │   │   ├── establishments/
│   │   │   ├── amenities/
│   │   │   ├── accommodation-types/
│   │   │   ├── rooms/
│   │   │   ├── reservations/
│   │   │   ├── payments/
│   │   │   ├── events/
│   │   │   ├── reviews/
│   │   │   ├── favorites/
│   │   │   ├── notifications/
│   │   │   ├── uploads/
│   │   │   ├── reports/
│   │   │   ├── audit/
│   │   │   └── maps/
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   ├── filters/
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   ├── pipes/
│   │   │   └── utils/
│   │   ├── config/
│   │   ├── database/
│   │   │   └── prisma/
│   │   └── main.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── test/
│   └── package.json
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── public/
│   │   │   ├── guest/
│   │   │   ├── establishment/
│   │   │   └── admin/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── services/
│   │   ├── utils/
│   │   └── types/
│   └── package.json
├── docs/
├── Implementations/
├── Backups/
├── docker-compose.yml
└── README.md
```

---

### Modelagem do Banco de Dados (Neon + PostGIS)

| Tabela | Campos Principais |
|--------|------------------|
| `User` | id, nome, email, telefone, senhaHash, role (GUEST/ESTABLISHMENT/ADMIN), ativo |
| `City` | id, nome, estado, latitude, longitude, location (GEOMETRY), ativo |
| `Establishment` | id, nome, descrição, contato, endereço, lat/lng, location (GEOMETRY), aprovado, ativo, cityId, ownerId |
| `Amenity` | id, nome, ícone |
| `EstablishmentAmenity` | establishmentId, amenityId (N:N) |
| `AccommodationType` | id, nome, descrição |
| `Room` | id, establishmentId, accommodationTypeId, nome, capacidade, quantidade, descrição |
| `Season` | id, nome, dataInicio, dataFim, percentualAjuste |
| `RoomPrice` | roomId, seasonId, valor |
| `Photo` | id, url, s3Key, entidade, entidadeId |
| `Reservation` | id, codigoReserva, hospedeId, estabelecimentoId, roomId, checkIn, checkOut, adultos, criancas, valorTotal, status |
| `Payment` | id, reservationId, transactionCode, metodo, comprovanteUrl, status |
| `Event` | id, nome, descrição, linkOficial, dataInicio, dataFim |
| `EventCity` | eventId, cityId (N:N) |
| `Review` | id, reservaId, nota, comentário, createdAt |
| `Favorite` | usuarioId, estabelecimentoId |
| `AuditLog` | id, usuarioId, acao, entidade, entidadeId, dados (JSONB), createdAt |
| `DateBlock` | id, roomId, data, motivo |

---

### Backend — Módulos

#### [NEW] `AuthModule`
- endpoints: POST /auth/register, /auth/login, /auth/refresh, /auth/logout, /auth/forgot-password, /auth/reset-password
- JWT Access Token (15min) + Refresh Token (7d) com rotação
- Bcrypt para hash de senhas

#### [NEW] `UsersModule`
- GET/PATCH /users/me — perfil próprio
- CRUD admin para gestão de usuários

#### [NEW] `CitiesModule`
- CRUD + busca por proximidade PostGIS

#### [NEW] `EstablishmentsModule`
- CRUD + aprovação + filtros geográficos PostGIS

#### [NEW] `RoomsModule`
- CRUD quartos + preços por temporada + disponibilidade

#### [NEW] `ReservationsModule`
- POST /reservations — criar reserva
- PATCH /reservations/:id/confirm — confirmar (estabelecimento)
- PATCH /reservations/:id/cancel — cancelar
- PATCH /reservations/:id/finalize — finalizar

#### [NEW] `PaymentsModule`
- Simulação de pagamento PIX/Cartão/Boleto
- Upload de comprovante

#### [NEW] `NotificationsModule`
- BullMQ queues + workers para email e WhatsApp

#### [NEW] `UploadsModule`
- AWS S3: presigned URLs, upload direto, otimização com Sharp

#### [NEW] `ReportsModule`
- Relatórios agregados + exportação jsPDF + csv-writer

#### [NEW] `AuditModule`
- Interceptor global que registra todas as mutations no AuditLog

#### [NEW] `MapsModule`
- GET /maps/nearby — hospedagens por raio (PostGIS ST_DWithin)
- GET /maps/cities — cidades com coordenadas

---

### Frontend — Tecnologias e Componentes

#### Tema Material UI
- Paleta: Azul turquesa `#0097A7` + Laranja `#FF7043` + Verde água `#00BCD4`
- Tipografia: Inter (corpo) + Outfit (headings)
- Modo escuro preparado

#### Lojas Zustand
- `useAuthStore` — usuário autenticado, tokens, role
- `useUIStore` — drawer, tema, notificações
- `useSearchStore` — filtros e resultados de busca

#### Serviços Axios
- `api.ts` — instância com interceptors JWT + refresh automático

---

## Verification Plan

### Automated Tests
```bash
# Backend
cd backend && npm run test          # unitários
cd backend && npm run test:e2e      # integração

# Frontend
cd frontend && npm run test         # Vitest
```

### Manual Verification
1. Executar `docker-compose up` e verificar todos os serviços
2. Testar fluxo completo via Swagger (`/api/docs`)
3. Validar mapa Leaflet com hospedagens georreferenciadas
4. Confirmar exportação PDF/CSV nos painéis
5. Verificar filas BullMQ via Bull Board

---

## Cronograma Estimado

| Fase | Descrição | Estimativa |
|------|-----------|------------|
| 1 | Infraestrutura + Banco | ~1-2h |
| 2 | Auth + Usuários + Guards | ~1-2h |
| 3 | Módulos de Negócio | ~3-4h |
| 4 | Infraestrutura Transversal | ~2h |
| 5 | Frontend Base + Auth | ~2h |
| 6 | Frontend Hóspede | ~2h |
| 7 | Frontend Estabelecimento | ~2h |
| 8 | Frontend Gestor | ~1h |
| 9 | Testes + Docs + Deploy | ~2h |
| **Total** | | **~18-21h** |

> [!NOTE]
> O desenvolvimento é sequencial e iterativo. Cada fase produz código funcional. O usuário pode solicitar ajustes em qualquer ponto antes de avançar.
