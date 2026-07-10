import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding local PostgreSQL database...');

  // 1. Create System Admin
  const adminEmail = 'admin@meetlite.dev';
  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('admin123', salt);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      name: 'System Admin',
      isSystemAdmin: true,
      onboardingCompleted: true,
      planType: 'enterprise'
    }
  });

  // 2. Create Development Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'meetlite-dev-workspace' },
    update: {},
    create: {
      name: 'MeetLite Dev Workspace',
      slug: 'meetlite-dev-workspace',
      ownerId: admin.id,
      planType: 'enterprise'
    }
  });

  // 3. Create Development Team
  const team = await prisma.team.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'design-team' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Design Team',
      slug: 'design-team',
      ownerId: admin.id
    }
  });

  console.log('✅ Local development database seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
