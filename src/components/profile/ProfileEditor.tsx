'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { updateProfile, getMyProfile } from '@/lib/actions/profile'
import { toast } from 'sonner'
import { useEffect } from 'react'

interface ProfileEditorProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function ProfileEditor({ isOpen, onOpenChange, onSuccess }: ProfileEditorProps) {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [displayName, setDisplayName] = useState('')
    const [bio, setBio] = useState('')
    const [isPublic, setIsPublic] = useState(false)

    // Load current profile data
    useEffect(() => {
        if (isOpen) {
            setLoading(true)
            getMyProfile().then(profile => {
                if (profile) {
                    setDisplayName(profile.displayName || profile.name)
                    setBio(profile.bio || '')
                    setIsPublic(profile.isPublic)
                }
            }).finally(() => setLoading(false))
        }
    }, [isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            const result = await updateProfile({
                displayName: displayName || undefined,
                bio: bio || undefined,
                isPublic,
            })

            if (result.success) {
                toast.success('Profile updated!')
                onOpenChange(false)
                onSuccess?.()
            } else {
                toast.error(result.error || 'Failed to update profile')
            }
        } catch (error) {
            toast.error('Something went wrong')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-900 border-white/10 max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-white">Edit Profile</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Customize how others see you on Curator
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="displayName" className="text-zinc-300">Display Name</Label>
                            <Input
                                id="displayName"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your display name"
                                className="bg-zinc-800 border-white/10 text-white"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bio" className="text-zinc-300">Bio</Label>
                            <Textarea
                                id="bio"
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="Tell others about yourself and your taste..."
                                rows={3}
                                className="bg-zinc-800 border-white/10 text-white resize-none"
                                maxLength={500}
                            />
                            <div className="text-right text-xs text-zinc-500">{bio.length}/500</div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-white/5">
                            <div>
                                <Label htmlFor="public" className="text-zinc-300 font-medium">Public Profile</Label>
                                <p className="text-sm text-zinc-500">Allow others to view your profile and collections</p>
                            </div>
                            <Switch
                                id="public"
                                checked={isPublic}
                                onCheckedChange={setIsPublic}
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className="flex-1 border-white/10"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={saving}
                                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600"
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    'Save Changes'
                                )}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
