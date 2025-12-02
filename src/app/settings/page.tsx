import { getSettings, updateSettings } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import SettingsForm from '@/components/settings/SettingsForm'

export default async function SettingsPage() {
    const settings = await getSettings()

    return (
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-6">Settings</h1>
            <Separator className="my-6" />

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>LLM Configuration</CardTitle>
                        <CardDescription>
                            Configure the Large Language Model settings for auto-tagging and recommendations.
                            Defaulting to OpenRouter for best compatibility.
                        </CardDescription>
                    </CardHeader>
                    <SettingsForm initialSettings={settings} />
                </Card>
            </div>
        </div>
    )
}
