import { App } from "../src/client/App";

export default function IndexPage({
  appName,
  bridgeToken,
}: {
  appName: string;
  bridgeToken: string;
}) {
  return <App appName={appName} bridgeToken={bridgeToken} />;
}
