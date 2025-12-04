'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ListOrdered } from 'lucide-react'
import CustomRanksDialog from '@/components/dialogs/CustomRanksDialog'

export default function CustomRanksButton({ categoryId }: { categoryId: string }) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <Button
                variant="outline"
                onClick={() => setOpen(true)}
            >
                <ListOrdered className="h-4 w-4 mr-2" />
                Custom Ranks
            </Button>
            <CustomRanksDialog
                categoryId={categoryId}
                open={open}
                onOpenChange={setOpen}
            />
        </>
    )
}
