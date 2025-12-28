'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

const LLM_PROVIDERS = [
    { id: 'openrouter', name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1', defaultModel: 'mistralai/mistral-7b-instruct' },
    { id: 'openai', name: 'OpenAI', endpoint: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
    { id: 'anthropic', name: 'Anthropic', endpoint: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-sonnet-20240229' },
    { id: 'custom', name: 'Custom Endpoint', endpoint: '', defaultModel: '' },
] as const

type SettingsFormProps = {
    initialSettings: {
        llm_provider?: string
        llm_api_key?: string
        llm_model?: string
        llm_endpoint?: string
        tmdb_api_key?: string
        rawg_api_key?: string
        lastfm_api_key?: string
        google_books_api_key?: string

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
    const [model, setModel] = useState(initialSettings.llm_model || 'mistralai/mistral-7b-instruct')

    const handleProviderChange = (newProvider: string) => {
        setProvider(newProvider)
        const providerConfig = LLM_PROVIDERS.find(p => p.id === newProvider)
        if (providerConfig && providerConfig.endpoint) {
            setEndpoint(providerConfig.endpoint)
            if (providerConfig.defaultModel) {
                setModel(providerConfig.defaultModel)
            }
        }
        // Clear fetched models when provider changes
        setModels([])
    }

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
                    <Label htmlFor="llm_provider">LLM Provider</Label>
                    <Select value={provider} onValueChange={handleProviderChange}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                        <SelectContent>
                            {LLM_PROVIDERS.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <input type="hidden" name="llm_provider" value={provider} />
                    {provider === 'openrouter' && (
                        <p className="text-xs text-muted-foreground">
                            OpenRouter provides access to many models. Get a key at <a href="https://openrouter.ai" target="_blank" className="text-blue-400 hover:underline">openrouter.ai</a>
                        </p>
                    )}
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
                    <Label htmlFor="llm_api_key">LLM API Key</Label>
                    <Input
                        id="llm_api_key"
                        name="llm_api_key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                    />
                </div>

                <div className="my-6 border-t border-white/10" />
                <h3 className="text-lg font-medium text-white">Media Services</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Configure external APIs for auto-fill functionality.
                </p>

                <div className="grid gap-2">
                    <Label htmlFor="tmdb_api_key">TMDB API Key (Movies & TV)</Label>
                    <Input
                        id="tmdb_api_key"
                        name="tmdb_api_key"
                        type="password"
                        defaultValue={initialSettings.tmdb_api_key || ''}
                        placeholder="TMDB Read Access Token or API Key"
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="rawg_api_key">RAWG API Key (Video Games)</Label>
                    <Input
                        id="rawg_api_key"
                        name="rawg_api_key"
                        type="password"
                        defaultValue={initialSettings.rawg_api_key || ''}
                        placeholder="RAWG API Key"
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="lastfm_api_key">Last.fm API Key (Music)</Label>
                    <Input
                        id="lastfm_api_key"
                        name="lastfm_api_key"
                        type="password"
                        defaultValue={initialSettings.lastfm_api_key || ''}
                        placeholder="Last.fm API Key"
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="google_books_api_key">Google Books API Key</Label>
                    <Input
                        id="google_books_api_key"
                        name="google_books_api_key"
                        type="password"
                        defaultValue={initialSettings.google_books_api_key || ''}
                        placeholder="Google Books API Key"
                    />
                </div>
                <div className="my-2 border-t border-white/10" />

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
            <CardFooter className="pt-6">
                <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Changes
                </Button>
            </CardFooter>
        </form>
    )
}
