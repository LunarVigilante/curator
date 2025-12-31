import { getBrokenGlobalItems } from '@/lib/actions/admin'
import { ContentMatchWizard } from '@/components/admin/ContentMatchWizard'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function WizardPage() {
    const session = await getSession()
    if (!session || session.profile?.role !== 'ADMIN') {
        redirect('/admin') // or 404
    }

    const brokenItems = await getBrokenGlobalItems(50)

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-black text-white mb-2">Content Match Wizard</h1>
                <p className="text-zinc-400">
                    Fix missing metadata for items in the global database.
                    These items likely came from "New Discovery" or incomplete imports.
                </p>
            </header>

            <ContentMatchWizard items={brokenItems} />
        </div>
    )
}
