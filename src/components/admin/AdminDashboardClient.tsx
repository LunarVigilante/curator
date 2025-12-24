'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminSystemConfig from './AdminSystemConfig';
import EmailTemplates from './EmailTemplates';
import { UserPlus, Settings2, Layout, Mail } from 'lucide-react';

interface AdminDashboardClientProps {
    systemSettings: any;
}

export default function AdminDashboardClient({ systemSettings }: AdminDashboardClientProps) {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
                    <div className="bg-black/20 border border-white/10 rounded-lg p-6 backdrop-blur-sm max-w-2xl">
                        <h2 className="text-xl font-semibold mb-4 text-white">Invite New User</h2>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-zinc-300">Email</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full p-2.5 rounded-md bg-zinc-900/50 border border-white/10 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-zinc-300">Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2.5 rounded-md bg-zinc-900/50 border border-white/10 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="p-3 rounded bg-blue-500/10 border border-blue-500/20 text-sm text-blue-200">
                                <span className="font-semibold">Note:</span> Default password will be <code className="bg-black/30 px-1 py-0.5 rounded">changeme123</code>. The user will be required to change it on first login.
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-white text-black font-medium px-4 py-2.5 rounded hover:bg-zinc-200 disabled:opacity-50 transition-colors mt-2"
                            >
                                {isLoading ? 'Creating...' : 'Send Invitation'}
                            </button>
                        </form>
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
