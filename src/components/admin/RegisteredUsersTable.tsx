'use client'

import { useState, useEffect, useTransition } from 'react'
import { getAllUsers, toggleUserRole, toggleUserBan, deleteUser, type AdminUserData } from '@/lib/actions/admin'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Search,
    MoreHorizontal,
    Shield,
    ShieldOff,
    Ban,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Users,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'

export function RegisteredUsersTable() {
    const [users, setUsers] = useState<AdminUserData[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [isPending, startTransition] = useTransition()

    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean
        title: string
        description: string
        action: () => void
        variant: 'destructive' | 'default'
    }>({
        open: false,
        title: '',
        description: '',
        action: () => { },
        variant: 'default',
    })

    // Load users
    useEffect(() => {
        loadUsers()
    }, [page, search])

    function loadUsers() {
        startTransition(async () => {
            const result = await getAllUsers({ page, limit: 10, search })
            setUsers(result.users)
            setTotal(result.total)
            setTotalPages(result.totalPages)
        })
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault()
        setPage(1) // Reset to first page on search
        setSearch(searchInput)
    }

    function handleToggleRole(user: AdminUserData) {
        const isPromoting = user.role !== 'ADMIN'
        setConfirmDialog({
            open: true,
            title: isPromoting ? 'Promote to Admin?' : 'Demote to User?',
            description: isPromoting
                ? `This will grant ${user.name} full admin privileges.`
                : `This will remove admin privileges from ${user.name}.`,
            variant: 'default',
            action: async () => {
                startTransition(async () => {
                    const result = await toggleUserRole(user.id)
                    if (result.success) {
                        toast.success(`Role changed to ${result.newRole}`)
                        loadUsers()
                    } else {
                        toast.error(result.error || 'Failed to change role')
                    }
                })
            },
        })
    }

    function handleToggleBan(user: AdminUserData) {
        const isBanning = !user.isLockedOut
        setConfirmDialog({
            open: true,
            title: isBanning ? 'Ban User?' : 'Unban User?',
            description: isBanning
                ? `${user.name} will no longer be able to log in.`
                : `${user.name} will be able to log in again.`,
            variant: isBanning ? 'destructive' : 'default',
            action: async () => {
                startTransition(async () => {
                    const result = await toggleUserBan(user.id)
                    if (result.success) {
                        toast.success(result.isBanned ? 'User banned' : 'User unbanned')
                        loadUsers()
                    } else {
                        toast.error(result.error || 'Failed to update status')
                    }
                })
            },
        })
    }

    function handleDelete(user: AdminUserData) {
        setConfirmDialog({
            open: true,
            title: 'Delete User?',
            description: `This will permanently delete ${user.name}'s account and all their data. This action cannot be undone.`,
            variant: 'destructive',
            action: async () => {
                startTransition(async () => {
                    const result = await deleteUser(user.id)
                    if (result.success) {
                        toast.success('User deleted')
                        loadUsers()
                    } else {
                        toast.error(result.error || 'Failed to delete user')
                    }
                })
            },
        })
    }

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
    }

    return (
        <>
            <Card className="border-white/10 bg-black/40">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/20">
                                <Users className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <CardTitle>Registered Users</CardTitle>
                                <CardDescription>
                                    {total} total user{total !== 1 ? 's' : ''} in the system
                                </CardDescription>
                            </div>
                        </div>
                        {/* Search */}
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <Input
                                    placeholder="Search by name or email..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="pl-10 w-64 bg-black/40 border-white/10"
                                />
                            </div>
                            <Button type="submit" variant="outline" size="icon" disabled={isPending}>
                                <Search className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                </CardHeader>
                <CardContent>
                    {isPending && users.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500">
                            No users found{search ? ` matching "${search}"` : ''}
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableHead>User</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Joined</TableHead>
                                        <TableHead className="w-[50px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow key={user.id} className="border-white/5">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 border border-white/10">
                                                        <AvatarImage src={user.image || ''} />
                                                        <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                                                            {user.name[0]?.toUpperCase() || '?'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">{user.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-zinc-400">{user.email}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={user.role === 'ADMIN' ? 'default' : 'secondary'}
                                                    className={user.role === 'ADMIN'
                                                        ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                                        : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                                                    }
                                                >
                                                    {user.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {user.isLockedOut ? (
                                                    <span className="flex items-center gap-1 text-red-400 text-sm">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Banned
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-green-400 text-sm">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Active
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-zinc-400 text-sm">
                                                {formatDate(user.createdAt)}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10">
                                                        <DropdownMenuItem
                                                            onClick={() => handleToggleRole(user)}
                                                            className="cursor-pointer"
                                                        >
                                                            {user.role === 'ADMIN' ? (
                                                                <>
                                                                    <ShieldOff className="h-4 w-4 mr-2" />
                                                                    Demote to User
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Shield className="h-4 w-4 mr-2" />
                                                                    Promote to Admin
                                                                </>
                                                            )}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleToggleBan(user)}
                                                            className="cursor-pointer"
                                                        >
                                                            {user.isLockedOut ? (
                                                                <>
                                                                    <UserCheck className="h-4 w-4 mr-2" />
                                                                    Unban User
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Ban className="h-4 w-4 mr-2 text-orange-400" />
                                                                    <span className="text-orange-400">Ban User</span>
                                                                </>
                                                            )}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator className="bg-white/10" />
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(user)}
                                                            className="cursor-pointer text-red-400 focus:text-red-400"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Delete User
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                                    <span className="text-sm text-zinc-400">
                                        Page {page} of {totalPages}
                                    </span>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={page === 1 || isPending}
                                        >
                                            <ChevronLeft className="h-4 w-4 mr-1" />
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={page === totalPages || isPending}
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Confirmation Dialog */}
            <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((d) => ({ ...d, open }))}>
                <AlertDialogContent className="bg-zinc-900 border-white/10">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
                        <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                confirmDialog.action()
                                setConfirmDialog((d) => ({ ...d, open: false }))
                            }}
                            className={confirmDialog.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : ''}
                        >
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
