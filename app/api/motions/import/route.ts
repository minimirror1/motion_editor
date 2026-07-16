import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { assertCsvName, ensureMotionRoot, resolveSafeMotionPath } from "@/lib/motionDir";

// 업로드된 라이브러리 zip의 csv/csv.meta.json 엔트리를 MOTION_DIR에 기록한다 (export와 쌍).
// 엔트리 이름은 basename으로 평탄화 후 assertCsvName + resolveSafeMotionPath로 검증해
// zip slip / path traversal을 차단하고, 대상 외 확장자는 건너뛴다.
export async function POST(request: NextRequest) {
  try {
    ensureMotionRoot();

    const body = await request.arrayBuffer();
    if (body.byteLength === 0) {
      return NextResponse.json({ error: "empty request body" }, { status: 400 });
    }

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(body);
    } catch {
      return NextResponse.json({ error: "not a valid zip file" }, { status: 400 });
    }

    const added: string[] = [];
    const overwritten: string[] = [];
    const skipped: string[] = [];

    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;

      // OS 폴더 압축 시 생기는 상위 폴더 경로를 벗겨 파일명만 사용한다.
      const baseName = path.basename(entry.name);
      const lowerName = baseName.toLowerCase();

      if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".csv.meta.json")) {
        skipped.push(entry.name);
        continue;
      }

      assertCsvName(baseName);
      const resolved = resolveSafeMotionPath(baseName);
      const existed = fs.existsSync(resolved);
      const content = await entry.async("nodebuffer");

      fs.writeFileSync(resolved, content);
      (existed ? overwritten : added).push(baseName);
    }

    if (added.length === 0 && overwritten.length === 0) {
      return NextResponse.json({ error: "no csv/meta entries found in zip" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, added, overwritten, skipped });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
