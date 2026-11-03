import Auth from "@/features/auth/Auth";
export const metadata = { title: "Sign in" };
export default function Page() {
  return <Auth mode="sign-in" />;
}
