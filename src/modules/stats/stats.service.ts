import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DashboardCounts {
  pages: number;
  projects: number;
  blogPosts: number;
  skills: number;
  experience: number;
  education: number;
  achievements: number;
  media: number;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all content counts in a single round-trip
   * (one DB transaction instead of N list queries).
   */
  async getCounts(): Promise<DashboardCounts> {
    const [pages, projects, blogPosts, skills, experience, education, achievements, media] =
      await this.prisma.$transaction([
        this.prisma.page.count(),
        this.prisma.project.count(),
        this.prisma.blogPost.count(),
        this.prisma.skill.count(),
        this.prisma.experience.count(),
        this.prisma.education.count(),
        this.prisma.achievement.count(),
        this.prisma.media.count(),
      ]);

    return { pages, projects, blogPosts, skills, experience, education, achievements, media };
  }
}
