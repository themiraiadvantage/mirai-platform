require("dotenv/config");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaService } = require("../dist/database/prisma.service");
const { CloudinaryService } = require("../dist/property/cloudinary.service");
const db = new PrismaService();
const cloud = new CloudinaryService(db);
(async () => {
  let photo;
  let stage = "upload";
  const checks = {};
  try {
    // Use the existing MIRAI logo for a temporary, authenticated upload check.
    photo = await cloud.uploadPhoto(
      fs.readFileSync(path.join(__dirname, "../assets/mirai-logo-no-tagline.png")),
      "image/png",
    );
    const url = cloud.deliveryUrl({
      cloudinaryPublicId: photo.publicId,
      cloudinaryFormat: photo.format,
      cloudinaryVersion: photo.version,
    });
    stage = "signed delivery";
    const response = await fetch(url, {
      headers: { Origin: new URL(require("../dist/config").config.FRONTEND_URL).origin },
      signal: AbortSignal.timeout(20000),
    });
    checks.signedStatus = response.status;
    checks.browserAccessAllowed =
      response.headers.get("Access-Control-Allow-Origin") === "*" ||
      response.headers.get("Access-Control-Allow-Origin") ===
        new URL(require("../dist/config").config.FRONTEND_URL).origin;
    if (
      !response.ok ||
      !response.headers.get("Content-Type")?.startsWith("image/") ||
      !(await response.arrayBuffer()).byteLength
    )
      throw new Error("Delivery failed");
    if (!checks.browserAccessAllowed) throw new Error("Browser delivery is unavailable");
    stage = "unsigned original restriction";
    // Cloudinary can return an already-signed secure_url for authenticated uploads.
    const unsignedUrl = photo.url.replace(/\/s--[^/]+--\//, "/");
    const unsigned = await fetch(unsignedUrl, { signal: AbortSignal.timeout(20000) });
    checks.unsignedStatus = unsigned.status;
    await unsigned.body?.cancel();
    if (unsigned.ok) throw new Error("Unsigned original must be restricted");
    console.log(
      "Cloudinary upload and signed image delivery verified; unsigned original is restricted.",
    );
  } catch {
    console.error(JSON.stringify({ error: "Cloudinary verification failed", stage, ...checks }));
    process.exitCode = 1;
  } finally {
    if (photo) {
      try {
        await db.cloudinaryCleanup.update({
          where: { publicId: photo.publicId },
          data: { notBefore: new Date() },
        });
        await cloud.cleanup();
        if (await db.cloudinaryCleanup.findUnique({ where: { publicId: photo.publicId } }))
          throw new Error();
        console.log("Temporary test image removed from Cloudinary.");
      } catch {
        console.error("Temporary image cleanup is queued for retry.");
        process.exitCode = 1;
      }
    }
    await db.$disconnect();
  }
})();
