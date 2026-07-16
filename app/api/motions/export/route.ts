import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { ensureMotionRoot } from "@/lib/motionDir";

// MOTION_DIR의 모든 csv + csv.meta.json을 zip 하나로 묶어 내려준다.
// 다른 PC의 로컬 설치로 라이브러리 전체를 옮길 때(import와 쌍) 사용.
export async function GET() {
  try {
    const root = ensureMotionRoot();
    const zip = new JSZip();
    const entries = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => {
        if (!entry.isFile()) return false;
        const lowerName = entry.name.toLowerCase();
        return lowerName.endsWith(".csv") || lowerName.endsWith(".csv.meta.json");
      });

    for (const entry of entries) {
      zip.file(entry.name, fs.readFileSync(path.join(root, entry.name)));
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="motion-library-${stamp}.zip"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
