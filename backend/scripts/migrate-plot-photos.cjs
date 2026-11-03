// Move existing plot photos to Cloudinary. Listing/private documents remain private database files.
require("dotenv/config");
const { PrismaService } = require("../dist/database/prisma.service");
const { CloudinaryService } = require("../dist/property/cloudinary.service");
const db = new PrismaService();
const cloud = new CloudinaryService(db);
(async () => {
  let migrated = 0;
  try {
    for (;;) {
      const asset = await db.plotAsset.findFirst({
        where: { kind: "PHOTO", cloudinaryPublicId: null },
        orderBy: { id: "asc" },
      });
      if (!asset) break;
      if (!asset.data) throw new Error("A stored photo has no file data.");
      const photo = await cloud.uploadPhoto(Buffer.from(asset.data), asset.mime);
      await db.$transaction(async (tx) => {
        const result = await tx.plotAsset.updateMany({
          where: { id: asset.id, cloudinaryPublicId: null },
          data: {
            data: null,
            cloudinaryPublicId: photo.publicId,
            cloudinaryUrl: photo.url,
            cloudinaryFormat: photo.format,
            cloudinaryVersion: photo.version,
          },
        });
        if (result.count) {
          await tx.cloudinaryCleanup.deleteMany({ where: { publicId: photo.publicId } });
          migrated++;
        }
      });
    }
    console.log(
      JSON.stringify({
        migrated,
        remaining: await db.plotAsset.count({ where: { kind: "PHOTO", cloudinaryPublicId: null } }),
      }),
    );
  } catch {
    console.error(
      "Photo migration did not finish. Existing files are preserved; the script can be run again.",
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
})();
