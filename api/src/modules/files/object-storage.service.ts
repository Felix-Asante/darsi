import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'node:stream';
import { ProblemException } from '../../common/errors/problem.exception.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { contentDisposition } from './file-rules.js';

const UPLOAD_URL_SECONDS = 5 * 60;
const DOWNLOAD_URL_SECONDS = 60;

/** Cloudflare R2 (or any S3 server). Every read and write goes through a short-lived presigned URL. */
@Injectable()
export class ObjectStorage {
  private readonly client: S3Client | null;
  private readonly bucket: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const endpoint = config.get('S3_ENDPOINT', { infer: true });
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.client = endpoint
      ? new S3Client({
          endpoint,
          region: config.get('S3_REGION', { infer: true }),
          forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
          credentials: {
            accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }) ?? '',
            secretAccessKey:
              config.get('S3_SECRET_ACCESS_KEY', { infer: true }) ?? '',
          },
          // R2 and other S3 servers reject the checksum parameters newer SDKs add to presigned URLs.
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
        })
      : null;
  }

  private get s3(): S3Client {
    if (!this.client) {
      throw new ProblemException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'storage_unavailable',
        'File storage is not configured',
      );
    }
    return this.client;
  }

  /** For local and test servers; production buckets are created with the infrastructure. */
  async ensureBucket(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  /** The size and type are signed, so the upload must be exactly what was declared. */
  presignUpload(
    key: string,
    contentType: string,
    size: number,
  ): Promise<string> {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
      }),
      { expiresIn: UPLOAD_URL_SECONDS },
    );
  }

  presignDownload(key: string, name: string, inline: boolean): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: contentDisposition(name, inline),
      }),
      { expiresIn: DOWNLOAD_URL_SECONDS },
    );
  }

  /** The uploaded size, or null when nothing was uploaded. */
  async size(key: string): Promise<number | null> {
    try {
      return (
        (
          await this.s3.send(
            new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
          )
        ).ContentLength ?? null
      );
    } catch {
      return null;
    }
  }

  async read(key: string): Promise<Readable> {
    const { Body } = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return Body as Readable;
  }

  async move(from: string, to: string): Promise<void> {
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: to,
        CopySource: `${this.bucket}/${from}`,
      }),
    );
    await this.remove(from);
  }

  /** For files the platform makes itself, such as report PDFs. */
  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async remove(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
