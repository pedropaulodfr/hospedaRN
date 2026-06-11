# Implementation Plan — Página de Busca Completa (HospedaRN)

Este plano descreve o desenvolvimento completo da página de busca do HospedaRN, abrangendo tanto a implementação de filtros avançados no backend (NestJS/Prisma) quanto a criação de uma interface de busca dinâmica e interativa no frontend (React/MUI/Leaflet).

## User Review Required

> [!IMPORTANT]
> **Integração com Leaflet**: Usaremos a biblioteca `react-leaflet` no frontend para mostrar as hospedagens em um mapa interativo. Caso o usuário não tenha conexão de internet ativa ou o CDN do Leaflet apresente lentidão, os marcadores padrão do mapa serão carregados através do CDN do unpkg (para evitar quebra do ícone por problemas de bundling).
>
> **Preço inicial e Tipo de Acomodação**: Como os tipos de acomodação e preços são definidos por quarto (`Room`) no banco de dados e não direto no estabelecimento, o filtro de "faixa de preço" e "tipo de quarto" buscará estabelecimentos que possuam pelo menos um quarto ativo que atenda aos critérios. O preço exibido no card será o menor preço de quarto ativo encontrado ("A partir de R$ X").

## Proposed Changes

---

### Backend (NestJS / Prisma)

#### [MODIFY] [establishment.dto.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/establishments/dto/establishment.dto.ts)
- Adicionar os seguintes parâmetros opcionais à classe `SearchEstablishmentsDto`:
  - `minPrice?: number` (Preço mínimo base dos quartos)
  - `maxPrice?: number` (Preço máximo base dos quartos)
  - `minRating?: number` (Avaliação média mínima do estabelecimento)
  - `amenityIds?: string` (Lista de IDs de comodidades separada por vírgula)
  - `accommodationTypeIds?: string` (Lista de IDs de tipos de acomodação separada por vírgula)

#### [MODIFY] [establishments.service.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/establishments/establishments.service.ts)
- Modificar o `ESTABLISHMENT_SELECT` para incluir:
  - `photos` do estabelecimento (para carregar imagens reais nos cards).
  - `rooms` com seus preços base (`precoBase`) e tipos de acomodação vinculados (necessário para calcular o preço inicial "A partir de" e exibir os tipos no card).
- Atualizar o método `findAll(dto: SearchEstablishmentsDto)`:
  - Ampliar o filtro textual (`dto.search`) para buscar no nome do estabelecimento, descrição e também no nome da cidade.
  - Implementar o filtro de preço (`minPrice` / `maxPrice`) buscando estabelecimentos que possuam quartos ativos dentro da faixa.
  - Implementar o filtro por tipos de acomodação (`accommodationTypeIds`) verificando os quartos do estabelecimento.
  - Implementar o filtro por comodidades (`amenityIds`) garantindo que o estabelecimento possua *todas* as comodidades selecionadas (usando a junção `AND` do Prisma).
  - Implementar o filtro por nota mínima (`minRating`) comparando com a `notaMedia` do estabelecimento.

---

### Frontend (React / MUI / Leaflet)

#### [MODIFY] [SearchPage.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/public/SearchPage.tsx)
- Desenvolver uma tela de busca premium contendo:
  - **Filtros Laterais (Sidebar)**:
    - Campo de busca textual.
    - Seleção de Cidade (carregada dinamicamente via `citiesApi`).
    - Faixa de Preço (Slider ou campos numéricos).
    - Avaliação Mínima (estrelas interativas).
    - Tipos de Acomodação (checkboxes carregados via `accommodationTypesApi`).
    - Comodidades/Vantagens (checkboxes carregados via `amenitiesApi`).
    - Botão para Limpar Filtros.
  - **Área de Resultados**:
    - Contador de resultados com feedback do termo buscado.
    - Grade (Grid) de Cards de Estabelecimentos:
      - Carrossel de fotos ou foto de capa real (com fallback de Unsplash).
      - Chip indicando a cidade.
      - Nome do estabelecimento e avaliação por estrelas (com quantidade de avaliações).
      - Resumo das comodidades em formato de Chips/ícones.
      - Preço inicial "A partir de R$ X".
      - Botão "Ver detalhes" redirecionando para a página de detalhes.
  - **Visualização em Mapa Dividido (Split Screen)**:
    - Painel direito opcional com mapa Leaflet exibindo os estabelecimentos como marcadores.
    - Centralização automática na cidade selecionada (usando as coordenadas da cidade) ou centro do RN por padrão.
    - Popups informativos ao clicar no marcador com link rápido para detalhes.
    - Botão flutuante para ocultar/exibir o mapa em telas menores.

## Verification Plan

### Automated Tests
- Testar a chamada da API do backend com os novos filtros via `curl` ou requisitando pelo Swagger em `http://localhost:3000/docs`:
  - `GET /api/establishments?minPrice=100&maxPrice=300`
  - `GET /api/establishments?amenityIds=id1,id2`
  - `GET /api/establishments?accommodationTypeIds=id1`

### Manual Verification
- Acessar a tela inicial, digitar uma cidade (ex: "Natal"), clicar em buscar e verificar o redirecionamento correto para `/busca?cityId=ID_NATAL`.
- Ajustar os filtros de preço, avaliação, tipos e comodidades no frontend e validar se a listagem e o mapa atualizam em tempo real.
- Validar a responsividade da tela em tamanhos mobile (ocultando o mapa por padrão e colapsando a barra de filtros em um Drawer).
- Validar se o marcador do mapa exibe os popups corretos ao clicar.
