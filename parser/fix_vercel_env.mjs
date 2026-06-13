// Vercel REST API로 환경변수를 직접 등록/검증한다.
// PowerShell 파이프/CLI 비대화형 입력의 인코딩 문제를 우회하기 위한 스크립트.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const AUTH = join(homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json");
const token = JSON.parse(readFileSync(AUTH, "utf8")).token;
if (!token) throw new Error("auth.json에서 토큰을 찾지 못함");

const PROJECT = "xhrrace";
const VARS = {
  NEXT_PUBLIC_SUPABASE_URL: "https://nleeacvlyirlbiqkgqoa.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_T_UIPmkBWOlWqZdHLi1aeg_aQC6_szE",
};

async function api(method, path, body) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

// 1) 기존 SUPABASE 변수 전부 제거
const { envs } = await api("GET", `/v9/projects/${PROJECT}/env`);
for (const e of envs.filter((e) => e.key.includes("SUPABASE"))) {
  await api("DELETE", `/v9/projects/${PROJECT}/env/${e.id}`);
  console.log(`삭제: ${e.key} (${e.id})`);
}

// 2) 깨끗한 값으로 재등록 (production + preview)
for (const [key, value] of Object.entries(VARS)) {
  await api("POST", `/v10/projects/${PROJECT}/env`, {
    key,
    value,
    type: "encrypted",
    target: ["production", "preview"],
  });
  console.log(`등록: ${key} (len=${value.length})`);
}

// 3) 검증: 복호화해 길이·첫 문자코드 확인
const after = await api("GET", `/v9/projects/${PROJECT}/env`);
for (const e of after.envs.filter((e) => e.key.includes("SUPABASE"))) {
  const d = await api("GET", `/v9/projects/${PROJECT}/env/${e.id}?decrypt=true`);
  const v = d.value ?? "";
  const first = v.codePointAt(0);
  const ok = v === VARS[e.key];
  console.log(
    `검증: ${e.key} len=${v.length} firstChar=U+${first?.toString(16).toUpperCase().padStart(4, "0")} ${ok ? "✓ 일치" : "✗ 불일치!"}`,
  );
}
console.log("done");
