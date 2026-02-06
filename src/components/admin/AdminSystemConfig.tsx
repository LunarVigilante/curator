'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardDescription, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, Database, Brain, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { updateSystemConfig, getSystemConfig, testLLMConnectionAction, testServiceConnection } from '@/lib/actions/admin';
import { useEffect } from 'react';
import { ApiKeyInput } from '@/components/admin/settings/ApiKeyInput';

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [rawgApiKey, setRawgApiKey] = useState(settings?.['rawg_api_key'] || '');
    const [googleBooksApiKey, setGoogleBooksApiKey] = useState(settings?.['google_books_api_key'] || '');
    const [spotifyClientId, setSpotifyClientId] = useState(settings?.['spotify_client_id'] || '');
    const [spotifyClientSecret, setSpotifyClientSecret] = useState(settings?.['spotify_client_secret'] || '');
    const [comicVineApiKey, setComicVineApiKey] = useState(settings?.['comicvine_api_key'] || '');
    const [bggApiKey, setBggApiKey] = useState(settings?.['bgg_api_key'] || '');
    const [metronUsername, setMetronUsername] = useState(settings?.['metron_username'] || '');
    const [metronPassword, setMetronPassword] = useState(settings?.['metron_password'] || '');
    const [omdbApiKey, setOmdbApiKey] = useState(settings?.['omdb_api_key'] || '');
    const [tvdbApiKey, setTvdbApiKey] = useState(settings?.['tvdb_api_key'] || '');
    const [tvdbPin, setTvdbPin] = useState(settings?.['tvdb_pin'] || '');

    // Voyage AI (Embeddings)
    const [voyageApiKey, setVoyageApiKey] = useState(settings?.['voyage_api_key'] || '');
    const [voyageModel, setVoyageModel] = useState(settings?.['voyage_model'] || 'voyage-3');

    // Media API Endpoints (Custom URLs)
    // Twitch / IGDB
    const [twitchClientId, setTwitchClientId] = useState(settings?.['twitch_client_id'] || '');
    const [twitchClientSecret, setTwitchClientSecret] = useState(settings?.['twitch_client_secret'] || '');

    // Email State
    const [resendKey, setResendKey] = useState(settings?.['resend_api_key'] || '');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [fromEmail, setFromEmail] = useState(settings?.['resend_from_email'] || '');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [appUrl, setAppUrl] = useState(settings?.['public_app_url'] || 'http://localhost:3000');
    const [testEmailRecipient, setTestEmailRecipient] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        twitch: { status: 'idle' },
        tvdb: { status: 'idle' }
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
            if (config['tvdb_api_key']) setTvdbApiKey(config['tvdb_api_key']);
            if (config['tvdb_pin']) setTvdbPin(config['tvdb_pin']);

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

    const handleTestService = async (service: 'tmdb' | 'twitch' | 'googlebooks' | 'spotify' | 'resend' | 'comicvine' | 'bgg' | 'metron' | 'omdb' | 'steamgrid' | 'tvdb', apiKey: string, clientSecret?: string) => {
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleSendTestEmail = async () => {
        if (!testEmailRecipient || !resendKey) {
            toast.error('Please enter a valid recipient email and Resend API key');
            return;
        }
        setIsSendingTestEmail(true);
        try {
            const res = await fetch('/api/v1/admin/test-email', {
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
            const res = await fetch('/api/v1/admin/llm/models', {
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
                voyageModel,
                steamGridApiKey,
                // Feature Flags
                featureAiCritic: enableAiCritic ? 'true' : 'false',
                featureSmartSort: enableSmartSort ? 'true' : 'false',
                featureRecommendations: enableRecommendations ? 'true' : 'false',
                featureChallenges: enableChallenges ? 'true' : 'false',
                // TVDB
                tvdbApiKey,
                tvdbPin
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
                        API key and model for generating vector embeddings used in taste compatibility and item search.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSaveConfig}>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <div className="grid gap-2">
                                <Label>Embedding Model</Label>
                                <Select value={voyageModel} onValueChange={setVoyageModel}>
                                    <SelectTrigger className="bg-zinc-900/50">
                                        <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="voyage-4">voyage-4 (Latest)</SelectItem>
                                        <SelectItem value="voyage-3">voyage-3</SelectItem>
                                        <SelectItem value="voyage-3-lite">voyage-3-lite</SelectItem>
                                        <SelectItem value="voyage-large-2">voyage-large-2</SelectItem>
                                        <SelectItem value="voyage-code-2">voyage-code-2</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">Model used for generating embeddings (voyage-4 recommended)</p>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="pt-4">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Voyage Configuration
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
                        <ApiKeyInput
                            label="TMDB API Key (Movies & TV)"
                            value={tmdbApiKey}
                            onChange={(v) => { setTmdbApiKey(v); setServiceStatuses(prev => ({ ...prev, tmdb: { status: 'idle' } })); }}
                            serviceStatus={serviceStatuses.tmdb}
                            onTest={() => handleTestService('tmdb', tmdbApiKey)}
                            testLabel="TMDB"
                            placeholder="The Movie Database API Key"
                            helpText={<>Get your key from <a href="https://www.themoviedb.org/settings/api" target="_blank" className="underline hover:text-white">themoviedb.org</a></>}
                        />
                        <ApiKeyInput
                            label="Twitch API (IGDB / Video Games)"
                            value={twitchClientId}
                            onChange={(v) => { setTwitchClientId(v); setServiceStatuses(prev => ({ ...prev, twitch: { status: 'idle' } })); }}
                            serviceStatus={serviceStatuses.twitch || { status: 'idle' }}
                            onTest={() => handleTestService('twitch', twitchClientId, twitchClientSecret)}
                            testLabel="Twitch"
                            placeholder="Client ID"
                            secondaryValue={twitchClientSecret}
                            secondaryOnChange={(v) => { setTwitchClientSecret(v); setServiceStatuses(prev => ({ ...prev, twitch: { status: 'idle' } })); }}
                            secondaryPlaceholder="Client Secret"
                            helpText={<>Required for game metadata. Get credentials from <a href="https://dev.twitch.tv/console" target="_blank" className="underline hover:text-white">Twitch Console</a></>}
                        />

                        <ApiKeyInput
                            label="SteamGridDB API Key (Game Covers)"
                            value={steamGridApiKey}
                            onChange={(v) => { setSteamGridApiKey(v); setServiceStatuses(prev => ({ ...prev, steamgrid: { status: 'idle' } })); }}
                            serviceStatus={serviceStatuses.steamgrid || { status: 'idle' }}
                            onTest={() => handleTestService('steamgrid', steamGridApiKey)}
                            testLabel="SteamGridDB"
                            placeholder="SteamGridDB API Key"
                            helpText={<>Required for high-quality vertical game covers. Get key from <a href="https://www.steamgriddb.com/profile/preferences" target="_blank" className="underline hover:text-white">SteamGridDB Preferences</a></>}
                        />

                        <ApiKeyInput
                            label="Google Books API Key (Books)"
                            value={googleBooksApiKey}
                            onChange={(v) => { setGoogleBooksApiKey(v); setServiceStatuses(prev => ({ ...prev, googlebooks: { status: 'idle' } })); }}
                            serviceStatus={serviceStatuses.googlebooks || { status: 'idle' }}
                            onTest={() => handleTestService('googlebooks', googleBooksApiKey)}
                            testLabel="Google Books"
                            placeholder="Google Books API Key"
                            helpText={<>Get your key from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline hover:text-white">Google Cloud Console</a></>}
                        />
                        <ApiKeyInput
                            label="Spotify Client ID (Music)"
                            value={spotifyClientId}
                            onChange={(v) => { setSpotifyClientId(v); setServiceStatuses(prev => ({ ...prev, spotify: { status: 'idle' } })); }}
                            serviceStatus={serviceStatuses.spotify || { status: 'idle' }}
                            onTest={() => handleTestService('spotify', spotifyClientId, spotifyClientSecret)}
                            testLabel="Spotify"
                            placeholder="Client ID"
                            secondaryValue={spotifyClientSecret}
                            secondaryOnChange={(v) => { setSpotifyClientSecret(v); setServiceStatuses(prev => ({ ...prev, spotify: { status: 'idle' } })); }}
                            secondaryPlaceholder="Client Secret"
                            helpText={<>Get your credentials from <a href="https://developer.spotify.com/dashboard" target="_blank" className="underline hover:text-white">Spotify Developer Dashboard</a></>}
                        />
                        <ApiKeyInput
                            label="ComicVine API Key (Comics)"
                            value={comicVineApiKey}
                            onChange={(v) => { setComicVineApiKey(v); setServiceStatuses(prev => ({ ...prev, comicvine: { status: 'idle' } })); }}
                            serviceStatus={serviceStatuses.comicvine || { status: 'idle' }}
                            onTest={() => handleTestService('comicvine', comicVineApiKey)}
                            testLabel="ComicVine"
                            placeholder="ComicVine API Key"
                            helpText={<>Get your key from <a href="https://comicvine.gamespot.com/api/" target="_blank" className="underline hover:text-white">ComicVine API</a></>}
                        />
                        <ApiKeyInput
                            label="BoardGameGeek API Key (Board Games)"
                            value={bggApiKey}
                            onChange={(v) => { setBggApiKey(v); setServiceStatuses(prev => ({ ...prev, bgg: { status: 'idle' } })); }}
                            serviceStatus={serviceStatuses.bgg || { status: 'idle' }}
                            onTest={() => handleTestService('bgg', bggApiKey)}
                            testLabel="BGG"
                            placeholder="BGG API Key"
                            helpText={<>Register at <a href="https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use" target="_blank" className="underline hover:text-white">BGG API Terms</a> to get access</>}
                        />

                        {/* OMDB (Ratings) */}
                        <ApiKeyInput
                            label="OMDB API Key (Global Ratings)"
                            value={omdbApiKey}
                            onChange={(v) => { setOmdbApiKey(v); setServiceStatuses(prev => ({ ...prev, omdb: { status: 'idle' } })); }}
                            serviceStatus={serviceStatuses.omdb || { status: 'idle' }}
                            onTest={() => handleTestService('omdb', omdbApiKey)}
                            testLabel="OMDB"
                            placeholder="OMDB API Key"
                            helpText={<>Required for fetching Rotten Tomatoes & IMDb ratings. Get key from <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" className="underline hover:text-white">omdbapi.com</a></>}
                        />

                        {/* TVDB v4 (TV Enrichment) */}
                        <ApiKeyInput
                            label="TVDB v4 (TV Enrichment)"
                            value={tvdbApiKey}
                            onChange={(v) => { setTvdbApiKey(v); setServiceStatuses(prev => ({ ...prev, tvdb: { status: 'idle' } })); }}
                            serviceStatus={serviceStatuses.tvdb || { status: 'idle' }}
                            onTest={() => handleTestService('tvdb', tvdbApiKey, tvdbPin)}
                            testLabel="TVDB"
                            placeholder="API Key"
                            secondaryValue={tvdbPin}
                            secondaryOnChange={(v) => { setTvdbPin(v); setServiceStatuses(prev => ({ ...prev, tvdb: { status: 'idle' } })); }}
                            secondaryPlaceholder="User PIN (optional)"
                            secondaryOptional={true}
                            helpText={<>Enhanced TV metadata (characters, tags, franchises). Get credentials from <a href="https://thetvdb.com/api-information" target="_blank" className="underline hover:text-white">thetvdb.com</a></>}
                        />

                        {/* Metron (Comic Backup) */}
                        <ApiKeyInput
                            label="Metron (Comic Backup)"
                            value={metronUsername}
                            onChange={(v) => { setMetronUsername(v); setServiceStatuses(prev => ({ ...prev, metron: { status: 'idle' } })); }}
                            serviceStatus={serviceStatuses.metron || { status: 'idle' }}
                            onTest={() => handleTestService('metron', metronUsername, metronPassword)}
                            testLabel="Metron"
                            placeholder="Metron Username"
                            secondaryValue={metronPassword}
                            secondaryOnChange={(v) => { setMetronPassword(v); setServiceStatuses(prev => ({ ...prev, metron: { status: 'idle' } })); }}
                            secondaryPlaceholder="Metron Password"
                            helpText={<>Used as a fallback for comics. Register at <a href="https://metron.cloud" target="_blank" className="underline hover:text-white">metron.cloud</a></>}
                        />

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
        </div>
    );
}
