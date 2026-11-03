import { readFileSync } from "node:fs";
import { join } from "node:path";

const brandLogo = readFileSync(join(__dirname, "../../assets/mirai-logo-white-email.png"));
export const brandLogoDataUrl = `data:image/png;base64,${brandLogo.toString("base64")}`;

export function withBrandLogo<T extends { html: string }>(message: T) {
  return {
    ...message,
    html: message.html.replaceAll(brandLogoDataUrl, "cid:mirai-brand-logo"),
    attachments: [
      {
        filename: "mirai-logo-white-email.png",
        content: brandLogo,
        cid: "mirai-brand-logo",
        contentType: "image/png",
        contentDisposition: "inline" as const,
      },
    ],
  };
}
