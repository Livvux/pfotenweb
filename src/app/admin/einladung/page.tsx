import { SecurityPage } from "@/components/security-page";
import { SecurityLanding } from "@/components/security-forms";
export const metadata = { title: "Einladung zum Vereinszugang", referrer: "no-referrer" as const };
export default function Page() { return <SecurityPage title="Einladung zum Vereinszugang"><SecurityLanding mode="invite"/></SecurityPage>; }
