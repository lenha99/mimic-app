"""
새 밈 후보 발굴 — 검색으로 훑고, 기계로 거르고, 사람이 고른다.

    python tools/trend_scan.py                      # 후보를 마크다운으로 출력
    python tools/trend_scan.py --issue              # GitHub 이슈로 등록 (gh 필요)
    python tools/trend_scan.py --days 30 --min-views 200000

유행어는 몇 주면 식는다. 그래서 발굴은 일회성 작업이 아니라 주기 작업이고,
주기 작업은 사람이 매번 기억해서 하면 반드시 끊긴다.

한계를 분명히 해둔다: 키워드 검색은 '거제 야호 같은 게 지금 뜬다'는 사실 자체를
알아내지 못한다. 그건 사람이나 웹 검색을 하는 에이전트의 몫이다. 이 도구가 하는 건
후보가 주어졌을 때의 기계적인 부분 — 조회수·업로드일·길이 확인, 중복 제거,
인제스트 명령 생성 — 이다. 검색어 목록(trend_queries.txt)이 이 도구의 품질을 정한다.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "content" / "registry.json"
BLOCKLIST = ROOT / "content" / "blocklist.json"
QUERIES = ROOT / "tools" / "trend_queries.txt"

MAX_CLIP_S = 90          # 이보다 길면 대사 위치를 사람이 찾아야 해서 후보로선 약하다
# 전연령·무논란 필터. 걸리면 후보에서 뺀다 — 밈 수명보다 평판 리스크가 길다.
UNSAFE = re.compile(
    r"(논란|사과문|고소|성희롱|학폭|음주운전|마약|사망|사고|갑질|정치|대통령|의원|"
    r"욕설|19금|선정)", re.I)


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")


def yt_dlp():
    if shutil.which("yt-dlp"):
        return ["yt-dlp"]
    if run([sys.executable, "-m", "yt_dlp", "--version"]).returncode == 0:
        return [sys.executable, "-m", "yt_dlp"]
    sys.exit("yt-dlp 가 없다.  pip install -r tools/requirements-ingest.txt")


def known_video_ids():
    """이미 쓴 원본 + 내린 원본. 다시 제안하면 안 된다."""
    ids = set()
    with REGISTRY.open(encoding="utf-8") as f:
        for m in json.load(f)["memes"]:
            vid = (m.get("origin") or {}).get("video_id")
            if vid:
                ids.add(vid)
    if BLOCKLIST.exists():
        with BLOCKLIST.open(encoding="utf-8") as f:
            ids |= set(json.load(f).get("video_ids", []))
    return ids


def search(query, limit, days):
    """업로드 최신순 검색. 조회수·길이·제목까지 한 번에 받는다."""
    r = run(yt_dlp() + [f"ytsearchdate{limit}:{query}", "--flat-playlist",
                        "--dump-json", "--no-warnings",
                        "--match-filter", f"duration < {MAX_CLIP_S}"])
    out = []
    for line in r.stdout.splitlines():
        try:
            j = json.loads(line)
        except json.JSONDecodeError:
            continue
        out.append({
            "video_id": j.get("id"), "title": j.get("title") or "",
            "channel": j.get("channel") or j.get("uploader") or "",
            "duration": j.get("duration"), "views": j.get("view_count") or 0,
            "upload_date": j.get("upload_date"), "query": query,
            "url": f"https://youtu.be/{j.get('id')}",
        })
    return out


def keep(c, seen, min_views, days):
    if not c["video_id"] or c["video_id"] in seen:
        return None
    if c["views"] < min_views:
        return f"조회수 {c['views']:,}"
    if UNSAFE.search(c["title"]):
        return f"안전 필터: {UNSAFE.search(c['title']).group(0)}"
    if c["upload_date"]:
        try:
            up = datetime.strptime(c["upload_date"], "%Y%m%d").date()
            if up < date.today() - timedelta(days=days):
                return f"오래됨 {up}"
        except ValueError:
            pass
    return None


def as_markdown(rows, days, min_views):
    lines = [
        f"## 밈 후보 — {date.today().isoformat()}",
        "",
        f"최근 {days}일 · 조회수 {min_views:,} 이상 · {MAX_CLIP_S}초 미만. "
        "기계가 거른 것까지다 — **소리가 본체인지, 억양이 뚜렷한지, 따라할 만한지는 사람이 본다.**",
        "",
        "고를 때 보는 것: ① 눈 감고 들어도 뭔지 아는가 ② 2~5초로 잘리는가 "
        "③ 억양이 평평하지 않은가 ④ 전연령인가",
        "",
    ]
    for c in rows:
        up = c["upload_date"] or "?"
        lines += [
            f"- [ ] **{c['title'][:70]}** — {c['channel']} · {c['duration']}초 · "
            f"조회 {c['views']:,} · {up}",
            f"      {c['url']}  (검색어: {c['query']})",
            "      ```",
            f"      python tools/ingest.py scan --url {c['url']} --around 00:00:05",
            f"      python tools/ingest.py add --id CHANGEME --url {c['url']} \\",
            "          --start ... --end ... --title '...' --line '...' \\",
            f"          --source '{c['channel']}' --kind shortform",
            "      ```",
        ]
    if not rows:
        lines.append("_이번 주 통과한 후보 없음._")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", type=int, default=45, help="최근 며칠 이내 업로드")
    ap.add_argument("--min-views", type=int, default=100000)
    ap.add_argument("--per-query", type=int, default=8)
    ap.add_argument("--issue", action="store_true", help="GitHub 이슈로 등록")
    args = ap.parse_args()

    queries = [q.strip() for q in QUERIES.read_text(encoding="utf-8").splitlines()
               if q.strip() and not q.startswith("#")]
    seen, rows, rejected = known_video_ids(), [], []

    for q in queries:
        print(f"· 검색: {q}", file=sys.stderr)
        for c in search(q, args.per_query, args.days):
            reason = keep(c, seen, args.min_views, args.days)
            seen.add(c["video_id"])
            (rejected if reason else rows).append((c, reason) if reason else c)

    rows.sort(key=lambda c: -c["views"])
    body = as_markdown(rows[:20], args.days, args.min_views)
    print(f"· 후보 {len(rows)}개 / 제외 {len(rejected)}개", file=sys.stderr)

    if args.issue:
        if not shutil.which("gh"):
            sys.exit("gh 가 없다")
        r = run(["gh", "issue", "create", "--label", "content-candidate",
                 "--title", f"밈 후보 {date.today().isoformat()}", "--body", body])
        print(r.stdout or r.stderr)
    else:
        print(body)


if __name__ == "__main__":
    main()
