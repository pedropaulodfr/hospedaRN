import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

export interface UploadResult {
  url: string;
  s3Key: string;
  bucket: string;
  size?: number;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly baseUrl: string;

  constructor(private config: ConfigService) {
    this.s3Client = new S3Client({
      region: config.get<string>('AWS_REGION', 'sa-east-1'),
      credentials: {
        accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
    this.bucket = config.get<string>('AWS_S3_BUCKET', 'hospedarn-uploads');
    this.baseUrl = config.get<string>('AWS_S3_BASE_URL', '');
  }

  async uploadImage(
    buffer: Buffer,
    originalName: string,
    folder: string,
    optimize = true,
  ): Promise<UploadResult> {
    const ext = 'webp';
    const s3Key = `${folder}/${randomUUID()}.${ext}`;

    let processedBuffer = buffer;
    if (optimize) {
      processedBuffer = await sharp(buffer)
        .resize(1200, 900, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: processedBuffer,
        ContentType: 'image/webp',
        CacheControl: 'max-age=31536000',
      }),
    );

    const url = `${this.baseUrl}/${s3Key}`;
    this.logger.log(`Uploaded: ${s3Key}`);

    return { url, s3Key, bucket: this.bucket, size: processedBuffer.length };
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    contentType: string,
    folder: string,
  ): Promise<UploadResult> {
    const ext = originalName.split('.').pop() || 'bin';
    const s3Key = `${folder}/${randomUUID()}.${ext}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const url = `${this.baseUrl}/${s3Key}`;
    return { url, s3Key, bucket: this.bucket, size: buffer.length };
  }

  async getSignedUrl(s3Key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  async deleteFile(s3Key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      }),
    );
    this.logger.log(`Deleted: ${s3Key}`);
  }

  async getPresignedUploadUrl(folder: string, contentType: string, expiresIn = 300) {
    const ext = contentType.split('/')[1] || 'bin';
    const s3Key = `${folder}/${randomUUID()}.${ext}`;

    const { createPresignedPost } = await import('@aws-sdk/s3-presigned-post');

    const { url, fields } = await createPresignedPost(this.s3Client, {
      Bucket: this.bucket,
      Key: s3Key,
      Conditions: [
        ['content-length-range', 0, 10 * 1024 * 1024], // 10MB max
        ['starts-with', '$Content-Type', 'image/'],
      ],
      Expires: expiresIn,
    });

    return { url, fields, s3Key };
  }
}
