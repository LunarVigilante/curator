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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

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
    const [avatarMode, setAvatarMode] = useState<'url' | 'upload'>('url');

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
                                    <Label>Avatar</Label>

                                    {/* Current Avatar Preview */}
                                    {image && (
                                        <div className="flex items-center gap-4 mb-2">
                                            <img
                                                src={image}
                                                alt="Avatar preview"
                                                className="h-16 w-16 rounded-full object-cover border border-white/10"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none'
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setImage('')}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    )}

                                    {/* Upload Mode Toggle */}
                                    <div className="flex gap-2 mb-2">
                                        <Button
                                            type="button"
                                            variant={avatarMode === 'url' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setAvatarMode('url')}
                                        >
                                            URL
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={avatarMode === 'upload' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setAvatarMode('upload')}
                                        >
                                            Upload
                                        </Button>
                                    </div>

                                    {avatarMode === 'url' ? (
                                        <Input
                                            value={image}
                                            onChange={e => setImage(e.target.value)}
                                            placeholder="https://..."
                                        />
                                    ) : (
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0]
                                                if (file) {
                                                    const formData = new FormData()
                                                    formData.append('file', file)
                                                    const { uploadImage } = await import('@/lib/actions/upload')
                                                    const url = await uploadImage(formData)
                                                    if (url) {
                                                        setImage(url)
                                                        toast.success('Avatar uploaded!')
                                                    } else {
                                                        toast.error('Upload failed')
                                                    }
                                                }
                                            }}
                                        />
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        {avatarMode === 'url' ? 'Supports JPG, PNG, or GIF links.' : 'Upload JPG, PNG, or GIF (max 5MB).'}
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
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    disabled
                                                    className="px-3 py-1.5 rounded-md text-sm font-medium transition-all text-zinc-600 cursor-not-allowed opacity-50"
                                                >
                                                    Light
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Light mode is currently under development</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
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
                        <CardFooter className="mt-6">
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
