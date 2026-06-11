# Plano de Implementação: Foto de Perfil Opcional da Cidade

## Descrição do Objetivo
Implementar a opção (opcional) de adicionar uma foto de perfil para cidades em ambos os fluxos de criação e edição no painel de administração (Gestor).
Para fins de padronização, usaremos exatamente os mesmos nomes e padrões adotados para o Estabelecimento:
1. O upload da imagem da cidade é feito para o S3 via API de uploads.
2. Apenas o nome do arquivo resultante (ex: `foto0001.webp`) é salvo na coluna `fotoPerfil` (mapeada como `foto_perfil` no banco) da tabela `Cidade`.
3. O frontend monta dinamicamente o caminho completo da imagem (ex: `https://hospedarn-bucket.s3.us-east-2.amazonaws.com/cidades/foto0001.webp`) ao exibi-la.

---

## Alterações Propostas

### 1. Banco de Dados (Prisma Schema)

#### [MODIFY] [schema.prisma](file:///d:/Documentos/projects/HospedaRN/backend/prisma/schema.prisma)
- Adicionar o campo `fotoPerfil` (opcional) no modelo `Cidade`:
  ```prisma
  fotoPerfil String? @map("foto_perfil")
  ```

---

### 2. Backend (NestJS)

#### [MODIFY] [cidade.dto.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/cidades/dto/cidade.dto.ts)
- Adicionar o campo opcional `fotoPerfil` aos DTOs de criação e atualização da cidade:
  ```typescript
  @ApiPropertyOptional({ example: 'foto0001.webp' })
  @IsOptional()
  @IsString()
  fotoPerfil?: string;
  ```

#### [MODIFY] [cidades.service.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/cidades/cidades.service.ts)
- Atualizar o método `create` para passar `fotoPerfil` ao criar o registro no Prisma.
- Atualizar o método `findAll` para incluir `fotoPerfil: true` no retorno do select.

---

### 3. Migração do Banco de Dados
- Executar `npx prisma db push` na pasta `backend` para criar a coluna `foto_perfil` na tabela `Cidade` do PostgreSQL no Neon.

---

### 4. Frontend (React)

#### [MODIFY] [AdminCities.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/admin/AdminCities.tsx)
- **Imports**: Adicionar `Avatar` e `Stack` aos componentes importados do `@mui/material`. Importar `uploadsApi` de `../../services/api`.
- **Interface**: Adicionar `fotoPerfil?: string` à interface `City`.
- **Utilitário de URL**: Adicionar a função auxiliar `getPhotoUrl` para montar dinamicamente o link do S3:
  ```typescript
  const getPhotoUrl = (filename?: string) => {
    if (!filename) return '';
    return `https://hospedarn-bucket.s3.us-east-2.amazonaws.com/cidades/${filename}`;
  };
  ```
- **Estados**: Adicionar os estados `fotoPerfil` (string) e `uploadingImage` (boolean) para gerenciar o upload da foto.
- **Modo Criação**: Resetar `fotoPerfil` para `''` no `handleOpenAdd`.
- **Modo Edição**: Preencher `fotoPerfil` com `city.fotoPerfil || ''` no `handleOpenEdit`.
- **Fluxo de Upload**:
  - Exibir um preview `Avatar` no modal.
  - Implementar a função `handlePhotoUpload` que consome a API de upload (`uploadsApi.uploadImage('cidades', file)`) e salva apenas o nome do arquivo resultante.
- **Submissão**: Enviar `fotoPerfil` no payload para o backend.
- **Tabela**: Exibir o `Avatar` da cidade na listagem (coluna "Nome") substituindo o ícone estático `LocationCity`.

---

## Plano de Verificação

### Testes Manuais
1. **Verificação do Banco**: Confirmar a criação da coluna `foto_perfil` na tabela `Cidade` após o `prisma db push`.
2. **Cadastro de Nova Cidade**:
   - Criar uma cidade carregando uma foto e salvando.
   - Verificar na listagem e na base de dados se apenas o nome do arquivo foi registrado.
3. **Edição de Cidade**:
   - Editar uma cidade sem foto, carregar uma foto e salvar.
   - Editar uma cidade com foto, alterar a foto e salvar.
4. **Opcionalidade**:
   - Garantir que criar/editar cidades sem anexar nenhuma foto continue funcionando perfeitamente.
