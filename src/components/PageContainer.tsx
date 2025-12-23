import { cn } from "@/lib/utils"

export default function PageContainer({
    children,
    className
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn("container mx-auto py-10", className)}>
            <div className="bg-card text-card-foreground rounded-xl gradient-border shadow-sm p-6 sm:p-8">
                {children}
            </div>
        </div>
    )
}
