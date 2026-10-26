import test from "node:test";
import assert from "node:assert/strict";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Driver } from "../../src/lib/r2";
test("private R2 presigned flow validates a 40 MB zip using an injected fake S3 client", async () => {
  const objects = new Map<string, { body: Buffer; type: string }>();
  const calls: object[] = [];
  let failCopy = false;
  const client = {
    async send(command: object) {
      calls.push(command);
      if (command instanceof PutObjectCommand) {
        objects.set(command.input.Key!, {
          body: Buffer.from(command.input.Body as Uint8Array),
          type: command.input.ContentType!,
        });
        return {};
      }
      if (command instanceof HeadObjectCommand) {
        const o = objects.get(command.input.Key!);
        if (!o) throw Error("missing");
        return {
          ContentLength: o.body.length,
          ContentType: o.type,
          ETag: "fake-etag",
        };
      }
      if (command instanceof GetObjectCommand) {
        const o = objects.get(command.input.Key!);
        if (!o) throw Error("missing");
        return {
          Body: {
            transformToByteArray: async () =>
              command.input.Range ? o.body.subarray(0, 16) : o.body,
          },
        };
      }
      if (command instanceof CopyObjectCommand) {
        if (failCopy) throw Error("failed");
        assert.equal(command.input.CopySourceIfMatch, "fake-etag");
        const source = command.input.CopySource!.slice("private/".length);
        objects.set(command.input.Key!, objects.get(source)!);
        return {};
      }
      if (command instanceof DeleteObjectCommand) {
        objects.delete(command.input.Key!);
        return {};
      }
      throw Error("unexpected command");
    },
  } as unknown as S3Client;
  const signed: {
    command: PutObjectCommand | GetObjectCommand;
    options: Record<string, unknown>;
  }[] = [];
  const signer = (async (
    _client: unknown,
    command: PutObjectCommand | GetObjectCommand,
    options: Record<string, unknown>,
  ) => {
    signed.push({ command, options });
    return "https://private.example.test/signed";
  }) as unknown as typeof getSignedUrl;
  const driver = r2Driver(client, "private", signer);
  const pending = await driver.upload(
    "owner",
    "product",
    40 * 1024 * 1024,
    "application/zip",
  );
  assert.equal(
    (signed[0].command as PutObjectCommand).input.ContentType,
    "application/zip",
  );
  assert.equal(
    (signed[0].command as PutObjectCommand).input.ContentLength,
    40 * 1024 * 1024,
  );
  assert.equal(signed[0].options.expiresIn, 300);
  assert.deepEqual(
    signed[0].options.signableHeaders,
    new Set(["content-type", "content-length"]),
  );
  const zip = Buffer.alloc(40 * 1024 * 1024);
  zip.set([80, 75, 3, 4]);
  objects.set(pending.key, { body: zip, type: "application/zip" });
  await assert.rejects(
    driver.finalize("stranger", pending.key, "products/seller", "product"),
  );
  assert.ok(objects.has(pending.key));
  const key = await driver.finalize(
    "owner",
    pending.key,
    "products/seller",
    "product",
  );
  assert.ok(!objects.has(pending.key));
  assert.equal((await driver.read(key)).length, zip.length);
  await driver.download(key);
  assert.equal(signed[1].options.expiresIn, 60);
  const download = signed[1].command as GetObjectCommand;
  assert.equal(download.input.ResponseContentDisposition, "attachment");
  assert.equal(download.input.ResponseCacheControl, "private, no-store");
  await driver.download(key, true);
  assert.equal(
    (signed[2].command as GetObjectCommand).input.ResponseContentDisposition,
    "inline",
  );
  const before = calls.length;
  await assert.rejects(driver.read("../secret"));
  assert.equal(calls.length, before);
  for (const [body, type] of [
    [Buffer.from("not an image"), "image/png"],
    [zip, "image/png"],
  ] as const) {
    const upload = await driver.upload("owner", "chat", 100, type);
    objects.set(upload.key, { body, type });
    await assert.rejects(
      driver.finalize("owner", upload.key, "chat/order", "chat"),
    );
    assert.ok(!objects.has(upload.key));
  }
  const failed = await driver.upload(
    "owner",
    "product",
    zip.length,
    "application/zip",
  );
  objects.set(failed.key, { body: zip, type: "application/zip" });
  failCopy = true;
  await assert.rejects(
    driver.finalize("owner", failed.key, "products/seller", "product"),
  );
  assert.ok(!objects.has(failed.key));
  await driver.remove(key);
  assert.ok(!objects.has(key));
});

test("real SDK signer binds PUT size/type and short GET lifetime without network", async () => {
  const client = new S3Client({
    region: "auto",
    endpoint: "https://testaccount.r2.cloudflarestorage.com",
    forcePathStyle: true,
    credentials: { accessKeyId: "dummy-key", secretAccessKey: "dummy-secret" },
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  const driver = r2Driver(client, "private");
  const upload = await driver.upload(
    "owner",
    "product",
    40 * 1024 * 1024,
    "application/zip",
  );
  const put = new URL(upload.url);
  assert.equal(put.hostname, "testaccount.r2.cloudflarestorage.com");
  assert.equal(put.searchParams.get("X-Amz-Expires"), "300");
  for (const header of ["content-length", "content-type"])
    assert.ok(
      put.searchParams.get("X-Amz-SignedHeaders")?.split(";").includes(header),
    );
  const get = new URL(await driver.download("products/seller/file.zip"));
  assert.equal(get.searchParams.get("X-Amz-Expires"), "60");
  assert.equal(
    get.searchParams.get("response-cache-control"),
    "private, no-store",
  );
  client.destroy();
});
