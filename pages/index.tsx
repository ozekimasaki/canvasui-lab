import { MatrixCanvas } from "../src/client/MatrixCanvas";

export default function IndexPage({ appName }: { appName: string }) {
  return <MatrixCanvas appName={appName} />;
}
