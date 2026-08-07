import { Module, type MiddlewareConsumer, type NestModule, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AllExceptionsFilter } from './common/filters';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import {
  LoggingInterceptor,
  TimeoutInterceptor,
  TransformInterceptor,
} from './common/interceptors';
import { RequestIdMiddleware } from './common/middleware';
import { type AppConfig, configurations, validateEnv } from './config';
import { HealthModule } from './core/health';
import { LoggerModule } from './core/logger';
import { MailModule } from './core/mail';
import { PrismaModule } from './core/prisma';
import { AcademicYearsModule } from './modules/academic-years/academic-years.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClassesModule } from './modules/classes/classes.module';
import { MediumsModule } from './modules/mediums/mediums.module';
import { ParentsModule } from './modules/parents/parents.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ExamsModule } from './modules/exams/exams.module';
import { RolesModule } from './modules/roles/roles.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { StudentsModule } from './modules/students/students.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { UsersModule } from './modules/users/users.module';

/**
 * Composition root.
 *
 * Cross-cutting concerns are registered once here as APP_* providers, so a new
 * feature module inherits validation, auth, RBAC, logging, and error handling
 * by simply being added to `imports`.
 */
@Module({
  imports: [
    // --- Configuration: validated once, available everywhere ---------------
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: configurations,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),

    // --- Infrastructure ----------------------------------------------------
    LoggerModule,
    PrismaModule,
    MailModule,

    // --- Rate limiting -----------------------------------------------------
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { ttl, limit } = config.get('throttle', { infer: true });
        return { throttlers: [{ ttl, limit }] };
      },
    }),

    // --- Platform modules --------------------------------------------------
    HealthModule,
    AuthModule,

    // --- Feature modules ---------------------------------------------------
    UsersModule,
    SchoolsModule,
    RolesModule,
    AcademicYearsModule,
    ClassesModule,
    MediumsModule,
    SubjectsModule,
    TeachersModule,
    StudentsModule,
    ParentsModule,
    TimetableModule,
    AttendanceModule,
    ExamsModule,
    // Add them here as they are built, e.g.:
    // StudentsModule, StaffModule, AcademicsModule, AttendanceModule, FeesModule,
  ],
  providers: [
    // Global validation — DTOs are the contract; anything not declared is rejected.
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: false },
          stopAtFirstError: false,
          validationError: { target: false, value: false },
        }),
    },

    // Uniform error shape for every failure path.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },

    // Order matters: logging wraps timing, transform shapes the payload last.
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },

    // Auth first, then authorization, then rate limiting.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
