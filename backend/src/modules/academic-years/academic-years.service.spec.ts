import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AcademicYearStatus, Prisma } from '@prisma/client';

import { PrismaService } from '@/core/prisma/prisma.service';

import { AcademicYearsService, type Actor } from './academic-years.service';

const ACTOR: Actor = { id: 'admin-1', schoolId: 'school-1' };
const UNSCOPED_ACTOR: Actor = { id: 'admin-2', schoolId: null };

const firstArg = (mock: jest.Mock): unknown => (mock.mock.calls as unknown[][])[0]?.[0];

function buildYear(overrides: Record<string, unknown> = {}) {
  return {
    id: 'year-1',
    name: '2025-2026',
    startDate: new Date('2025-06-01T00:00:00.000Z'),
    endDate: new Date('2026-03-31T00:00:00.000Z'),
    status: AcademicYearStatus.UPCOMING,
    activeMarker: null,
    schoolId: 'school-1',
    archivedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

describe('AcademicYearsService', () => {
  let service: AcademicYearsService;
  let prisma: {
    academicYear: Record<string, jest.Mock>;
    auditLog: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      academicYear: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((ops: unknown) => Promise.resolve(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AcademicYearsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AcademicYearsService);
  });

  const validDto = { name: '2025-2026', startDate: '2025-06-01', endDate: '2026-03-31' };

  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates an UPCOMING year with no active marker', async () => {
      prisma.academicYear.create.mockResolvedValue(buildYear());

      await service.create(validDto, ACTOR);

      const args = firstArg(prisma.academicYear.create) as {
        data: { status: string; activeMarker: null; schoolId: string };
      };
      // Activation is a separate, separately-permissioned decision.
      expect(args.data.status).toBe(AcademicYearStatus.UPCOMING);
      expect(args.data.activeMarker).toBeNull();
      expect(args.data.schoolId).toBe('school-1');
    });

    it('anchors dates at UTC midnight so they survive round-tripping', async () => {
      prisma.academicYear.create.mockResolvedValue(buildYear());

      await service.create(validDto, ACTOR);

      const args = firstArg(prisma.academicYear.create) as {
        data: { startDate: Date; endDate: Date };
      };
      expect(args.data.startDate.toISOString()).toBe('2025-06-01T00:00:00.000Z');
      expect(args.data.endDate.toISOString()).toBe('2026-03-31T00:00:00.000Z');
    });

    it('rejects an end date on or before the start date', async () => {
      await expect(service.create({ ...validDto, endDate: '2025-06-01' }, ACTOR)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.create({ ...validDto, endDate: '2025-05-01' }, ACTOR)).rejects.toThrow(
        BadRequestException,
      );

      expect(prisma.academicYear.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate name within the school', async () => {
      prisma.academicYear.findFirst.mockResolvedValueOnce({ id: 'existing' });

      await expect(service.create(validDto, ACTOR)).rejects.toThrow(ConflictException);
      expect(prisma.academicYear.create).not.toHaveBeenCalled();
    });

    it('rejects dates that overlap an existing year', async () => {
      prisma.academicYear.findFirst
        // name check passes
        .mockResolvedValueOnce(null)
        // overlap check finds a clash
        .mockResolvedValueOnce({
          name: '2024-2025',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2025-07-31'),
        });

      await expect(service.create(validDto, ACTOR)).rejects.toThrow(/overlap/i);
      expect(prisma.academicYear.create).not.toHaveBeenCalled();
    });

    it('treats ranges as inclusive when checking overlap', async () => {
      prisma.academicYear.findFirst.mockResolvedValue(null);
      prisma.academicYear.create.mockResolvedValue(buildYear());

      await service.create(validDto, ACTOR);

      const overlapQuery = (prisma.academicYear.findFirst.mock.calls as unknown[][])[1]?.[0] as {
        where: { startDate: { lte: Date }; endDate: { gte: Date } };
      };
      expect(overlapQuery.where.startDate.lte).toEqual(new Date('2026-03-31T00:00:00.000Z'));
      expect(overlapQuery.where.endDate.gte).toEqual(new Date('2025-06-01T00:00:00.000Z'));
    });

    it('refuses when no school can be determined', async () => {
      await expect(service.create(validDto, UNSCOPED_ACTOR)).rejects.toThrow(
        /No school could be determined/,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('update', () => {
    it('refuses to edit an archived year', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(
        buildYear({ status: AcademicYearStatus.ARCHIVED }),
      );

      await expect(service.update('year-1', { name: 'X' }, ACTOR)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.academicYear.update).not.toHaveBeenCalled();
    });

    it('keeps the untouched date when only one is supplied', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(buildYear());
      prisma.academicYear.findFirst.mockResolvedValue(null);
      prisma.academicYear.update.mockResolvedValue(buildYear());

      await service.update('year-1', { endDate: '2026-04-30' }, ACTOR);

      const args = firstArg(prisma.academicYear.update) as {
        data: { startDate: Date; endDate: Date };
      };
      expect(args.data.startDate).toEqual(new Date('2025-06-01T00:00:00.000Z'));
      expect(args.data.endDate).toEqual(new Date('2026-04-30T00:00:00.000Z'));
    });

    it('validates the combined range, not just the supplied field', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(buildYear());

      // An end date before the existing start date must still be caught.
      await expect(service.update('year-1', { endDate: '2025-01-01' }, ACTOR)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('excludes itself from the overlap check', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(buildYear());
      prisma.academicYear.findFirst.mockResolvedValue(null);
      prisma.academicYear.update.mockResolvedValue(buildYear());

      await service.update('year-1', { startDate: '2025-07-01' }, ACTOR);

      const overlapQuery = firstArg(prisma.academicYear.findFirst) as {
        where: { id: { not: string } };
      };
      expect(overlapQuery.where.id).toEqual({ not: 'year-1' });
    });

    it('404s for an unknown year', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(null);

      await expect(service.update('nope', { name: 'X' }, ACTOR)).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  describe('activate', () => {
    it('archives the previously active year and activates the target atomically', async () => {
      prisma.academicYear.findUnique
        .mockResolvedValueOnce(buildYear({ id: 'year-2' }))
        .mockResolvedValueOnce(buildYear({ id: 'year-1', status: AcademicYearStatus.ARCHIVED }));
      prisma.academicYear.findFirst.mockResolvedValue(
        buildYear({ id: 'year-1', status: AcademicYearStatus.ACTIVE }),
      );
      prisma.$transaction.mockResolvedValue([
        { count: 1 },
        buildYear({ id: 'year-2', status: AcademicYearStatus.ACTIVE, activeMarker: true }),
      ]);

      const result = await service.activate('year-2', ACTOR);

      // Both writes must be in the same transaction — never two active years,
      // never a gap with none.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.activated.status).toBe(AcademicYearStatus.ACTIVE);
      expect(result.archived?.id).toBe('year-1');
    });

    it('sets the active marker so the database enforces uniqueness', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(buildYear({ id: 'year-2' }));
      prisma.academicYear.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockResolvedValue([
        { count: 0 },
        buildYear({ id: 'year-2', status: AcademicYearStatus.ACTIVE, activeMarker: true }),
      ]);

      await service.activate('year-2', ACTOR);

      const [archiveOp, activateOp] = prisma.academicYear.updateMany.mock.calls.length
        ? [firstArg(prisma.academicYear.updateMany), firstArg(prisma.academicYear.update)]
        : [null, null];

      expect(archiveOp).toMatchObject({ data: { activeMarker: null } });
      expect(activateOp).toMatchObject({ data: { activeMarker: true } });
    });

    it('succeeds when no year was active', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(buildYear({ id: 'year-2' }));
      prisma.academicYear.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockResolvedValue([
        { count: 0 },
        buildYear({ id: 'year-2', status: AcademicYearStatus.ACTIVE }),
      ]);

      const result = await service.activate('year-2', ACTOR);

      expect(result.archived).toBeNull();
    });

    it('rejects activating an already-active year', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(
        buildYear({ status: AcademicYearStatus.ACTIVE }),
      );

      await expect(service.activate('year-1', ACTOR)).rejects.toThrow(/already active/i);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to reactivate an archived year', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(
        buildYear({ status: AcademicYearStatus.ARCHIVED }),
      );

      await expect(service.activate('year-1', ACTOR)).rejects.toThrow(/cannot be reactivated/i);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('turns a lost activation race into a clear 409', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(buildYear({ id: 'year-2' }));
      prisma.academicYear.findFirst.mockResolvedValue(null);
      // The unique index on (schoolId, activeMarker) rejected a second ACTIVE row.
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(service.activate('year-2', ACTOR)).rejects.toThrow(
        /activated at the same time/i,
      );
    });

    it('does not swallow unrelated database errors', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(buildYear({ id: 'year-2' }));
      prisma.academicYear.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockRejectedValue(new Error('connection lost'));

      await expect(service.activate('year-2', ACTOR)).rejects.toThrow('connection lost');
    });
  });

  // -------------------------------------------------------------------------
  describe('archive', () => {
    it('clears the active marker so the slot is freed', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(
        buildYear({ status: AcademicYearStatus.ACTIVE, activeMarker: true }),
      );
      prisma.academicYear.update.mockResolvedValue(
        buildYear({ status: AcademicYearStatus.ARCHIVED }),
      );

      await service.archive('year-1', ACTOR);

      const args = firstArg(prisma.academicYear.update) as {
        data: { status: string; activeMarker: null; archivedAt: Date };
      };
      expect(args.data.status).toBe(AcademicYearStatus.ARCHIVED);
      expect(args.data.activeMarker).toBeNull();
      expect(args.data.archivedAt).toBeInstanceOf(Date);
    });

    it('can archive an UPCOMING year that was never activated', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(buildYear());
      prisma.academicYear.update.mockResolvedValue(
        buildYear({ status: AcademicYearStatus.ARCHIVED }),
      );

      await expect(service.archive('year-1', ACTOR)).resolves.toBeDefined();
    });

    it('rejects archiving twice', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(
        buildYear({ status: AcademicYearStatus.ARCHIVED }),
      );

      await expect(service.archive('year-1', ACTOR)).rejects.toThrow(/already archived/i);
    });
  });

  // -------------------------------------------------------------------------
  describe('response shape', () => {
    it('returns date-only strings, not timestamps', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(buildYear());

      const result = await service.findOne('year-1');

      expect(result.startDate).toBe('2025-06-01');
      expect(result.endDate).toBe('2026-03-31');
    });

    it('flags a year containing today as current', async () => {
      const today = new Date();
      const start = new Date(today.getTime() - 86_400_000);
      const end = new Date(today.getTime() + 86_400_000);
      prisma.academicYear.findUnique.mockResolvedValue(
        buildYear({ startDate: start, endDate: end }),
      );

      expect((await service.findOne('year-1')).isCurrent).toBe(true);
    });

    it('does not flag a past year as current', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(buildYear());
      // 2025-06-01 to 2026-03-31 is in the past relative to the test clock.
      const result = await service.findOne('year-1');
      const today = new Date().toISOString().slice(0, 10);
      expect(result.isCurrent).toBe(today >= '2025-06-01' && today <= '2026-03-31');
    });
  });

  // -------------------------------------------------------------------------
  describe('findAll', () => {
    it("scopes to the caller's school", async () => {
      prisma.$transaction.mockResolvedValue([0, []]);

      await service.findAll({ page: 1, limit: 20, skip: 0, sortOrder: 'asc' } as never, ACTOR);

      const args = firstArg(prisma.academicYear.findMany) as { where: { schoolId: string } };
      expect(args.where.schoolId).toBe('school-1');
    });

    it('lets an unscoped admin see every school', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);

      await service.findAll(
        { page: 1, limit: 20, skip: 0, sortOrder: 'asc' } as never,
        UNSCOPED_ACTOR,
      );

      const args = firstArg(prisma.academicYear.findMany) as { where: Record<string, unknown> };
      expect(args.where.schoolId).toBeUndefined();
    });
  });
});
