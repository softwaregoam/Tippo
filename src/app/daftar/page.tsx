import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Buat akun | Tippo", robots: { index: false, follow: false } };
export default function Page() { return <AuthForm mode="signup" />; }
