import { Box, Button, FormControlLabel, IconButton, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { Add, DeleteOutlined } from '@mui/icons-material';
import { FormGrid, FormSection, FormSpan } from '../common';
import { radius } from '../../theme/tokens';
import type { AcompanhanteForm } from './contrato';
import { MAX_ACOMPANHANTES, acompanhanteVazio } from './contrato';

type Erros = Record<string, string>;

/**
 * Editor de acompanhantes do check-in.
 *
 * Lista ordenada de blocos — um por acompanhante — com adicionar/remover.
 * O hóspede principal NÃO entra aqui: ele é sempre presente e fica na seção
 * anterior do drawer, identificado pelo chip "Principal".
 */
export function AcompanhantesEditor({
  acompanhantes,
  onChange,
  erros,
  disabled = false,
  onEditarCampo,
  onEstruturaChange,
}: {
  acompanhantes: AcompanhanteForm[];
  onChange: (proximos: AcompanhanteForm[]) => void;
  erros: Erros;
  disabled?: boolean;
  /** Avisa qual campo foi corrigido, para limpar o erro daquele campo. */
  onEditarCampo?: (chave: string) => void;
  /** Avisa que a lista mudou de tamanho/ordem (erros antigos deixam de valer). */
  onEstruturaChange?: () => void;
}) {
  const atualizar = (indice: number, campo: keyof AcompanhanteForm, valor: string | boolean) => {
    const proximos = acompanhantes.map((item, i) =>
      i === indice ? { ...item, [campo]: valor } : item,
    );
    onChange(proximos);
    onEditarCampo?.(`acompanhantes.${indice}.${campo}`);
  };

  const remover = (indice: number) => {
    onChange(acompanhantes.filter((_, i) => i !== indice));
    onEstruturaChange?.();
  };

  const adicionar = () => {
    if (acompanhantes.length >= MAX_ACOMPANHANTES) return;
    onChange([...acompanhantes, acompanhanteVazio()]);
    onEstruturaChange?.();
  };

  const noLimite = acompanhantes.length >= MAX_ACOMPANHANTES;

  return (
    <FormSection
      title="Acompanhantes"
      description="Registre quem está presente no check-in. O hóspede principal é sempre considerado presente."
    >
      {acompanhantes.length === 0 ? (
        <Box
          sx={{
            p: 2,
            borderRadius: `${radius.lg}px`,
            border: '1px dashed',
            borderColor: 'divider',
            bgcolor: 'action.hover',
          }}
        >
          <Typography variant="body2" color="textSecondary">
            Nenhum acompanhante informado. Adicione apenas se houver mais alguém na hospedagem.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2}>
          {acompanhantes.map((acompanhante, indice) => {
            const prefixo = `acompanhantes.${indice}`;
            return (
              <Box
                key={indice}
                component="fieldset"
                sx={{
                  m: 0,
                  p: 2,
                  borderRadius: `${radius.lg}px`,
                  border: '1px solid',
                  borderColor: 'divider',
                  minWidth: 0,
                }}
              >
                <Box
                  component="legend"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    width: '100%',
                    px: 0.5,
                    mb: 1.5,
                  }}
                >
                  <Typography variant="subtitle2" component="span" sx={{ fontWeight: 700 }}>
                    Acompanhante {indice + 1}
                  </Typography>
                  <Tooltip title={`Remover acompanhante ${indice + 1}`}>
                    <span>
                      <IconButton
                        onClick={() => remover(indice)}
                        disabled={disabled}
                        aria-label={`Remover acompanhante ${indice + 1}`}
                        sx={{ minWidth: 44, minHeight: 44, color: 'error.main' }}
                      >
                        <DeleteOutlined />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>

                <FormGrid columns={2} gap={2}>
                  <FormSpan span={2}>
                    <TextField
                      id={`acompanhante-${indice}-nome`}
                      label="Nome completo"
                      required
                      value={acompanhante.nome}
                      onChange={(e) => atualizar(indice, 'nome', e.target.value)}
                      disabled={disabled}
                      error={Boolean(erros[`${prefixo}.nome`])}
                      helperText={erros[`${prefixo}.nome`]}
                      autoComplete="off"
                    />
                  </FormSpan>

                  <TextField
                    id={`acompanhante-${indice}-cpf`}
                    label="CPF"
                    value={acompanhante.cpf}
                    onChange={(e) => atualizar(indice, 'cpf', e.target.value)}
                    disabled={disabled}
                    error={Boolean(erros[`${prefixo}.cpf`])}
                    helperText={erros[`${prefixo}.cpf`] ?? 'Opcional · 11 dígitos'}
                    slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 14 } }}
                    autoComplete="off"
                  />

                  <TextField
                    id={`acompanhante-${indice}-documento`}
                    label="RG / documento"
                    value={acompanhante.documento}
                    onChange={(e) => atualizar(indice, 'documento', e.target.value)}
                    disabled={disabled}
                    helperText="Opcional"
                    autoComplete="off"
                  />

                  <TextField
                    id={`acompanhante-${indice}-dataNascimento`}
                    label="Data de nascimento"
                    type="date"
                    value={acompanhante.dataNascimento}
                    onChange={(e) => atualizar(indice, 'dataNascimento', e.target.value)}
                    disabled={disabled}
                    error={Boolean(erros[`${prefixo}.dataNascimento`])}
                    helperText={erros[`${prefixo}.dataNascimento`] ?? 'Opcional'}
                    slotProps={{
                      inputLabel: { shrink: true },
                      htmlInput: { max: new Date().toISOString().slice(0, 10) },
                    }}
                    sx={(t) => ({ '& input': { colorScheme: t.palette.mode } })}
                  />

                  <TextField
                    id={`acompanhante-${indice}-telefone`}
                    label="Telefone"
                    value={acompanhante.telefone}
                    onChange={(e) => atualizar(indice, 'telefone', e.target.value)}
                    disabled={disabled}
                    helperText="Opcional"
                    slotProps={{ htmlInput: { inputMode: 'tel' } }}
                    autoComplete="off"
                  />

                  <TextField
                    id={`acompanhante-${indice}-parentesco`}
                    label="Parentesco"
                    value={acompanhante.parentesco}
                    onChange={(e) => atualizar(indice, 'parentesco', e.target.value)}
                    disabled={disabled}
                    helperText="Ex.: cônjuge, filho, amigo"
                    autoComplete="off"
                  />

                  <FormSpan span={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={acompanhante.presente}
                          onChange={(e) => atualizar(indice, 'presente', e.target.checked)}
                          disabled={disabled}
                          slotProps={{
                            input: { 'aria-label': `Acompanhante ${indice + 1} presente no check-in` },
                          }}
                        />
                      }
                      label="Presente no check-in"
                    />
                  </FormSpan>

                  <FormSpan span={2}>
                    <TextField
                      id={`acompanhante-${indice}-observacoes`}
                      label="Observação"
                      value={acompanhante.observacoes}
                      onChange={(e) => atualizar(indice, 'observacoes', e.target.value)}
                      disabled={disabled}
                      multiline
                      minRows={2}
                      helperText="Opcional"
                      slotProps={{ htmlInput: { maxLength: 500 } }}
                    />
                  </FormSpan>
                </FormGrid>
              </Box>
            );
          })}
        </Stack>
      )}

      <Box>
        <Tooltip title={noLimite ? `Limite de ${MAX_ACOMPANHANTES} acompanhantes atingido` : ''}>
          <span>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={adicionar}
              disabled={disabled || noLimite}
              sx={{ minHeight: 44 }}
            >
              Adicionar acompanhante
            </Button>
          </span>
        </Tooltip>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>
          {acompanhantes.length} de {MAX_ACOMPANHANTES} acompanhantes
        </Typography>
      </Box>
    </FormSection>
  );
}
