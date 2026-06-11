# Plano de Implementação: Foto de Perfil Opcional do Estabelecimento

## Descrição do Objetivo
Adicionar a opção (opcional) de foto de perfil para estabelecimentos em ambos os fluxos de criação e edição no painel de administração (Gestor).
Para fins de eficiência e arquitetura:
1. A foto será enviada para o S3 via API de uploads.
2. Apenas o nome do arquivo resultante (ex: `foto0001.webp`) será salvo na coluna `fotoPerfil` da tabela `Estabelecimento`.
3. O frontend montará dinamicamente o caminho completo da imagem (ex: `https://hospedarn-bucket.s3.us-east-2.amazonaws.com/estabelecimentos/foto0001.webp`) ao exibi-la.

---

## Alterações Propostas

### 1. Banco de Dados (Prisma Schema)

#### [MODIFY] [schema.prisma](file:///d:/Documentos/projects/HospedaRN/backend/prisma/schema.prisma)
- Adicionar o campo `fotoPerfil` (opcional) no modelo `Estabelecimento`:
  ```prisma
  fotoPerfil String? @map("foto_perfil")
  ```

---

### 2. Backend (NestJS)

#### [MODIFY] [estabelecimento.dto.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/estabelecimentos/dto/estabelecimento.dto.ts)
- Adicionar a propriedade opcional `fotoPerfil` aos DTOs de criação e atualização:
  ```typescript
  @ApiPropertyOptional({ example: 'foto0001.webp' })
  @IsOptional()
  @IsString()
  fotoPerfil?: string;
  ```

#### [MODIFY] [estabelecimentos.service.ts](file:///d:/Documentos/projects/HospedaRN/backend/src/modules/estabelecimentos/estabelecimentos.service.ts)
- Atualizar a constante `ESTABLISHMENT_SELECT` para incluir o novo campo `fotoPerfil`:
  ```typescript
  fotoPerfil: true,
  ```

---

### 3. Migração do Banco de Dados
- Executar `npx prisma db push` na pasta `backend` para refletir a nova coluna `foto_perfil` no banco PostgreSQL da Neon.

---

### 4. Frontend (React)

#### [MODIFY] [AdminEstablishments.tsx](file:///d:/Documentos/projects/HospedaRN/frontend/src/pages/admin/AdminEstablishments.tsx)
- **Interface**: Adicionar `fotoPerfil?: string` à interface `Establishment`.
- **Utilitário de URL**: Criar uma função auxiliar ou constante para montar o caminho do S3:
  ```typescript
  const getPhotoUrl = (filename?: string) => {
    if (!filename) return '';
    return `https://hospedarn-bucket.s3.us-east-2.amazonaws.com/estabelecimentos/${filename}`;
  };
  ```
- **Estados**: Criar os estados `fotoPerfil` (string) e `uploadingImage` (boolean).
- **Modo Criação**: Resetar `fotoPerfil` para `''` ao abrir o modal.
- **Modo Edição**: Preencher `fotoPerfil` com `est.fotoPerfil || ''` ao abrir o modal.
- **Fluxo de Upload**: 
  - Exibir um `Avatar` do MUI com a foto atual (usando `getPhotoUrl(fotoPerfil)`) ou um placeholder se não houver foto.
  - Implementar o upload chamando `uploadsApi.uploadImage('estabelecimentos', file)`.
  - Ao concluir, extrair apenas o nome do arquivo da chave retornado (ex: `const filename = res.data.s3Key.split('/').pop()`) e atualizar o estado `fotoPerfil` com esse nome.
- **Submissão**: Enviar a propriedade `fotoPerfil` no payload para a API.
- **Exibição**:
  - Na tabela de estabelecimentos, substituir o ícone estático por um `Avatar` exibindo `getPhotoUrl(est.fotoPerfil)`.
  - No modal de detalhes, renderizar a foto de perfil do estabelecimento caso ela esteja cadastrada.

---

## Plano de Verificação

### Testes Manuais
1. **Verificação do Banco**: Confirmar a criação da coluna `foto_perfil` após o `prisma db push`.
2. **Criação de Estabelecimento**:
   - Abrir o modal, fazer upload de uma foto de perfil e salvar.
   - Verificar na Neon se a coluna `foto_perfil` contém apenas o nome do arquivo (ex: `<uuid>.webp`).
   - Confirmar se a imagem carrega corretamente na listagem de estabelecimentos.
3. **Edição de Estabelecimento**:
   - Editar um estabelecimento sem foto, adicionar uma foto e salvar.
   - Editar um estabelecimento com foto, trocar a foto por outra e salvar.
   - Confirmar se os previews e exibições na tabela funcionam corretamente.
4. **Opcionalidade**:
   - Salvar novas inclusões/edições sem carregar foto e garantir que nenhuma exceção ocorra.
