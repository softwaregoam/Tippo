import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Lupa kata sandi | Tippo", robots: { index: false, follow: false } };
export default function Page() { return <AuthForm mode="forgot" />; }
