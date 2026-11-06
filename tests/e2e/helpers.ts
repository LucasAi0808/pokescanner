import type { Page, Route } from "@playwright/test";
import { DEMO_OUTPUT } from "../../src/grading/demo";
import type { ModelOutput } from "../../src/grading/types";

export const FAKE_KEY = "sk-ant-api03-TESTKEY-" + "x".repeat(40);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-expose-headers": "*",
};

export function message(output: ModelOutput | string, opts: { stop_reason?: string; model?: string } = {}) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: opts.model ?? "claude-opus-5-5",
    content: [{ type: "text", text: typeof output === "string" ? output : JSON.stringify(output) }],
    stop_reason: opts.stop_reason ?? "end_turn",
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 9123, output_tokens: 4321 },
  };
}

/** A "real" reply pointing at the front and back, not a demo result. */
export function liveOutput(overrides: Partial<ModelOutput> = {}): ModelOutput {
  return {
    ...DEMO_OUTPUT,
    summary: "Test reply: the card looks good but has a white dot on the back.",
    card: { name: "Test card", number: "025/165", set_name: "Test set", language: "ja", confidence: "medium" },
    ...overrides,
  };
}

export interface ApiReply {
  status?: number;
  body?: unknown;
  delayMs?: number;
  headers?: Record<string, string>;
}

export interface ApiMock {
  posts: { headers: Record<string, string>; body: any }[];
}

/** Intercepts every request to api.anthropic.com and answers with `reply`. */
export async function mockAnthropic(page: Page, reply: (n: number) => ApiReply): Promise<ApiMock> {
  const mock: ApiMock = { posts: [] };
  await page.route("https://api.anthropic.com/**", async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    // allHeaders(): headers() hides some headers in WebKit.
    mock.posts.push({ headers: await req.allHeaders(), body: req.postDataJSON() });
    const r = reply(mock.posts.length);
    if (r.delayMs) await new Promise((res) => setTimeout(res, r.delayMs));
    try {
      await route.fulfill({
        status: r.status ?? 200,
        headers: { ...CORS, "content-type": "application/json", "request-id": "req_test", ...(r.headers ?? {}) },
        body: JSON.stringify(r.body ?? {}),
      });
    } catch {
      /* the request was aborted by the client */
    }
  });
  return mock;
}

export async function uploadPair(page: Page, front = "public/demo/front.jpg", back = "public/demo/back.jpg") {
  await page.getByTestId("file-front").setInputFiles(front);
  await page.getByTestId("file-back").setInputFiles(back);
  await page.getByTestId("slot-front").locator("img").first().waitFor();
  await page.getByTestId("slot-back").locator("img").first().waitFor();
}

export async function analyzeWithKey(page: Page, key = FAKE_KEY) {
  await page.getByTestId("api-key").fill(key);
  await page.getByTestId("consent-check").check();
  await page.getByRole("dialog").getByRole("button", { name: "Analyze" }).click();
}

/** A fresh result opens as a booster pack first; skip straight to the details. */
export async function skipBooster(page: Page) {
  await page.getByTestId("booster-skip").click();
}

/** Everything in localStorage, sessionStorage and IndexedDB (except image data), as text. */
export async function dumpStorage(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const out: unknown[] = [{ ...localStorage }, { ...sessionStorage }];
    const dbs = await indexedDB.databases();
    for (const info of dbs) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(info.name!);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      for (const name of Array.from(db.objectStoreNames)) {
        const all = await new Promise<unknown[]>((res, rej) => {
          const r = db.transaction(name).objectStore(name).getAll();
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        out.push({ store: name, all });
      }
      db.close();
    }
    return JSON.stringify(out, (_k, v) => (v instanceof Blob ? `[blob ${v.size}]` : v));
  });
}
