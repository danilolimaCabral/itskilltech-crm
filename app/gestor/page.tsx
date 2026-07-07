export const dynamic = 'force-dynamic';

import dynamicImport from 'next/dynamic';

const GestorDashboard = dynamicImport(
  () => import('./gestor-client'),
  { ssr: false }
);

export default function Page() {
  return <GestorDashboard />;
}
