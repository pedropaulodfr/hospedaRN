import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const lastReserva = await prisma.reserva.findFirst({
    orderBy: { criadoEm: 'desc' },
  });
  if (lastReserva) {
    const updated = await prisma.reserva.update({
      where: { id: lastReserva.id },
      data: { status: 'CONFIRMADA' },
    });
    console.log(`SUCCESS: Updated last reservation ${updated.codigoReserva} (ID: ${updated.id}) status to CONFIRMADA`);
  } else {
    console.log('WARN: No reservations found');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
