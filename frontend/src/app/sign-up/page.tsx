import Auth from "@/features/auth/Auth";
export const metadata = { title: "Create an account" };
export default function Page() {
  return <Auth mode="sign-up" />;
}
