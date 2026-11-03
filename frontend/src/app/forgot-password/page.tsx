import Auth from "@/features/auth/Auth";
export const metadata = { title: "Password recovery" };
export default function Page() {
  return <Auth mode="forgot" />;
}
