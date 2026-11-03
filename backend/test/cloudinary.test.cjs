const { test } = require("node:test");
const assert = require("node:assert/strict");
require("dotenv/config");

test("Cloudinary photo uploads, signed delivery and durable cleanup", async (t) => {
  const { v2: sdk } = require("cloudinary");
  const { CloudinaryService } = require("../dist/property/cloudinary.service");
  const { config } = require("../dist/config");
  // Never use real credentials in assertions, mock responses or unit-test delivery URLs.
  const originalConfig = {
    cloud: config.CLOUDINARY_CLOUD_NAME,
    key: config.CLOUDINARY_API_KEY,
    secret: config.CLOUDINARY_API_SECRET,
  };
  Object.assign(config, {
    CLOUDINARY_CLOUD_NAME: "test-cloud",
    CLOUDINARY_API_KEY: "test-key",
    CLOUDINARY_API_SECRET: "test-secret",
  });
  const originalUpload = sdk.uploader.upload,
    originalDestroy = sdk.uploader.destroy;
  const jobs = new Map(),
    calls = [];
  let attached = false;
  let failDelete = false;
  const db = {
    cloudinaryCleanup: {
      create: async ({ data }) => {
        jobs.set(data.publicId, data);
      },
      findMany: async () => [...jobs.values()],
      deleteMany: async ({ where }) => {
        jobs.delete(where.publicId);
      },
    },
    plotAsset: { findUnique: async () => (attached ? { id: "saved-file" } : null) },
  };
  sdk.uploader.upload = async (file, options) => {
    calls.push({ file, options });
    return {
      public_id: options.public_id,
      secure_url: "https://res.cloudinary.com/test-cloud/image/authenticated/photo.png",
      format: "png",
      version: 1,
    };
  };
  sdk.uploader.destroy = async (id, options) => {
    calls.push({ destroy: id, options });
    if (failDelete) throw new Error("Unavailable");
    return { result: "ok" };
  };
  try {
    const service = new CloudinaryService(db);
    await t.test("uploads use server-generated ids and authenticated originals", async () => {
      const photo = await service.uploadPhoto(Buffer.from("test-image"), "image/png");
      assert.ok(photo.publicId.startsWith("mirai/plots/"));
      assert.equal(jobs.size, 1);
      assert.equal(calls[0].options.type, "authenticated");
      assert.equal(calls[0].options.overwrite, false);
      assert.equal(calls[0].file, "data:image/png;base64,dGVzdC1pbWFnZQ==");
      const url = service.deliveryUrl({
        cloudinaryPublicId: photo.publicId,
        cloudinaryFormat: photo.format,
        cloudinaryVersion: photo.version,
      });
      assert.match(url, /https:\/\/res\.cloudinary\.com\/test-cloud\/image\/authenticated\/s--/);
      assert.ok(!url.includes("test-secret"));
    });
    await t.test(
      "failed remote deletion stays queued; retries remove only orphaned files",
      async () => {
        failDelete = true;
        await service.cleanup();
        assert.equal(jobs.size, 1);
        failDelete = false;
        await service.cleanup();
        assert.equal(jobs.size, 0);
        assert.ok(calls.find((c) => c.destroy)?.options.invalidate);
      },
    );
    await t.test("a committed photo is never deleted when an upload response is lost", async () => {
      await service.uploadPhoto(Buffer.from("test-image"), "image/png");
      attached = true;
      const before = calls.filter((c) => c.destroy).length;
      await service.cleanup();
      assert.equal(jobs.size, 0);
      assert.equal(calls.filter((c) => c.destroy).length, before);
      attached = false;
    });
    await t.test("upload errors retain their cleanup lease and hide provider details", async () => {
      sdk.uploader.upload = async () => {
        throw new Error("private-provider-detail");
      };
      await assert.rejects(
        service.uploadPhoto(Buffer.from("test-image"), "image/png"),
        (error) =>
          error.message.includes("Please try again") &&
          !error.message.includes("private-provider-detail"),
      );
      assert.equal(jobs.size, 1);
    });
  } finally {
    sdk.uploader.upload = originalUpload;
    sdk.uploader.destroy = originalDestroy;
    Object.assign(config, {
      CLOUDINARY_CLOUD_NAME: originalConfig.cloud,
      CLOUDINARY_API_KEY: originalConfig.key,
      CLOUDINARY_API_SECRET: originalConfig.secret,
    });
  }
});
