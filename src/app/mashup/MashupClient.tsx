'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Users,
    Layers,
    ArrowRight,
    Search,
    ChevronLeft,
    Sparkles,
    CheckCircle2,
    MinusCircle
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getCommonGround } from '@/lib/actions/mashup';
import { toast } from 'sonner';

interface MashupClientProps {
    categories: any[];
    followedUsers: any[];
}

export default function MashupClient({ categories, followedUsers }: MashupClientProps) {
    const [step, setStep] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [selectedPartner, setSelectedPartner] = useState<any>(null);
    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleSelectCategory = (category: any) => {
        setSelectedCategory(category);
        setStep(2);
    };

    const handleSelectPartner = (partner: any) => {
        setSelectedPartner(partner);
    };

    const handleCalculate = async () => {
        if (!selectedCategory || !selectedPartner) return;

        setIsLoading(true);
        try {
            const data = await getCommonGround(selectedPartner.id, selectedCategory.id);
            setResults(data);
            setStep(3);
        } catch (error) {
            toast.error("Failed to find common ground. Ensure both curators have ranked items in this category.");
        } finally {
            setIsLoading(false);
        }
    };

    const reset = () => {
        setStep(1);
        setSelectedCategory(null);
        setSelectedPartner(null);
        setResults([]);
    };

    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            {/* Stepper Header */}
            <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-blue-600' : 'bg-zinc-800 text-zinc-500'}`}>1</div>
                    <span className={`font-semibold ${step === 1 ? 'text-white' : 'text-zinc-500'}`}>Category</span>
                    <div className="h-[1px] w-12 bg-zinc-800" />
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-blue-600' : 'bg-zinc-800 text-zinc-500'}`}>2</div>
                    <span className={`font-semibold ${step === 2 ? 'text-white' : 'text-zinc-500'}`}>Partner</span>
                    <div className="h-[1px] w-12 bg-zinc-800" />
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${step >= 3 ? 'bg-blue-600' : 'bg-zinc-800 text-zinc-500'}`}>3</div>
                    <span className={`font-semibold ${step === 3 ? 'text-white' : 'text-zinc-500'}`}>Mashup</span>
                </div>
                {step > 1 && step < 3 && (
                    <Button variant="ghost" onClick={() => setStep(step - 1)} className="text-zinc-400">
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                )}
            </div>

            {/* Step 1: Category Selection */}
            {step === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center space-y-4">
                        <h1 className="text-4xl font-black tracking-tight text-white">What should we do?</h1>
                        <p className="text-zinc-500 text-lg">Choose a category you both have ranked.</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => handleSelectCategory(cat)}
                                className="group relative aspect-video rounded-2xl overflow-hidden border border-white/5 hover:border-blue-500/50 transition-all text-left"
                            >
                                {cat.image ? (
                                    <img src={cat.image} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-110 group-hover:opacity-60 transition-all" />
                                ) : (
                                    <div className="absolute inset-0 bg-zinc-900" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                                <div className="absolute bottom-4 left-4 z-10">
                                    <h3 className="text-xl font-bold text-white">{cat.name}</h3>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Step 2: Partner Selection */}
            {step === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center space-y-4">
                        <h1 className="text-4xl font-black tracking-tight text-white">Who's joining you?</h1>
                        <p className="text-zinc-500 text-lg">Picking for category: <span className="text-blue-400">{selectedCategory.name}</span></p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 max-w-md mx-auto">
                        {followedUsers.length > 0 ? (
                            followedUsers.map((partner) => (
                                <button
                                    key={partner.id}
                                    onClick={() => handleSelectPartner(partner)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedPartner?.id === partner.id ? 'bg-blue-600/10 border-blue-600' : 'bg-zinc-900 border-white/5 hover:border-zinc-700'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-12 w-12 border-2 border-white/10">
                                            <AvatarImage src={partner.image} />
                                            <AvatarFallback>{partner.name[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="text-left">
                                            <p className="font-bold text-white">{partner.name}</p>
                                            <p className="text-zinc-500 text-sm">Curator</p>
                                        </div>
                                    </div>
                                    {selectedPartner?.id === partner.id && <CheckCircle2 className="text-blue-400" />}
                                </button>
                            ))
                        ) : (
                            <div className="text-center p-12 bg-zinc-900 rounded-2xl border border-dashed border-zinc-800">
                                <Users className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                                <p className="text-zinc-400">You're not following any curators yet.</p>
                                <Button variant="link" className="text-blue-400" onClick={() => window.location.href = '/curators'}>Find Curators</Button>
                            </div>
                        )}

                        <Button
                            className="w-full mt-8 bg-blue-600 hover:bg-blue-500 h-14 text-lg font-bold rounded-xl shadow-lg shadow-blue-500/20"
                            disabled={!selectedPartner || isLoading}
                            onClick={handleCalculate}
                        >
                            {isLoading ? "Finding common ground..." : "Find Our Match"}
                            <Sparkles className="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Step 3: Results */}
            {step === 3 && (
                <div className="space-y-8 animate-in zoom-in fade-in duration-700">
                    <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-4 mb-4">
                            <Avatar className="h-16 w-16 border-4 border-zinc-900 shadow-xl">
                                <AvatarFallback className="bg-blue-600 text-2xl font-black">YOU</AvatarFallback>
                            </Avatar>
                            <div className="h-[2px] w-8 bg-zinc-800" />
                            <div className="h-12 w-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                                <Sparkles className="text-blue-400 h-6 w-6" />
                            </div>
                            <div className="h-[2px] w-8 bg-zinc-800" />
                            <Avatar className="h-16 w-16 border-4 border-zinc-900 shadow-xl">
                                <AvatarImage src={selectedPartner.image} />
                                <AvatarFallback className="bg-zinc-800 text-2xl font-black">{selectedPartner.name[0]}</AvatarFallback>
                            </Avatar>
                        </div>
                        <h1 className="text-4xl font-black tracking-tight text-white italic">The Perfect Compromise</h1>
                        <p className="text-zinc-500 text-lg">Matches found in <span className="text-blue-400">{selectedCategory.name}</span></p>
                    </div>

                    <div className="space-y-4 max-w-2xl mx-auto">
                        {results.length > 0 ? (
                            results.map((item, index) => (
                                <div key={item.id} className="flex items-center gap-6 bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all group overflow-hidden relative">
                                    {/* Score Gradient Background */}
                                    <div className="absolute inset-y-0 left-0 bg-blue-600/10 pointer-events-none transition-all group-hover:bg-blue-600/20" style={{ width: `${(item.compositeScore - 800) / 12}%` }} />

                                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center font-black text-4xl text-white/5 italic z-10">
                                        #{index + 1}
                                    </div>

                                    <div className="h-24 w-16 flex-shrink-0 rounded-lg overflow-hidden shadow-2xl relative z-10">
                                        {item.image ? (
                                            <img src={item.image} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-zinc-800" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 z-10">
                                        <h3 className="text-2xl font-bold text-white truncate mb-1">{item.name}</h3>
                                        <div className="flex items-center gap-4 text-sm font-medium">
                                            <span className="text-zinc-400">You: <span className="text-white font-bold">{item.userAScore}</span></span>
                                            <span className="text-zinc-400">{selectedPartner.name}: <span className="text-white font-bold">{item.userBScore}</span></span>
                                        </div>
                                    </div>

                                    <div className="text-right z-10 bg-black/40 px-4 py-2 rounded-xl border border-white/5 backdrop-blur-md">
                                        <p className="text-[10px] uppercase tracking-tighter text-zinc-500 font-bold mb-0.5">Match Score</p>
                                        <p className="text-2xl font-black text-blue-400 leading-none">{Math.round(item.compositeScore)}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center p-20 bg-zinc-900 border border-dashed border-zinc-800 rounded-3xl">
                                <MinusCircle className="h-16 w-16 text-zinc-700 mx-auto mb-6" />
                                <h2 className="text-2xl font-bold text-white mb-2">No Common Ground Yet</h2>
                                <p className="text-zinc-500 max-w-sm mx-auto">It looks like you two haven't ranked any of the same items in this category yet. Go rank some items together!</p>
                            </div>
                        )}

                        <div className="flex gap-4 pt-8">
                            <Button variant="outline" className="flex-1 py-8 text-lg font-bold rounded-2xl border-white/10 hover:bg-white/5" onClick={reset}>
                                Start Over
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
