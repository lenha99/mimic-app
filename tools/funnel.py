# -*- coding: utf-8 -*-
"""퍼널 — 단계마다 몇 명이 남는지. 홍보 다음 날 이거 한 줄이면 된다.

    python tools/funnel.py                 # 어제·오늘 (KST)
    python tools/funnel.py 2026-11-06      # 그날 하루 (KST)
    python tools/funnel.py --days 7        # 최근 7일
    python tools/funnel.py --people        # 사람별 경로도 (어디서 멈췄나)
    python tools/funnel.py --exclude abc123,def456   # 촬영 스크립트·내 폰 같은 기기 빼기

이벤트는 Modal 볼륨 meme-refs 의 events/<UTC 날짜>/<uuid>.json (modal_app._log_event).
지난 날짜는 tools/.cache/events/ 에 받아 두고 다시 안 받는다. 오늘(UTC)만 매번 새로.
내부 기기(internal_clients.json — 프로필의 "내 기기 통계 제외")는 기본으로 뺀다. --all 이면 포함.

사람 = 기기(client). 같은 사람이 폰·PC 로 오면 두 명으로 센다.
퍼널 숫자는 "앞 단계를 전부 한 사람 중 이 단계도 한 사람" — 순서는 안 따진다.
"""
import argparse
import collections
import datetime as dt
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, ".cache", "events")
KST = dt.timezone(dt.timedelta(hours=9))
VOLUME = "meme-refs"

# (이름, [(이벤트, 표시, 조건)]) — 조건은 이벤트 dict 를 받는 함수(없으면 전부)
FUNNELS = [
    ("첫 방문 미션 (홈)", [
        ("view_home", "홈 봄", None),
        ("mission_open", "미션 시트 열림", None),
        ("mission_rec", "한 줄 녹음", None),
        ("mission_done", "목소리 타입 봄", None),
        ("weekly_enter", "들려주기", lambda e: e.get("via") == "mission"),
    ]),
    ("연습실", [
        ("practice_view", "대본 엶", None),
        ("practice_take", "녹음함", None),
        ("enter_open", "들려주기 누름", None),
        ("weekly_enter", "올라감", None),
    ]),
    ("갤러리", [
        ("weekly_view", "목소리 탭 봄", None),
        ("weekly_play", "들음", None),
        ("weekly_like", "❤ 누름", None),
    ]),
]
# 이것만 한 사람 = "홈만 보고 떠남"
SHALLOW = {"view_home", "mission_open", "mission_skip", "intro_view", "intro_skip", "intro_done"}
# 사람별 경로에서 생략할 잡음
NOISE = {"transcribe", "rescore"}


def modal(*args):
    env = {**os.environ, "PYTHONUTF8": "1"}   # 안 주면 윈도에서 출력 인코딩 오류로 중간에 죽는다
    return subprocess.run([sys.executable, "-m", "modal", *args], capture_output=True, text=True,
                          encoding="utf-8", errors="replace", env=env)


def fetch_day(day: str, today_utc: str) -> str | None:
    """UTC 날짜 하나를 캐시에 받는다. 볼륨에 없으면 None."""
    dst = os.path.join(CACHE, day)
    if os.path.isdir(dst) and day < today_utc:
        return dst
    tmp = dst + ".part"
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    r = modal("volume", "get", "--force", VOLUME, f"events/{day}", tmp)
    if r.returncode != 0:
        shutil.rmtree(tmp, ignore_errors=True)
        if "No such file" in r.stdout + r.stderr or "not found" in (r.stdout + r.stderr).lower():
            return None
        sys.exit(f"modal volume get 실패 ({day}):\n{r.stderr[-800:]}\n→ `modal token new` 로 로그인돼 있는지 확인")
    shutil.rmtree(dst, ignore_errors=True)
    os.replace(tmp, dst)
    return dst


def internal_clients() -> set:
    tmp = os.path.join(CACHE, "_internal")
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    modal("volume", "get", "--force", VOLUME, "internal_clients.json", tmp)
    for root, _, files in os.walk(tmp):
        for f in files:
            try:
                with open(os.path.join(root, f), encoding="utf-8") as fh:
                    return set(json.load(fh).get("clients", []))
            except Exception:
                pass
    return set()


def load(start: dt.datetime, end: dt.datetime):
    today_utc = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    d = start.astimezone(dt.timezone.utc).date()
    last = end.astimezone(dt.timezone.utc).date()
    lo, hi = start.timestamp(), end.timestamp()
    out = []
    while d <= last:
        path = fetch_day(d.isoformat(), today_utc)
        if path:
            for root, _, files in os.walk(path):
                for f in files:
                    if not f.endswith(".json"):
                        continue
                    try:
                        with open(os.path.join(root, f), encoding="utf-8") as fh:
                            e = json.load(fh)
                    except Exception:
                        continue
                    if lo <= e.get("ts", 0) < hi:
                        out.append(e)
        d += dt.timedelta(days=1)
    out.sort(key=lambda e: e["ts"])
    return out


def kst(ts: float) -> dt.datetime:
    return dt.datetime.fromtimestamp(ts, KST)


def pct(a: int, b: int) -> str:
    return f"{a * 100 // b:>3}%" if b else "   -"


def main():
    ap = argparse.ArgumentParser(description="MIMIC 퍼널")
    ap.add_argument("date", nargs="?", help="KST 날짜 하루 (YYYY-MM-DD)")
    ap.add_argument("--days", type=int, default=2, help="최근 N일 (KST, 오늘 포함). 기본 2")
    ap.add_argument("--people", action="store_true", help="사람별 경로")
    ap.add_argument("--all", action="store_true", help="내부 기기 포함")
    ap.add_argument("--exclude", default="", help="뺄 기기 id, 쉼표로")
    a = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    now = dt.datetime.now(KST)
    if a.date:
        start = dt.datetime.fromisoformat(a.date).replace(tzinfo=KST)
        end = start + dt.timedelta(days=1)
        label = a.date
    else:
        start = (now - dt.timedelta(days=a.days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
        label = f"{start:%m/%d} ~ {now:%m/%d %H:%M}"

    events = load(start, end)
    drop = {x.strip() for x in a.exclude.split(",") if x.strip()}
    internal = set() if a.all else internal_clients()
    events = [e for e in events if e.get("client") not in internal | drop]

    by = collections.defaultdict(list)
    for e in events:
        by[e.get("client") or f"anon-{id(e)}"].append(e)

    print(f"\n■ MIMIC 퍼널 · {label} (KST)")
    print(f"  이벤트 {len(events)}건 · 사람 {len(by)}명"
          f" · 뺀 기기: 내부 {len(internal)} + 지정 {len(drop)}")
    if not by:
        return

    shallow = [c for c, es in by.items() if {e["kind"] for e in es} <= SHALLOW]
    days_seen = {c: {kst(e["ts"]).date() for e in es} for c, es in by.items()}
    back = sum(1 for v in days_seen.values() if len(v) >= 2)
    print(f"  홈만 보고 떠남 {len(shallow)}명 ({pct(len(shallow), len(by)).strip()})"
          f" · 이틀 이상 온 사람 {back}명")

    for name, steps in FUNNELS:
        print(f"\n  [{name}]")
        alive = set(by)
        prev = None
        for kind, title, cond in steps:
            did = {c for c in alive if any(e["kind"] == kind and (cond is None or cond(e)) for e in by[c])}
            n_ev = sum(1 for c in did for e in by[c] if e["kind"] == kind and (cond is None or cond(e)))
            print(f"    {title:<14} {len(did):>4}명 {pct(len(did), prev) if prev is not None else '    '}"
                  f"   ({n_ev}건)")
            alive, prev = did, len(did)
            if not did:
                break

    undo = sum(1 for e in events if e["kind"] == "post_undo")
    fail = sum(1 for e in events if e["kind"] == "enter_fail")
    if undo or fail:
        print(f"\n  되돌림(post_undo) {undo}건 · 올리기 실패(enter_fail) {fail}건")

    land = collections.Counter(es[0]["kind"] for es in by.values())
    print("\n  [처음 들어온 곳]  " + " · ".join(f"{k} {v}" for k, v in land.most_common(6)))

    if a.people:
        print("\n  [사람별 경로] (이벤트 많은 순, 최대 30명)")
        for c, es in sorted(by.items(), key=lambda kv: -len(kv[1]))[:30]:
            seq = []
            for e in es:
                if e["kind"] in NOISE:
                    continue
                k = e["kind"] + (f"({e['via']})" if e["kind"] == "weekly_enter" and e.get("via") else "")
                if seq and seq[-1][0] == k:
                    seq[-1][1] += 1
                else:
                    seq.append([k, 1])
            path = " → ".join(k + (f"×{n}" if n > 1 else "") for k, n in seq)
            if len(path) > 160:
                path = path[:157] + "…"
            print(f"    {c[:10]:<10} {kst(es[0]['ts']):%m/%d %H:%M}  {path}")
    print()


if __name__ == "__main__":
    main()
