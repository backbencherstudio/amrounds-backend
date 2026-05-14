import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorage } from './iStorage';
import { DiskOption } from '../Option';
import { Readable } from 'stream';

/**
 * S3Adapter for s3 bucket storage
 */
export class S3Adapter implements IStorage {
  private _config: DiskOption;
  private s3: S3Client;

  constructor(config: DiskOption) {
    this._config = config;
    this.s3 = new S3Client({
      endpoint: this._config.connection.awsEndpoint,
      region: this._config.connection.awsDefaultRegion,
      credentials: {
        accessKeyId: this._config.connection.awsAccessKeyId,
        secretAccessKey: this._config.connection.awsSecretAccessKey,
      },
      forcePathStyle: !!this._config.connection.minio,
    });
  }

  /**
   * returns object url
   * @param key
   * @returns
   */
  async url(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this._config.connection.awsBucket,
      Key: key,
      // ResponseContentType: 'image/jpeg',
    });

    // sign url for 7 days (604800 seconds)
    return await getSignedUrl(this.s3, command, { expiresIn: 604800 });
  }

  /**
   * check if file exists
   * @param key
   * @returns
   */
  async isExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this._config.connection.awsBucket,
        Key: key,
      });
      await this.s3.send(command);
      return true;
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * get data
   * @param key
   */
  async get(key: string) {
    try {
      const command = new GetObjectCommand({
        Bucket: this._config.connection.awsBucket,
        Key: key,
      });
      const response = await this.s3.send(command);
      return response.Body as Readable;
    } catch (error) {
      throw new Error(`Failed to get object ${key}: ${error}`);
    }
  }

  /**
   * put data
   * @param key
   * @param value
   */
  async put(key: string, value: Buffer | Uint8Array | string): Promise<any> {
    try {
      const command = new PutObjectCommand({
        Bucket: this._config.connection.awsBucket,
        Key: key,
        Body: value,
      });
      const response = await this.s3.send(command);
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * delete data
   * @param key
   */
  async delete(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this._config.connection.awsBucket,
        Key: key,
      });
      await this.s3.send(command);
      return true;
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }
}
