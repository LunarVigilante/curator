import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Sparkles, Loader2 } from 'lucide-react'
import { suggestMetadataSchema } from '@/lib/actions/ai'
import { toast } from 'sonner'

export type MetadataField = {
    name: string
    type: 'text' | 'number' | 'url' | 'date'
    required: boolean
}

export type MetadataSchema = MetadataField[]

export default function MetadataSchemaEditor({
    schema,
    onChange,
    categoryName,
    categoryDescription
}: {
    schema: MetadataSchema
    onChange: (schema: MetadataSchema) => void
    categoryName?: string
    categoryDescription?: string
}) {
    const [fields, setFields] = useState<MetadataSchema>(schema || [])
    const [isSuggesting, setIsSuggesting] = useState(false)

    const addField = () => {
        const newFields = [...fields, { name: '', type: 'text' as const, required: false }]
        setFields(newFields)
        onChange(newFields)
    }

    const removeField = (index: number) => {
        const newFields = fields.filter((_, i) => i !== index)
        setFields(newFields)
        onChange(newFields)
    }

    const updateField = (index: number, updates: Partial<MetadataField>) => {
        const newFields = fields.map((field, i) =>
            i === index ? { ...field, ...updates } : field
        )
        setFields(newFields)
        onChange(newFields)
    }

    const handleSuggest = async () => {
        if (!categoryName) return

        setIsSuggesting(true)
        try {
            const suggestions = await suggestMetadataSchema(categoryName, categoryDescription || '')
            if (suggestions.length > 0) {
                // Map to ensure required is boolean
                const mappedSuggestions = suggestions.map(s => ({
                    ...s,
                    required: !!s.required
                }))
                const newFields = [...fields, ...mappedSuggestions]
                setFields(newFields)
                onChange(newFields)
                toast.success(`Added ${suggestions.length} suggested fields`)
            } else {
                toast.error('No suggestions found')
            }
        } catch (error) {
            toast.error('Failed to get suggestions')
        } finally {
            setIsSuggesting(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label>Custom Metadata Fields</Label>
                <div className="flex gap-2">
                    {categoryName && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleSuggest}
                            disabled={isSuggesting}
                        >
                            {isSuggesting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                            Suggest Fields
                        </Button>
                    )}
                    <Button type="button" size="sm" variant="outline" onClick={addField}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Field
                    </Button>
                </div>
            </div>

            {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    No custom fields defined. Click &quot;Add Field&quot; to create one.
                </p>
            )}

            {fields.map((field, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end border p-3 rounded-lg">
                    <div className="col-span-5">
                        <Label htmlFor={`field-name-${index}`} className="text-xs">Field Name</Label>
                        <Input
                            id={`field-name-${index}`}
                            placeholder="e.g. Release Date"
                            value={field.name}
                            onChange={(e) => updateField(index, { name: e.target.value })}
                        />
                    </div>

                    <div className="col-span-3">
                        <Label htmlFor={`field-type-${index}`} className="text-xs">Type</Label>
                        <Select
                            value={field.type}
                            onValueChange={(value) => updateField(index, { type: value as MetadataField['type'] })}
                        >
                            <SelectTrigger id={`field-type-${index}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="url">URL</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="col-span-3 flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id={`field-required-${index}`}
                            checked={field.required}
                            onChange={(e) => updateField(index, { required: e.target.checked })}
                            className="rounded"
                        />
                        <Label htmlFor={`field-required-${index}`} className="text-xs">Required</Label>
                    </div>

                    <div className="col-span-1">
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeField(index)}
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}
