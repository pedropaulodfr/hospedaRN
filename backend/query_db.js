const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDashboard() {
  console.log('--- Testing Dashboard Queries ---');
  try {
    const totalUsers = await prisma.usuario.count();
    console.log('Total Users:', totalUsers);
    
    const totalEstablishments = await prisma.estabelecimento.count({ where: { ativo: true } });
    console.log('Total Establishments:', totalEstablishments);
    
    const totalReservations = await prisma.reserva.count();
    console.log('Total Reservations:', totalReservations);
    
    const totalRevenue = await prisma.reserva.aggregate({
      where: { status: { in: ['CONFIRMADA', 'FINALIZADA'] } },
      _sum: { valorTotal: true },
    });
    console.log('Total Revenue:', totalRevenue);
  } catch (e) {
    console.error('Error in testDashboard:', e.stack || e);
  }
}

async function testEstablishments() {
  console.log('--- Testing Establishments Query ---');
  try {
    const ESTABLISHMENT_SELECT = {
      id: true,
      nome: true,
      descricao: true,
      contato: true,
      emailContato: true,
      website: true,
      endereco: true,
      cep: true,
      latitude: true,
      longitude: true,
      ativo: true,
      notaMedia: true,
      totalAvaliacoes: true,
      fotoPerfil: true,
      criadoEm: true,
      cidade: { select: { id: true, nome: true, estado: true } },
      proprietario: { select: { id: true, nome: true, email: true } },
      comodidades: { include: { comodidade: true } },
      fotos: { select: { id: true, url: true, isCapa: true, ordem: true } },
      quartos: {
        where: { ativo: true },
        select: {
          id: true,
          nome: true,
          precoBase: true,
          capacidade: true,
          tipoAcomodacao: { select: { id: true, nome: true } },
        },
      },
      _count: { select: { quartos: true, reservas: true } },
    };

    const res = await prisma.estabelecimento.findMany({
      where: {},
      select: ESTABLISHMENT_SELECT,
    });
    console.log('Establishments count:', res.length);
  } catch (e) {
    console.error('Error in testEstablishments:', e.stack || e);
  }
}

async function main() {
  await testDashboard();
  await testEstablishments();
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
