/**
 * Feature module barrel.
 *
 * Each feature lives in `src/modules/<feature>/` and owns its controllers,
 * services, DTOs, and entities. Register new modules in AppModule's `imports`
 * and export them here.
 *
 * Suggested layout for a new module:
 *   modules/students/
 *     ├── dto/
 *     ├── entities/
 *     ├── students.controller.ts
 *     ├── students.service.ts
 *     ├── students.module.ts
 *     └── index.ts
 */
export * from './auth/auth.module';
