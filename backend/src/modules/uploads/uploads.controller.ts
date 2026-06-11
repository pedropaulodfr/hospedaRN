import {
  Controller, Post, Delete, Param, UploadedFile, UseInterceptors, Body, Get, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';

@ApiTags('Uploads')
@ApiBearerAuth('JWT-auth')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly service: UploadsService) {}

  @Post('image/:folder')
  @ApiOperation({ summary: 'Upload de imagem para S3 (otimizado em WebP)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Param('folder') folder: string,
  ) {
    return this.service.uploadImage(file.buffer, file.originalname, folder);
  }

  @Post('file/:folder')
  @ApiOperation({ summary: 'Upload de arquivo para S3' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Param('folder') folder: string,
  ) {
    return this.service.uploadFile(file.buffer, file.originalname, file.mimetype, folder);
  }

  @Get('signed-url')
  @ApiOperation({ summary: 'Gera URL assinada para acesso temporário a arquivo privado' })
  getSignedUrl(@Query('key') key: string, @Query('expires') expires?: string) {
    return this.service.getSignedUrl(key, expires ? parseInt(expires) : 3600);
  }

  @Delete(':key')
  @Roles(PerfilUsuario.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Remove arquivo do S3' })
  deleteFile(@Param('key') key: string) {
    return this.service.deleteFile(key);
  }
}
