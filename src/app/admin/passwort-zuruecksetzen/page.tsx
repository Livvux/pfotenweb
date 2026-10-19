import { SecurityPage } from "@/components/security-page";
import { SecurityLanding } from "@/components/security-forms";
export const metadata = { title: "Passwort zurücksetzen", referrer: "no-referrer" as const };
export default function Page() { return <SecurityPage title="Passwort zurücksetzen"><SecurityLanding mode="reset"/></SecurityPage>; }
