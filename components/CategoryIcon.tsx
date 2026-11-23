import { getCategory } from "@/lib/categories";

export default function CategoryIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
    const Icon = getCategory(name).icon;
    return <Icon className={className} aria-hidden />;
}