# API — Check-in do Estabelecimento

Contrato navegável da funcionalidade de check-in do HospedaRN. Fonte de verdade da implementação:
[`ImplementationPlan_CheckinEstabelecimento_20112026.md`](../../Implementations/ImplementationPlan_CheckinEstabelecimento_20112026.md).
Decisão de modelagem: [`ADR-001`](../adr/ADR-001-checkin-entidade-aditiva.md). Fluxo de telas:
[`flows/checkin.md`](../flows/checkin.md).

- **Base:** `http://localhost:3000/api` (prefixo global `api`, `backend/src/main.ts:19,55`)
- **Auth:** `Authorization: Bearer <access_token>` em **todas** as rotas
- **Perfis:** `ESTABELECIMENTO` e `ADMIN` (`@Roles` + checagem de posse no servidor)
- **Implementação:** `backend/src/modules/reservas/checkins/{checkins.controller.ts,checkins.service.ts,dto/checkin.dto.ts}` (tag Swagger **Check-in**)
- **Situação da hospedagem:** derivada, nunca persistida (`PENDENTE` | `ATRASADO` | `REALIZADO`)
- **Inelegibilidade em dois campos:** `motivoInelegibilidade` = **texto pt-BR** para exibir; `codigoInelegibilidade` = código estável para máquina (`RESERVA_CANCELADA`, `STATUS_INVALIDO`, `CHECKIN_JA_REALIZADO`, `PERIODO_ENCERRADO`)
- **`StatusReserva` não muda:** check-in **não** é status de reserva

## Envelopes

Sucesso (interceptor global — `backend/src/common/interceptors/transform.interceptor.ts:25-30`):

```json
{ "success": true, "data": { }, "timestamp": "2026-11-20T18:05:41.000Z" }
```

Erro (filtro global — `backend/src/common/filters/http-exception.filter.ts:30-50`) — **formato
diferente** do sucesso:

```json
{
  "statusCode": 409,
  "timestamp": "2026-11-20T18:10:03.114Z",
  "path": "/api/checkins",
  "method": "POST",
  "message": "Check-in já realizado para esta reserva"
}
```

> `message` pode ser um **array de strings** quando a origem é o `ValidationPipe`
> (`whitelist` + `forbidNonWhitelisted`, `backend/src/main.ts:58-67`) — o filtro repassa o array do
> Nest sem alterar. O cliente deve tratar `string | string[]`.

## Escopo do estabelecimento (todas as rotas)

O escopo é resolvido **no servidor** a partir do usuário autenticado (`sub` do JWT,
`backend/src/modules/auth/auth.service.ts:212-213`):

| Caso | Escopo |
|---|---|
| `ADMIN` | todos os estabelecimentos; `estabelecimentoId` na query **estreita** |
| `ESTABELECIMENTO` dono (`Estabelecimento.proprietarioId = usuario.sub`) | todos os estabelecimentos do dono |
| `ESTABELECIMENTO` sub-usuário (`Usuario.estabelecimentoVinculadoId`) | o estabelecimento vinculado |
| `ESTABELECIMENTO` sem vínculo | `200` com lista vazia e `resumo` zerado (estado legítimo, não erro) |

`estabelecimentoId` **nunca amplia** escopo. Para `ESTABELECIMENTO`, enviar um id fora do próprio
escopo → `403 Sem permissão para acessar os check-ins deste estabelecimento` (`checkins.service.ts:468-475`).

---

## `GET /api/checkins`

Central operacional de chegadas, com paginação e resumo para os cards de cabeçalho.

**Autorização:** `ESTABELECIMENTO`, `ADMIN`.

### Query

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `estabelecimentoId` | UUID | — | Estreita o escopo (validado contra o escopo do usuário) |
| `situacao` | `TODOS` \| `PENDENTES` \| `REALIZADOS` \| `ATRASADOS` | `TODOS` | Ver "Situações" |
| `data` | `YYYY-MM-DD` | — | Chegada prevista **ou** check-in realizado nesse dia |
| `de` | `YYYY-MM-DD` | — | Início do intervalo de chegada prevista (ignorado se `data` vier) |
| `ate` | `YYYY-MM-DD` | — | Fim do intervalo de chegada prevista (ignorado se `data` vier) |
| `busca` | string ≤ 100 | — | Código da reserva, nome do hóspede ou nome do quarto (case-insensitive) |
| `page` | inteiro ≥ 1 | `1` | Página |
| `limit` | inteiro 1..100 | `20` | Tamanho da página |

Datas fora do formato `YYYY-MM-DD` ou `limit > 100` → `400` (DTO).

### Situações (derivadas, não persistidas)

| Situação | Condição |
|---|---|
| `REALIZADO` | existe check-in para a reserva |
| `PENDENTE` | sem check-in e `hoje ≤ Reserva.checkIn` |
| `ATRASADO` | sem check-in e `hoje > Reserva.checkIn` (pode estar inelegível se o período encerrou) |

"Hoje" é a data corrente em **America/Fortaleza (UTC-3, sem horário de verão)**, convertida para
meia-noite UTC. Ordenação: `REALIZADOS` por `checkin.realizadoEm desc`; as demais por
`checkIn asc, criadoEm asc`.

### Recorte operacional (importante)

A central é **operacional**, não um histórico completo (`checkins.service.ts:501-531`):

| `situacao` | Filtro aplicado |
|---|---|
| `TODOS` (default) | `OR[{status ∈ CONFIRMADA/AGUARDANDO_PAGAMENTO/FINALIZADA, checkOut ≥ hoje}, {tem check-in}]` |
| `PENDENTES` | sem check-in + `checkIn ≥ hoje` + status permitido |
| `ATRASADOS` | sem check-in + `checkIn < hoje` + **`checkOut ≥ hoje`** + status permitido |
| `REALIZADOS` | tem check-in (sem filtro de status/período) |

Consequência: **estadia encerrada sem check-in (no-show antigo) não aparece** em `TODOS` nem em
`ATRASADOS`; ela continua acessível por URL direta no detalhe (que explica `PERIODO_ENCERRADO`) e o
`POST` responde `400`.

### Exemplo

```bash
curl -s "http://localhost:3000/api/checkins?situacao=PENDENTES&data=2026-11-20&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "reserva": {
          "id": "1f0b9d2e-8a55-4a0e-9c3b-5c6f0e2d1a77",
          "codigoReserva": "HRN7K2M9Q1",
          "checkIn": "2026-11-20",
          "checkOut": "2026-11-22",
          "adultos": 2,
          "criancas": 1,
          "valorTotal": 780,
          "status": "CONFIRMADA",
          "modoPagamento": "PADRAO",
          "observacoes": null,
          "criadoEm": "2026-11-10T13:02:11.000Z",
          "hospede": {
            "id": "8a1c4d62-0f77-4c0e-a3d1-9b2e5f6a7c88",
            "nome": "João Silva",
            "email": "joao@exemplo.com",
            "telefone": "84999998888"
          },
          "quarto": { "id": "c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e71", "nome": "Suíte Mar", "capacidade": 3 },
          "pagamento": {
            "id": "97ab11cd-2233-4455-8899-aabbccddeeff",
            "reservaId": "1f0b9d2e-8a55-4a0e-9c3b-5c6f0e2d1a77",
            "metodo": "PIX",
            "status": "PENDENTE",
            "valor": 780,
            "codigoTransacao": null,
            "comprovanteUrl": null,
            "comprovanteS3Key": null,
            "dadosPagamento": null,
            "criadoEm": "2026-11-10T13:05:00.000Z",
            "atualizadoEm": "2026-11-10T13:05:00.000Z"
          }
        },
        "checkin": null,
        "situacaoCheckIn": "PENDENTE",
        "elegivel": true,
        "motivoInelegibilidade": null,
        "codigoInelegibilidade": null,
        "checkInAntecipado": false,
        "diasParaChegada": 0
      }
    ],
    "total": 12,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "resumo": { "chegadasHoje": 3, "pendentes": 7, "atrasados": 2, "realizados": 5 }
  },
  "timestamp": "2026-11-20T18:05:41.000Z"
}
```

Quando a reserva já tem check-in, `checkin` vem preenchido e o item é inelegível:

```json
{
  "checkin": {
    "id": "d41d8cd9-8f00-4204-a980-0998ecf8429c",
    "realizadoEm": "2026-11-20T17:12:00.000Z",
    "observacoes": "Chegou às 17h12.",
    "responsavel": { "id": "aa10f2b3-4c5d-4e6f-8091-a2b3c4d5e6fe", "nome": "Maria Souza" }
  },
  "situacaoCheckIn": "REALIZADO",
  "elegivel": false,
  "motivoInelegibilidade": "Check-in já realizado para esta reserva",
  "codigoInelegibilidade": "CHECKIN_JA_REALIZADO",
  "checkInAntecipado": false,
  "diasParaChegada": 0
}
```

Notas dos campos derivados (`checkins.service.ts:814-839`):

- `checkInAntecipado`: com check-in → dia de `realizadoEm` anterior ao `checkIn` previsto; **sem**
  check-in → `diasParaChegada > 0` (chegada futura, ou seja, o check-in será antecipado).
- `diasParaChegada`: diferença em dias entre `checkIn` e hoje (positivo = futuro, `0` = hoje, negativo = atraso).
- `valorTotal` e `pagamento.valor` saem como **número** (Decimal convertido na borda).

### `resumo` (cards do cabeçalho)

Contagens do escopo com `status ∈ CONFIRMADA/AGUARDANDO_PAGAMENTO/FINALIZADA`, **independentes** de
`situacao`, `busca`, `data`/`de`/`ate` e da paginação (`checkins.service.ts:166-215`):

| Campo | Significado real |
|---|---|
| `chegadasHoje` | chegadas **previstas** para hoje (`checkIn = hoje`) que ainda **não** fizeram check-in |
| `pendentes` | sem check-in e chegada hoje ou no futuro |
| `atrasados` | sem check-in, chegada no passado **e** `checkOut ≥ hoje` (estadia em curso) |
| `realizados` | check-ins **realizados hoje** (dia operacional), não o histórico todo |

Não há invariante de soma fechada: `realizados` é temporal (hoje) e pode incluir reserva fora de
`pendentes`/`atrasados`.

### Inelegibilidade: texto × código

`motivoInelegibilidade` (texto, exibido direto) e `codigoInelegibilidade` (estável):

| Código | `motivoInelegibilidade` | Quando | Ação sugerida na UI |
|---|---|---|---|
| `null` | `null` | elegível | habilitar "Fazer check-in" |
| `RESERVA_CANCELADA` | Reserva cancelada — não é possível realizar check-in | status `CANCELADA` | somente leitura |
| `STATUS_INVALIDO` | Reserva ainda não foi confirmada pelo estabelecimento | status fora dos permitidos (hoje: `SOLICITADA`) | orientar a confirmar a reserva |
| `CHECKIN_JA_REALIZADO` | Check-in já realizado para esta reserva | já existe `CheckIn` | mostrar "realizado em …" |
| `PERIODO_ENCERRADO` | O período da estadia desta reserva já foi encerrado | `hoje > checkOut` sem check-in | somente leitura |

Precedência: `RESERVA_CANCELADA` → `STATUS_INVALIDO` → `CHECKIN_JA_REALIZADO` → `PERIODO_ENCERRADO`.

### Erros

| HTTP | Quando | `message` |
|---|---|---|
| `400` | query inválida (data, `limit`, `situacao`) | array do `ValidationPipe` |
| `401` | sem token / token inválido | `Token de acesso não fornecido` / `Token inválido ou expirado` |
| `403` | perfil sem permissão | `Acesso restrito. Perfil necessário: ESTABELECIMENTO ou ADMIN` |
| `403` | `estabelecimentoId` fora do escopo do usuário | `Sem permissão para acessar os check-ins deste estabelecimento` |
| `200` | `ESTABELECIMENTO` sem nenhum vínculo | *(não é erro: `data: []`, `total: 0`, `resumo` zerado)* |

---

## `GET /api/checkins/:reservaId`

Detalhe / **pré-check-in**: dados da reserva, perfil do hóspede, check-in (se já feito), elegibilidade
e avisos. Acessível **mesmo quando inelegível** — é assim que a UI explica o bloqueio.

**Autorização:** `ESTABELECIMENTO` (dono ou sub-usuário vinculado), `ADMIN`.

### Parâmetros

| Param | Tipo | Descrição |
|---|---|---|
| `reservaId` | UUID (path) | `400` se não for UUID; `404` se não existir |

### Exemplo

```bash
curl -s "http://localhost:3000/api/checkins/1f0b9d2e-8a55-4a0e-9c3b-5c6f0e2d1a77" \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "success": true,
  "data": {
    "reserva": {
      "id": "1f0b9d2e-8a55-4a0e-9c3b-5c6f0e2d1a77",
      "codigoReserva": "HRN7K2M9Q1",
      "checkIn": "2026-11-20",
      "checkOut": "2026-11-22",
      "adultos": 2,
      "criancas": 1,
      "valorTotal": 780,
      "status": "AGUARDANDO_PAGAMENTO",
      "modoPagamento": "PADRAO",
      "observacoes": null,
      "criadoEm": "2026-11-10T13:02:11.000Z",
      "hospede": {
        "id": "8a1c4d62-0f77-4c0e-a3d1-9b2e5f6a7c88",
        "nome": "João Silva",
        "email": "joao@exemplo.com",
        "telefone": "84999998888",
        "hospedePerfil": {
          "cpf": "123.456.789-00",
          "rg": null,
          "dataNascimento": "1995-10-25",
          "nacionalidade": "Brasileira",
          "contatoEmergencia": null,
          "endereco": "Rua das Flores, 123, Natal - RN"
        }
      },
      "quarto": {
        "id": "c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e71",
        "nome": "Suíte Mar",
        "capacidade": 3,
        "tipoAcomodacao": { "id": "77e0a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b", "nome": "Suíte" }
      },
      "estabelecimento": { "id": "0b2f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "nome": "Pousada Ponta Negra" },
      "pagamento": { "id": "97ab11cd-2233-4455-8899-aabbccddeeff", "metodo": "PIX", "status": "PENDENTE", "valor": 780 }
    },
    "checkin": null,
    "elegivel": true,
    "motivoInelegibilidade": null,
    "codigoInelegibilidade": null,
    "avisos": [
      {
        "codigo": "PAGAMENTO_PENDENTE",
        "mensagem": "Pagamento ainda não confirmado. O check-in pode ser realizado e o pagamento regularizado depois."
      }
    ]
  },
  "timestamp": "2026-11-20T18:07:02.000Z"
}
```

Com check-in já realizado (`checkin != null`):

```json
{
  "checkin": {
    "id": "d41d8cd9-8f00-4204-a980-0998ecf8429c",
    "realizadoEm": "2026-11-20T17:12:00.000Z",
    "observacoes": "Chegou com 1 acompanhante a mais do que o previsto.",
    "responsavel": { "id": "aa10f2b3-4c5d-4e6f-8091-a2b3c4d5e6fe", "nome": "Maria Souza" },
    "hospedes": [
      {
        "id": "5e1a2b3c-4d5e-4f60-8192-a3b4c5d6e7f1",
        "principal": true,
        "nome": "João Silva",
        "cpf": "123.456.789-00",
        "documento": null,
        "dataNascimento": "1995-10-25",
        "telefone": "84999998888",
        "parentesco": null,
        "presente": true,
        "observacoes": null
      },
      {
        "id": "5e1a2b3c-4d5e-4f60-8192-a3b4c5d6e7f2",
        "principal": false,
        "nome": "Ana Silva",
        "cpf": "987.654.321-00",
        "documento": "2.345.678",
        "dataNascimento": "1992-03-08",
        "telefone": null,
        "parentesco": "Cônjuge",
        "presente": true,
        "observacoes": null
      }
    ]
  },
  "elegivel": false,
  "motivoInelegibilidade": "Check-in já realizado para esta reserva",
  "codigoInelegibilidade": "CHECKIN_JA_REALIZADO"
}
```

### Avisos (`avisos[]`)

Todos são **informativos**: nenhum deles bloqueia o `POST`. Ordem fixa (facilita teste/UI).

| Código | Gatilho (real) | Mensagem (pt-BR) |
|---|---|---|
| `PAGAMENTO_PENDENTE` | sem `Pagamento` ou `Pagamento.status ≠ CONFIRMADO` | Pagamento ainda não confirmado. O check-in pode ser realizado e o pagamento regularizado depois. |
| `CADASTRO_INCOMPLETO` | falta `Hospede.cpf`, `Hospede.dataNascimento` ou `Usuario.telefone` | Cadastro do hóspede incompleto: <campos>. O check-in pode ser realizado, mas os dados podem ser completados depois. |
| `CAPACIDADE_EXCEDIDA` | `Reserva.adultos + Reserva.criancas > Quarto.capacidade` | O quarto comporta N pessoa(s) e a reserva tem M. |
| `CHECKIN_ANTECIPADO` | `hoje < Reserva.checkIn` | Check-in antecipado: a chegada prevista é dd/mm/aaaa. |
| `CHECKIN_ATRASADO` | `Reserva.checkIn < hoje ≤ Reserva.checkOut` | Check-in atrasado: a chegada prevista foi dd/mm/aaaa. |

A capacidade é sempre comparada com **adultos + crianças da reserva** (não com os hóspedes do
check-in), mesmo depois do registro (`checkins.service.ts:689-695`).

### Erros

| HTTP | Quando | `message` |
|---|---|---|
| `400` | `reservaId` não é UUID | array do `ValidationPipe` |
| `401` | sem token | `Token de acesso não fornecido` |
| `403` | perfil sem permissão | `Acesso restrito. Perfil necessário: ESTABELECIMENTO ou ADMIN` |
| `403` | reserva de outro estabelecimento | `Sem permissão para acessar esta reserva` |
| `404` | reserva inexistente | `Reserva não encontrada` |

---

## `POST /api/checkins`

Registra o check-in de uma reserva em **uma transação**: `CheckIn` + `HospedeCheckIn` (principal e
acompanhantes) + atualização opcional do cadastro do hóspede + `LogAuditoria`.

**Autorização:** `ESTABELECIMENTO` (dono ou sub-usuário vinculado), `ADMIN`.

### Body

```json
{
  "reservaId": "1f0b9d2e-8a55-4a0e-9c3b-5c6f0e2d1a77",
  "observacoes": "Hóspede chegou às 17h12. Solicitou berço extra.",
  "hospedePrincipal": {
    "cpf": "123.456.789-00",
    "rg": "1.234.567",
    "documento": "1.234.567",
    "dataNascimento": "1995-10-25",
    "telefone": "84999998888",
    "nacionalidade": "Brasileira"
  },
  "acompanhantes": [
    {
      "nome": "Ana Silva",
      "cpf": "987.654.321-00",
      "documento": "2.345.678",
      "dataNascimento": "1992-03-08",
      "telefone": "84988887777",
      "parentesco": "Cônjuge",
      "presente": true,
      "observacoes": null
    }
  ]
}
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `reservaId` | sim | UUID |
| `observacoes` | não | string ≤ 1000 |
| `hospedePrincipal.cpf` | não | string ≤ 14 — atualiza `Hospede.cpf` |
| `hospedePrincipal.rg` | não | string ≤ 20 — atualiza `Hospede.rg` |
| `hospedePrincipal.documento` | não | string ≤ 40 — gravado **só** em `HospedeCheckIn.documento` |
| `hospedePrincipal.dataNascimento` | não | `YYYY-MM-DD` — atualiza `Hospede.dataNascimento` |
| `hospedePrincipal.telefone` | não | string ≤ 20 — atualiza `Usuario.telefone` |
| `hospedePrincipal.nacionalidade` | não | string ≤ 100 — atualiza `Hospede.nacionalidade` |
| `acompanhantes` | não | array, **máx. 20** itens |
| `acompanhantes[].nome` | **sim** | não vazio, ≤ 255 |
| `acompanhantes[].cpf` | não | string ≤ 14 |
| `acompanhantes[].documento` | não | string ≤ 40 |
| `acompanhantes[].dataNascimento` | não | `YYYY-MM-DD` |
| `acompanhantes[].telefone` | não | string ≤ 20 |
| `acompanhantes[].parentesco` | não | string ≤ 80 |
| `acompanhantes[].presente` | não | boolean, default `true` |
| `acompanhantes[].observacoes` | não | string ≤ 1000 |

Campo fora do DTO → `400` (`forbidNonWhitelisted`). Não envie `valorTotal`, `status` nem ids: são do servidor.

### Regras aplicadas

1. **Elegibilidade:** status `CONFIRMADA` | `AGUARDANDO_PAGAMENTO` | `FINALIZADA`, **e** `hoje ≤ checkOut`,
   **e** sem check-in prévio.
2. **Antecipado é permitido** (chegou antes do dia previsto) — só sinaliza.
3. **Atrasado é permitido** até o dia do `checkOut` — só sinaliza.
4. **Pagamento pendente não bloqueia** — só avisa no `GET`.
5. **Capacidade excedida não bloqueia** — o estabelecimento assume a exceção.
6. **Duplicidade proibida:** `CheckIn.reservaId` é `@unique`; corrida vira `409`.
7. **Hóspede principal é sempre `principal = true` e `presente = true`.**
8. Acompanhantes são gravados **todos os informados**, inclusive `presente = false` (registro fiel).
9. Cadastro do hóspede só é criado (`Hospede`) quando vierem `cpf` **e** `dataNascimento` (colunas
   NOT NULL); se já existir, é atualizado. `documento` do principal não vira `Hospede` (não existe coluna).
10. CPF que já pertence a outro `Hospede` **não** é propagado (não bloqueia o check-in).
11. Auditoria: `LogAuditoria` com `acao = 'CHECKIN_REALIZADO'`, `entidade = 'Reserva'`,
    `entidadeId = reservaId`, `usuarioId` = usuário autenticado, `enderecoIp` = IP da requisição, na **mesma transação**.
12. Fallbacks do hóspede principal (`checkins.service.ts:720-746`): `cpf` enviado → senão `Hospede.cpf`;
    `documento` enviado → senão `rg` enviado → senão `Hospede.rg`; `dataNascimento` enviado → senão
    `Hospede.dataNascimento`; `telefone` enviado → senão `Usuario.telefone`.
13. A checagem de "pelo menos um hóspede presente" existe no código mas é **inalcançável** hoje
    (o principal é sempre presente) — é defesa para evolução do DTO, não regra de negócio testável.

### Resposta `201`

```json
{
  "success": true,
  "data": {
    "reserva": { "...mesmo shape do `reserva` acima, incluindo `checkin`..." },
    "checkin": {
      "id": "d41d8cd9-8f00-4204-a980-0998ecf8429c",
      "realizadoEm": "2026-11-20T17:12:00.000Z",
      "observacoes": "Hóspede chegou às 17h12. Solicitou berço extra.",
      "responsavel": { "id": "aa10f2b3-4c5d-4e6f-8091-a2b3c4d5e6fe", "nome": "Maria Souza" },
      "hospedes": [ { "principal": true, "nome": "João Silva" }, { "principal": false, "nome": "Ana Silva" } ]
    }
  },
  "timestamp": "2026-11-20T17:12:00.402Z"
}
```

### Erros (ordem de precedência é determinística)

| # | HTTP | Quando | `message` (real) |
|---|---|---|---|
| 1 | `400` | DTO inválido (campo desconhecido, `acompanhantes[].nome` vazio, `dataNascimento` malformada, > 20 acompanhantes) | array do `ValidationPipe` (inclui `Acompanhante sem nome`) |
| 2 | `404` | reserva inexistente | `Reserva não encontrada` |
| 3 | `403` | reserva de outro estabelecimento | `Sem permissão para realizar check-in nesta reserva` |
| 4 | `409` | já existe check-in (checagem prévia **ou** `P2002`) | `Check-in já realizado para esta reserva` |
| 5 | `400` | status `SOLICITADA` | `Reserva ainda não confirmada pelo estabelecimento — confirme a reserva antes do check-in` |
| 6 | `400` | status `CANCELADA` | `Reserva cancelada — não é possível realizar check-in` |
| 7 | `400` | período encerrado (`hoje > checkOut`) | `O período da estadia desta reserva já foi encerrado` |
| 8 | `400` | nenhum hóspede presente | `Informe pelo menos um hóspede presente` — **inalcançável** hoje (defensivo) |

### Exemplo cURL

```bash
curl -s -X POST "http://localhost:3000/api/checkins" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reservaId": "1f0b9d2e-8a55-4a0e-9c3b-5c6f0e2d1a77",
    "hospedePrincipal": { "cpf": "123.456.789-00", "dataNascimento": "1995-10-25", "telefone": "84999998888" },
    "acompanhantes": [{ "nome": "Ana Silva", "parentesco": "Cônjuge" }]
  }'
```

---

## Referência rápida: modelo de dados

| Tabela | Campos (contrato) |
|---|---|
| `CheckIn` | `id`, `reservaId` (**unique**), `realizadoEm`, `responsavelId` (nullable no banco, **sempre** preenchido pelo POST), `observacoes`, `criadoEm`, `atualizadoEm` |
| `HospedeCheckIn` | `id`, `checkInId`, `principal`, `nome`, `cpf`, `documento`, `dataNascimento`, `telefone`, `parentesco`, `presente`, `observacoes`, `criadoEm` |

Definição no schema: `backend/prisma/schema.prisma:359-394` (relações `:285`, `:76`).

## Mudança de comportamento em rota existente

`PATCH /api/reservas/:id/cancel` passa a responder **`400 Reserva com check-in já realizado não pode
ser cancelada`** quando a reserva já tem check-in (`backend/src/modules/reservas/reservas.service.ts:211-221`).
Corrida residual entre cancelar e registrar check-in é o risco **R-36** (`docs/agents/RISCOS-VERIFICADOS.md`).

## Fora deste contrato (propostas, não implementadas)

`PATCH /checkins/:reservaId` (corrigir acompanhante/presença), `POST /checkouts`, `GET /checkins/resumo`
dedicado, notificação de check-in ao hóspede. Registradas como P-1, P-3, P-5, P-6 e P-7 no plano de
implementação; **não** consumir antes de existirem. Riscos residuais conhecidos: R-36 (corrida
cancelamento × check-in), R-37 (`Hospede.cpf` sem unique), R-38 (`403` × `404`), R-39 (card × aba de
realizados).
