import { SecurityPage } from "@/components/security-page";
import { MailRequestForm } from "@/components/security-forms";
export const metadata = { title: "Zugang wiederherstellen" };
export default function Page() { return <SecurityPage title="Zugang wiederherstellen"><p>Der Link wird ausschließlich an eine zuvor bestätigte persönliche E-Mail-Adresse verschickt.</p><MailRequestForm mode="reset"/></SecurityPage>; }
