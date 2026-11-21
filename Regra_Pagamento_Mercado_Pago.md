# Regra de Pagamento com Mercado Pago

## Como funciona hoje (método padrão)

1. **Solicitação** — O hóspede escolhe a acomodação e os dados da estadia e solicita a reserva. Ela fica como "Solicitada".
2. **Aprovação** — O estabelecimento analisa e **confirma** a solicitação. Só a partir daí o hóspede tem acesso às formas de pagamento.
3. **Pagamento manual** — O hóspede escolhe PIX, boleto ou cartão e "paga" simuladamente.
4. **Comprovante** — Para PIX e boleto, o hóspede precisa **enviar o comprovante** de pagamento.
5. **Reconhecimento manual** — O estabelecimento abre a reserva, vê o comprovante anexado e **aprova o pagamento manualmente**, só então a estadia é finalizada.

Em resumo: **o reconhecimento do pagamento depende de uma pessoa** — o hóspede envia o comprovante e o gestor valida.

---

## Novo parâmetro no módulo do gestor

Cada estabelecimento terá uma configuração própria que indica o **modo de pagamento** que vai usar:

- **Método padrão** — o fluxo atual, com envio e conferência manual de comprovante.
- **Mercado Pago** — pagamentos processados pela plataforma Mercado Pago, com reconhecimento automático.

Ou seja, a decisão é feita **por estabelecimento**, não por hóspede. Estabelecimentos diferentes podem ter modos diferentes ao mesmo tempo. A escolha aparece no painel do gestor e vale para todas as reservas daquele estabelecimento.

---

## Como vai funcionar com Mercado Pago

A solicitação de hospedagem continua **exatamente igual** ao que já existe hoje:

1. **Solicitação** — O hóspede preenche os dados da estadia e solicita a reserva → "Solicitada".
2. **Aprovação** — O estabelecimento confirma a solicitação como faz hoje → "Confirmada".

A partir daí a diferença começa, na **hora de pagar**:

3. **Pagamento direto na plataforma** — O hóspede continua escolhendo entre PIX, boleto e cartão, mas o pagamento passa a ser feito pelo **Mercado Pago** (QR Code PIX, linha digitável de boleto ou cartão, gerados de verdade pela plataforma).
4. **Sem comprovante** — O hóspede **não envia comprovante**. Ele não vê mais a tela de anexar arquivo.
5. **Reconhecimento automático** — Assim que o pagamento é concluído e confirmado pelo Mercado Pago, o sistema identifica sozinho e a reserva **é reconhecida automaticamente como paga** — sem que ninguém precise conferir nada.
6. **Finalização** — Com o pagamento confirmado automaticamente, a estadia segue o fluxo normal até a finalização, como já acontece hoje.

---

## Regras da nova modalidade

- O hóspede **não é obrigado a enviar comprovante** em nenhum caso quando o estabelecimento usa o Mercado Pago.
- O pagamento é **reconhecido sozinho**: o hóspede não fica "aguardando validação" e o gestor não precisa fazer nenhum passo manual de aprovação de pagamento.
- Se o hóspede **não concluir o pagamento** dentro do prazo, a reserva continua no estado atual (aguardando pagamento), podendo ser cancelada tanto pelo hóspede quanto pelo estabelecimento, como já acontece.
- Para quem optar pelo **modo padrão**, nada muda: o fluxo com comprovante e validação manual permanece intacto.
- Cada estabelecimento pode trocar essa configuração quando quiser. A troca vale para as reservas feitas a partir dali — reservas antigas já em andamento seguem o modo em que foram criadas.