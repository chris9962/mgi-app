import { redirect } from "next/navigation";
import { requirePage } from "@/server/auth/current";
import { can } from "@/lib/permissions";

export default async function AdminHome() {
  const user = await requirePage();
  redirect(can(user, "users") ? "/users" : "/profile");
}
