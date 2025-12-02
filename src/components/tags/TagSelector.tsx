'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getTags } from '@/lib/actions/tags'
import { Badge } from '@/components/ui/badge'

type Tag = {
    id: string
    name: string
}

export default function TagSelector({
    selectedTags,
    onTagsChange
}: {
    selectedTags: string[] // Array of tag IDs
    onTagsChange: (tags: string[]) => void
}) {
    const [open, setOpen] = useState(false)
    const [tags, setTags] = useState<Tag[]>([])

    useEffect(() => {
        getTags().then(setTags)
    }, [])

    const toggleTag = (tagId: string) => {
        if (selectedTags.includes(tagId)) {
            onTagsChange(selectedTags.filter(id => id !== tagId))
        } else {
            onTagsChange([...selectedTags, tagId])
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="justify-between"
                    >
                        Select tags...
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                    <Command>
                        <CommandInput placeholder="Search tags..." />
                        <CommandList>
                            <CommandEmpty>No tag found.</CommandEmpty>
                            <CommandGroup>
                                {tags.map((tag) => (
                                    <CommandItem
                                        key={tag.id}
                                        value={tag.name}
                                        onSelect={() => toggleTag(tag.id)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedTags.includes(tag.id) ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {tag.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <div className="flex flex-wrap gap-2">
                {selectedTags.map(tagId => {
                    const tag = tags.find(t => t.id === tagId)
                    if (!tag) return null
                    return (
                        <Badge key={tag.id} variant="secondary" className="mr-1">
                            {tag.name}
                            <button
                                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        toggleTag(tag.id)
                                    }
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                }}
                                onClick={() => toggleTag(tag.id)}
                            >
                                <span className="sr-only">Remove {tag.name} tag</span>
                                <span aria-hidden="true">×</span>
                            </button>
                        </Badge>
                    )
                })}
            </div>
        </div>
    )
}
