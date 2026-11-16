import { app, BrowserWindow, Menu, ipcMain } from "electron";
import { createServer } from "node:http";
import { join } from "node:path";
import { homedir } from "node:os";
import { getRequestListener } from "@hono/node-server";
import { createLocalPorts } from "../src/adapters/local";
import { createServices } from "../src/factory";
import { createLocalApp } from "../src/local/server";
import { createSafeSourceRepo, undoLast, undoStack } from "../src/factory/local";

app.commandLine.appendSwitch("enable-features", process.env.CUL_FEATURES ?? "CanvasDrawElement");
app.commandLine.appendSwitch("remote-debugging-port", process.env.CUL_DEBUG_PORT ?? "9333");

const projectRoot = process.env.CUL_PROJECT ?? process.cwd();

void app.whenReady().then(async () => {
  const ports = createLocalPorts({
    dataDir: process.env.CUL_DATA_DIR ?? join(homedir(), ".canvasui"),
    migrationsFolder: join(projectRoot, "db/migrations"),
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
});

app.on("window-all-closed", () => app.quit());
