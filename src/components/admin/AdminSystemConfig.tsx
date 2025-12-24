'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardDescription, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea'; // Assuming exists, or I'll use standard
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Copy, RefreshCw } from 'lucide-react';
import { updateSystemConfig, generateInviteCode, getInvites, sendTestEmailAction } from '@/lib/actions/admin';

interface AdminSystemConfigProps {
    settings: any;
}

export default function AdminSystemConfig({ settings }: AdminSystemConfigProps) {
    const [isLoading, setIsLoading] = useState(false);

    // LLM State
    const [apiKey, setApiKey] = useState(settings?.find((s: any) => s.key === 'anannas_api_key')?.value || '');
    const [model, setModel] = useState(settings?.find((s: any) => s.key === 'anannas_model')?.value || 'meta-llama/llama-3-70b-instruct');
    const [systemPrompt, setSystemPrompt] = useState(settings?.find((s: any) => s.key === 'system_prompt')?.value || 'You represent the Curator application. Be concise and objective.');
    const [resendKey, setResendKey] = useState(settings?.find((s: any) => s.key === 'resend_api_key')?.value || '');
    const [fromEmail, setFromEmail] = useState(settings?.find((s: any) => s.key === 'resend_from_email')?.value || '');

    // Invite State
    const [invites, setInvites] = useState<any[]>([]);
    const [isInviteLoading, setIsInviteLoading] = useState(false);

    // Initial Invite Load
    useEffect(() => {
        loadInvites();
    }, []);

    const loadInvites = async () => {
        setIsInviteLoading(true);
        try {
            const data = await getInvites();
            setInvites(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsInviteLoading(false);
        }
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await updateSystemConfig({
                anannasKey: apiKey,
                anannasModel: model,
                systemPrompt,
                resendApiKey: resendKey,
                fromEmail
            });
            toast.success("System configuration updated!");
        } catch (err) {
            toast.error("Failed to update system config.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateInvite = async () => {
        setIsInviteLoading(true);
        try {
            const { success, code } = await generateInviteCode();
            if (success) {
                toast.success(`Invite Generated: ${code}`);
                await loadInvites();
            }
        } catch (err) {
            toast.error("Failed to generate invite.");
        } finally {
            setIsInviteLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    return (
        <div className="space-y-8">
            {/* LLM Section */}
            <Card className="border-white/10 bg-black/20 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        <CardTitle>Intelligence Provider</CardTitle>
                    </div>
                    <CardDescription>
                        Configure Anannas AI settings for global intelligence features.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSaveConfig}>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Provider</Label>
                            <Input disabled value="Anannas AI" className="bg-zinc-900/50 text-zinc-400" />
                        </div>
                        <div className="grid gap-2">
                            <Label>API Key</Label>
                            <Input
                                type="password"
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                                placeholder="sk-..."
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Model ID</Label>
                            <Input
                                value={model}
                                onChange={e => setModel(e.target.value)}
                                placeholder="meta-llama/llama-3-70b-instruct"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>System Prompt</Label>
                            <textarea
                                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={systemPrompt}
                                onChange={e => setSystemPrompt(e.target.value)}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* Email Infrastructure Section */}
            <Card className="border-white/10 bg-black/20 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-blue-500" />
                        <CardTitle>Email Infrastructure</CardTitle>
                    </div>
                    <CardDescription>
                        Configure transactional email settings (Resend).
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSaveConfig}>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Resend API Key</Label>
                            <Input
                                type="password"
                                value={resendKey}
                                onChange={e => setResendKey(e.target.value)}
                                placeholder="re_..."
                            />
                            <p className="text-[10px] text-muted-foreground">Get your key from <a href="https://resend.com/api-keys" target="_blank" className="underline hover:text-white">resend.com</a></p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* Invite System Section */}
            <Card className="border-white/10 bg-black/20 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Invite System</CardTitle>
                            <CardDescription>
                                Manage registration codes for new users.
                            </CardDescription>
                        </div>
                        <Button onClick={handleGenerateInvite} disabled={isInviteLoading} variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 hover:text-white">
                            {isInviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate New Code'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-white/10 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-white/5">
                                <TableRow className="hover:bg-transparent border-white/5">
                                    <TableHead className="text-zinc-400">Code</TableHead>
                                    <TableHead className="text-zinc-400">Created By</TableHead>
                                    <TableHead className="text-zinc-400">Status</TableHead>
                                    <TableHead className="text-right text-zinc-400">Created At</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invites.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-zinc-500 py-8">
                                            No invites generated yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    invites.map((invite) => (
                                        <TableRow key={invite.id} className="border-white/5 hover:bg-white/5">
                                            <TableCell className="font-mono text-white">
                                                <div className="flex items-center gap-2">
                                                    {invite.code}
                                                    <button onClick={() => copyToClipboard(invite.code)} className="text-zinc-500 hover:text-white transition-colors">
                                                        <Copy size={12} />
                                                    </button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-zinc-400 text-sm">
                                                {invite.creatorName || 'Admin'}
                                            </TableCell>
                                            <TableCell>
                                                {invite.isUsed ? (
                                                    <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10">Used</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">Active</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right text-zinc-500 text-sm">
                                                {new Date(invite.createdAt).toLocaleDateString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
