import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/dal";

export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? "/app" : "/login");
}
