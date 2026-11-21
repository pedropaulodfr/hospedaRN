# API — Check-out do Estabelecimento

Contrato da funcionalidade de check-out do HospedaRN. Fonte de verdade da implementação:
[`ImplementationPlan_CheckoutEstabelecimento_20112026.md`](../../Implementations/ImplementationPlan_CheckoutEstabelecimento_20112026.md).
Decisão de modelagem: [`ADR-002`](../adr/ADR-002-checkout-encerramento-hospedagem.md). Fluxo de telas:
[`flows/checkout.md`](../flows/checkout.md).

> **Estado:** **entregue em 20/11/2026**. Backend em
> `backend/src/modules/reservas/checkouts/{checkouts.controller.ts,checkouts.service.ts,dto/checkout.dto.ts}`,
> registro em `reservas.module.ts`, DDL **aplicada no Neon** (`prisma db execute`, exit 0, 2× para provar
> idempotência), `npx eslint` exit 0, `npm run build` (backend **e** frontend) exit 0, **8 suites / 228
> testes PASS** e integração **read-only** real provada (`GET /checkouts` com `TODOS=1`/`EM_ANDAMENTO=1`,
> `valorTotal` como `number`, `detail` de UUID inexistente → `404`). Review do revisor: **aprovado com
> ressalvas, zero bloqueantes**. O `POST` **não** foi exercitado contra o banco real (grava) — ver P-10 no
> plano.

- **Base:** `http://localhost:3000/api` (prefixo global `api`, `backend/src/main.ts:55`)
- **Auth:** `Authorization: Bearer <access_token>` em **todas** as rotas
- **Perfis:** `ESTABELECIMENTO` e `ADMIN` (`@Roles` + checagem de posse no servidor; `@Permissions` **não**
  é usado de propósito — o guard é ineficaz, R-02)
- **Implementação:** `backend/src/modules/reservas/checkouts/**` (tag Swagger **Check-out**)
- **Situação do check-out:** derivada, nunca persistida (`HOSPEDADO` | `SAIDA_HOJE` | `ATRASADO` | `REALIZADO`)
- **Inelegibilidade em dois campos:** `motivoInelegibilidade` = **texto pt-BR** para exibir;
  `codigoInelegibilidade` = código estável (`RESERVA_CANCELADA`, `CHECKIN_NAO_REALIZADO`, `CHECKOUT_JA_REALIZADO`)
- **`StatusReserva` não muda:** check-out **não** é status de reserva. `FINALIZADA` é **efeito** do
  encerramento — e também nasce de pagamento aprovado, antes da estadia (`pagamentos.service.ts:628-654`)

## Envelopes

Sucesso (interceptor global — `backend/src/common/interceptors/transform.interceptor.ts:25-30`):

```json
{ "success": true, "data": { }, "timestamp": "2026-11-20T19:40:12.000Z" }
```

Erro (filtro global — `backend/src/common/filters/http-exception.filter.ts:31-38`) — **formato
diferente** do sucesso:

```json
{
  "statusCode": 409,
  "timestamp": "2026-11-20T19:41:07.114Z",
  "path": "/api/checkouts",
  "method": "POST",
  "message": "Check-out já realizado para esta reserva"
}
```

> `message` pode ser um **array de strings** quando a origem é o `ValidationPipe`
> (`whitelist` + `forbidNonWhitelisted`, `backend/src/main.ts:58-67`) — o cliente deve tratar
> `string | string[]`.

## Escopo do estabelecimento (todas as rotas)

Resolvido **no servidor** a partir do usuário autenticado (`sub` do JWT,
`backend/src/modules/auth/auth.service.ts:212-213`; `checkouts.service.ts:451-518`):

| Caso | Escopo |
|---|---|
| `ADMIN` | todos os estabelecimentos; `estabelecimentoId` na query **estreita** |
| `ESTABELECIMENTO` dono (`Estabelecimento.proprietarioId = usuario.sub`) | todos os estabelecimentos do dono |
| `ESTABELECIMENTO` sub-usuário (`Usuario.estabelecimentoVinculadoId`) | o estabelecimento vinculado |
| `ESTABELECIMENTO` sem vínculo | `200` com lista vazia e `resumo` zerado (estado legítimo, não erro) |

`estabelecimentoId` **nunca amplia** escopo. Para `ESTABELECIMENTO`, um id fora do próprio escopo →
`403 Sem permissão para acessar os check-outs deste estabelecimento` (`checkouts.service.ts:498-503`).

---

## `GET /api/checkouts`

Central operacional de saídas, com paginação e resumo para os cards de cabeçalho.

**Autorização:** `ESTABELECIMENTO`, `ADMIN`.

### Query

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `estabelecimentoId` | UUID | — | Estreita o escopo (validado contra o escopo do usuário) |
| `situacao` | `TODOS` \| `EM_ANDAMENTO` \| `SAIDAS_HOJE` \| `ATRASADOS` \| `REALIZADOS` | `TODOS` | Ver "Recorte operacional" |
| `data` | `YYYY-MM-DD` | — | **Saída prevista** nesse dia **ou** check-out **realizado** no dia operacional |
| `de` | `YYYY-MM-DD` | — | Início do intervalo de saída prevista — **ignorado se `data` vier** |
| `ate` | `YYYY-MM-DD` | — | Fim do intervalo de saída prevista, inclusivo — **ignorado se `data` vier** |
| `busca` | string ≤ 100 | — | Código da reserva, nome do hóspede ou nome do quarto (case-insensitive) |
| `page` | inteiro ≥ 1 | `1` | Página |
| `limit` | inteiro 1..100 | `20` | Tamanho da página |

Datas fora do formato `YYYY-MM-DD` ou `limit > 100` → `400` (DTO; mensagens `Data deve estar no formato
YYYY-MM-DD`, `Data inválida`, `limit` fora da faixa).

**Precedência de contrato:** `data` **tem precedência**; quando `data` vem, `de` e `ate` são
**ignorados** (`checkouts.service.ts:567-583`). É o mesmo comportamento do check-in
(`checkins.service.ts`, cadeia `if (query.data) … else if (query.de || query.ate)`) — **decisão de
contrato, não bug** (B-QA-3/D-16). Enviar os três juntos devolve o recorte de `data`.

### Situações (derivadas, não persistidas)

| Situação | Condição (`checkouts.service.ts:702-713`) |
|---|---|
| `REALIZADO` | existe `CheckOut` para a reserva |
| `ATRASADO` | sem `CheckOut` e `Reserva.checkOut` (previsto) < hoje |
| `SAIDA_HOJE` | sem `CheckOut` e `Reserva.checkOut` previsto = hoje |
| `HOSPEDADO` | sem `CheckOut` e `Reserva.checkOut` previsto > hoje |

"Hoje" é a data corrente em **America/Fortaleza (UTC-3, sem horário de verão)**, convertida para
meia-noite UTC. Para comparação com `realizadoEm` (`Timestamptz`) a janela real do dia vai de `03:00Z` a
`03:00Z` do dia seguinte (`:599-629`).

### Recorte operacional (importante)

A central lista **hospedagem iniciada** — não é agenda de chegadas nem histórico de no-shows:

| `situacao` | Filtro aplicado (`:531-565`) |
|---|---|
| `TODOS` (default) | `OR[{ tem CheckIn }, { tem CheckOut }]` |
| `EM_ANDAMENTO` | **toda hospedagem iniciada e não encerrada** (tem `CheckIn` + sem `CheckOut` + `status ≠ CANCELADA`) — **inclui** `SAIDAS_HOJE` e `ATRASADOS`; não filtra por data |
| `SAIDAS_HOJE` | idem + `checkOut` previsto = hoje |
| `ATRASADOS` | idem + `checkOut` previsto < hoje |
| `REALIZADOS` | tem `CheckOut` (sem filtro de status/data) |

**`EM_ANDAMENTO` = toda hospedagem iniciada e não encerrada** (com `CheckIn`, sem `CheckOut`, `status ≠
CANCELADA`) — **não** aplica `checkOut > hoje`. `SAIDAS_HOJE` e `ATRASADOS` são **recortes dela** por
data. **As abas se sobrepõem por desenho** e o `resumo` reflete essa **hierarquia**
(`emAndamento ⊇ saidasHoje + atrasados`): a aba default da central precisa mostrar **todo mundo que está
hospedado agora**, inclusive quem sai hoje e quem está atrasado — o operador não pode "esconder" o
hóspede que tem de tirar hoje; a urgência é sinalizada pelo chip (`SAIDA_HOJE`/`ATRASADO`). É o mesmo
desenho do check-in, onde `chegadasHoje ⊂ pendentes` (`backend/src/modules/reservas/checkins/checkins.service.ts:189-201`).
Isso é **contrato de produto, não bug** (D-8).

Ordenação (`:177-181`): `REALIZADOS` por `checkout.realizadoEm desc`; as demais por
`checkOut asc, criadoEm asc` (quem sai primeiro aparece primeiro).

Consequências explícitas:

- Reserva **sem check-in** não aparece na central (não há o que encerrar); ela é tratada na central de
  check-in. O detalhe (`GET /checkouts/:reservaId`) continua acessível por URL direta e explica
  `CHECKIN_NAO_REALIZADO`.
- No-show antigo (período vencido, sem check-in e sem check-out) **não** polui `ATRASADOS`.
- Como o banco tem **0 `CheckIn`**, a central nasce **vazia** até a operação registrar o check-in das
  estadias em curso (R-42).

### Exemplo

```bash
curl -s "http://localhost:3000/api/checkouts?situacao=SAIDAS_HOJE&page=1&limit=20" \
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
          "checkIn": "2026-11-18",
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
        "checkin": {
          "id": "d41d8cd9-8f00-4204-a980-0998ecf8429c",
          "realizadoEm": "2026-11-18T17:12:00.000Z",
          "observacoes": "Chegou às 17h12.",
          "responsavel": { "id": "aa10f2b3-4c5d-4e6f-8091-a2b3c4d5e6fe", "nome": "Maria Souza" }
        },
        "checkout": null,
        "situacaoCheckout": "SAIDA_HOJE",
        "elegivel": true,
        "motivoInelegibilidade": null,
        "codigoInelegibilidade": null,
        "diasAposSaidaPrevista": 0,
        "saidaAntecipada": false
      }
    ],
    "total": 4,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "resumo": { "emAndamento": 11, "saidasHoje": 4, "atrasados": 1, "realizadosHoje": 2 }
  },
  "timestamp": "2026-11-20T19:40:12.000Z"
}
```

Quando a reserva já tem check-out, `checkout` vem preenchido e o item é inelegível:

```json
{
  "checkout": {
    "id": "7c9e51a4-2b3d-4f68-9012-3a4b5c6d7e8f",
    "realizadoEm": "2026-11-22T11:05:00.000Z",
    "observacoes": "Saída antecipada a pedido do hóspede.",
    "responsavel": { "id": "aa10f2b3-4c5d-4e6f-8091-a2b3c4d5e6fe", "nome": "Maria Souza" }
  },
  "situacaoCheckout": "REALIZADO",
  "elegivel": false,
  "motivoInelegibilidade": "Check-out já realizado para esta hospedagem",
  "codigoInelegibilidade": "CHECKOUT_JA_REALIZADO",
  "diasAposSaidaPrevista": -2,
  "saidaAntecipada": true
}
```

Notas dos campos derivados:

- `diasAposSaidaPrevista` = `diaReferencia − Reserva.checkOut` em dias (`checkouts.service.ts:882`).
  **Negativo** = saída prevista no futuro, `0` = hoje, **positivo** = atraso em dias.
- `diaReferencia` = **dia operacional do check-out** quando existe `CheckOut`; **hoje** quando não existe
  (`resolverDiaReferencia`, `:637-644`; D-13). Consequência prática: o número de uma estadia **já
  encerrada não muda** com o passar dos dias, e bate com o valor gravado na auditoria (**B-QA-2**).
- `saidaAntecipada` = `true` **somente** quando existe `CheckOut` e o dia dele é anterior ao previsto
  (`:887-894`); sem check-out é sempre `false` (D-15). Antecipação *planejada* é assunto do aviso
  `SAIDA_ANTECIPADA` no detalhe, não deste booleano.
- `valorTotal` e `pagamento.valor` saem como **número** (Decimal convertido na borda, `:940,987`).
- `checkin`/`checkout` = resumo `{id, realizadoEm, observacoes, responsavel}`; a **lista de hóspedes do
  check-in** só aparece no detalhe.

### `resumo` (cards do cabeçalho)

Contagens do escopo, **independentes** de `situacao`, `busca`, `data`/`de`/`ate` e da paginação
(`:183-257`). Base: `status ≠ CANCELADA`.

| Campo | Significado real |
|---|---|
| `emAndamento` | com `CheckIn` e **sem** `CheckOut` — **qualquer data** (inclui quem sai hoje e quem está atrasado) |
| `saidasHoje` | com `CheckIn`, sem `CheckOut` e saída prevista **hoje** |
| `atrasados` | com `CheckIn`, sem `CheckOut` e saída prevista **no passado** |
| `realizadosHoje` | check-outs **realizados hoje** (dia operacional), não o histórico todo |

Relação entre os cards (**hierarquia, não partição**): `emAndamento` **é superconjunto** de
`saidasHoje` + `atrasados` — os dois são recortes por data do mesmo universo. É o mesmo padrão do
check-in (`chegadasHoje` também é subconjunto de `pendentes`,
`checkins.service.ts:189-201`). `realizadosHoje` é **evento do dia**, não estado — não há invariante de
soma fechada.

### Inelegibilidade: texto × código

| Código | `motivoInelegibilidade` | Quando | Ação sugerida na UI |
|---|---|---|---|
| `null` | `null` | elegível | habilitar "Fazer check-out" |
| `RESERVA_CANCELADA` | Reserva cancelada — não é possível realizar check-out | `status = CANCELADA` | somente leitura |
| `CHECKIN_NAO_REALIZADO` | A hospedagem ainda não realizou check-in — registre o check-in antes do check-out | sem `CheckIn` | oferecer o atalho para o check-in |
| `CHECKOUT_JA_REALIZADO` | Check-out já realizado para esta hospedagem | já existe `CheckOut` | mostrar "realizado em …" |

Precedência: `RESERVA_CANCELADA` → `CHECKIN_NAO_REALIZADO` → `CHECKOUT_JA_REALIZADO`
(`checkouts.service.ts:722-750`).

> **Não existe `STATUS_INVALIDO` neste contrato.** Uma reserva `SOLICITADA` não tem check-in, portanto cai
> em `CHECKIN_NAO_REALIZADO`.

### Erros

| HTTP | Quando | `message` |
|---|---|---|
| `400` | query inválida (data, `limit`, `situacao`) | array do `ValidationPipe` |
| `401` | sem token / token inválido | `Token de acesso não fornecido` / `Token inválido ou expirado` |
| `403` | perfil sem permissão | `Acesso restrito. Perfil necessário: ESTABELECIMENTO ou ADMIN` |
| `403` | `estabelecimentoId` fora do escopo do usuário | `Sem permissão para acessar os check-outs deste estabelecimento` |
| `200` | `ESTABELECIMENTO` sem nenhum vínculo | *(não é erro: `data: []`, `total: 0`, `resumo` zerado)* |

---

## `GET /api/checkouts/:reservaId`

Conferência da hospedagem: dados da reserva, perfil do hóspede, check-in (com a lista de hóspedes),
check-out (se já feito), elegibilidade, avisos, **resumo financeiro somente leitura** e dados da
acomodação (inclusive a próxima entrada no mesmo quarto). Acessível **mesmo quando inelegível** — é assim
que a UI explica o bloqueio.

**Autorização:** `ESTABELECIMENTO` (dono ou sub-usuário vinculado), `ADMIN`.

### Parâmetros

| Param | Tipo | Descrição |
|---|---|---|
| `reservaId` | UUID (path) | `400` se não for UUID; `404` se não existir; `403` se for de outro estabelecimento |

### Exemplo

```bash
curl -s "http://localhost:3000/api/checkouts/1f0b9d2e-8a55-4a0e-9c3b-5c6f0e2d1a77" \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "success": true,
  "data": {
    "reserva": {
      "id": "1f0b9d2e-8a55-4a0e-9c3b-5c6f0e2d1a77",
      "codigoReserva": "HRN7K2M9Q1",
      "checkIn": "2026-11-18",
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
    "checkin": {
      "id": "d41d8cd9-8f00-4204-a980-0998ecf8429c",
      "realizadoEm": "2026-11-18T17:12:00.000Z",
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
    "checkout": null,
    "elegivel": true,
    "motivoInelegibilidade": null,
    "codigoInelegibilidade": null,
    "avisos": [
      {
        "codigo": "PAGAMENTO_PENDENTE",
        "mensagem": "Pagamento ainda não confirmado. O check-out pode ser realizado e o pagamento regularizado depois."
      },
      {
        "codigo": "SALDO_EM_ABERTO",
        "mensagem": "Há R$ 780,00 em aberto. O check-out pode ser concluído; a regularização é feita no financeiro."
      }
    ],
    "financeiro": {
      "valorTotal": 780,
      "valorPago": 0,
      "saldoEmAberto": 780,
      "pagamento": {
        "id": "97ab11cd-2233-4455-8899-aabbccddeeff",
        "reservaId": "1f0b9d2e-8a55-4a0e-9c3b-5c6f0e2d1a77",
        "metodo": "PIX",
        "status": "PENDENTE",
        "valor": 780,
        "codigoTransacao": null,
        "comprovanteUrl": null,
        "comprovanteS3Key": null,
        "dadosPagamento": null
      }
    },
    "acomodacao": {
      "id": "c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e71",
      "nome": "Suíte Mar",
      "capacidade": 3,
      "tipoAcomodacao": { "id": "77e0a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b", "nome": "Suíte" },
      "proximaEntrada": {
        "reservaId": "9c8b7a65-4d3c-4b2a-9e1f-0a9b8c7d6e5f",
        "codigoReserva": "HRN4T8Z1PX",
        "checkIn": "2026-11-23",
        "hospedeNome": "Carla Menezes"
      }
    }
  },
  "timestamp": "2026-11-20T19:42:31.000Z"
}
```

Com check-out já realizado (`checkout != null`):

```json
{
  "checkout": {
    "id": "7c9e51a4-2b3d-4f68-9012-3a4b5c6d7e8f",
    "realizadoEm": "2026-11-22T11:05:00.000Z",
    "observacoes": "Saída antecipada a pedido do hóspede.",
    "responsavel": { "id": "aa10f2b3-4c5d-4e6f-8091-a2b3c4d5e6fe", "nome": "Maria Souza" }
  },
  "elegivel": false,
  "motivoInelegibilidade": "Check-out já realizado para esta hospedagem",
  "codigoInelegibilidade": "CHECKOUT_JA_REALIZADO"
}
```

Sem check-in (`checkin = null`) — **sem avisos de saída**:

```json
{
  "checkin": null,
  "elegivel": false,
  "motivoInelegibilidade": "A hospedagem ainda não realizou check-in — registre o check-in antes do check-out",
  "codigoInelegibilidade": "CHECKIN_NAO_REALIZADO",
  "avisos": []
}
```

Com check-in, mas sem pagamento pendente e sem saldo (reserva paga e dentro do período): `avisos` volta
`[]`.

### Avisos (`avisos[]`)

Todos são **informativos**: nenhum bloqueia o `POST`. Ordem **fixa e real** (`checkouts.service.ts:776-825`).

| # | Código | Gatilho | Mensagem (pt-BR) |
|---|---|---|---|
| 1 | `PAGAMENTO_PENDENTE` | sem `Pagamento` ou `Pagamento.status ≠ CONFIRMADO` | Pagamento ainda não confirmado. O check-out pode ser realizado e o pagamento regularizado depois. |
| 2 | `SALDO_EM_ABERTO` | `financeiro.saldoEmAberto > 0` | Há R$ 000,00 em aberto. O check-out pode ser concluído; a regularização é feita no financeiro. |
| 3 | `SAIDA_ANTECIPADA` | **há estadia iniciada** (`CheckIn` **ou** `CheckOut`) **e** dia de referência < saída prevista | Saída antecipada: a saída prevista é dd/mm/aaaa. |
| 4 | `SAIDA_APOS_PREVISTO` | **há estadia iniciada** **e** dia de referência > saída prevista | Saída após a data prevista (dd/mm/aaaa). |

**Gate de estadia iniciada (regra do B-QA-1):** sem `CheckIn` **não existe** `SAIDA_ANTECIPADA` nem
`SAIDA_APOS_PREVISTO` — a reserva é inelegível por `CHECKIN_NAO_REALIZADO` e a recepção não está
encerrando nada. `PAGAMENTO_PENDENTE` e `SALDO_EM_ABERTO` são **incondicionais**
(`temEstadiaIniciada = Boolean(checkin || checkout)`, `:804-822`).

"Dia de referência" = dia operacional do check-out quando existe; **hoje** quando não existe
(`:637-644`). Prova em dados reais: reserva `HRND3T7ZNX` (`SOLICITADA`, 22→23/11, sem check-in) devolve
exatamente `[PAGAMENTO_PENDENTE, SALDO_EM_ABERTO]`.

### Financeiro (somente leitura, derivado)

**Nenhuma** cobrança, baixa ou estorno acontece por causa deste endpoint — ele apenas informa
(`calcularFinanceiro`, `:756-774`).

| Campo | Derivação |
|---|---|
| `valorTotal` | `Reserva.valorTotal` como número |
| `valorPago` | valor do `Pagamento` quando `Pagamento.status = CONFIRMADO`; senão `0` |
| `saldoEmAberto` | `max(0, valorTotal - valorPago)`, arredondado a centavos |
| `pagamento` | **registro completo** do `Pagamento` com `valor` em `number`, ou `null` — é **superset** de `{metodo, status, valor}`; a UI lê só os três campos |

> Não existe pagamento parcial no modelo (1:1 com a reserva e um único `valor`), então `saldoEmAberto` é
> `0` ou o `valorTotal` — nunca um valor intermediário.

### Acomodação e próxima entrada

| Campo | Definição |
|---|---|
| `acomodacao.id` / `nome` / `capacidade` | dados do `Quarto` |
| `acomodacao.tipoAcomodacao` | `{id, nome}` ou `null` |
| `acomodacao.proximaEntrada` | próxima reserva **do mesmo quarto** com `checkIn > Reserva.checkOut` desta e `status ≠ CANCELADA` (a mais próxima por `checkIn`): `{reservaId, codigoReserva, checkIn, hospedeNome}` ou `null` (`checkouts.service.ts:831-861`) |

O quarto **não tem** campo de situação/limpeza no modelo (`schema.prisma:193-215`): `proximaEntrada` é
informação de agenda, não um estado do quarto.

### Erros

| HTTP | Quando | `message` |
|---|---|---|
| `400` | `reservaId` não é UUID | array do `ValidationPipe` |
| `401` | sem token | `Token de acesso não fornecido` |
| `403` | perfil sem permissão | `Acesso restrito. Perfil necessário: ESTABELECIMENTO ou ADMIN` |
| `403` | reserva de outro estabelecimento | `Sem permissão para acessar esta hospedagem` |
| `404` | reserva inexistente | `Reserva não encontrada` |

---

## `POST /api/checkouts`

Registra o encerramento da hospedagem em **uma transação**: `CheckOut` + `Reserva.status = FINALIZADA`
(só se ainda não for) + `LogAuditoria`. **Não** cobra, **não** estorna e **não** altera `Pagamento`.

**Autorização:** `ESTABELECIMENTO` (dono ou sub-usuário vinculado), `ADMIN`.

### Body

```json
{
  "reservaId": "1f0b9d2e-8a55-4a0e-9c3b-5c6f0e2d1a77",
  "realizadoEm": "2026-11-22T11:05:00.000Z",
  "observacoes": "Saída às 11h05, sem pendências na conferência."
}
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `reservaId` | **sim** | UUID |
| `realizadoEm` | não | ISO datetime; default = agora; `400` se futuro além de **5 min** (`TOLERANCIA_FUTURO_MS`) ou anterior ao `realizadoEm` do check-in |
| `observacoes` | não | string ≤ **1000** |

Campo fora do DTO → `400` (`forbidNonWhitelisted`). Não envie `status`, `valorTotal` nem ids: são do servidor.

```bash
curl -s -X POST "http://localhost:3000/api/checkouts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "reservaId": "1f0b9d2e-8a55-4a0e-9c3b-5c6f0e2d1a77", "observacoes": "Saída às 11h05." }'
```

### Regras aplicadas

1. **Elegibilidade:** a reserva **não** pode estar `CANCELADA`, **deve** ter `CheckIn` e **não** pode ter
   `CheckOut`. Data e pagamento **não** bloqueiam.
2. **Sem bloqueio por data:** check-out antecipado e após a data prevista são permitidos — apenas
   sinalizados (`SAIDA_ANTECIPADA` / `SAIDA_APOS_PREVISTO`).
3. **Pagamento pendente não bloqueia** — apenas avisa no `GET`.
4. **`realizadoEm`:** default agora; futuro além de 5 min → `400`; anterior ao check-in → `400`.
5. **Duplicidade proibida:** `CheckOut.reservaId` é `@unique`; corrida de duplo `POST` vira `409`.
6. **Encerramento:** `Reserva.status = FINALIZADA` **somente se o status atual não for `FINALIZADA`**
   (`checkouts.service.ts:390-397`) — semântica "concluída", sem tocar em outros campos.
7. **Nenhuma escrita financeira:** `Pagamento` fica intacto; o financeiro do check-out é somente leitura.
8. **Auditoria:** `LogAuditoria` com `acao = 'CHECKOUT_REALIZADO'`, `entidade = 'Reserva'`,
   `entidadeId = reservaId`, `usuarioId` = usuário autenticado, `enderecoIp` = IP da requisição, e
   `dadosNovos` = `{checkoutId, realizadoEm, observacoes, statusAnterior, statusNovo, saidaAntecipada,
   diasAposSaidaPrevista}` — na **mesma transação** (`:400-417`).
9. **Disponibilidade intacta:** o check-out **não** libera as noites restantes (a checagem segue
   bloqueando `FINALIZADA`, `quartos.service.ts:80-82`) — ver R-40.

### Resposta `201`

`{ reserva, checkin, checkout }` — `reserva` no shape **detalhe** (com `hospede.hospedePerfil`,
`quarto.tipoAcomodacao`, `estabelecimento`), já com `status = FINALIZADA`; `checkin` com a lista de
hóspedes (`checkouts.service.ts:435-444`).

```json
{
  "success": true,
  "data": {
    "reserva": { "...shape do detalhe, agora com status FINALIZADA..." },
    "checkin": { "id": "d41d...9c", "realizadoEm": "2026-11-18T17:12:00.000Z", "observacoes": null, "responsavel": { "id": "aa10...4b", "nome": "Maria Souza" }, "hospedes": [ { "principal": true, "nome": "João Silva" } ] },
    "checkout": {
      "id": "7c9e51a4-2b3d-4f68-9012-3a4b5c6d7e8f",
      "realizadoEm": "2026-11-22T11:05:00.000Z",
      "observacoes": "Saída às 11h05.",
      "responsavel": { "id": "aa10f2b3-4c5d-4e6f-8091-a2b3c4d5e6fe", "nome": "Maria Souza" }
    }
  },
  "timestamp": "2026-11-22T11:05:00.402Z"
}
```

### Erros (ordem de precedência determinística)

| # | HTTP | Quando | `message` (real) |
|---|---|---|---|
| 1 | `400` | DTO inválido (campo desconhecido, `realizadoEm` malformado, `observacoes` > 1000) | array do `ValidationPipe` (inclui `Data e hora do check-out inválida`, `reservaId deve ser um UUID válido`) |
| 2 | `404` | reserva inexistente | `Reserva não encontrada` |
| 3 | `403` | reserva de outro estabelecimento | `Sem permissão para realizar check-out nesta reserva` |
| 4 | `400` | status `CANCELADA` (checagem prévia **e** releitura dentro da transação) | `Reserva cancelada — não é possível realizar check-out` |
| 5 | `400` | sem `CheckIn` | `A hospedagem ainda não realizou check-in — registre o check-in antes do check-out` |
| 6 | `409` | já existe `CheckOut` (checagem prévia, rechecagem na transação **ou** `P2002`) | `Check-out já realizado para esta reserva` |
| 7 | `400` | `realizadoEm` futuro além da tolerância de 5 min | `A data e hora do check-out não pode estar no futuro` |
| 8 | `400` | `realizadoEm` anterior ao check-in | `A data e hora do check-out não pode ser anterior ao check-in` |

> A duplicidade é checada **depois** de cancelamento e ausência de check-in — diferente do `POST /checkins`,
> onde o `409` vence o `400`. Vale o que está nesta tabela (D-3/D-16 do plano).

---

## Referência rápida: modelo de dados

| Tabela | Campos (contrato) |
|---|---|
| `CheckOut` | `id`, `reservaId` (**unique**), `realizadoEm`, `responsavelId` (nullable no banco, preenchido pelo `POST`), `observacoes`, `criadoEm`, `atualizadoEm` |

Definição no schema: `backend/prisma/schema.prisma:404-418` (relações inversas `:79` em `Usuario` e `:289`
em `Reserva`). DDL: `backend/prisma/sql/20261120_checkout.sql` — **aplicada no Neon** via
`npx prisma db execute` (exit 0, executada 2× para provar idempotência); verificado: tabela, 2 índices
(`CheckOut_reserva_id_key` UNIQUE, `CheckOut_realizado_em_idx`), 2 FKs, 7 colunas e
`prisma.checkOut.count() = 0`.

## O que este contrato **não** faz (de propósito)

- **Cobrança/estorno/baixa financeira**: o resumo financeiro é derivado e somente leitura.
- **Liberar o quarto antes da data prevista**: disponibilidade continua bloqueando `FINALIZADA` (R-06/R-40).
- **Criar status de quarto/limpeza/manutenção**: não existe o eixo no modelo e esta feature não o cria.
- **Descontinuar `PATCH /reservas/:id/finalize`**: a rota continua existindo como caminho paralelo de
  encerramento, sem dono checado (**R-08**, aberto). O check-out **não** a utiliza.
- **Listar reservas sem check-in**: elas ficam na central de check-in; aqui só o detalhe as explica
  (`CHECKIN_NAO_REALIZADO`).
- **Emitir aviso de saída para reserva sem estadia iniciada**: B-QA-1 corrigido — esse caso devolve
  apenas os avisos financeiros.

Riscos residuais conhecidos: **R-40** (check-out antecipado não libera noites), **R-41** (`FINALIZADA` com
três origens), **R-42** (central nasce vazia sem check-ins), **R-43** (corrida entre
cancelamento/check-in e check-out), R-38 (403 × 404), R-19 (e2e quebrado).
