import { writeFileSync } from "node:fs";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Point {
  x: number;
  y: number;
}

const codeFor = (k: string) =>
  k.startsWith("Arrow")
    ? k
    : k.length === 1
      ? /[a-z]/i.test(k)
        ? "Key" + k.toUpperCase()
        : /[0-9]/.test(k)
          ? "Digit" + k
          : k === "?"
            ? "Slash"
            : k === "["
              ? "BracketLeft"
              : k === "]"
                ? "BracketRight"
                : "Space"
      : k;

export class Cdp {
  private ws: WebSocket;
  private id = 0;
  private pending = new Map<number, (r: unknown) => void>();
  private opened: Promise<void>;
  consoleSink?: (line: string) => void;

  private constructor(url: string) {
    this.ws = new WebSocket(url);
    this.opened = new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error("cdp connect failed"));
    });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(String(ev.data)) as {
        id?: number;
        result?: unknown;
        method?: string;
        params?: { args?: { value?: unknown }[] };
      };
      if (m.method === "Runtime.consoleAPICalled" && this.consoleSink) {
        this.consoleSink(
          (m.params?.type ?? "") +
            " " +
            (m.params?.args ?? []).map((a) => String(a.value ?? a.description ?? "")).join(" "),
        );
      }
      if (m.id && this.pending.has(m.id)) {
        this.pending.get(m.id)!(m.result);
        this.pending.delete(m.id);
      }
    };
  }

  static async connect(port: number): Promise<Cdp> {
    const list = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as {
      type: string;
      webSocketDebuggerUrl: string;
    }[];
    const page = list.find((x) => x.type === "page");
    if (!page) throw new Error("no page target");
    const cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.opened;
    return cdp;
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.id;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evalJs<T = any>(expression: string): Promise<T> {
    const r = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r?.exceptionDetails) {
      throw new Error(
        "EXC " +
          JSON.stringify(
            r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
          ).slice(0, 300),
      );
    }
    return r?.result?.value as T;
  }

  async key(k: string, vk: number, mod = 0): Promise<void> {
    const code = codeFor(k);
    await this.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: k,
      code,
      windowsVirtualKeyCode: vk,
      modifiers: mod,
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: k,
      code,
      windowsVirtualKeyCode: vk,
      modifiers: mod,
    });
  }

  async press(p: Point): Promise<void> {
    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: p.x,
      y: p.y,
      button: "left",
      clickCount: 1,
    });
  }

  async move(p: Point, buttons = 1): Promise<void> {
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: p.x,
      y: p.y,
      button: "left",
      buttons,
    });
  }

  async release(p: Point): Promise<void> {
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: p.x,
      y: p.y,
      button: "left",
      clickCount: 1,
    });
  }

  async click(p: Point, mod = 0): Promise<void> {
    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: p.x,
      y: p.y,
      button: "left",
      clickCount: 1,
      modifiers: mod,
    });
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: p.x,
      y: p.y,
      button: "left",
      clickCount: 1,
      modifiers: mod,
    });
  }

  async dblclick(p: Point): Promise<void> {
    await this.click(p);
    await sleep(120);
    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: p.x,
      y: p.y,
      button: "left",
      clickCount: 2,
    });
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: p.x,
      y: p.y,
      button: "left",
      clickCount: 2,
    });
  }

  async drag(
    a: Point,
    b: Point,
    opts?: {
      steps?: number;
      stepSleep?: number;
      pressSleep?: number;
      after?: number;
      mod?: number;
    },
  ): Promise<void> {
    const { steps = 6, stepSleep = 50, pressSleep = 120, after = 800, mod = 0 } = opts ?? {};
    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: a.x,
      y: a.y,
      button: "left",
      clickCount: 1,
      modifiers: mod,
    });
    await sleep(pressSleep);
    for (let i = 1; i <= steps; i++) {
      await this.move({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps });
      await sleep(stepSleep);
    }
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: b.x,
      y: b.y,
      button: "left",
      clickCount: 1,
      modifiers: mod,
    });
    await sleep(after);
  }

  screen(wx: number, wy: number): Promise<Point> {
    return this.evalJs<Point>(
      `(() => { const c = window.__cul.canvas; const cam = c.getCamera(); const sr = c.surface.getBoundingClientRect(); return { x: (${wx} - cam.x) * cam.zoom + sr.x, y: (${wy} - cam.y) * cam.zoom + sr.y }; })()`,
    );
  }

  camera(): Promise<{ x: number; y: number; zoom: number }> {
    return this.evalJs(`window.__cul.canvas.getCamera()`);
  }

  async waitCanvas(timeout = 20000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await this.evalJs(`Boolean(window.__cul && window.__cul.canvas)`)) return;
      await sleep(300);
    }
    throw new Error("canvas not ready");
  }

  async reload(wait = 2500): Promise<void> {
    await this.send("Page.reload", {});
    await sleep(wait);
    await this.waitCanvas();
    await sleep(500);
  }

  async setFileInput(selector: string, files: string[]): Promise<void> {
    const doc = await this.send("DOM.getDocument", {});
    const node = await this.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector });
    await this.send("DOM.setFileInputFiles", { files, nodeId: node.nodeId });
  }

  async screenshot(path: string): Promise<void> {
    const shot = await this.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(path, Buffer.from(shot.data, "base64"));
  }

  close(): void {
    this.ws.close();
  }
}
