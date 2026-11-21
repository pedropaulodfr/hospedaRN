import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  CircularProgress,
  Divider,
  Link,
  Stack,
  alpha,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Person,
  ContactPage,
  CalendarToday,
  Phone,
  Home,
  Public,
  PhoneCallback,
  CheckCircleOutlined,
} from '@mui/icons-material';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { Logo, FormSection, FormGrid, FormSpan } from '../../components/common';
import toast from 'react-hot-toast';

// Zod validation schema
const registerSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  telefone: z.string().min(14, 'O celular deve ter o formato (99) 99999-9999'),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'O CPF deve ter o formato 999.999.999-99'),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento inválida').refine((val) => {
    const birthDate = new Date(val);
    const today = new Date();
    return birthDate < today;
  }, 'A data de nascimento deve ser no passado'),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmarSenha: z.string().min(6, 'A confirmação de senha é obrigatória'),
  // Optional fields
  rg: z.string().optional(),
  nacionalidade: z.string().optional(),
  contatoEmergencia: z.string().optional(),
  endereco: z.string().optional(),
}).refine((data) => data.senha === data.confirmarSenha, {
  message: 'As senhas não coincidem',
  path: ['confirmarSenha'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

// Mask formatters
const maskCpf = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .substring(0, 14);
};

const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .substring(0, 15);
};

/** Destaques da marca no painel lateral (fatos do produto, sem métricas inventadas). */
const brandHighlights = [
  'Cadastro rápido, direto pelo site',
  'Reserve e acompanhe a aprovação em um só painel',
  'Pagamento por Pix, boleto ou cartão',
];

export default function RegisterPage() {
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true);
    try {
      const response = await authApi.register({
        nome: data.nome,
        email: data.email,
        senha: data.senha,
        telefone: data.telefone,
        cpf: data.cpf,
        dataNascimento: data.dataNascimento,
        rg: data.rg || undefined,
        nacionalidade: data.nacionalidade || undefined,
        contatoEmergencia: data.contatoEmergencia || undefined,
        endereco: data.endereco || undefined,
        perfil: 'HOSPEDE',
      });

      const { usuario, accessToken, refreshToken } = response.data.data;

      // Update auth store with guest profile
      setAuth(
        {
          ...usuario,
          role: 'GUEST',
        },
        accessToken,
        refreshToken
      );

      toast.success(`Cadastro realizado! Bem-vindo(a), ${usuario.nome}!`);
      navigate('/hospede');
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.message || 'Falha ao realizar cadastro. Verifique os dados inseridos.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 0.85fr) minmax(0, 1.15fr)' },
        bgcolor: 'background.default',
      }}
    >
      {/* ================= PAINEL DE MARCA (desktop) ================= */}
      <Box
        component="aside"
        aria-label="Sobre o HospedaRN"
        sx={{
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 6,
          bgcolor: 'primary.dark',
          color: 'primary.contrastText',
          position: 'relative',
          overflow: 'hidden',
          p: 6,
        }}
      >
        <Box
          aria-hidden
          sx={(t) => ({
            position: 'absolute',
            width: 420,
            height: 420,
            borderRadius: '50%',
            top: -160,
            right: -140,
            border: `1px solid ${alpha(t.palette.primary.contrastText, 0.16)}`,
            bgcolor: alpha(t.palette.primary.contrastText, 0.04),
            pointerEvents: 'none',
          })}
        />

        <Box sx={{ position: 'relative' }}>
          <Logo size={40} onDark to="/" />
        </Box>

        <Box sx={{ position: 'relative' }}>
          <Typography variant="overline" component="p" sx={{ color: 'inherit', opacity: 0.72, mb: 1.5 }}>
            Nova conta de hóspede
          </Typography>
          <Typography variant="h3" component="p" sx={{ color: 'inherit', maxWidth: 420, letterSpacing: '-0.02em' }}>
            Crie sua conta e reserve com tranquilidade.
          </Typography>
          <Typography variant="body1" sx={{ color: 'inherit', opacity: 0.82, mt: 2.5, maxWidth: 400 }}>
            Leva poucos minutos. Depois é só escolher a hospedagem e enviar a solicitação.
          </Typography>

          <Stack spacing={1.5} sx={{ mt: 4 }}>
            {brandHighlights.map((highlight) => (
              <Stack key={highlight} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <CheckCircleOutlined
                  aria-hidden
                  sx={{ fontSize: 20, color: 'inherit', opacity: 0.85, mt: 0.25, flexShrink: 0 }}
                />
                <Typography variant="body2" sx={{ color: 'inherit', opacity: 0.88 }}>
                  {highlight}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.6, position: 'relative' }}>
          Rio Grande do Norte · Brasil
        </Typography>
      </Box>

      {/* ================= FORMULÁRIO ================= */}
      <Box sx={{ px: { xs: 2, sm: 4 }, py: { xs: 4, md: 6 } }}>
        <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto' }}>
          {/* Marca no topo (mobile/tablet) */}
          <Box sx={{ display: { xs: 'flex', lg: 'none' }, justifyContent: 'center', mb: 3 }}>
            <Logo size={38} to="/" />
          </Box>

          <Card>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Box component="header" sx={{ mb: 3 }}>
                <Typography variant="overline" component="p" color="primary">
                  Criar conta
                </Typography>
                <Typography variant="h4" component="h1" sx={{ mt: 0.5 }}>
                  Criar conta de hóspede
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1, maxWidth: 520 }}>
                  Cadastre-se para encontrar e reservar as melhores estadias no Rio Grande do Norte.
                </Typography>
              </Box>

              <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
                <FormSection
                  title="Informações obrigatórias"
                  description="Dados usados para identificar você e liberar suas reservas."
                >
                  <FormGrid columns={2}>
                    <FormSpan span={2}>
                      <TextField
                        id="register-nome"
                        {...register('nome')}
                        label="Nome completo"
                        autoComplete="name"
                        fullWidth
                        error={!!errors.nome}
                        helperText={errors.nome?.message}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <Person aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    </FormSpan>

                    <TextField
                      id="register-cpf"
                      {...register('cpf')}
                      label="CPF"
                      placeholder="000.000.000-00"
                      autoComplete="off"
                      fullWidth
                      error={!!errors.cpf}
                      helperText={errors.cpf?.message}
                      onChange={(e) => {
                        const masked = maskCpf(e.target.value);
                        setValue('cpf', masked, { shouldValidate: true });
                      }}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <ContactPage aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      id="register-data-nascimento"
                      {...register('dataNascimento')}
                      label="Data de nascimento"
                      type="date"
                      autoComplete="bday"
                      fullWidth
                      error={!!errors.dataNascimento}
                      helperText={errors.dataNascimento?.message}
                      slotProps={{
                        inputLabel: {
                          shrink: true,
                        },
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <CalendarToday aria-hidden sx={{ color: 'text.secondary', fontSize: 18 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      id="register-telefone"
                      {...register('telefone')}
                      label="Celular"
                      placeholder="(84) 99999-9999"
                      autoComplete="tel"
                      fullWidth
                      error={!!errors.telefone}
                      helperText={errors.telefone?.message}
                      onChange={(e) => {
                        const masked = maskPhone(e.target.value);
                        setValue('telefone', masked, { shouldValidate: true });
                      }}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Phone aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      id="register-email"
                      {...register('email')}
                      label="E-mail"
                      type="email"
                      autoComplete="email"
                      fullWidth
                      error={!!errors.email}
                      helperText={errors.email?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Email aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      id="register-senha"
                      {...register('senha')}
                      label="Senha"
                      type={showSenha ? 'text' : 'password'}
                      autoComplete="new-password"
                      fullWidth
                      error={!!errors.senha}
                      helperText={errors.senha?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Lock aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={() => setShowSenha(!showSenha)}
                                edge="end"
                                aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                              >
                                {showSenha ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      id="register-confirmar-senha"
                      {...register('confirmarSenha')}
                      label="Confirmar senha"
                      type={showConfirmarSenha ? 'text' : 'password'}
                      autoComplete="new-password"
                      fullWidth
                      error={!!errors.confirmarSenha}
                      helperText={errors.confirmarSenha?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Lock aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                                edge="end"
                                aria-label={
                                  showConfirmarSenha ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'
                                }
                              >
                                {showConfirmarSenha ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </FormGrid>
                </FormSection>

                <Divider sx={{ my: 3.5 }} />

                <FormSection
                  title="Informações opcionais"
                  description="Ajudam o anfitrião a preparar sua chegada. Você pode preencher depois."
                >
                  <FormGrid columns={2}>
                    <TextField
                      id="register-rg"
                      {...register('rg')}
                      label="RG"
                      placeholder="Somente números"
                      autoComplete="off"
                      fullWidth
                      error={!!errors.rg}
                      helperText={errors.rg?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <ContactPage aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      id="register-nacionalidade"
                      {...register('nacionalidade')}
                      label="Nacionalidade"
                      placeholder="Ex: Brasileira"
                      autoComplete="off"
                      fullWidth
                      error={!!errors.nacionalidade}
                      helperText={errors.nacionalidade?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Public aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <FormSpan span={2}>
                      <TextField
                        id="register-contato-emergencia"
                        {...register('contatoEmergencia')}
                        label="Contato de emergência"
                        placeholder="Nome e telefone"
                        autoComplete="off"
                        fullWidth
                        error={!!errors.contatoEmergencia}
                        helperText={errors.contatoEmergencia?.message}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <PhoneCallback aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    </FormSpan>

                    <FormSpan span={2}>
                      <TextField
                        id="register-endereco"
                        {...register('endereco')}
                        label="Endereço completo"
                        placeholder="Rua, número, bairro, cidade - UF"
                        autoComplete="street-address"
                        multiline
                        rows={3}
                        fullWidth
                        error={!!errors.endereco}
                        helperText={errors.endereco?.message}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                                <Home aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    </FormSpan>
                  </FormGrid>
                </FormSection>

                <Divider sx={{ my: 3.5 }} />

                <Box sx={{ display: 'grid', gap: 2 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    disabled={loading}
                    aria-busy={loading}
                  >
                    {loading ? <CircularProgress size={24} color="inherit" /> : 'Realizar cadastro'}
                  </Button>

                  <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center' }}>
                    Já possui uma conta?{' '}
                    <Link component={RouterLink} to="/login" variant="body2" sx={{ fontWeight: 600 }}>
                      Entrar
                    </Link>
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
