'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Save, FileCode, Eye } from 'lucide-react';
import { getEmailTemplates, updateEmailTemplate } from '@/lib/actions/admin';
import { cn } from '@/lib/utils';

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    bodyHtml: string;
    variables: string | null;
    lastUpdated: Date | null;
}

export default function EmailTemplates() {
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            const data = await getEmailTemplates();
            setTemplates(data);
            if (data.length > 0 && !selectedTemplateId) {
                selectTemplate(data[0]);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load templates.");
        } finally {
            setIsLoading(false);
        }
    };

    const selectTemplate = (template: EmailTemplate) => {
        setSelectedTemplateId(template.id);
        setSubject(template.subject);
        setBody(template.bodyHtml);
    };

    const handleSave = async () => {
        if (!selectedTemplateId) return;
        setIsSaving(true);
        try {
            await updateEmailTemplate(selectedTemplateId, {
                subject,
                bodyHtml: body
            });
            toast.success("Template saved successfully.");

            // Update local list state to reflect changes without full reload
            setTemplates(prev => prev.map(t =>
                t.id === selectedTemplateId
                    ? { ...t, subject, bodyHtml: body, lastUpdated: new Date() }
                    : t
            ));
        } catch (err) {
            console.error(err);
            toast.error("Failed to save template.");
        } finally {
            setIsSaving(false);
        }
    };

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

    // Parse variables safely
    const variables: string[] = selectedTemplate?.variables
        ? JSON.parse(selectedTemplate.variables)
        : [];

    if (isLoading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-white/50" /></div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[700px]">
            {/* Sidebar List */}
            <div className="md:col-span-3 space-y-2 overflow-y-auto pr-2 rounded-lg bg-black/20 p-4 border border-white/5">
                <h3 className="text-sm font-medium text-zinc-400 mb-4 px-2 uppercase tracking-wider">Templates</h3>
                {templates.map(t => (
                    <button
                        key={t.id}
                        onClick={() => selectTemplate(t)}
                        className={cn(
                            "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                            selectedTemplateId === t.id
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                        )}
                    >
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-zinc-600 truncate">{t.subject}</div>
                    </button>
                ))}
            </div>

            {/* Main Editor */}
            <Card className="md:col-span-9 border-white/10 bg-black/20 backdrop-blur-sm flex flex-col h-full overflow-hidden">
                <CardHeader className="border-b border-white/5 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Mail className="h-5 w-5 text-purple-500" />
                            <div>
                                <CardTitle>{selectedTemplate?.name}</CardTitle>
                                <CardDescription>Edit email template content and styles.</CardDescription>
                            </div>
                        </div>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Template
                        </Button>
                    </div>
                </CardHeader>

                <div className="flex-1 overflow-hidden p-0">
                    <Tabs defaultValue="edit" className="h-full flex flex-col">
                        <div className="px-6 pt-4 border-b border-white/5 bg-white/2">
                            <TabsList className="bg-black/20">
                                <TabsTrigger value="edit" className="flex items-center gap-2"><FileCode size={14} /> Editor</TabsTrigger>
                                <TabsTrigger value="preview" className="flex items-center gap-2"><Eye size={14} /> Preview</TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="edit" className="flex-1 flex flex-col p-6 gap-4 overflow-y-auto mt-0">
                            <div className="grid gap-2">
                                <Label>Subject Line</Label>
                                <Input
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    className="font-medium"
                                />
                                {variables.length > 0 && (
                                    <div className="flex gap-2 text-xs text-zinc-500 mt-1">
                                        <span>Available variables:</span>
                                        {variables.map(v => (
                                            <span key={v} className="bg-white/10 px-1.5 py-0.5 rounded text-zinc-300 font-mono">{v}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 flex flex-col gap-2 min-h-[300px]">
                                <Label>HTML Body</Label>
                                <Textarea
                                    value={body}
                                    onChange={e => setBody(e.target.value)}
                                    className="flex-1 font-mono text-xs leading-relaxed resize-none p-4"
                                    placeholder="<html>...</html>"
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="preview" className="flex-1 bg-white overflow-y-auto mt-0 p-0">
                            {/* Render safe preview inside an iframe or shadow dom? 
                                For simplicity, a div with dangerouSetInnerHTML is often risky but okay for admin previewing their OWN input. 
                                Ideally, use an iframe to isolate styles. */}
                            <iframe
                                title="preview"
                                className="w-full h-full border-none bg-zinc-950"
                                srcDoc={body && (body.toLowerCase().includes('<html') || body.toLowerCase().includes('<!doctype')) ? body : `
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                        <style>
                                            body { 
                                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                                                margin: 0;
                                                padding: 20px;
                                                background-color: white;
                                                color: black;
                                            }
                                        </style>
                                    </head>
                                    <body>
                                        ${body}
                                    </body>
                                    </html>
                                `}
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </Card>
        </div>
    );
}
