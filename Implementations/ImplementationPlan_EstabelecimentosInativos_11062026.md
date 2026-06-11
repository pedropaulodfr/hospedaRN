# Plano de Implementação - Correção da Categoria Inativos de Estabelecimentos

Esta alteração corrige um problema na tela de "Estabelecimentos" do painel de administração, onde a categoria "Inativos" exibe estabelecimentos ativos e oculta os inativos. 

O problema ocorre devido à forma como o NestJS (utilizando a biblioteca `class-transformer`) realiza a conversão de parâmetros de URL (query parameters) do tipo booleano. Por padrão, a anotação `@Type(() => Boolean)` transforma qualquer string não vazia (como `"false"`) em `true`. Com isso, a requisição enviada pelo frontend (`GET /api/estabelecimentos?adminView=true&ativo=false`) é convertida no backend para `ativo: true`.

## Mudanças Propostas

### Backend

#### [MODIFY] [estabelecimento.dto.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/estabelecimentos/dto/estabelecimento.dto.ts)

- Importar o decorador `Transform` da biblioteca `class-transformer`.
- Substituir o decorador `@Type(() => Boolean)` por `@Transform(({ value }) => value === 'true' || value === true)` nos campos booleans de busca do DTO `BuscaEstabelecimentosDto`:
  - `aprovado`
  - `ativo`
  - `adminView`

## Plano de Verificação

### Testes Manuais
1. Enviar requisições diretas ao endpoint do backend utilizando um script ou terminal de teste:
   - `GET /api/estabelecimentos?adminView=true&ativo=false` -> Validar que retorna apenas estabelecimentos com `"ativo": false`.
   - `GET /api/estabelecimentos?adminView=true&ativo=true` -> Validar que retorna apenas estabelecimentos com `"ativo": true`.
2. Validar o comportamento na interface do usuário (frontend):
   - Acessar a tela "Estabelecimentos".
   - Clicar na aba "Inativos".
   - Confirmar que apenas os estabelecimentos inativos são listados.
