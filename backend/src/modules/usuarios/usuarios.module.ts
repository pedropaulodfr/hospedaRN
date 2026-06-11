import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './usuarios.controller';
import { UsersService } from './usuarios.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
