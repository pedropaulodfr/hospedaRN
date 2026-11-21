import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Typography } from '@mui/material';
import { AttachMoney, EditCalendar, EventBusy } from '@mui/icons-material';
import { establishmentsApi, roomsApi } from '../../services/api';
import {
  EmptyState,
  ErrorState,
  PageContainer,
  PageHeader,
  SectionCard,
  TableSkeleton,
} from '../../components/common';
import { formatCurrency, formatDate } from '../../theme/tokens';
import type { Season, RoomWithPrices } from './types';
import toast from 'react-hot-toast';

/**
 * Visão consolidada de temporadas e valores por quarto (somente leitura).
 * A edição continua em "Quartos" — esta tela existe para auditar a política de preços
 * sem navegar quarto por quarto. Nenhuma regra de preço é calculada aqui: os valores
 * exibidos vêm do servidor.
 */
export default function EstPrices() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [rooms, setRooms] = useState<RoomWithPrices[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const estRes = await establishmentsApi.getMy();
      const list = estRes.data.data || estRes.data || [];
      const estabelecimentoId = list[0]?.id;

      const [seasonsRes, roomsRes] = await Promise.allSettled([
        roomsApi.getSeasons(),
        estabelecimentoId ? roomsApi.getByEstablishment(estabelecimentoId) : Promise.resolve(null),
      ]);

      if (seasonsRes.status === 'fulfilled') {
        setSeasons(seasonsRes.value.data.data || seasonsRes.value.data || []);
      } else {
        console.error('Erro ao carregar temporadas', seasonsRes.reason);
      }

      if (roomsRes.status === 'fulfilled' && roomsRes.value) {
        setRooms(roomsRes.value.data.data || roomsRes.value.data || []);
      } else if (roomsRes.status === 'rejected') {
        console.error('Erro ao carregar quartos', roomsRes.reason);
        toast.error('Não foi possível carregar os quartos.');
      }
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Preço de cada quarto por temporada, indexado por `quartoId`. */
  const priceMatrix = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    rooms.forEach((room) => {
      const bySeason = new Map<string, number>();
      (room.precos || []).forEach((p) => {
        if (p?.temporadaId) bySeason.set(p.temporadaId, Number(p.valor));
      });
      map.set(room.id, bySeason);
    });
    return map;
  }, [rooms]);

  if (loading) {
    return (
      <PageContainer>
        <PageHeader overline="Operação" title="Preços e temporadas" subtitle="Carregando a política de preços do estabelecimento…" />
        <SectionCard>
          <TableSkeleton rows={5} columns={4} />
        </SectionCard>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <PageHeader overline="Operação" title="Preços e temporadas" />
        <SectionCard>
          <ErrorState onRetry={load} description="Não foi possível carregar temporadas e preços agora." />
        </SectionCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        overline="Operação"
        title="Preços e temporadas"
        subtitle="Visão consolidada das temporadas cadastradas e dos valores praticados por quarto. A edição é feita na tela de Quartos."
        actions={
          <Button
            variant="contained"
            startIcon={<EditCalendar />}
            onClick={() => navigate('/estabelecimento/quartos')}
          >
            Editar em Quartos
          </Button>
        }
      />

      <Stack spacing={3}>
        <SectionCard
          title="Temporadas"
          subtitle="Períodos com ajuste de preço aplicado sobre o valor base do quarto."
          noPadding={seasons.length > 0}
        >
          {seasons.length === 0 ? (
            <EmptyState
              compact
              icon={<EventBusy />}
              title="Nenhuma temporada cadastrada"
              description="Sem temporadas, todos os quartos usam apenas o preço base. Cadastre períodos de alta estação na base de temporadas para ajustar valores automaticamente."
            />
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Temporada</TableCell>
                    <TableCell>Início</TableCell>
                    <TableCell>Fim</TableCell>
                    <TableCell align="right">Ajuste</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {seasons.map((season) => (
                    <TableRow key={season.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{season.nome}</TableCell>
                      <TableCell>{formatDate(season.dataInicio)}</TableCell>
                      <TableCell>{formatDate(season.dataFim)}</TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={(t) => ({
                            fontWeight: 700,
                            color:
                              Number(season.percentualAjuste) > 0
                                ? t.palette.error.main
                                : Number(season.percentualAjuste) < 0
                                  ? t.palette.success.main
                                  : t.palette.text.secondary,
                          })}
                        >
                          {Number(season.percentualAjuste) > 0 ? '+' : ''}
                          {Number(season.percentualAjuste || 0).toLocaleString('pt-BR')}%
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </SectionCard>

        <SectionCard
          title="Valores por quarto"
          subtitle="Preço base e, quando definido, o valor específico de cada temporada."
          noPadding={rooms.length > 0}
        >
          {rooms.length === 0 ? (
            <EmptyState
              compact
              icon={<AttachMoney />}
              title="Nenhum quarto cadastrado"
              description="Cadastre quartos para definir preço base e valores por temporada."
              action={
                <Button variant="outlined" onClick={() => navigate('/estabelecimento/quartos')}>
                  Ir para Quartos
                </Button>
              }
            />
          ) : (
            <Box sx={{ p: 3 }}>
              <Grid container spacing={2}>
                {rooms.map((room) => {
                  const values = priceMatrix.get(room.id);
                  return (
                    <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={room.id}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          border: '1px solid',
                          borderColor: 'divider',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
                              {room.nome}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {room.capacidade} {room.capacidade === 1 ? 'hóspede' : 'hóspedes'}
                            </Typography>
                          </Box>
                          {!room.ativo && (
                            <Typography variant="caption" color="textSecondary">
                              Inativo
                            </Typography>
                          )}
                        </Box>

                        <Box>
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            Preço base
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1.2 }}>
                            {formatCurrency(Number(room.precoBase))}
                          </Typography>
                        </Box>

                        <Box sx={{ mt: 'auto', pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                          {seasons.length === 0 ? (
                            <Typography variant="caption" color="textSecondary">
                              Sem temporadas cadastradas
                            </Typography>
                          ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {seasons.map((season) => {
                                const value = values?.get(season.id);
                                return (
                                  <Box key={season.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                                    <Typography variant="caption" color="textSecondary" noWrap>
                                      {season.nome}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{ fontWeight: 600, color: value == null ? 'text.disabled' : 'text.primary' }}
                                    >
                                      {value == null ? 'ajuste' : formatCurrency(value)}
                                    </Typography>
                                  </Box>
                                );
                              })}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}
        </SectionCard>
      </Stack>
    </PageContainer>
  );
}
