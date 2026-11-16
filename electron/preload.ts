import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("__CUL_API__", process.env.CUL_API ?? "");
contextBridge.exposeInMainWorld("__CUL_NATIVE__", {
  desktop: true,
  syncApi: process.env.CUL_REMOTE_API ?? "",
  undo: () => ipcRenderer.invoke("cul-undo") as Promise<boolean>,
  undoCount: () => ipcRenderer.invoke("cul-undo-count") as Promise<number>,
  onUndo: (cb: () => void) => ipcRenderer.on("cul-undo", cb),
});
