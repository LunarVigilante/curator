'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminSystemConfig from './AdminSystemConfig';
import EmailTemplates from './EmailTemplates';
import { UserPlus, Settings2, Layout, Mail, Trash2, Copy, Loader2, Ticket } from 'lucide-react';
import FeaturedContent from './FeaturedContent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Invite {
    id: string;
    code: string;
    isUsed: boolean;
    createdAt: string;
    usedAt: string | null;
    creatorName: string | null;
    creatorEmail: string;
}

interface AdminDashboardClientProps {
    systemSettings: any;
}

export default function AdminDashboardClient({ systemSettings }: AdminDashboardClientProps) {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [invites, setInvites] = useState<Invite[]>([]);
    const [isLoadingInvites, setIsLoadingInvites] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    // Fetch invites on mount
    useEffect(() => {
        const fetchInvites = async () => {
            try {
                const res = await fetch('/api/admin/invites');
                if (res.ok) {
                    const data = await res.json();
                    setInvites(data);
                }
            } catch (err) {
                console.error('Failed to fetch invites:', err);
            } finally {
                setIsLoadingInvites(false);
            }
        };
        fetchInvites();
    }, []);

    const handleGenerateInvite = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/admin/invites', { method: 'POST' });
            if (res.ok) {
                const newInvite = await res.json();
                setInvites(prev => [newInvite, ...prev]);
                toast.success(`Invite code ${newInvite.code} generated!`);
            } else {
                toast.error('Failed to generate invite');
            }
        } catch (err) {
            toast.error('Error generating invite');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeleteInvite = async (id: string, code: string) => {
        if (!confirm(`Are you sure you want to revoke invite code ${code}?`)) return;

        // Optimistic update
        setInvites(prev => prev.filter(i => i.id !== id));

        try {
            const res = await fetch(`/api/admin/invites?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Invite revoked');
            } else {
                toast.error('Failed to revoke invite');
                // Revert on error - refetch
                const refetch = await fetch('/api/admin/invites');
                if (refetch.ok) setInvites(await refetch.json());
            }
        } catch (err) {
            toast.error('Error revoking invite');
        }
    };

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        toast.success('Code copied to clipboard');
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify({ email, name, password: 'changeme123' }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                toast.success('User created!');
                setEmail('');
                setName('');
            } else {
                toast.error('Failed to create user');
            }
        } catch (err) {
            toast.error('Error creating user');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-10 px-4 max-w-5xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                    <p className="text-muted-foreground mt-1">Manage users and system configuration.</p>
                </div>
            </div>

            <Tabs defaultValue="users" className="space-y-6">
                <TabsList className="bg-zinc-900/50 border border-white/10">
                    <TabsTrigger value="users" className="gap-2">
                        <UserPlus size={16} />
                        Users
                    </TabsTrigger>
                    <TabsTrigger value="homepage" className="gap-2">
                        <Layout size={16} />
                        Homepage
                    </TabsTrigger>
                    <TabsTrigger value="templates" className="gap-2">
                        <Mail size={16} />
                        Templates
                    </TabsTrigger>
                    <TabsTrigger value="system" className="gap-2">
                        <Settings2 size={16} />
                        System Config
                    </TabsTrigger>
                </TabsList>

                {/* HOMEPAGE TAB */}
                <TabsContent value="homepage" className="space-y-4">
                    <FeaturedContent />
                </TabsContent>

                {/* TEMPLATES TAB */}
                <TabsContent value="templates" className="space-y-4">
                    <EmailTemplates />
                </TabsContent>

                {/* USERS TAB */}
                <TabsContent value="users" className="space-y-4">
                    {/* INVITE CODES MANAGEMENT */}
                    <div className="grid gap-6">
                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Generator Card */}
                            <div className="bg-black/20 border border-white/10 rounded-lg p-6 backdrop-blur-sm flex-1">
                                <h2 className="text-xl font-semibold mb-2 text-white flex items-center gap-2">
                                    <Ticket className="w-5 h-5 text-blue-400" />
                                    Generate Invite Code
                                </h2>
                                <p className="text-sm text-zinc-400 mb-4">
                                    Create a unique 8-character code for new user registration.
                                </p>
                                <Button
                                    onClick={handleGenerateInvite}
                                    disabled={isGenerating}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        'Generate New Code'
                                    )}
                                </Button>
                            </div>

                            {/* Direct User Create (Optional/Legacy) */}
                            <div className="bg-black/20 border border-white/10 rounded-lg p-6 backdrop-blur-sm flex-1 opacity-60 hover:opacity-100 transition-opacity">
                                <h2 className="text-xl font-semibold mb-2 text-white flex items-center gap-2">
                                    <UserPlus className="w-5 h-5 text-zinc-400" />
                                    Direct Create (Dev)
                                </h2>
                                <p className="text-sm text-zinc-400 mb-4">
                                    Bypass invite system (admin only).
                                </p>
                                <form onSubmit={handleCreateUser} className="flex gap-2">
                                    <input
                                        type="email"
                                        required
                                        className="flex-1 p-2 rounded-md bg-zinc-900/50 border border-white/10 text-white text-sm"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="user@example.com"
                                    />
                                    <Button type="submit" disabled={isLoading} size="sm" variant="secondary">
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                                    </Button>
                                </form>
                            </div>
                        </div>

                        {/* Invites List */}
                        <div className="bg-black/20 border border-white/10 rounded-lg overflow-hidden backdrop-blur-sm">
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <h3 className="font-semibold text-white">Active & Recent Invites</h3>
                                <Badge variant="outline" className="text-zinc-400">{invites.length} Total</Badge>
                            </div>

                            {isLoadingInvites ? (
                                <div className="p-8 text-center text-zinc-500">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    Loading invites...
                                </div>
                            ) : invites.length === 0 ? (
                                <div className="p-8 text-center text-zinc-500">
                                    No invite codes found. Generate one to get started.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white/5 text-zinc-400 font-medium">
                                            <tr>
                                                <th className="px-4 py-3">Code</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3">Created By</th>
                                                <th className="px-4 py-3">Created At</th>
                                                <th className="px-4 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {invites.map((invite) => (
                                                <tr key={invite.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-3 font-mono text-white">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg tracking-wider">{invite.code}</span>
                                                            <button
                                                                onClick={() => handleCopyCode(invite.code)}
                                                                className="opacity-50 hover:opacity-100 hover:text-blue-400 transition-all"
                                                                title="Copy code"
                                                            >
                                                                <Copy size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {invite.isUsed ? (
                                                            <Badge variant="secondary" className="bg-zinc-800 text-zinc-500 hover:bg-zinc-800">Used</Badge>
                                                        ) : (
                                                            <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/50">Active</Badge>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-zinc-300">
                                                        {invite.creatorName || invite.creatorEmail}
                                                    </td>
                                                    <td className="px-4 py-3 text-zinc-500">
                                                        {new Date(invite.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => handleDeleteInvite(invite.id, invite.code)}
                                                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                                                            title="Revoke Invite"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* SYSTEM CONFIG TAB */}
                <TabsContent value="system">
                    <AdminSystemConfig settings={systemSettings} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
