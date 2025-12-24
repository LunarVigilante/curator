'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea'; // Importing Textarea (if not exists I'll standard input or create it, assuming shadcn)
// Wait, I might not have Textarea. Using simple textarea for now if needed.
import { useTheme } from 'next-themes';
import { updateUserProfile } from '@/lib/actions/users';
import ProfileSettings from './ProfileSettings'; // Existing Security/Danger component
import { User, Shield, Sliders } from 'lucide-react';

interface UserSettingsProps {
    user: {
        id: string;
        name: string;
        email: string;
        image?: string | null;
        bio?: string | null;
        preferences?: any;
    }
}

export default function UserSettings({ user }: UserSettingsProps) {
    const [isLoading, setIsLoading] = useState(false);

    // Profile State
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [bio, setBio] = useState(user.bio || '');
    const [image, setImage] = useState(user.image || '');

    // Preferences State
    const { theme, setTheme } = useTheme();
    const defaults = typeof user.preferences === 'string'
        ? JSON.parse(user.preferences || '{}')
        : (user.preferences || {});
    const [visibility, setVisibility] = useState(defaults.visibility || 'private');

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await updateUserProfile({
                name,
                email,
                bio,
                image
            });
            toast.success("Profile updated");
        } catch (err) {
            toast.error("Failed to update profile");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSavePreferences = async () => {
        setIsLoading(true);
        try {
            await updateUserProfile({
                preferences: {
                    visibility,
                    // theme is handled by next-themes client side usually, but we can store it too if we want sync
                }
            });
            toast.success("Preferences saved");
        } catch (err) {
            toast.error("Failed to save preferences");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-8">
            <aside className="md:w-64 flex-shrink-0">
                <TabsList className="flex flex-col h-auto w-full bg-transparent p-0 gap-1">
                    <TabsTrigger
                        value="profile"
                        className="w-full justify-start px-4 py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white hover:bg-white/5 transition-colors text-zinc-400"
                    >
                        <User className="mr-2 h-4 w-4" />
                        Profile
                    </TabsTrigger>
                    <TabsTrigger
                        value="security"
                        className="w-full justify-start px-4 py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white hover:bg-white/5 transition-colors text-zinc-400"
                    >
                        <Shield className="mr-2 h-4 w-4" />
                        Security
                    </TabsTrigger>
                    <TabsTrigger
                        value="preferences"
                        className="w-full justify-start px-4 py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white hover:bg-white/5 transition-colors text-zinc-400"
                    >
                        <Sliders className="mr-2 h-4 w-4" />
                        Preferences
                    </TabsTrigger>
                </TabsList>
            </aside>

            <div className="flex-1">
                {/* PROFILE TAB */}
                <TabsContent value="profile" className="mt-0 space-y-6">
                    <Card className="border-white/10 bg-black/20 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Public Profile</CardTitle>
                            <CardDescription>
                                This is how others will see you on Curator.
                            </CardDescription>
                        </CardHeader>
                        <form onSubmit={handleSaveProfile}>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>Display Name</Label>
                                    <Input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Your name"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Email Address</Label>
                                    <Input
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="user@example.com"
                                        type="email"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Bio</Label>
                                    <textarea
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={bio}
                                        onChange={e => setBio(e.target.value)}
                                        placeholder="Tell us about yourself..."
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Avatar URL</Label>
                                    <Input
                                        value={image}
                                        onChange={e => setImage(e.target.value)}
                                        placeholder="https://..."
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Supports JPG, PNG, or GIF links.
                                    </p>
                                </div>
                            </CardContent>
                            <CardFooter className="mt-8">
                                <Button type="submit" disabled={isLoading}>
                                    Save Changes
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                </TabsContent>

                {/* SECURITY TAB (Reusing existing components) */}
                <TabsContent value="security" className="mt-0">
                    <ProfileSettings />
                </TabsContent>

                {/* PREFERENCES TAB */}
                <TabsContent value="preferences" className="mt-0 space-y-6">
                    <Card className="border-white/10 bg-black/20 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>App Preferences</CardTitle>
                            <CardDescription>
                                Customize your experience.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Appearance</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Switch between day and night themes.
                                    </p>
                                </div>
                                <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${theme === 'light' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                                    >
                                        Light
                                    </button>
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${theme === 'dark' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                                    >
                                        Dark
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Default Visibility</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Set new collections to public or private by default.
                                    </p>
                                </div>
                                <select
                                    value={visibility}
                                    onChange={(e) => setVisibility(e.target.value)}
                                    className="h-9 w-[150px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="private" className="bg-zinc-900">Private</option>
                                    <option value="public" className="bg-zinc-900">Public</option>
                                </select>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleSavePreferences} disabled={isLoading}>
                                Save Preferences
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </div>
        </Tabs>
    );
}
