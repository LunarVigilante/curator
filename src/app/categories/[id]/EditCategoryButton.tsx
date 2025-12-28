'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import EditCategoryDialog from '@/components/dialogs/EditCategoryDialog'

type Category = {
    id: string
    name: string
    description: string | null
    image: string | null
    metadata: string | null
    isPublic: boolean
}

import { useRouter } from 'next/navigation'

export default function EditCategoryButton({ category }: { category: Category }) {
    const [open, setOpen] = useState(false)
    const router = useRouter()

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(true)}
                className="h-8 w-8 opacity-50 hover:opacity-100"
            >
                <Pencil className="h-4 w-4" />
            </Button>

            <EditCategoryDialog
                category={category}
                open={open}
                onOpenChange={setOpen}
                onSuccess={() => router.refresh()}
            />
        </>
    )
}
