import type { Analysis } from "./voice-analysis";

/**
 * 연습 테이크 보관함 — 이 기기의 IndexedDB 에만 남는다.
 *
 * 대본 녹음은 서버로 안 간다(명대사만 채점하려고 /api/score 로 보내고, 서버는 점수를
 * 낸 뒤 파일을 바로 지운다 — PRIVACY.md). 지망생은 하루에 같은 대본을 열 번씩 읽는데, 그걸
 * 전부 올리면 우리는 쓸모없는 개인 음성을 쌓고 사용자는 불안하다. 대신 기기에
 * 남겨서 "어제의 나"와 나란히 들을 수 있게 한다 — 연습 도구의 본체는 그 비교다.
 *
 * 저장이 안 되는 브라우저(사생활 보호 모드 등)에서는 조용히 메모리로 떨어진다.
 * 그 세션 동안은 똑같이 보이고, 닫으면 사라진다.
 */

export type Take = {
  id: string;
  /** 대본 id 또는 밈 id */
  itemId: string;
  at: number;
  blob: Blob;
  analysis: Analysis | null;
  /** 명대사만 — 서버 채점 결과 */
  score?: { score: number; pitch: number; tone: number; timing: number } | null;
  starred?: boolean;
  /** 대본 확인을 눌렀으면 받아쓴 글자. 비교(lib/script-match)는 그때그때 다시 한다. */
  transcript?: { text: string } | null;
};

/** 대본 하나에 남기는 테이크 수. 별표 친 건 세지 않고 지우지도 않는다. */
const KEEP = 12;
const DB = "mimic-practice";
const STORE = "takes";

let memory: Take[] = [];
let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("itemId", "itemId");
        store.createIndex("at", "at");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listTakes(itemId: string): Promise<Take[]> {
  const db = await open();
  let rows: Take[];
  if (!db) rows = memory.filter((t) => t.itemId === itemId);
  else {
    try {
      rows = await tx<Take[]>(db, "readonly", (s) => s.index("itemId").getAll(itemId));
    } catch {
      rows = memory.filter((t) => t.itemId === itemId);
    }
  }
  return rows.sort((a, b) => b.at - a.at);
}

export async function saveTake(take: Take): Promise<void> {
  const db = await open();
  if (db) {
    try {
      await tx(db, "readwrite", (s) => s.put(take));
      await prune(take.itemId);
      return;
    } catch {
      // 용량 초과 등 — 메모리로 떨어진다.
    }
  }
  memory = [take, ...memory.filter((t) => t.id !== take.id)];
}

export async function updateTake(id: string, patch: Partial<Take>): Promise<void> {
  const db = await open();
  if (db) {
    try {
      const cur = await tx<Take | undefined>(db, "readonly", (s) => s.get(id));
      if (cur) {
        await tx(db, "readwrite", (s) => s.put({ ...cur, ...patch }));
        return;
      }
    } catch {
      // 아래 메모리로
    }
  }
  memory = memory.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

export async function deleteTake(id: string): Promise<void> {
  const db = await open();
  memory = memory.filter((t) => t.id !== id);
  if (!db) return;
  try {
    await tx(db, "readwrite", (s) => s.delete(id));
  } catch {
    // 지우기 실패는 다음 정리 때 다시 걸린다.
  }
}

async function prune(itemId: string) {
  const rows = await listTakes(itemId);
  const extra = rows.filter((t) => !t.starred).slice(KEEP);
  for (const t of extra) await deleteTake(t.id);
}

export type ItemSummary = { itemId: string; count: number; lastAt: number };

/** 연습실 목록용 — 대본마다 몇 번 했고 언제 마지막으로 했는지. 녹음 본체는 안 읽는다. */
export async function summaries(): Promise<Map<string, ItemSummary>> {
  const out = new Map<string, ItemSummary>();
  const add = (itemId: string, at: number) => {
    const cur = out.get(itemId);
    if (!cur) out.set(itemId, { itemId, count: 1, lastAt: at });
    else {
      cur.count += 1;
      cur.lastAt = Math.max(cur.lastAt, at);
    }
  };
  const db = await open();
  if (!db) {
    memory.forEach((t) => add(t.itemId, t.at));
    return out;
  }
  await new Promise<void>((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve();
        const v = c.value as Take;
        add(v.itemId, v.at);
        c.continue();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  memory.forEach((t) => add(t.itemId, t.at));
  return out;
}

export function newTakeId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
