import Auth from "@/features/auth/Auth";
export const metadata = { title: "Verify your email" };
export default function Page() {
  return <Auth mode="verify" />;
}
