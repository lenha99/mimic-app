"""
content/registry.json 하나에서 카탈로그 사본 전부를 생성한다.

지금까지 밈 목록은 네 군데에 손으로 복사돼 있었다:
  catalog.json · memes.json · web/lib/memes.ts(FALLBACK) · lib/data.dart(demoMemes)
하나라도 빠뜨리면 Modal 이 죽었을 때 새 밈 페이지가 404 난다. 그래서 레지스트리를
단일 진실 소스로 두고 나머지는 전부 여기서 찍어낸다.

    python tools/sync_catalog.py            # 생성/갱신
    python tools/sync_catalog.py --check    # 드리프트만 검사 (CI용, 파일 안 건드림)
"""
import argparse
import json
import re
import sys
from pathlib import Path

# Windows 콘솔이 cp949 라 한글/대시 출력이 깨진다.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "content" / "registry.json"

# 서버 카탈로그(= 앱이 받는 JSON)에 나가는 필드만. 나머지(origin/license/added…)는
# 레포에만 남는 운영 기록이다.
PUBLIC_FIELDS = ("id", "title", "source", "emoji", "plays", "line", "draft")

CATALOG_COMMENT = (
    "이 파일은 content/registry.json 에서 생성된다. 직접 고치지 말고 "
    "레지스트리를 고친 뒤 `python tools/sync_catalog.py` 를 돌려라. "
    "기준 음성은 meme-refs 볼륨의 {id}.wav."
)

BEGIN = "// <generated:catalog> — content/registry.json 에서 생성. 직접 고치지 말 것."
END = "// </generated:catalog>"


def load_registry():
    with REGISTRY.open(encoding="utf-8") as f:
        return json.load(f)["memes"]


def public_entry(m):
    return {k: m[k] for k in PUBLIC_FIELDS if k in m}


def render_catalog(memes):
    body = {"_comment": CATALOG_COMMENT, "memes": [public_entry(m) for m in memes]}
    return json.dumps(body, ensure_ascii=False, indent=2) + "\n"


def live(memes):
    """공개된 것만. 서버가 죽었을 때 쓰는 폴백에 미공개 밈이 섞이면 안 된다."""
    return [m for m in memes if not m.get("draft")]


def render_ts(memes):
    lines = [BEGIN, "const FALLBACK: Meme[] = ["]
    for m in live(memes):
        fields = ", ".join(
            f"{k}: {json.dumps(v, ensure_ascii=False)}" for k, v in public_entry(m).items()
        )
        lines.append(f"  {{ {fields} }},")
    lines.append("];")
    lines.append(END)
    return "\n".join(lines)


def render_dart(memes):
    lines = [BEGIN, "const demoMemes = ["]
    for m in live(memes):
        e = public_entry(m)
        parts = [
            f"id: '{e['id']}'",
            f"title: '{e['title']}'",
            f"source: '{e['source']}'",
            f"emoji: '{e['emoji']}'",
            f"plays: {e.get('plays', 0)}",
            "refUrl: ''",
        ]
        lines.append(f"  Meme({', '.join(parts)},),")
    lines.append("];")
    lines.append(END)
    return "\n".join(lines)


def splice(path: Path, block: str) -> str:
    """파일의 마커 사이를 block 으로 갈아끼운 전체 텍스트를 돌려준다."""
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(
        re.escape(BEGIN) + r".*?" + re.escape(END), re.DOTALL
    )
    if not pattern.search(text):
        sys.exit(
            f"{path} 에 생성 마커가 없다. 아래 두 줄로 블록을 감싸라:\n  {BEGIN}\n  {END}"
        )
    return pattern.sub(lambda _: block, text)


def targets(memes):
    """(경로, 기대 내용) 목록."""
    catalog = render_catalog(memes)
    return [
        (ROOT / "catalog.json", catalog),
        (ROOT / "memes.json", catalog),
        (ROOT / "web" / "lib" / "memes.ts", splice(ROOT / "web" / "lib" / "memes.ts", render_ts(memes))),
        (ROOT / "lib" / "data.dart", splice(ROOT / "lib" / "data.dart", render_dart(memes))),
    ]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="쓰지 않고 드리프트만 검사")
    args = ap.parse_args()

    memes = load_registry()
    drifted = []
    for path, expected in targets(memes):
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current == expected:
            continue
        drifted.append(path)
        if not args.check:
            path.write_text(expected, encoding="utf-8")

    rel = [str(p.relative_to(ROOT)).replace("\\", "/") for p in drifted]
    if args.check:
        if drifted:
            print("카탈로그 사본이 레지스트리와 어긋났다:")
            for r in rel:
                print(f"  - {r}")
            print("\n`python tools/sync_catalog.py` 를 돌리고 결과를 커밋해라.")
            return 1
        print(f"카탈로그 동기화 OK — 밈 {len(memes)}개")
        return 0

    if drifted:
        print(f"갱신 ({len(memes)}개 밈):")
        for r in rel:
            print(f"  - {r}")
    else:
        print(f"이미 최신 — 밈 {len(memes)}개")
    return 0


if __name__ == "__main__":
    sys.exit(main())
