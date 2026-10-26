import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import {
  validateKey,
  uploadSpec,
  checkMagic,
  UploadError,
  type UploadKind,
} from "./storage-rules";
export function r2Driver(
  client: S3Client,
  bucket: string,
  sign: typeof getSignedUrl = getSignedUrl,
) {
  return {
    async put(key: string, body: Uint8Array, type: string) {
      validateKey(key);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: type,
        }),
      );
    },
    async read(key: string) {
      validateKey(key);
      const result = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (!result.Body) throw new UploadError("الملف مش موجود");
      return Buffer.from(await result.Body.transformToByteArray());
    },
    async remove(key: string) {
      validateKey(key);
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async upload(userId: string, kind: UploadKind, size: number, type: string) {
      const ext = uploadSpec(kind, size, type);
      const key = validateKey(
        "pending/" + userId + "/" + randomUUID() + "." + ext,
      );
      const url = await sign(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: type,
          ContentLength: size,
        }),
        {
          expiresIn: 300,
          signableHeaders: new Set(["content-type", "content-length"]),
        },
      );
      return { key, url };
    },
    async finalize(
      userId: string,
      key: string,
      folder: string,
      kind: UploadKind,
    ) {
      validateKey(key);
      validateKey(folder + "/validation.png");
      if (!key.startsWith("pending/" + userId + "/"))
        throw new UploadError("الملف مش بتاعك");
      let finalKey: string | undefined;
      try {
        const head = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        const type = head.ContentType || "";
        const ext = uploadSpec(kind, head.ContentLength || 0, type);
        const first = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            Range: "bytes=0-15",
            IfMatch: head.ETag,
          }),
        );
        if (!first.Body) throw new UploadError("الملف مش موجود");
        checkMagic(await first.Body.transformToByteArray(), type);
        finalKey = validateKey(folder + "/" + randomUUID() + "." + ext);
        await client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            Key: finalKey,
            CopySource: bucket + "/" + key,
            CopySourceIfMatch: head.ETag,
          }),
        );
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: key }),
        );
        return finalKey;
      } catch {
        if (finalKey)
          await client
            .send(new DeleteObjectCommand({ Bucket: bucket, Key: finalKey }))
            .catch(() => {});
        await client
          .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
          .catch(() => {});
        throw new UploadError("رفع الملف فشل، ارفعه تاني");
      }
    },
    async download(key: string, inline = false) {
      validateKey(key);
      return sign(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentDisposition: inline ? "inline" : "attachment",
          ResponseCacheControl: "private, no-store",
        }),
        { expiresIn: 60 },
      );
    },
  };
}
let cached: ReturnType<typeof r2Driver> | undefined;
export function r2() {
  if (!cached) {
    const client = new S3Client({
      region: "auto",
      forcePathStyle: true,
      endpoint:
        "https://" + process.env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
    cached = r2Driver(client, process.env.R2_BUCKET!);
  }
  return cached;
}
