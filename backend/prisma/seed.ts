/* eslint-disable no-console */
import { PrismaClient, SystemRoleKey, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

import {
  ALL_PERMISSIONS,
  DEFAULT_SCHOOL_ROLES,
  SCHOOL_GRANTABLE_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
  parsePermission,
} from '../src/common/constants';

const prisma = new PrismaClient();

/**
 * Idempotent seed — safe to re-run after adding permissions.
 *
 * It deliberately creates **no schools**. Under the current model a school and
 * its administrator are created through the API by the platform operator, so
 * seeding one would just be a second, divergent code path for the same thing.
 * All this does is bootstrap the operator who performs that first action.
 */
async function main(): Promise<void> {
  console.log('Seeding permissions...');
  await Promise.all(
    ALL_PERMISSIONS.map((key) => {
      const { resource, action } = parsePermission(key);
      return prisma.permission.upsert({
        where: { key },
        update: { resource, action },
        create: { key, resource, action, description: `Allows ${action} on ${resource}` },
      });
    }),
  );

  console.log('Seeding the global platform-operator role...');
  // Global: schoolId stays NULL, which is what takes it outside every tenant.
  const existing = await prisma.role.findFirst({
    where: { systemKey: SystemRoleKey.SUPER_ADMIN, schoolId: null },
    select: { id: true },
  });

  const superAdminRole =
    existing ??
    (await prisma.role.create({
      data: {
        name: 'Super Administrator',
        description: 'Platform operator. Creates schools and appoints their administrators.',
        systemKey: SystemRoleKey.SUPER_ADMIN,
        isSystem: true,
        schoolId: null,
      },
      select: { id: true },
    }));

  const permissions = await prisma.permission.findMany({
    where: { key: { in: SUPER_ADMIN_PERMISSIONS } },
    select: { id: true },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map(({ id }) => ({ roleId: superAdminRole.id, permissionId: id })),
    skipDuplicates: true,
  });

  // A school's Administrator role is provisioned with whatever permissions
  // existed at the time. Adding a new resource later would otherwise leave
  // every existing school unable to use it, with no obvious cause.
  console.log('Reconciling school Administrator roles with the permission catalogue...');
  const adminRoles = await prisma.role.findMany({
    where: { systemKey: SystemRoleKey.SCHOOL_ADMIN },
    select: { id: true },
  });

  if (adminRoles.length > 0) {
    const grantable = await prisma.permission.findMany({
      where: { key: { in: SCHOOL_GRANTABLE_PERMISSIONS } },
      select: { id: true },
    });

    await prisma.rolePermission.createMany({
      data: adminRoles.flatMap((role) =>
        grantable.map(({ id }) => ({ roleId: role.id, permissionId: id })),
      ),
      skipDuplicates: true,
    });

    console.log(`  reconciled ${adminRoles.length} role(s)`);
  }

  // The same problem one level down: Manager, Headmaster, and Teacher are
  // provisioned from DEFAULT_SCHOOL_ROLES and then owned by the school, so a
  // template gaining a permission left every existing school without it — which
  // showed up as a menu that was there but 403'd.
  //
  // This only ever *adds* keys the template lists. It cannot restore one an
  // administrator deliberately removed... but equally, it will re-add such a key
  // if it is still in the template — which is the deliberate trade: a school
  // that wants a narrower role should edit or delete it rather than strip a
  // permission the template still declares.
  console.log('Reconciling default school roles with their templates...');
  for (const template of DEFAULT_SCHOOL_ROLES) {
    const roles = await prisma.role.findMany({
      // `systemKey: null` keeps this to school-authored roles; the locked
      // Administrator role is handled above against the full catalogue.
      where: { name: template.name, systemKey: null },
      select: { id: true },
    });
    if (roles.length === 0) continue;

    const templatePermissions = await prisma.permission.findMany({
      where: { key: { in: template.permissions } },
      select: { id: true },
    });

    const { count } = await prisma.rolePermission.createMany({
      data: roles.flatMap((role) =>
        templatePermissions.map(({ id }) => ({ roleId: role.id, permissionId: id })),
      ),
      skipDuplicates: true,
    });

    if (count > 0) {
      console.log(`  ${template.name}: +${count} grant(s) across ${roles.length} role(s)`);
    }
  }

  console.log('Seeding the bootstrap platform operator...');
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'superadmin@school-erp.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const superAdmin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      // Must match PasswordService's parameters, or the first login silently
      // re-hashes via the needsRehash path.
      passwordHash: await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      }),
      firstName: 'Platform',
      lastName: 'Operator',
      status: UserStatus.ACTIVE,
      // No school: the operator belongs to the platform, not to a tenant.
      schoolId: null,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: superAdmin.id, roleId: superAdminRole.id },
  });

  console.log(`\nSeed complete. Platform operator: ${email} / ${password}`);
  console.log('Sign in, create a school, and appoint its administrator.');
  console.log('Change this password before exposing the API.\n');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
