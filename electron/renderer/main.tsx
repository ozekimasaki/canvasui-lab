import { createRoot } from "react-dom/client";
import { App } from "../../src/client/App";
import "../../src/client/tailwind.css";

createRoot(document.getElementById("root")!).render(<App appName="CanvasUI Lab" bridgeToken="" />);
