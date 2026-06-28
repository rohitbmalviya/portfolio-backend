import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';

// ── Feature modules ───────────────────────────────────────────────────────
import { AuthModule } from './modules/auth/auth.module';
import { PagesModule } from './modules/pages/pages.module';
import { SectionsModule } from './modules/sections/sections.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { BlogModule } from './modules/blog/blog.module';
import { SkillsModule } from './modules/skills/skills.module';
import { ExperienceModule } from './modules/experience/experience.module';
import { EducationModule } from './modules/education/education.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { SettingsModule } from './modules/settings/settings.module';
import { MediaModule } from './modules/media/media.module';
import { HealthModule } from './modules/health/health.module';
import { StatsModule } from './modules/stats/stats.module';
import { ConfigFeatureModule } from './modules/config/config.module';
import { ContactModule } from './modules/contact/contact.module';

@Module({
  imports: [
    // Config (global — available everywhere via ConfigService)
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting (global via APP_GUARD below)
    // Default: 120 requests per 60 seconds per IP. Auth routes override to 5/min.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),

    // Cron scheduler (used by ContactSyncTask for Gmail polling)
    ScheduleModule.forRoot(),

    // Data layer (global — PrismaService injected without re-importing)
    PrismaModule,

    // ── Feature modules ──────────────────────────────────────────────────
    AuthModule,
    PagesModule,
    SectionsModule,
    ProjectsModule,
    BlogModule,
    SkillsModule,
    ExperienceModule,
    EducationModule,
    AchievementsModule,
    SettingsModule,
    MediaModule,
    HealthModule,
    StatsModule,
    ConfigFeatureModule,
    ContactModule,
  ],
  providers: [
    // Apply ThrottlerGuard globally to all routes
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
