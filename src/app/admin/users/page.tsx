import { auth } from '@/lib/auth'
import { getInvites } from '@/lib/actions/admin'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TicketCheck, CheckCircle2, Clock } from 'lucide-react'
import { RegisteredUsersTable } from '@/components/admin/RegisteredUsersTable'

export default async function AdminUsersPage() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (session?.user?.role !== 'ADMIN') {
        redirect('/')
    }

    const invites = await getInvites()

    return (
        <div className="container mx-auto py-10 space-y-8">
            <div>
                <h1 className="text-3xl font-bold">User Management</h1>
                <p className="text-muted-foreground mt-2">
                    Manage invites and registered users
                </p>
            </div>

            {/* Active & Recent Invites */}
            <Card className="border-white/10 bg-black/40">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/20">
                            <TicketCheck className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <CardTitle>Active & Recent Invites</CardTitle>
                            <CardDescription>
                                Invite codes for new user registration
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {invites.length === 0 ? (
                        <p className="text-zinc-500 text-sm">No invites generated yet.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead>Code</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created By</TableHead>
                                    <TableHead>Created At</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invites.slice(0, 10).map((invite) => (
                                    <TableRow key={invite.id} className="border-white/5">
                                        <TableCell>
                                            <code className="px-2 py-1 rounded bg-zinc-800 font-mono text-sm">
                                                {invite.code}
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            {invite.isUsed ? (
                                                <Badge variant="secondary" className="bg-zinc-500/20 text-zinc-400">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Used
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    Active
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-zinc-400">
                                            {invite.creatorName || 'Unknown'}
                                        </TableCell>
                                        <TableCell className="text-zinc-400 text-sm">
                                            {invite.createdAt ? new Date(invite.createdAt).toLocaleDateString() : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Registered Users Table */}
            <RegisteredUsersTable />
        </div>
    )
}

