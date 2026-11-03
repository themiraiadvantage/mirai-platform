import { BadRequestException } from "@nestjs/common";
export function validateAssetBytes(data: { base64: string; mime: string; kind: string }) {
  const bytes = Buffer.from(data.base64, "base64");
  if (!bytes.length || bytes.length > 5 * 1024 * 1024 || bytes.toString("base64") !== data.base64)
    throw new BadRequestException("Use a valid file up to 5 MB.");
  const valid =
    data.mime === "application/pdf"
      ? bytes.subarray(0, 5).toString() === "%PDF-"
      : data.mime === "image/png"
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : data.mime === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : data.mime === "image/webp" &&
            bytes.subarray(0, 4).toString() === "RIFF" &&
            bytes.subarray(8, 12).toString() === "WEBP";
  if (!valid || (data.kind === "PHOTO" && data.mime === "application/pdf"))
    throw new BadRequestException("The file does not match the selected file type.");
  return bytes;
}
