'use client'

import { useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { rateItem } from '@/lib/actions/ratings'

export default function NumericalRating({ itemId }: { itemId: string }) {
    const [value, setValue] = useState([50])
    const [loading, setLoading] = useState(false)

    const handleRate = async () => {
        setLoading(true)
        await rateItem(itemId, value[0], 'NUMERICAL')
        setLoading(false)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Score: {value[0]}</label>
            </div>
            <Slider
                value={value}
                onValueChange={setValue}
                max={100}
                step={1}
                className="w-full"
            />
            <Button onClick={handleRate} disabled={loading} size="sm">
                Submit Score
            </Button>
        </div>
    )
}
