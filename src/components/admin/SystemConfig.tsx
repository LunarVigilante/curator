'use client';

import { useState } from 'react';
import { Save, Database, Mail, Terminal } from 'lucide-react';

export default function SystemConfig() {
    const [config, setConfig] = useState({
        llmProvider: 'openai',
        llmApiKey: '',
        tmdbApiKey: '',
        rawgApiKey: '',
        lastfmApiKey: '',
        emailHost: '',
        emailPort: '',
        emailUser: '',
        emailPass: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = (section: string) => {
        console.log(`Saving ${section} settings...`, config);
        // Add specific API calls here if needed
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8 text-white">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
                <p className="text-gray-400 mt-2">Manage external connections and API keys.</p>
            </div>

            {/* 1. LLM CONFIGURATION */}
            <div className="border border-gray-800 bg-gray-900/50 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Terminal className="w-5 h-5 text-blue-400" />
                    <h2 className="text-lg font-semibold">AI & LLM Provider</h2>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-300">Select Provider</label>
                        <select
                            name="llmProvider"
                            value={config.llmProvider}
                            onChange={handleChange}
                            className="p-3 rounded-lg bg-gray-950 border border-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                        >
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic (Claude)</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="ollama">Ollama (Local)</option>
                        </select>
                    </div>

                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-300">API Key</label>
                        <input
                            type="password"
                            name="llmApiKey"
                            value={config.llmApiKey}
                            onChange={handleChange}
                            placeholder="sk-..."
                            className="p-3 rounded-lg bg-gray-950 border border-gray-800 focus:border-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="pt-6">
                    <button
                        onClick={() => handleSave('LLM')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save LLM Configuration
                    </button>
                </div>
            </div>

            {/* 2. MEDIA DATA SOURCES */}
            <div className="border border-gray-800 bg-gray-900/50 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Database className="w-5 h-5 text-green-400" />
                    <h2 className="text-lg font-semibold">Media Data Sources</h2>
                </div>

                <div className="space-y-6">
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-300">TMDB API Key (Movies/TV)</label>
                        <input
                            type="text"
                            name="tmdbApiKey"
                            value={config.tmdbApiKey}
                            onChange={handleChange}
                            placeholder="The Movie Database Key"
                            className="p-3 rounded-lg bg-gray-950 border border-gray-800 focus:border-green-500 outline-none"
                        />
                    </div>

                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-300">RAWG.io API Key (Games)</label>
                        <input
                            type="text"
                            name="rawgApiKey"
                            value={config.rawgApiKey}
                            onChange={handleChange}
                            placeholder="RAWG Database Key"
                            className="p-3 rounded-lg bg-gray-950 border border-gray-800 focus:border-green-500 outline-none"
                        />
                    </div>

                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-300">Last.fm API Key (Music)</label>
                        <input
                            type="text"
                            name="lastfmApiKey"
                            value={config.lastfmApiKey}
                            onChange={handleChange}
                            placeholder="Last.fm API Key"
                            className="p-3 rounded-lg bg-gray-950 border border-gray-800 focus:border-green-500 outline-none"
                        />
                    </div>
                </div>

                <div className="pt-6">
                    <button
                        onClick={() => handleSave('Media')}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Media Keys
                    </button>
                </div>
            </div>

            {/* 3. EMAIL INFRASTRUCTURE */}
            <div className="border border-gray-800 bg-gray-900/50 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Mail className="w-5 h-5 text-purple-400" />
                    <h2 className="text-lg font-semibold">Email Infrastructure</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-300">SMTP Host</label>
                        <input
                            type="text"
                            name="emailHost"
                            value={config.emailHost}
                            onChange={handleChange}
                            placeholder="smtp.provider.com"
                            className="p-3 rounded-lg bg-gray-950 border border-gray-800 focus:border-purple-500 outline-none"
                        />
                    </div>
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-300">SMTP Port</label>
                        <input
                            type="text"
                            name="emailPort"
                            value={config.emailPort}
                            onChange={handleChange}
                            placeholder="587"
                            className="p-3 rounded-lg bg-gray-950 border border-gray-800 focus:border-purple-500 outline-none"
                        />
                    </div>
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-300">Username</label>
                        <input
                            type="text"
                            name="emailUser"
                            value={config.emailUser}
                            onChange={handleChange}
                            className="p-3 rounded-lg bg-gray-950 border border-gray-800 focus:border-purple-500 outline-none"
                        />
                    </div>
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-300">Password</label>
                        <input
                            type="password"
                            name="emailPass"
                            value={config.emailPass}
                            onChange={handleChange}
                            className="p-3 rounded-lg bg-gray-950 border border-gray-800 focus:border-purple-500 outline-none"
                        />
                    </div>
                </div>

                <div className="pt-6">
                    <button
                        onClick={() => handleSave('Email')}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Email Config
                    </button>
                </div>
            </div>
        </div>
    );
}
