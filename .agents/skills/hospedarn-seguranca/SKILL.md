---
name: hospedarn-seguranca
description: "Segurança e autorização do HospedaRN: corrigir IDOR e escalada de privilégio, desenhar a camada de policy/tenant, JWT/refresh, segredos e env, hardening HTTP (CORS, throttle, uploads, S3, Swagger), webhooks e higiene do repositório. Carregue para revisar ou corrigir acesso indevido, vazamento de dados, segredo exposto, rota pública demais ou upload inseguro."
---

# HospedaRN — segurança

## 1. Escopo

Objetivo: fechar as portas de acesso indevido e de vazamento sem quebrar os fluxos legítimos dos três
perfis.

```
backend/src/common/**                       (guards, decorators, filters, interceptors)
backend/src/modules/auth/**                 (login, refresh, reset, claims)
backend/src/modules/uploads/**              (política de arquivo/S3 — dono único)
backend/.env.example, .gitignore            (higiene)
políticas de autorização entregues aos demais módulos
```

`uploads/**` é **seu**, não do backend: upload de comprovante, presign e validação de arquivo são
política de segurança.

**Não é seu:** `main.ts`/`app.module.ts` (→ `hospedarn-backend`, você entrega a especificação de
Swagger/throttle), controllers de outros módulos (você entrega o patch e o dono aplica), regra de
negócio de reserva/pagamento.

## 2. Modelo de acesso real (verificado)

- JWT payload: `{ sub, email, perfil }` (`auth.service.ts:213`). Access 15 min, refresh 7 dias em
  bcrypt hash; refresh usa header `x-usuario-id` controlado pelo cliente (`auth.controller.ts:48-57`).
- Guards globais: `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` (declarados em `auth.module.ts:29-40`).
- **`PermissionsGuard` é no-op** (R-02): lê `usuario.permissoes`/`criadoPorId`, que não existem no
  token, e cai em `return true` (`permissions.guard.ts:41-44`).
- Escopo por estabelecimento não é camada: é `proprietarioId === userId` copiado em 5 services.
  `estabelecimentoVinculadoId`, `subPerfil` e `permissoes` são gravados e **nunca aplicados** — um
  sub-usuário de estabelecimento não opera nada (os checks comparam com o dono) e nada o restringe.

## 3. Fila prioritária (detalhe em `docs/agents/RISCOS-VERIFICADOS.md`)

Críticos: R-01 (cadastro como `ADMIN`), R-02 (permissions no-op), R-03 (webhook fail-open — dono é
pagamentos, mas a política de segredo é sua), R-04 (dump de reservas), R-05 (confirmar pagamento alheio).
Altos: R-07/R-08/R-09 (IDOR em reservas/pagamentos), R-11 (presign de qualquer chave), R-12 (upload
sem limites/tipo), R-24 (refresh com identidade do cliente), R-27 (e-mail do proprietário em rota
pública).
Médios: R-25 (Swagger público), R-26 (sem throttle por rota), R-31 (probes com CPF/e-mail no repo).

## 4. Desenho alvo (proponha, não implemente tudo de uma vez)

1. **Claims úteis**: incluir `estabelecimentoVinculadoId`, `criadoPorId` e `permissoes` no access
   token (ou resolver por request) e fazer o `PermissionsGuard` consultar o banco quando necessário.
2. **Camada de policy única**, ex.:

```ts
// proposta — não existe ainda
@Injectable()
export class OwnershipService {
  assertPodeVerReserva(user: AuthUser, reservaId: string): Promise<void>
  assertPodeConfirmarPagamento(user: AuthUser, pagamentoId: string): Promise<void>
  estabelecimentoDoUsuario(user: AuthUser): Promise<string | null>
}
```

3. **Regra de tenant**: ESTABELECIMENTO nunca recebe `estabelecimentoId` do cliente como fonte de
   verdade — o servidor resolve pelo token. ADMIN pode filtrar; HOSPEDE só vê o que é dele.
4. **Segredos**: validar env no boot (schema de config), falhar rápido se `JWT_*`,
   `MERCADO_PAGO_*`, `AWS_*`, `RESEND_*` estiverem ausentes em `NODE_ENV=production`; nunca logar valor;
   nunca commitar `.env`; rotação recomendada de chaves AWS/Resend/MP já expostas em disco.
5. **Uploads**: `limits: {fileSize, files}`, `fileFilter` por MIME real (magic bytes/`sharp`),
   extensão derivada do MIME (não do nome), pasta validada por allowlist, presign **escopado** por
   prefixo do usuário e `expires` curto.
6. **Hardening**: throttle específico em `auth/login`, `auth/refresh`, `auth/forgot-password` e no
   webhook; Swagger desligado em produção; CORS por ambiente (não lista fixa com localhost em prod).

## 5. Como corrigir com segurança

1. Escreva o teste que **falha hoje** (matriz: anônimo, HOSPEDE-A, HOSPEDE-B, ESTAB-A, ESTAB-B, ADMIN)
   antes do patch — em coordenação com `hospedarn-qa`.
2. Patch mínimo: a barreira no ponto mais próximo do dado (service), não só no controller.
3. Confirme que a correção não quebra o fluxo legítimo (hóspede dono, dono do estabelecimento, ADMIN).
4. Nunca "resolva" IDOR mudando o formato da resposta para esconder campos: o acesso é que precisa ser negado.
5. Registre o motivo no handoff e atualize o item no registro de riscos.

## 6. Critérios de qualidade

- Toda rota autenticada tem decisão explícita de autorização (dono/tenant/perfil) e teste.
- Segredo nunca aparece em código, log, resposta de erro, teste ou commit.
- Falha de configuração de segurança = erro no boot, não aviso silencioso.
- Erro 403 sem vazar existência de recurso alheio (use 404 quando apropriado).

## 7. Limitações

- Não altera regra de negócio (status de reserva, política de pagamento) — chama o dono.
- Não faz varredura de infraestrutura externa, não testa contra produção, não usa credencial de terceiros.
- Não instala dependência de segurança sem pedir ao usuário.
- Não rotaciona chaves sozinho (não tem acesso ao painel) — entrega a instrução exata.

## 8. Interação e entregáveis

Entregáveis: relatório por severidade (`arquivo:linha`), patch, teste de autorização, checklist de
configuração/env para o usuário, atualização do registro de riscos. Interage com todos os donos de
módulo (a barreira é deles em produção, sua na política) e com `hospedarn-dados` para índices/constraints
de isolamento quando necessário.

## 9. Ferramentas

`read`, `grep`, `glob`, `edit`, `write` (só no escopo do §1), `pwsh` para `npm run build` e para
`git check-ignore`/`git ls-files` na higiene do repositório. Nunca imprime valor de `.env`, nunca roda
`prisma`, deploy, `git push` nem teste contra produção.
