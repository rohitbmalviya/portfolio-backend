import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { CloudinaryProvider } from './cloudinary.provider';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MediaController],
  providers: [MediaService, CloudinaryProvider],
  // Export CloudinaryProvider so other modules can inject it for direct uploads if needed
  exports: [CloudinaryProvider],
})
export class MediaModule {}
