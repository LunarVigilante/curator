'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardDescription, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, Database, Mail, Brain, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { updateSystemConfig, getSystemConfig, testLLMConnectionAction, testServiceConnection } from '@/lib/actions/admin';
import { useEffect } from 'react';

interface AdminSystemConfigProps {
    settings: Record<string, string>;
}

export default function AdminSystemConfig({ settings }: AdminSystemConfigProps) {
    const [isLoading, setIsLoading] = useState(false);

    // LLM State
    const [llmProvider, setLlmProvider] = useState(settings?.['llm_provider'] || 'openai');
    const [llmApiKey, setLlmApiKey] = useState(settings?.['llm_api_key'] || '');
    const [llmModel, setLlmModel] = useState(settings?.['llm_model'] || '');
    const [systemPrompt, setSystemPrompt] = useState(settings?.['system_prompt'] || `You are The Curator, an elite cultural critic and algorithm. Your goal is to analyze user taste with surgical precision and sophisticated wit.

**OPERATIONAL RULES:**
1. **Scope:** You analyze Movies, TV, Games, Books, Music, and Podcasts.
2. **Tone:** Authoritative, discerning, and slightly snarky. You are not a cheerleader; you are a critic.
3. **Constraints:** - Never recommend items the user already has (you will receive an exclusion list).
   - Use bolding (markdown **text**) inside strings to highlight key genres/tropes.
   - For "Likely Misses," be critical and explain specifically why the user would dislike it based on their profile.`);

    // Dynamic Model Fetching & Testing
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [isTestLoading, setIsTestLoading] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // Media API Keys
    const [tmdbApiKey, setTmdbApiKey] = useState(settings?.['tmdb_api_key'] || '');
    const [rawgApiKey, setRawgApiKey] = useState(settings?.['rawg_api_key'] || '');
    const [googleBooksApiKey, setGoogleBooksApiKey] = useState(settings?.['google_books_api_key'] || '');
    const [spotifyClientId, setSpotifyClientId] = useState(settings?.['spotify_client_id'] || '');
    const [spotifyClientSecret, setSpotifyClientSecret] = useState(settings?.['spotify_client_secret'] || '');
    const [comicVineApiKey, setComicVineApiKey] = useState(settings?.['comicvine_api_key'] || '');
    const [bggApiKey, setBggApiKey] = useState(settings?.['bgg_api_key'] || '');
    const [metronUsername, setMetronUsername] = useState(settings?.['metron_username'] || '');
    const [metronPassword, setMetronPassword] = useState(settings?.['metron_password'] || '');
    const [omdbApiKey, setOmdbApiKey] = useState(settings?.['omdb_api_key'] || '');

    // Voyage AI (Embeddings)
    const [voyageApiKey, setVoyageApiKey] = useState(settings?.['voyage_api_key'] || '');

    // Media API Endpoints (Custom URLs)
    // Twitch / IGDB
    const [twitchClientId, setTwitchClientId] = useState(settings?.['twitch_client_id'] || '');
    const [twitchClientSecret, setTwitchClientSecret] = useState(settings?.['twitch_client_secret'] || '');

    // Email State
    const [resendKey, setResendKey] = useState(settings?.['resend_api_key'] || '');
    const [fromEmail, setFromEmail] = useState(settings?.['resend_from_email'] || '');
    const [appUrl, setAppUrl] = useState(settings?.['public_app_url'] || 'http://localhost:3000');
    const [testEmailRecipient, setTestEmailRecipient] = useState('');
    const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

    // Feature Flags
    const [enableAiCritic, setEnableAiCritic] = useState(settings['feature_ai_critic'] === 'true');
    const [enableSmartSort, setEnableSmartSort] = useState(settings['feature_smart_sort'] === 'true');
    const [enableRecommendations, setEnableRecommendations] = useState(settings['feature_recommendations'] === 'true');
    const [enableChallenges, setEnableChallenges] = useState(settings['feature_challenges'] === 'true');

    // SteamGridDB
    const [steamGridApiKey, setSteamGridApiKey] = useState(settings['STEAMGRIDDB_API_KEY'] || '');

    // Connection Status for Services
    const [serviceStatuses, setServiceStatuses] = useState<Record<string, { status: 'idle' | 'loading' | 'success' | 'error', message?: string }>>({
        tmdb: { status: 'idle' },
        googlebooks: { status: 'idle' },
        spotify: { status: 'idle' },
        resend: { status: 'idle' },
        comicvine: { status: 'idle' },
        bgg: { status: 'idle' },
        metron: { status: 'idle' },
        steamgrid: { status: 'idle' },
        omdb: { status: 'idle' },
        twitch: { status: 'idle' }
    });



    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [config] = await Promise.all([
                getSystemConfig()
            ]);

            // Populate states
            if (config['llm_provider']) setLlmProvider(config['llm_provider']);
            if (config['llm_api_key']) setLlmApiKey(config['llm_api_key']);
            if (config['llm_model']) setLlmModel(config['llm_model']);
            if (config['system_prompt']) setSystemPrompt(config['system_prompt']);

            if (config['tmdb_api_key']) setTmdbApiKey(config['tmdb_api_key']);
            if (config['rawg_api_key']) setRawgApiKey(config['rawg_api_key']);
            if (config['twitch_client_id']) setTwitchClientId(config['twitch_client_id']);
            if (config['twitch_client_secret']) setTwitchClientSecret(config['twitch_client_secret']);
            if (config['google_books_api_key']) setGoogleBooksApiKey(config['google_books_api_key']);
            if (config['spotify_client_id']) setSpotifyClientId(config['spotify_client_id']);
            if (config['spotify_client_secret']) setSpotifyClientSecret(config['spotify_client_secret']);
            if (config['comicvine_api_key']) setComicVineApiKey(config['comicvine_api_key']);
            if (config['bgg_api_key']) setBggApiKey(config['bgg_api_key']);
            if (config['metron_username']) setMetronUsername(config['metron_username']);
            if (config['metron_password']) setMetronPassword(config['metron_password']);
            if (config['omdb_api_key']) setOmdbApiKey(config['omdb_api_key']);

            if (config['resend_api_key']) setResendKey(config['resend_api_key']);
            if (config['resend_from_email']) setFromEmail(config['resend_from_email']);
            if (config['public_app_url']) setAppUrl(config['public_app_url']);


        } catch (e) {
            console.error("Failed to load settings:", e);
            toast.error("Failed to load existing settings.");
        } finally {
            setIsLoading(false);
        }
    };



    const handleTestLLM = async () => {
        setIsTestLoading(true);
        setTestResult(null);
        try {
            const result = await testLLMConnectionAction({
                provider: llmProvider,
                apiKey: llmApiKey,
                model: llmModel
            });
            if (result.success) {
                setTestResult({ success: true, message: result.message || "Connection Verified" });
                toast.success(result.message || "Connection Verified");
            } else {
                setTestResult({ success: false, message: result.error || "Connection Failed" });
                toast.error(result.error || "Connection Failed");
            }
        } catch (e: any) {
            setTestResult({ success: false, message: e.message || "Test Error" });
            toast.error("An error occurred during verification.");
        } finally {
            setIsTestLoading(false);
        }
    };

    const handleTestService = async (service: 'tmdb' | 'twitch' | 'googlebooks' | 'spotify' | 'resend' | 'comicvine' | 'bgg' | 'metron' | 'omdb' | 'steamgrid', apiKey: string, clientSecret?: string) => {
        setServiceStatuses(prev => ({ ...prev, [service]: { status: 'loading' } }));
        try {
            const result = await testServiceConnection({ service, apiKey, clientSecret });
            if (result.success) {
                setServiceStatuses(prev => ({ ...prev, [service]: { status: 'success', message: result.message } }));
                toast.success(result.message || `${service} Verified`);
            } else {
                setServiceStatuses(prev => ({ ...prev, [service]: { status: 'error', message: result.error } }));
                toast.error(result.error || `${service} Verification Failed`);
            }
        } catch (e: any) {
            setServiceStatuses(prev => ({ ...prev, [service]: { status: 'error', message: e.message } }));
            toast.error(`Error testing ${service}`);
        }
    };

    const handleSendTestEmail = async () => {
        if (!testEmailRecipient || !resendKey) {
            toast.error('Please enter a valid recipient email and Resend API key');
            return;
        }
        setIsSendingTestEmail(true);
        try {
            const res = await fetch('/api/admin/test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient: testEmailRecipient, apiKey: resendKey })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Test email sent to ${testEmailRecipient}`);
                setTestEmailRecipient('');
            } else {
                toast.error(data.error || 'Failed to send test email');
            }
        } catch (e: any) {
            toast.error(`Error: ${e.message}`);
        } finally {
            setIsSendingTestEmail(false);
        }
    };

    const fetchModels = async () => {
        setIsLoadingModels(true);
        setAvailableModels([]);
        try {
            const res = await fetch('/api/admin/llm/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: llmProvider, apiKey: llmApiKey })
            });
            if (!res.ok) throw new Error('Failed to fetch models');
            const data = await res.json();
            setAvailableModels(data.models || []);
            if (data.models?.length > 0 && !llmModel) {
                setLlmModel(data.models[0]);
            }
            toast.success(`Found ${data.models?.length || 0} models`);
        } catch {
            toast.error('Failed to fetch models from provider');
        } finally {
            setIsLoadingModels(false);
        }
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await updateSystemConfig({
                llmProvider,
                llmApiKey,
                llmModel,
                systemPrompt,
                tmdbApiKey,
                twitchClientId,
                twitchClientSecret,
                // Voyage AI
                voyageApiKey,
                steamGridApiKey,
                // Feature Flags
                featureAiCritic: enableAiCritic ? 'true' : 'false',
                featureSmartSort: enableSmartSort ? 'true' : 'false',
                featureRecommendations: enableRecommendations ? 'true' : 'false',
                featureChallenges: enableChallenges ? 'true' : 'false'
            });
            toast.success("System configuration updated!");
        } catch {
            toast.error("Failed to update system config.");
        } finally {
            setIsLoading(false);
        }
    };



    return (
        <div className="space-y-8">
            {/* Application Settings Section */}
            <Card className="border-gray-800 bg-gray-900/50 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-blue-500" />
                        <CardTitle>Application Settings</CardTitle>
                    </div>
                    <CardDescription>
                        General application properties for system-wide use.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSaveConfig}>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="appUrl">Public App URL (for Email Links)</Label>
                            <Input
                                id="appUrl"
                                value={appUrl}
                                onChange={e => setAppUrl(e.target.value)}
                                placeholder="e.g. https://curator.app"
                                className="bg-zinc-900/50"
                            />
                            <p className="text-[10px] text-muted-foreground outline-none">
                                This URL will be used to generate verification and reset links.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="pt-4 border-t border-white/5">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Application Settings
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* LLM Provider Section */}
            <Card className="border-white/10 bg-black/20 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-500" />
                        <CardTitle>AI & LLM Provider</CardTitle>
                    </div>
                    <CardDescription>
                        Configure the AI provider for intelligence features.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSaveConfig}>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Provider</Label>
                                <Select value={llmProvider} onValueChange={(v) => { setLlmProvider(v); setAvailableModels([]); setLlmModel(''); }}>
                                    <SelectTrigger className="bg-zinc-900/50">
                                        <SelectValue placeholder="Select provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="openai">OpenAI</SelectItem>
                                        <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                                        <SelectItem value="gemini">Google Gemini</SelectItem>
                                        <SelectItem value="ollama">Ollama (Local)</SelectItem>
                                        <SelectItem value="mistral">Mistral AI</SelectItem>
                                        <SelectItem value="anannas">Anannas AI</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>API Key</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="password"
                                        value={llmApiKey}
                                        onChange={e => setLlmApiKey(e.target.value)}
                                        placeholder="sk-..."
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={fetchModels}
                                        disabled={isLoadingModels}
                                        className="shrink-0"
                                    >
                                        {isLoadingModels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                        <span className="ml-1 hidden sm:inline">Check Models</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>Model</Label>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleTestLLM}
                                    disabled={isTestLoading || !llmModel}
                                    className="h-7 text-[10px] gap-1 shadow-none hover:shadow-none hover:translate-y-0 active:scale-100"
                                >
                                    {isTestLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                                    Test Connection
                                </Button>
                            </div>
                            <div className="space-y-1">
                                <div className="relative">
                                    <Input
                                        list="model-options"
                                        name="llmModel"
                                        value={llmModel}
                                        onChange={e => {
                                            setLlmModel(e.target.value);
                                            setTestResult(null); // Clear result on change
                                        }}
                                        placeholder={availableModels.length === 0 ? "Enter model name or click 'Check Models'..." : "Select or type model name..."}
                                        className={`bg-zinc-900/50 pr-10 transition-colors ${testResult ? (
                                            testResult.success
                                                ? "border-green-500/50 focus-visible:ring-green-500/30"
                                                : "border-red-500/50 focus-visible:ring-red-500/30"
                                        ) : (
                                            llmModel && !availableModels.includes(llmModel) && availableModels.length > 0
                                                ? "border-yellow-500/20"
                                                : ""
                                        )
                                            }`}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {testResult ? (
                                            testResult.success ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            ) : (
                                                <AlertCircle className="h-4 w-4 text-red-500" />
                                            )
                                        ) : (
                                            llmModel && !availableModels.includes(llmModel) && availableModels.length > 0 && (
                                                <AlertTriangle className="h-4 w-4 text-yellow-500/50" />
                                            )
                                        )}
                                    </div>
                                </div>
                                <datalist id="model-options">
                                    {availableModels.map((model) => (
                                        <option key={model} value={model} />
                                    ))}
                                </datalist>
                                <div className="text-[10px] flex flex-col gap-0.5">
                                    {testResult && (
                                        <span className={testResult.success ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                                            {testResult.success ? "✓ Connection Verified" : `✗ Connection Failed: ${testResult.message}`}
                                        </span>
                                    )}
                                    {availableModels.length === 0 && !testResult && (
                                        <p className="text-muted-foreground">Enter your API key and click "Check Models" to load available models</p>
                                    )}
                                    {llmModel && !availableModels.includes(llmModel) && availableModels.length > 0 && !testResult && (
                                        <span className="text-yellow-500/70 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" /> Manual entry (unverified)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>System Prompt</Label>
                            <textarea
                                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={systemPrompt}
                                onChange={e => setSystemPrompt(e.target.value)}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="pt-4">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save LLM Configuration
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* Voyage AI Embeddings */}
            <Card className="border-white/10 bg-black/20 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-blue-500" />
                        <CardTitle>Voyage AI Embeddings</CardTitle>
                    </div>
                    <CardDescription>
                        API key for generating vector embeddings used in taste compatibility and item search.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSaveConfig}>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Voyage API Key</Label>
                            <Input
                                type="password"
                                value={voyageApiKey}
                                onChange={e => setVoyageApiKey(e.target.value)}
                                placeholder="pa-..."
                            />
                            <p className="text-[10px] text-muted-foreground">Get your key from <a href="https://dash.voyageai.com/" target="_blank" className="underline hover:text-white">dash.voyageai.com</a></p>
                        </div>
                    </CardContent>
                    <CardFooter className="pt-4">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Voyage API Key
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* Media Data Sources */}
            <Card className="border-white/10 bg-black/20 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-green-500" />
                        <CardTitle>Media Data Sources</CardTitle>
                    </div>
                    <CardDescription>
                        API keys for fetching metadata from external services.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSaveConfig}>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>TMDB API Key (Movies & TV)</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTestService('tmdb', tmdbApiKey)}
                                    disabled={serviceStatuses.tmdb.status === 'loading' || !tmdbApiKey}
                                    className="h-7 text-[10px] gap-1 shadow-none hover:shadow-none hover:translate-y-0 active:scale-100"
                                >
                                    {serviceStatuses.tmdb.status === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                        serviceStatuses.tmdb.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> :
                                            serviceStatuses.tmdb.status === 'error' ? <AlertCircle className="h-3 w-3 text-red-500" /> : <Zap className="h-3 w-3" />}
                                    Test TMDB
                                </Button>
                            </div>
                            <Input
                                type="password"
                                value={tmdbApiKey}
                                onChange={e => { setTmdbApiKey(e.target.value); setServiceStatuses(prev => ({ ...prev, tmdb: { status: 'idle' } })); }}
                                placeholder="The Movie Database API Key"
                                className={serviceStatuses.tmdb.status === 'success' ? 'border-green-500/50' : serviceStatuses.tmdb.status === 'error' ? 'border-red-500/50' : ''}
                            />
                            {serviceStatuses.tmdb.status === 'error' && <p className="text-[10px] text-red-500 font-medium">{serviceStatuses.tmdb.message}</p>}
                            <p className="text-[10px] text-muted-foreground">Get your key from <a href="https://www.themoviedb.org/settings/api" target="_blank" className="underline hover:text-white">themoviedb.org</a></p>
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>Twitch API (IGDB / Video Games)</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTestService('twitch', twitchClientId, twitchClientSecret)}
                                    disabled={serviceStatuses.twitch?.status === 'loading' || !twitchClientId || !twitchClientSecret}
                                    className="h-7 text-[10px] gap-1 shadow-none hover:shadow-none hover:translate-y-0 active:scale-100"
                                >
                                    {serviceStatuses.twitch?.status === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                        serviceStatuses.twitch?.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> :
                                            serviceStatuses.twitch?.status === 'error' ? <AlertCircle className="h-3 w-3 text-red-500" /> : <Zap className="h-3 w-3" />}
                                    Test Twitch
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    type="password"
                                    value={twitchClientId}
                                    onChange={e => { setTwitchClientId(e.target.value); setServiceStatuses(prev => ({ ...prev, twitch: { status: 'idle' } })); }}
                                    placeholder="Client ID"
                                    className={serviceStatuses.twitch?.status === 'success' ? 'border-green-500/50' : serviceStatuses.twitch?.status === 'error' ? 'border-red-500/50' : ''}
                                />
                                <Input
                                    type="password"
                                    value={twitchClientSecret}
                                    onChange={e => { setTwitchClientSecret(e.target.value); setServiceStatuses(prev => ({ ...prev, twitch: { status: 'idle' } })); }}
                                    placeholder="Client Secret"
                                />
                            </div>
                            {serviceStatuses.twitch?.status === 'error' && <p className="text-[10px] text-red-500 font-medium">{serviceStatuses.twitch.message}</p>}
                            <p className="text-[10px] text-muted-foreground">Required for game metadata. Get credentials from <a href="https://dev.twitch.tv/console" target="_blank" className="underline hover:text-white">Twitch Console</a></p>
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>SteamGridDB API Key (Game Covers)</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTestService('steamgrid', steamGridApiKey)}
                                    disabled={serviceStatuses.steamgrid?.status === 'loading' || !steamGridApiKey}
                                    className="h-7 text-[10px] gap-1 shadow-none hover:shadow-none hover:translate-y-0 active:scale-100"
                                >
                                    {serviceStatuses.steamgrid?.status === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                        serviceStatuses.steamgrid?.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> :
                                            serviceStatuses.steamgrid?.status === 'error' ? <AlertCircle className="h-3 w-3 text-red-500" /> : <Zap className="h-3 w-3" />}
                                    Test SteamGridDB
                                </Button>
                            </div>
                            <Input
                                type="password"
                                value={steamGridApiKey}
                                onChange={e => { setSteamGridApiKey(e.target.value); setServiceStatuses(prev => ({ ...prev, steamgrid: { status: 'idle' } })); }}
                                placeholder="SteamGridDB API Key"
                                className={serviceStatuses.steamgrid?.status === 'success' ? 'border-green-500/50' : serviceStatuses.steamgrid?.status === 'error' ? 'border-red-500/50' : ''}
                            />
                            {serviceStatuses.steamgrid?.status === 'error' && <p className="text-[10px] text-red-500 font-medium">{serviceStatuses.steamgrid.message}</p>}
                            <p className="text-[10px] text-muted-foreground">Required for high-quality vertical game covers. Get key from <a href="https://www.steamgriddb.com/profile/preferences" target="_blank" className="underline hover:text-white">SteamGridDB Preferences</a></p>
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>Google Books API Key (Books)</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTestService('googlebooks', googleBooksApiKey)}
                                    disabled={serviceStatuses.googlebooks?.status === 'loading' || !googleBooksApiKey}
                                    className="h-7 text-[10px] gap-1 shadow-none hover:shadow-none hover:translate-y-0 active:scale-100"
                                >
                                    {serviceStatuses.googlebooks?.status === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                        serviceStatuses.googlebooks?.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> :
                                            serviceStatuses.googlebooks?.status === 'error' ? <AlertCircle className="h-3 w-3 text-red-500" /> : <Zap className="h-3 w-3" />}
                                    Test Google Books
                                </Button>
                            </div>
                            <Input
                                type="password"
                                value={googleBooksApiKey}
                                onChange={e => { setGoogleBooksApiKey(e.target.value); setServiceStatuses(prev => ({ ...prev, googlebooks: { status: 'idle' } })); }}
                                placeholder="Google Books API Key"
                                className={serviceStatuses.googlebooks?.status === 'success' ? 'border-green-500/50' : serviceStatuses.googlebooks?.status === 'error' ? 'border-red-500/50' : ''}
                            />
                            {serviceStatuses.googlebooks?.status === 'error' && <p className="text-[10px] text-red-500 font-medium">{serviceStatuses.googlebooks.message}</p>}
                            <p className="text-[10px] text-muted-foreground">Get your key from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline hover:text-white">Google Cloud Console</a></p>
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>Spotify Client ID (Music)</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTestService('spotify', spotifyClientId, spotifyClientSecret)}
                                    disabled={serviceStatuses.spotify?.status === 'loading' || !spotifyClientId || !spotifyClientSecret}
                                    className="h-7 text-[10px] gap-1 shadow-none hover:shadow-none hover:translate-y-0 active:scale-100"
                                >
                                    {serviceStatuses.spotify?.status === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                        serviceStatuses.spotify?.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> :
                                            serviceStatuses.spotify?.status === 'error' ? <AlertCircle className="h-3 w-3 text-red-500" /> : <Zap className="h-3 w-3" />}
                                    Test Spotify
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    type="password"
                                    value={spotifyClientId}
                                    onChange={e => { setSpotifyClientId(e.target.value); setServiceStatuses(prev => ({ ...prev, spotify: { status: 'idle' } })); }}
                                    placeholder="Client ID"
                                    className={serviceStatuses.spotify?.status === 'success' ? 'border-green-500/50' : serviceStatuses.spotify?.status === 'error' ? 'border-red-500/50' : ''}
                                />
                                <Input
                                    type="password"
                                    value={spotifyClientSecret}
                                    onChange={e => { setSpotifyClientSecret(e.target.value); setServiceStatuses(prev => ({ ...prev, spotify: { status: 'idle' } })); }}
                                    placeholder="Client Secret"
                                />
                            </div>
                            {serviceStatuses.spotify?.status === 'error' && <p className="text-[10px] text-red-500 font-medium">{serviceStatuses.spotify.message}</p>}
                            <p className="text-[10px] text-muted-foreground">Get your credentials from <a href="https://developer.spotify.com/dashboard" target="_blank" className="underline hover:text-white">Spotify Developer Dashboard</a></p>
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>ComicVine API Key (Comics)</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTestService('comicvine', comicVineApiKey)}
                                    disabled={serviceStatuses.comicvine?.status === 'loading' || !comicVineApiKey}
                                    className="h-7 text-[10px] gap-1 shadow-none hover:shadow-none hover:translate-y-0 active:scale-100"
                                >
                                    {serviceStatuses.comicvine?.status === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                        serviceStatuses.comicvine?.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> :
                                            serviceStatuses.comicvine?.status === 'error' ? <AlertCircle className="h-3 w-3 text-red-500" /> : <Zap className="h-3 w-3" />}
                                    Test ComicVine
                                </Button>
                            </div>
                            <Input
                                type="password"
                                value={comicVineApiKey}
                                onChange={e => { setComicVineApiKey(e.target.value); setServiceStatuses(prev => ({ ...prev, comicvine: { status: 'idle' } })); }}
                                placeholder="ComicVine API Key"
                                className={serviceStatuses.comicvine?.status === 'success' ? 'border-green-500/50' : serviceStatuses.comicvine?.status === 'error' ? 'border-red-500/50' : ''}
                            />
                            {serviceStatuses.comicvine?.status === 'error' && <p className="text-[10px] text-red-500 font-medium">{serviceStatuses.comicvine.message}</p>}
                            <p className="text-[10px] text-muted-foreground">Get your key from <a href="https://comicvine.gamespot.com/api/" target="_blank" className="underline hover:text-white">ComicVine API</a></p>
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>BoardGameGeek API Key (Board Games)</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTestService('bgg', bggApiKey)}
                                    disabled={serviceStatuses.bgg?.status === 'loading' || !bggApiKey}
                                    className="h-7 text-[10px] gap-1 shadow-none hover:shadow-none hover:translate-y-0 active:scale-100"
                                >
                                    {serviceStatuses.bgg?.status === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                        serviceStatuses.bgg?.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> :
                                            serviceStatuses.bgg?.status === 'error' ? <AlertCircle className="h-3 w-3 text-red-500" /> : <Zap className="h-3 w-3" />}
                                    Test BGG
                                </Button>
                            </div>
                            <Input
                                type="password"
                                value={bggApiKey}
                                onChange={e => { setBggApiKey(e.target.value); setServiceStatuses(prev => ({ ...prev, bgg: { status: 'idle' } })); }}
                                placeholder="BGG API Key"
                                className={serviceStatuses.bgg?.status === 'success' ? 'border-green-500/50' : serviceStatuses.bgg?.status === 'error' ? 'border-red-500/50' : ''}
                            />
                            {serviceStatuses.bgg?.status === 'error' && <p className="text-[10px] text-red-500 font-medium">{serviceStatuses.bgg.message}</p>}
                            <p className="text-[10px] text-muted-foreground">Register at <a href="https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use" target="_blank" className="underline hover:text-white">BGG API Terms</a> to get access</p>
                        </div>

                        {/* OMDB (Ratings) */}
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>OMDB API Key (Global Ratings)</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTestService('omdb', omdbApiKey)}
                                    disabled={serviceStatuses.omdb?.status === 'loading' || !omdbApiKey}
                                    className="h-7 text-[10px] gap-1 shadow-none hover:shadow-none hover:translate-y-0 active:scale-100"
                                >
                                    {serviceStatuses.omdb?.status === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                        serviceStatuses.omdb?.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> :
                                            serviceStatuses.omdb?.status === 'error' ? <AlertCircle className="h-3 w-3 text-red-500" /> : <Zap className="h-3 w-3" />}
                                    Test OMDB
                                </Button>
                            </div>
                            <Input
                                type="password"
                                value={omdbApiKey}
                                onChange={e => { setOmdbApiKey(e.target.value); setServiceStatuses(prev => ({ ...prev, omdb: { status: 'idle' } })); }}
                                placeholder="OMDB API Key"
                                className={serviceStatuses.omdb?.status === 'success' ? 'border-green-500/50' : serviceStatuses.omdb?.status === 'error' ? 'border-red-500/50' : ''}
                            />
                            {serviceStatuses.omdb?.status === 'error' && <p className="text-[10px] text-red-500 font-medium">{serviceStatuses.omdb.message}</p>}
                            <p className="text-[10px] text-muted-foreground">Required for fetching Rotten Tomatoes & IMDb ratings. Get key from <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" className="underline hover:text-white">omdbapi.com</a></p>
                        </div>

                        {/* Metron (Comic Backup) */}
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>Metron (Comic Backup)</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTestService('metron', metronUsername, metronPassword)}
                                    disabled={serviceStatuses.metron?.status === 'loading' || !metronUsername || !metronPassword}
                                    className="h-7 text-[10px] gap-1 shadow-none hover:shadow-none hover:translate-y-0 active:scale-100"
                                >
                                    {serviceStatuses.metron?.status === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                        serviceStatuses.metron?.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> :
                                            serviceStatuses.metron?.status === 'error' ? <AlertCircle className="h-3 w-3 text-red-500" /> : <Zap className="h-3 w-3" />}
                                    Test Metron
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    type="text"
                                    value={metronUsername}
                                    onChange={e => { setMetronUsername(e.target.value); setServiceStatuses(prev => ({ ...prev, metron: { status: 'idle' } })); }}
                                    placeholder="Metron Username"
                                    className={serviceStatuses.metron?.status === 'success' ? 'border-green-500/50' : serviceStatuses.metron?.status === 'error' ? 'border-red-500/50' : ''}
                                />
                                <Input
                                    type="password"
                                    value={metronPassword}
                                    onChange={e => { setMetronPassword(e.target.value); setServiceStatuses(prev => ({ ...prev, metron: { status: 'idle' } })); }}
                                    placeholder="Metron Password"
                                />
                            </div>
                            {serviceStatuses.metron?.status === 'error' && <p className="text-[10px] text-red-500 font-medium">{serviceStatuses.metron.message}</p>}
                            <p className="text-[10px] text-muted-foreground">Used as a fallback for comics. Register at <a href="https://metron.cloud" target="_blank" className="underline hover:text-white">metron.cloud</a></p>
                        </div>

                        {/* AniList (No API Key Required) */}


                        {/* iTunes (No API Key Required) */}

                    </CardContent>
                    <CardFooter className="pt-4">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save API Keys
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* Email Infrastructure Section */}
            <Card className="border-white/10 bg-black/20 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-blue-500" />
                        <CardTitle>Email Infrastructure</CardTitle>
                    </div>
                    <CardDescription>
                        Configure transactional email settings (Resend).
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSaveConfig}>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>Resend API Key</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTestService('resend', resendKey)}
                                    disabled={serviceStatuses.resend.status === 'loading' || !resendKey}
                                    className="h-7 text-[10px] gap-1 shadow-none hover:shadow-none hover:translate-y-0 active:scale-100"
                                >
                                    {serviceStatuses.resend.status === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                        serviceStatuses.resend.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> :
                                            serviceStatuses.resend.status === 'error' ? <AlertCircle className="h-3 w-3 text-red-500" /> : <Zap className="h-3 w-3" />}
                                    Test Resend
                                </Button>
                            </div>
                            <Input
                                type="password"
                                value={resendKey}
                                onChange={e => { setResendKey(e.target.value); setServiceStatuses(prev => ({ ...prev, resend: { status: 'idle' } })); }}
                                placeholder="re_..."
                                className={serviceStatuses.resend.status === 'success' ? 'border-green-500/50' : serviceStatuses.resend.status === 'error' ? 'border-red-500/50' : ''}
                            />
                            {serviceStatuses.resend.status === 'error' && <p className="text-[10px] text-red-500 font-medium">{serviceStatuses.resend.message}</p>}
                            <p className="text-[10px] text-muted-foreground">Get your key from <a href="https://resend.com/api-keys" target="_blank" className="underline hover:text-white">resend.com</a></p>
                        </div>

                        <div className="grid gap-2">
                            <Label>From Email Address</Label>
                            <Input
                                type="email"
                                value={fromEmail}
                                onChange={e => setFromEmail(e.target.value)}
                                placeholder="noreply@yourdomain.com"
                            />
                            <p className="text-[10px] text-muted-foreground">The email address emails will be sent from (must be verified in Resend)</p>
                        </div>

                        {/* Test Email Section */}
                        <div className="pt-4 border-t border-white/10">
                            <Label className="mb-2 block">Send Test Email</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="email"
                                    value={testEmailRecipient}
                                    onChange={e => setTestEmailRecipient(e.target.value)}
                                    placeholder="recipient@example.com"
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleSendTestEmail}
                                    disabled={isSendingTestEmail || !resendKey || !testEmailRecipient}
                                    className="shrink-0"
                                >
                                    {isSendingTestEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Test'}
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">Sends a test email to verify your Resend configuration</p>
                        </div>
                    </CardContent>
                    <CardFooter className="pt-4">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Email Configuration
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* Feature Flags Section */}
            <Card className="border-white/10 bg-black/20 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-400" />
                        Feature Flags
                    </CardTitle>
                    <CardDescription>
                        Toggle features to customize the app experience.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                        <div>
                            <Label className="text-sm font-medium">AI Critic</Label>
                            <p className="text-xs text-muted-foreground">Allow users to generate AI critiques of their lists</p>
                        </div>
                        <Button
                            variant={enableAiCritic ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setEnableAiCritic(!enableAiCritic)}
                            className={enableAiCritic ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                            {enableAiCritic ? 'Enabled' : 'Disabled'}
                        </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                        <div>
                            <Label className="text-sm font-medium">Smart Sort</Label>
                            <p className="text-xs text-muted-foreground">AI auto-sorts items into tiers based on reviews</p>
                        </div>
                        <Button
                            variant={enableSmartSort ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setEnableSmartSort(!enableSmartSort)}
                            className={enableSmartSort ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                            {enableSmartSort ? 'Enabled' : 'Disabled'}
                        </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                        <div>
                            <Label className="text-sm font-medium">AI Recommendations</Label>
                            <p className="text-xs text-muted-foreground">AI-powered recommendations based on user preferences</p>
                        </div>
                        <Button
                            variant={enableRecommendations ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setEnableRecommendations(!enableRecommendations)}
                            className={enableRecommendations ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                            {enableRecommendations ? 'Enabled' : 'Disabled'}
                        </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                        <div>
                            <Label className="text-sm font-medium">Community Challenges</Label>
                            <p className="text-xs text-muted-foreground">Allow community challenge features</p>
                        </div>
                        <Button
                            variant={enableChallenges ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setEnableChallenges(!enableChallenges)}
                            className={enableChallenges ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                            {enableChallenges ? 'Enabled' : 'Disabled'}
                        </Button>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={(e) => handleSaveConfig(e)} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Feature Flags
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
