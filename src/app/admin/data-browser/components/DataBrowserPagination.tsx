'use client'

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface DataBrowserPaginationProps {
    page: number
    totalPages: number
    setPage: (page: number) => void
    inputPage: number | string
    setInputPage: (val: number | string) => void
    handlePageInput: (e: React.FormEvent) => void
    // Optional: Page size selector if extracted
}

export function DataBrowserPagination({
    page,
    totalPages,
    setPage,
    inputPage,
    setInputPage,
    handlePageInput
}: DataBrowserPaginationProps) {
    if (totalPages <= 1) return null

    return (
        <div className="w-full flex flex-col items-center gap-3 mt-8 pb-8">
            <div className="flex items-center gap-2">
                {/* First Page */}
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    className="bg-black border-zinc-700 px-2"
                    title="First Page"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <ChevronLeft className="w-4 h-4 -ml-2" />
                </Button>

                {/* Previous */}
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="bg-black border-zinc-700"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Prev
                </Button>

                {/* Page Input */}
                <form onSubmit={handlePageInput} className="flex items-center gap-2 px-3">
                    <span className="text-sm text-zinc-500">Page</span>
                    <Input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={inputPage}
                        onChange={(e) => setInputPage(e.target.value)}
                        className="w-16 h-8 bg-zinc-900 border-zinc-700 text-center"
                    />
                    <span className="text-sm text-zinc-500">of {totalPages}</span>
                </form>

                {/* Next */}
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                    className="bg-black border-zinc-700"
                >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                </Button>

                {/* Last Page */}
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(totalPages)}
                    className="bg-black border-zinc-700 px-2"
                    title="Last Page"
                >
                    <ChevronRight className="w-4 h-4" />
                    <ChevronRight className="w-4 h-4 -ml-2" />
                </Button>
            </div>
        </div>
    )
}
