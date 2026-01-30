'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

export type ServiceStatus = {
    status: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
};

interface ApiKeyInputProps {
    /** Display label for the input */
    label: string;
    /** Current value of the API key */
    value: string;
    /** Callback when value changes */
    onChange: (value: string) => void;
    /** Connection status for this service */
    serviceStatus: ServiceStatus;
    /** Callback to test the connection */
    onTest: () => void;
    /** Short name for the test button (e.g., "TMDB", "Spotify") */
    testLabel: string;
    /** Help text with link */
    helpText: React.ReactNode;
    /** Placeholder text */
    placeholder?: string;
    /** Additional fields (for services requiring client ID + secret) */
    secondaryValue?: string;
    secondaryOnChange?: (value: string) => void;
    secondaryPlaceholder?: string;
}

/**
 * Reusable API key input with test button, status indicator, and help text.
 * Supports single-key services and dual-key services (client ID + secret).
 */
export function ApiKeyInput({
    label,
    value,
    onChange,
    serviceStatus,
    onTest,
    testLabel,
    helpText,
    placeholder = 'API Key',
    secondaryValue,
    secondaryOnChange,
    secondaryPlaceholder = 'Client Secret',
}: ApiKeyInputProps) {
    const hasDualInputs = secondaryValue !== undefined && secondaryOnChange !== undefined;
    const isTestDisabled = serviceStatus.status === 'loading' ||
        !value ||
        (hasDualInputs && !secondaryValue);

    const getStatusIcon = () => {
        switch (serviceStatus.status) {
            case 'loading':
                return <Loader2 className="h-3 w-3 animate-spin" />;
            case 'success':
                return <CheckCircle2 className="h-3 w-3 text-green-500" />;
            case 'error':
                return <AlertCircle className="h-3 w-3 text-red-500" />;
            default:
                return <Zap className="h-3 w-3" />;
        }
    };

    const getInputClassName = () => {
        if (serviceStatus.status === 'success') return 'border-green-500/50';
        if (serviceStatus.status === 'error') return 'border-red-500/50';
        return '';
    };

    return (
        <div className="grid gap-2">
            <div className="flex items-center justify-between">
                <Label>{label}</Label>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onTest}
                    disabled={isTestDisabled}
                    className="h-7 text-[10px] gap-1 shadow-none hover:shadow-none hover:translate-y-0 active:scale-100"
                >
                    {getStatusIcon()}
                    Test {testLabel}
                </Button>
            </div>

            {hasDualInputs ? (
                <div className="grid grid-cols-2 gap-2">
                    <Input
                        type="password"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        className={getInputClassName()}
                    />
                    <Input
                        type="password"
                        value={secondaryValue}
                        onChange={(e) => secondaryOnChange!(e.target.value)}
                        placeholder={secondaryPlaceholder}
                    />
                </div>
            ) : (
                <Input
                    type="password"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={getInputClassName()}
                />
            )}

            {serviceStatus.status === 'error' && serviceStatus.message && (
                <p className="text-[10px] text-red-500 font-medium">{serviceStatus.message}</p>
            )}

            <p className="text-[10px] text-muted-foreground">{helpText}</p>
        </div>
    );
}
