import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Box,
  Typography,
  Container,
  Button,
  TextField,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  CircularProgress,
  Grid,
  Divider,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  BeachAccess,
  Email,
  Lock,
  Person,
  ContactPage,
  CalendarToday,
  Phone,
  Home,
  Public,
  PhoneCallback,
} from '@mui/icons-material';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
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

      toast.success(`Cadastro realizado! Bem-vindo(a), ${usuario.nome}! ✈️`);
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
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pt: { xs: 8, md: 10 }, pb: 6 }}>
      <Container maxWidth="md">
        <Card sx={{ borderRadius: 5, boxShadow: '0 12px 40px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            {/* Header / Logo */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', mb: 4, textAlign: 'center' }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #0097A7, #FF7043)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 20px rgba(0, 151, 167, 0.2)',
                }}
              >
                <BeachAccess sx={{ color: 'white', fontSize: 30 }} />
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>
                  Criar Conta Hóspede
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Cadastre-se para encontrar e reservar as melhores estadias no Rio Grande do Norte
                </Typography>
              </Box>
            </Box>

            <form onSubmit={handleSubmit(onSubmit)}>
              <Grid container spacing={4}>
                {/* ================= LEFT COLUMN: MANDATORY FIELDS ================= */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                    Informações Obrigatórias
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    <TextField
                      {...register('nome')}
                      label="Nome Completo"
                      fullWidth
                      error={!!errors.nome}
                      helperText={errors.nome?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Person sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      {...register('cpf')}
                      label="CPF"
                      placeholder="000.000.000-00"
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
                              <ContactPage sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      {...register('dataNascimento')}
                      label="Data de Nascimento"
                      type="date"
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
                              <CalendarToday sx={{ color: 'text.secondary', fontSize: 18 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      {...register('telefone')}
                      label="Celular"
                      placeholder="(84) 99999-9999"
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
                              <Phone sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      {...register('email')}
                      label="E-mail"
                      fullWidth
                      error={!!errors.email}
                      helperText={errors.email?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Email sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      {...register('senha')}
                      label="Senha"
                      type={showSenha ? 'text' : 'password'}
                      fullWidth
                      error={!!errors.senha}
                      helperText={errors.senha?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Lock sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton onClick={() => setShowSenha(!showSenha)} edge="end">
                                {showSenha ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      {...register('confirmarSenha')}
                      label="Confirmar Senha"
                      type={showConfirmarSenha ? 'text' : 'password'}
                      fullWidth
                      error={!!errors.confirmarSenha}
                      helperText={errors.confirmarSenha?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Lock sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton onClick={() => setShowConfirmarSenha(!showConfirmarSenha)} edge="end">
                                {showConfirmarSenha ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Box>
                </Grid>

                {/* ================= RIGHT COLUMN: OPTIONAL FIELDS ================= */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.secondary', mb: 2 }}>
                    Informações Opcionais
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    <TextField
                      {...register('rg')}
                      label="RG"
                      placeholder="Somente números"
                      fullWidth
                      error={!!errors.rg}
                      helperText={errors.rg?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <ContactPage sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      {...register('nacionalidade')}
                      label="Nacionalidade"
                      placeholder="Ex: Brasileira"
                      fullWidth
                      error={!!errors.nacionalidade}
                      helperText={errors.nacionalidade?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Public sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      {...register('contatoEmergencia')}
                      label="Contato de Emergência"
                      placeholder="Nome e telefone"
                      fullWidth
                      error={!!errors.contatoEmergencia}
                      helperText={errors.contatoEmergencia?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <PhoneCallback sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      {...register('endereco')}
                      label="Endereço Completo"
                      placeholder="Rua, Número, Bairro, Cidade - UF"
                      multiline
                      rows={4.2}
                      fullWidth
                      error={!!errors.endereco}
                      helperText={errors.endereco?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                              <Home sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 4 }} />

              {/* Submit button */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={loading}
                  sx={{
                    width: { xs: '100%', sm: 280 },
                    py: 1.5,
                    borderRadius: 3,
                    fontWeight: 700,
                    fontSize: '1rem',
                    boxShadow: 'none',
                    '&:hover': {
                      boxShadow: '0 4px 14px rgba(0,151,167,0.3)',
                    },
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Realizar Cadastro'}
                </Button>

                <Typography variant="body2" color="text.secondary">
                  Já possui uma conta?{' '}
                  <Link
                    to="/login"
                    style={{
                      textDecoration: 'none',
                      fontWeight: 600,
                      color: '#0097A7',
                    }}
                  >
                    Entre aqui
                  </Link>
                </Typography>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
