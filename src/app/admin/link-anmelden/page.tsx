import { SecurityPage } from "@/components/security-page";
import { SecurityLanding } from "@/components/security-forms";
export const metadata = { title: "Anmeldung bestätigen", referrer: "no-referrer" as const };
export default function Page() { return <SecurityPage title="Anmeldung bestätigen"><SecurityLanding mode="magic"/></SecurityPage>; }
