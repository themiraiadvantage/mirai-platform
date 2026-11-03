import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export async function createBrandIcon(size: number) {
  const image = await readFile(join(process.cwd(), "public/brand/mirai-logo-no-tagline.png"));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={`data:image/png;base64,${image.toString("base64")}`}
        width={size}
        height={size}
        alt=""
        style={{ objectFit: "contain" }}
      />
    </div>,
    { width: size, height: size },
  );
}
