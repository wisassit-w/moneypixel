import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * The signed-in user's id. Every server action calls this first and then scopes
 * all its database work to the returned id (multi-user isolation).
 * An expired or missing session sends the visitor back to the login page.
 */
export async function requireUserId(): Promise<string> {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    return session.user.id;
}