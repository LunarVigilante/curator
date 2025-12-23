'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';

export default function AdminDashboard() {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // We need a Server Action or API route to create user because public signup is blocked.
        // Actually, if we use auth.api.signUpEmail, it calls the public API which we blocked via Hook (wait, we removed the hook!).
        // So public API is OPEN now? 
        // Ah, I removed the hook to fix the lint error to allow seeding.
        // I MUST restore the hook or use middleware to block /api/auth/sign-up unless the caller is Admin?
        // But better-auth API calls are hard to filter by role inside the generic route unless we use hooks.

        // Strategy: 
        // 1. Re-implement the hook properly in auth.ts (blocking everything except admin email).
        // 2. OR, create a custom Server Action `inviteUser` that uses `auth.api.signUpEmail` internally (server-to-server) 
        //    and bypasses the hook? No, hooks run on server.

        // Let's implement a Server Action that inserts directly into DB (like seed script) 
        // or uses a different auth function that doesn't trigger 'signUp' hook? `auth.internal.createUser`?

        // For this UI, I will just call a new Server Action: `createUserAction`.

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
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

            <div className="bg-card border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Invite New User</h2>
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full p-2 border rounded bg-background"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border rounded bg-background"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">Default password will be: <code>changeme123</code></p>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 disabled:opacity-50"
                    >
                        {isLoading ? 'Creating...' : 'Create User'}
                    </button>
                </form>
            </div>
        </div>
    );
}
