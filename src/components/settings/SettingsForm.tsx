'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateSettings } from '@/lib/actions/settings'
import { getModels } from '@/lib/actions/llm'
import { Loader2, RefreshCw, Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

type SettingsFormProps = {
    initialSettings: {
        llm_provider?: string
        llm_api_key?: string
        llm_model?: string
        llm_endpoint?: string

    }
}

export default function SettingsForm({ initialSettings }: SettingsFormProps) {
    const [loading, setLoading] = useState(false)
    const [models, setModels] = useState<{ id: string, name?: string }[]>([])
    const [fetchingModels, setFetchingModels] = useState(false)
    const [open, setOpen] = useState(false)

    // Form state
    const [provider, setProvider] = useState(initialSettings.llm_provider || 'openrouter')
    const [apiKey, setApiKey] = useState(initialSettings.llm_api_key || '')
    const [endpoint, setEndpoint] = useState(initialSettings.llm_endpoint || 'https://openrouter.ai/api/v1')
    const [model, setModel] = useState(initialSettings.llm_model || 'openai/gpt-4o')

    const handleFetchModels = async () => {
        if (!apiKey) {
            toast.error('Please enter an API Key first')
            return
        }

        setFetchingModels(true)
        try {
            const fetchedModels = await getModels(apiKey, endpoint)
            if (fetchedModels.length > 0) {
                setModels(fetchedModels)
                toast.success(`Found ${fetchedModels.length} models`)
                setOpen(true)
            } else {
                toast.error('No models found. Check your API Key and Endpoint.')
            }
        } catch (error) {
            toast.error('Failed to fetch models')
        } finally {
            setFetchingModels(false)
        }
    }

    const handleSubmit = async (formData: FormData) => {
        setLoading(true)
        // Ensure the selected model is included in the form data if using the combobox
        // We use a hidden input for this, but we can also append it manually if needed
        if (!formData.get('llm_model')) {
            formData.set('llm_model', model)
        }

        try {
            await updateSettings(formData)
            toast.success('Settings updated successfully')
        } catch (error) {
            toast.error('Failed to update settings')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form action={handleSubmit}>
            <CardContent className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor="llm_provider">Provider</Label>
                    <Input
                        id="llm_provider"
                        name="llm_provider"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        placeholder="e.g., openrouter"
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="llm_endpoint">Endpoint URL</Label>
                    <div className="flex gap-2">
                        <Input
                            id="llm_endpoint"
                            name="llm_endpoint"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                            placeholder="https://openrouter.ai/api/v1"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Default: https://openrouter.ai/api/v1
                    </p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="llm_api_key">API Key</Label>
                    <Input
                        id="llm_api_key"
                        name="llm_api_key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="llm_model">Model</Label>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            {models.length > 0 ? (
                                <Popover open={open} onOpenChange={setOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={open}
                                            className="w-full justify-between"
                                        >
                                            {model
                                                ? (models.find((m) => m.id === model)?.name || model)
                                                : "Select model..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0">
                                        <Command>
                                            <CommandInput placeholder="Search model..." />
                                            <CommandList>
                                                <CommandEmpty>No model found.</CommandEmpty>
                                                <CommandGroup>
                                                    {models.map((m) => (
                                                        <CommandItem
                                                            key={m.id}
                                                            value={m.id}
                                                            onSelect={(currentValue) => {
                                                                setModel(currentValue)
                                                                setOpen(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    model === m.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {m.name || m.id}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <Input
                                    id="llm_model"
                                    name="llm_model"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    placeholder="e.g., openai/gpt-4o"
                                />
                            )}
                            {/* Hidden input to ensure model is submitted when using Combobox */}
                            <input type="hidden" name="llm_model" value={model} />
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleFetchModels}
                            disabled={fetchingModels || !apiKey}
                            title="Fetch Models"
                        >
                            {fetchingModels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>


            </CardContent>
            <CardFooter>
                <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Changes
                </Button>
            </CardFooter>
        </form>
    )
}
