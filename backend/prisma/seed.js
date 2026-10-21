import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_MASTER_EMAIL;
  const senha = process.env.SEED_MASTER_PASSWORD;

  if (!email || !senha) {
    throw new Error('Defina SEED_MASTER_EMAIL e SEED_MASTER_PASSWORD no .env');
  }
  if (process.env.NODE_ENV === 'production' && senha === 'Trocar@123') {
    throw new Error('Troque a senha padrão do seed antes de rodar em produção.');
  }

  const senhaHash = await bcrypt.hash(senha, 12);

  const master = await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: {
      perfil: 'MASTER',
      nome: 'Master',
      email,
      senhaHash,
      cargo: 'Master',
    },
  });

  console.log(`Usuário master pronto: ${master.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
