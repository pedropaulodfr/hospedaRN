# 📌 Sistema de Agendamento de Hospedagens

Objetivo Geral: Desenvolver um sistema web responsivo que permita a hóspedes encontrar e reservar hospedagens em cidades cadastradas, e que atenda também gestores (administradores do sistema) e estabelecimentos (proprietários/gerentes), com fluxos completos de reserva, confirmação, pagamento e relatórios.

## 📌 2. Escopo do Sistema

- Módulo do Hóspede (público)
- Módulo do Gestor (administrador geral)
- Módulo do Estabelecimento (proprietário/gerente)
- Módulo de Autenticação e Perfis
- Módulo de Notificações (e-mail/WhatsApp)
- Módulo de Pagamentos (simulado/integrado)
- Módulo de Relatórios

## ⚙️ 3. Requisitos Funcionais

### 🔐 3.1 Módulo de Autenticação e Perfis

| ID | Requisito |
| --- | --- |
| AUT-01 | Cadastro e login com perfis: Hóspede, Estabelecimento, Gestor. |
| AUT-02 | Cadastro de estabelecimento deve ser aprovado pelo Gestor antes do primeiro acesso. |
| AUT-03 | Recuperação de senha via e-mail. |
| AUT-04 | Autenticação via e-mail + senha (futuramente login social). |

### 🏨 3.2 Módulo do Hóspede

| ID | Requisito |
| --- | --- |
| HOS-01 | Detectar automaticamente a cidade do hóspede via geolocalização (navegador/IP). |
| HOS-02 | Barra de pesquisa manual de cidade. |
| HOS-03 | Listar estabelecimentos da cidade selecionada em cards com imagem, nome, tipo, avaliação média. |
| HOS-04 | Filtrar estabelecimentos por: tipo, faixa de preço, avaliação, vantagens. |
| HOS-05 | Exibir mapa com localização, horário, contato, endereço, regras, fotos e tipos de acomodação. |
| HOS-06 | Reserva com calendário interativo (dias disponíveis), número de pessoas, crianças, tipo de quarto, forma de pagamento. |
| HOS-07 | Mensagem de sucesso com código da reserva e informar que aguarda análise do estabelecimento. |
| HOS-08 | Hóspede pode visualizar suas reservas e status (solicitada, confirmada, aguardando pagamento, finalizada, cancelada). |
| HOS-09 | Hóspede pode cancelar reserva se estiver em status "solicitada" ou "aguardando pagamento". |

### 👑 3.3 Módulo do Gestor

| ID | Requisito |
| --- | --- |
| GES-01 | Cadastrar/editar/inativar cidades: nome, estado, geolocalização (ponto no mapa). |
| GES-02 | Cadastrar/editar/inativar estabelecimentos: nome, tipo, endereço, geolocalização, contato, descrição, vantagens, acomodações, regras. |
| GES-03 | Vincular estabelecimento obrigatoriamente a uma cidade (somente gestor altera cidade). |
| GES-04 | Cadastrar eventos na cidade: nome, descrição, fotos, link oficial, data início/fim, cidades vinculadas. |
| GES-05 | Visualizar relatórios gerenciais: número de reservas por cidade/estabelecimento, taxa de ocupação, cancelamentos, eventos próximos. |
| GES-06 | Gerar relatório em PDF/CSV. |
| GES-07 | Aprovar ou recusar novos cadastros de estabelecimentos. |
| GES-08 | Gerenciar tipos de acomodação e vantagens globalmente (ex: "Wi-Fi grátis" comum a todos). |

### 🏢 3.4 Módulo do Estabelecimento

| ID | Requisito |
| --- | --- |
| EST-01 | Visualizar lista de solicitações de reserva (status "solicitada"). |
| EST-02 | Confirmar ou cancelar uma solicitação. |
| EST-03 | Ao confirmar, reserva vai para "Aguardando Pagamento" e hóspede é notificado. |
| EST-04 | Visualizar reservas em "Aguardando Pagamento". |
| EST-05 | Confirmar pagamento com anexo de comprovante (imagem/PDF). |
| EST-06 | Cancelar reserva em "Aguardando Pagamento" e voltar para "Solicitada" ou arquivar. |
| EST-07 | Editar informações do próprio estabelecimento (exceto cidade). |
| EST-08 | Gerenciar dias/horários de funcionamento (incluindo bloqueios por data específica). |
| EST-09 | Gerenciar fotos (múltiplas) do estabelecimento e dos quartos. |
| EST-10 | Gerenciar preços por tipo de acomodação e por temporada (alta/baixa). |
| EST-11 | Relatórios próprios: ocupação mensal, reservas confirmadas, faturamento estimado. |
| EST-12 | Bloquear datas manualmente (ex: manutenção). |

### 💳 3.5 Módulo de Pagamentos (simulado/integrado)

| ID | Requisito |
| --- | --- |
| PAG-01 | Hóspede pode simular pagamento com cartão de crédito, boleto ou Pix (MVP simulado). |
| PAG-02 | Estabelecimento confirma pagamento manualmente com envio de comprovante. |
| PAG-03 | Em versão futura: integração com gateway real (Stripe, PagSeguro). |
| PAG-04 | Gerar número de transação interno para cada reserva confirmada. |

### 📧 3.6 Módulo de Notificações

| ID | Requisito |
| --- | --- |
| NOT-01 | E-mail ao hóspede quando reserva for solicitada. |
| NOT-02 | E-mail/WhatsApp ao hóspede quando estabelecimento confirmar reserva. |
| NOT-03 | E-mail/WhatsApp ao hóspede quando pagamento for confirmado (reserva finalizada). |
| NOT-04 | E-mail ao estabelecimento quando houver nova solicitação de reserva. |
| NOT-05 | Notificação de cancelamento para ambas as partes. |

## 📐 4. Requisitos Não Funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Sistema responsivo (Bootstrap ou framework similar). |
| RNF-02 | Suporte a smartphones (320px), tablets (768px) e desktops (1024px+). |
| RNF-03 | Backend em linguagem moderna (PHP/Laravel, Node.js ou Python/Django). |
| RNF-04 | Banco de dados relacional (MySQL ou PostgreSQL). |
| RNF-05 | Tempos de resposta inferiores a 3 segundos para operações comuns. |
| RNF-06 | Senhas armazenadas com hash (bcrypt). |
| RNF-07 | Log de ações (quem alterou o quê e quando). |
| RNF-08 | Acessibilidade básica (WCAG) – contraste, labels, navegação por teclado. |
| RNF-09 | Geolocalização via API de mapas (Google Maps ou OpenStreetMap). |

## ✨ 5. Funcionalidades Aprimoradas (Add-ons)

## ⚠️ 6. Restrições e Premissas

- O sistema não gerencia o pagamento financeiro real na versão inicial (apenas simulação e confirmação manual).
- WhatsApp será via link gerado (whatsapp:// ou API terceirizada).
- Gestor é o único responsável por vincular cidade a estabelecimento.
- Estabelecimento não pode alterar sua cidade vinculada.
- O sistema será acessível via navegadores modernos (Chrome, Firefox, Edge, Safari).

## 👥 7. Atores do Sistema

- Hóspede: Usuário que busca e reserva hospedagens.
- Estabelecimento: Gerente/proprietário que opera o local e gerencia reservas.
- Gestor: Administrador geral – cadastra cidades, estabelecimentos e vê relatórios globais.

## 📖 8. Glossário

- Hospedagem: Reserva de estadia em um estabelecimento.
- Solicitação de reserva: Status inicial após hóspede enviar pedido.
- Aguardando Pagamento: Reserva confirmada pelo estabelecimento, aguardando comprovante.
- Finalizada: Reserva com pagamento confirmado e concluída (após data de saída).
- Temporada: Período com preços diferenciados (alta/baixa).