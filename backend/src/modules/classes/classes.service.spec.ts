import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AcademicYearStatus, RoleName, UserStatus } from '@prisma/client';

import { PrismaService } from '@/core/prisma/prisma.service';

import { ClassesService, type Actor } from './classes.service';

const ACTOR: Actor = { id: 'admin-1', schoolId: 'school-1' };

const firstArg = (mock: jest.Mock): unknown => (mock.mock.calls as unknown[][])[0]?.[0];

function buildClass(overrides: Record<string, unknown> = {}) {
  return {
    id: 'class-1',
    name: 'Class 10',
    level: 10,
    isActive: true,
    academicYearId: 'year-1',
    schoolId: 'school-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    sections: [],
    ...overrides,
  };
}

function buildSection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'section-1',
    name: 'A',
    capacity: 40,
    isActive: true,
    classId: 'class-1',
    classTeacher: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildTeacher(overrides: Record<string, unknown> = {}) {
  return {
    id: 'teacher-1',
    firstName: 'Asha',
    lastName: 'Rao',
    email: 'asha@school-erp.local',
    status: UserStatus.ACTIVE,
    schoolId: 'school-1',
    roles: [{ role: { name: RoleName.TEACHER } }],
    ...overrides,
  };
}

describe('ClassesService', () => {
  let service: ClassesService;
  let prisma: {
    schoolClass: Record<string, jest.Mock>;
    section: Record<string, jest.Mock>;
    academicYear: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
    auditLog: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };

  /** The happy-path academic year: active, editable. */
  const activeYear = {
    id: 'year-1',
    schoolId: 'school-1',
    status: AcademicYearStatus.ACTIVE,
    name: '2025-2026',
  };

  beforeEach(async () => {
    prisma = {
      schoolClass: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
      section: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
      academicYear: {
        findUnique: jest.fn().mockResolvedValue(activeYear),
        findUniqueOrThrow: jest.fn().mockResolvedValue(activeYear),
        findFirst: jest.fn().mockResolvedValue({ id: 'year-1' }),
      },
      user: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((ops: unknown) => Promise.resolve(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ClassesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ClassesService);
  });

  // -------------------------------------------------------------------------
  describe('createClass', () => {
    it('creates a class in the resolved academic year', async () => {
      prisma.schoolClass.create.mockResolvedValue(buildClass());

      await service.createClass({ name: 'Class 10', level: 10 }, ACTOR);

      const args = firstArg(prisma.schoolClass.create) as {
        data: { academicYearId: string; schoolId: string; level: number };
      };
      expect(args.data.academicYearId).toBe('year-1');
      expect(args.data.schoolId).toBe('school-1');
      expect(args.data.level).toBe(10);
    });

    it('falls back to the active academic year when none is given', async () => {
      prisma.schoolClass.create.mockResolvedValue(buildClass());

      await service.createClass({ name: 'Class 10', level: 10 }, ACTOR);

      expect(prisma.academicYear.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { schoolId: 'school-1', status: AcademicYearStatus.ACTIVE },
        }) as never,
      );
    });

    it('refuses when the school has no active year and none was supplied', async () => {
      prisma.academicYear.findFirst.mockResolvedValue(null);

      await expect(service.createClass({ name: 'Class 10', level: 10 }, ACTOR)).rejects.toThrow(
        /no active academic year/i,
      );
    });

    it('refuses to add a class to an archived year', async () => {
      prisma.academicYear.findUnique.mockResolvedValue({
        ...activeYear,
        status: AcademicYearStatus.ARCHIVED,
      });

      await expect(service.createClass({ name: 'Class 10', level: 10 }, ACTOR)).rejects.toThrow(
        /archived/i,
      );
      expect(prisma.schoolClass.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate class name within the same year', async () => {
      prisma.schoolClass.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.createClass({ name: 'Class 10', level: 10 }, ACTOR)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.schoolClass.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('updateClass / removeClass', () => {
    it('toggles active status', async () => {
      prisma.schoolClass.findUnique.mockResolvedValue(buildClass());
      prisma.schoolClass.update.mockResolvedValue(buildClass({ isActive: false }));

      const result = await service.updateClass('class-1', { isActive: false }, ACTOR);

      expect(result.isActive).toBe(false);
    });

    it('refuses to edit a class in an archived year', async () => {
      prisma.schoolClass.findUnique.mockResolvedValue(buildClass());
      prisma.academicYear.findUnique.mockResolvedValue({
        ...activeYear,
        status: AcademicYearStatus.ARCHIVED,
      });

      await expect(service.updateClass('class-1', { name: 'X' }, ACTOR)).rejects.toThrow(
        /archived/i,
      );
    });

    it('404s for an unknown class', async () => {
      prisma.schoolClass.findUnique.mockResolvedValue(null);

      await expect(service.updateClass('nope', { name: 'X' }, ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('records how many sections a delete removed', async () => {
      prisma.schoolClass.findUnique.mockResolvedValue(
        buildClass({ sections: [buildSection(), buildSection({ id: 'section-2', name: 'B' })] }),
      );

      await service.removeClass('class-1', ACTOR);

      expect(prisma.schoolClass.delete).toHaveBeenCalledWith({ where: { id: 'class-1' } });
      const audit = firstArg(prisma.auditLog.create) as {
        data: { metadata: { sectionsRemoved: number } };
      };
      expect(audit.data.metadata.sectionsRemoved).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  describe('createSection', () => {
    beforeEach(() => {
      prisma.schoolClass.findUnique.mockResolvedValue(buildClass());
    });

    it('creates a section with its capacity', async () => {
      prisma.section.create.mockResolvedValue(buildSection());

      await service.createSection('class-1', { name: 'A', capacity: 40 }, ACTOR);

      const args = firstArg(prisma.section.create) as {
        data: { capacity: number; classId: string; classTeacherId: null };
      };
      expect(args.data.capacity).toBe(40);
      expect(args.data.classId).toBe('class-1');
      expect(args.data.classTeacherId).toBeNull();
    });

    it('rejects a duplicate section name within the class', async () => {
      prisma.section.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createSection('class-1', { name: 'A', capacity: 40 }, ACTOR),
      ).rejects.toThrow(ConflictException);
      expect(prisma.section.create).not.toHaveBeenCalled();
    });

    it('refuses to add a section to a class in an archived year', async () => {
      prisma.academicYear.findUnique.mockResolvedValue({
        ...activeYear,
        status: AcademicYearStatus.ARCHIVED,
      });

      await expect(
        service.createSection('class-1', { name: 'A', capacity: 40 }, ACTOR),
      ).rejects.toThrow(/archived/i);
    });
  });

  // -------------------------------------------------------------------------
  describe('class teacher assignment', () => {
    beforeEach(() => {
      prisma.schoolClass.findUnique.mockResolvedValue(buildClass());
      prisma.section.create.mockResolvedValue(buildSection());
    });

    const withTeacher = { name: 'A', capacity: 40, classTeacherId: 'teacher-1' };

    it('accepts an active teacher from the same school', async () => {
      prisma.user.findFirst.mockResolvedValue(buildTeacher());

      await expect(service.createSection('class-1', withTeacher, ACTOR)).resolves.toBeDefined();
    });

    it('accepts a headmaster as class teacher', async () => {
      prisma.user.findFirst.mockResolvedValue(
        buildTeacher({ roles: [{ role: { name: RoleName.HEADMASTER } }] }),
      );

      await expect(service.createSection('class-1', withTeacher, ACTOR)).resolves.toBeDefined();
    });

    it('rejects a user without a teaching role', async () => {
      prisma.user.findFirst.mockResolvedValue(
        buildTeacher({ roles: [{ role: { name: RoleName.PARENT } }] }),
      );

      await expect(service.createSection('class-1', withTeacher, ACTOR)).rejects.toThrow(
        /must hold one of these roles/i,
      );
    });

    it('rejects an inactive teacher', async () => {
      prisma.user.findFirst.mockResolvedValue(buildTeacher({ status: UserStatus.INACTIVE }));

      await expect(service.createSection('class-1', withTeacher, ACTOR)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a teacher from a different school', async () => {
      prisma.user.findFirst.mockResolvedValue(buildTeacher({ schoolId: 'school-2' }));

      await expect(service.createSection('class-1', withTeacher, ACTOR)).rejects.toThrow(
        /different school/i,
      );
    });

    it('404s for a teacher that does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.createSection('class-1', withTeacher, ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses a teacher who already holds another section this year', async () => {
      prisma.user.findFirst.mockResolvedValue(buildTeacher());
      prisma.section.findFirst
        // section-name check passes
        .mockResolvedValueOnce(null)
        // already-assigned check finds a clash
        .mockResolvedValueOnce({ name: 'B', class: { name: 'Class 9' } });

      await expect(service.createSection('class-1', withTeacher, ACTOR)).rejects.toThrow(
        /already class teacher of Class 9 - B/,
      );
    });

    it('scopes the single-assignment rule to the academic year', async () => {
      prisma.user.findFirst.mockResolvedValue(buildTeacher());
      prisma.section.create.mockResolvedValue(buildSection());

      await service.createSection('class-1', withTeacher, ACTOR);

      const assignmentQuery = (prisma.section.findFirst.mock.calls as unknown[][])[1]?.[0] as {
        where: { class: { academicYearId: string } };
      };
      // A teacher may hold a section again in a later year.
      expect(assignmentQuery.where.class.academicYearId).toBe('year-1');
    });

    it('lets a section keep its own teacher when edited', async () => {
      prisma.section.findUnique.mockResolvedValue(buildSection());
      prisma.user.findFirst.mockResolvedValue(buildTeacher());
      prisma.section.update.mockResolvedValue(buildSection());

      await service.updateSection('section-1', { classTeacherId: 'teacher-1' }, ACTOR);

      const assignmentQuery = (prisma.section.findFirst.mock.calls as unknown[][])[0]?.[0] as {
        where: { id: { not: string } };
      };
      expect(assignmentQuery.where.id).toEqual({ not: 'section-1' });
    });
  });

  // -------------------------------------------------------------------------
  describe('updateSection', () => {
    beforeEach(() => {
      prisma.section.findUnique.mockResolvedValue(buildSection());
      prisma.schoolClass.findUnique.mockResolvedValue(buildClass());
      prisma.section.update.mockResolvedValue(buildSection());
    });

    it('leaves the teacher untouched when classTeacherId is absent', async () => {
      await service.updateSection('section-1', { capacity: 45 }, ACTOR);

      const args = firstArg(prisma.section.update) as { data: Record<string, unknown> };
      expect('classTeacherId' in args.data).toBe(false);
    });

    it('unassigns the teacher when classTeacherId is explicitly null', async () => {
      await service.updateSection('section-1', { classTeacherId: null }, ACTOR);

      const args = firstArg(prisma.section.update) as { data: { classTeacherId: null } };
      expect(args.data.classTeacherId).toBeNull();
      // No eligibility check is needed to clear an assignment.
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('404s for an unknown section', async () => {
      prisma.section.findUnique.mockResolvedValue(null);

      await expect(service.updateSection('nope', { capacity: 40 }, ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('response shape', () => {
    it('sums capacity across active sections only', async () => {
      prisma.schoolClass.findUnique.mockResolvedValue(
        buildClass({
          sections: [
            buildSection({ id: 's1', name: 'A', capacity: 40 }),
            buildSection({ id: 's2', name: 'B', capacity: 35 }),
            // Not taking students, so it must not inflate the total.
            buildSection({ id: 's3', name: 'C', capacity: 30, isActive: false }),
          ],
        }),
      );

      const result = await service.findOne('class-1');

      expect(result.sectionCount).toBe(3);
      expect(result.totalCapacity).toBe(75);
    });

    it('reports zero capacity for a class with no sections', async () => {
      prisma.schoolClass.findUnique.mockResolvedValue(buildClass());

      const result = await service.findOne('class-1');

      expect(result.sectionCount).toBe(0);
      expect(result.totalCapacity).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('listEligibleTeachers', () => {
    it('flags teachers who already hold a section', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 't1',
          firstName: 'Asha',
          lastName: 'Rao',
          email: 'a@x.io',
          classTeacherOf: [{ name: 'B', class: { name: 'Class 9' } }],
        },
        {
          id: 't2',
          firstName: 'Ravi',
          lastName: 'Kumar',
          email: 'r@x.io',
          classTeacherOf: [],
        },
      ]);

      const result = await service.listEligibleTeachers('year-1', ACTOR);

      expect(result[0]).toMatchObject({ isAssigned: true, assignedTo: 'Class 9 - B' });
      expect(result[1]).toMatchObject({ isAssigned: false, assignedTo: null });
    });

    it('only considers active staff at the same school', async () => {
      await service.listEligibleTeachers('year-1', ACTOR);

      const args = firstArg(prisma.user.findMany) as {
        where: { status: string; schoolId: string; deletedAt: null };
      };
      expect(args.where.status).toBe(UserStatus.ACTIVE);
      expect(args.where.schoolId).toBe('school-1');
      expect(args.where.deletedAt).toBeNull();
    });
  });
});
