import { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage } from "electron";
import { createServer } from "node:http";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import { getRequestListener } from "@hono/node-server";
import { createLocalPorts } from "../src/adapters/local";
import { createServices } from "../src/factory";
import { createLocalApp } from "../src/local/server";
import { createSafeSourceRepo, undoLast, undoStack } from "../src/factory/local";

app.commandLine.appendSwitch("enable-features", process.env.CUL_FEATURES ?? "CanvasDrawElement");
app.commandLine.appendSwitch("remote-debugging-port", process.env.CUL_DEBUG_PORT ?? "9333");

void app
  .whenReady()
  .then(async () => {
    // Finder 起動は cwd が / になるため、パッケージ版はユーザー領域を既定にする
    const projectRoot =
      process.env.CUL_PROJECT ??
      (app.isPackaged ? join(app.getPath("documents"), "CanvasUI") : process.cwd());
    mkdirSync(projectRoot, { recursive: true });
    const ports = createLocalPorts({
      dataDir: process.env.CUL_DATA_DIR ?? join(homedir(), ".canvasui"),
      migrationsFolder: join(__dirname, "../../db/migrations"),
      cfAccountId: process.env.CF_ACCOUNT_ID,
      cfApiToken: process.env.CF_API_TOKEN,
    });
    const services = createServices(ports, {
      writeback: "local",
      makeSourceRepo: (gate) => createSafeSourceRepo(gate, projectRoot, ports.db),
    });
    const honoApp = createLocalApp(services, ports.live);
    const server = createServer(getRequestListener(honoApp.fetch));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    process.env.CUL_API = `http://127.0.0.1:${port}`;

    ipcMain.handle("cul-undo", () => undoLast(projectRoot, ports.db));
    ipcMain.handle("cul-undo-count", () => undoStack.length);

    if (!app.isPackaged && process.platform === "darwin") {
      app.dock?.setIcon(nativeImage.createFromPath(join(__dirname, "../../build/icon.png")));
    }
    const win = new BrowserWindow({
      width: 1600,
      height: 1000,
      minWidth: 1024,
      minHeight: 700,
      webPreferences: {
        preload: join(__dirname, "../preload/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const menu = Menu.buildFromTemplate([
      { role: "appMenu" },
      { role: "fileMenu" },
      { role: "editMenu" },
      {
        label: "CanvasUI",
        submenu: [{ label: "Undo source write", click: () => win.webContents.send("cul-undo") }],
      },
      { role: "viewMenu" },
      { role: "windowMenu" },
    ]);
    Menu.setApplicationMenu(menu);
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (devUrl) void win.loadURL(devUrl);
    else void win.loadFile(join(__dirname, "../renderer/index.html"));
  })
  .catch((err: unknown) => {
    dialog.showErrorBox(
      app.getLocale().startsWith("ja")
        ? "CanvasUI Lab の起動に失敗しました"
        : "CanvasUI Lab failed to start",
      err instanceof Error ? err.message : String(err),
    );
    app.quit();
  });

app.on("window-all-closed", () => app.quit());
