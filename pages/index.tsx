import { MatrixCanvas } from "../src/client/MatrixCanvas";

export default function IndexPage({
  appName,
  bridgeToken,
}: {
  appName: string;
  bridgeToken: string;
}) {
  return <MatrixCanvas appName={appName} bridgeToken={bridgeToken} />;
}
