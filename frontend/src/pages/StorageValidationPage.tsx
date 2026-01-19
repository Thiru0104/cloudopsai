import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { apiClient, apiConfig } from '../config/api';
import {
    Search,
    Database,
    AlertTriangle,
    CheckCircle,
    XCircle,
    RefreshCw,
    Brain,
    Trash2,
    Archive,
    TrendingUp,
    FileText,
    Lightbulb,
    Info,
    ChevronDown,
    Download
} from 'lucide-react';

interface StorageValidationResult {
    summary: {
        total_accounts: number;
        total_containers: number;
        total_size_gb: number;
    };
    details: {
        empty_accounts: string[];
        empty_containers: string[];
        inactive_accounts: string[];
        large_accounts: { name: string; size_gb: number }[];
        large_containers: { account: string; container: string; size_gb: number }[];
    };
}

interface Recommendation {
    title: string;
    description: string;
    action: string;
    target_resources: string[];
    impact: string;
    priority: string;
}

interface LifecyclePolicy {
    name: string;
    rules: {
        name: string;
        action: string;
        days_after_modification_greater_than: number;
    }[];
}

interface LLMRecommendations {
    recommendations: Recommendation[];
    lifecycle_policy?: LifecyclePolicy;
    raw_recommendations?: string;
}

interface Subscription {
    id: string;
    display_name: string;
}

const StorageValidationPage: React.FC = () => {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [selectedSubscription, setSelectedSubscription] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [validating, setValidating] = useState<boolean>(false);
    const [analyzing, setAnalyzing] = useState<boolean>(false);
    const [validationResult, setValidationResult] = useState<StorageValidationResult | null>(null);
    const [recommendations, setRecommendations] = useState<LLMRecommendations | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    const fetchSubscriptions = async () => {
        try {
            const data = await apiClient.get(apiConfig.endpoints.subscriptions);
            // Handle both array and object response formats
            const subs = data.subscriptions || (Array.isArray(data) ? data : []);
            setSubscriptions(subs);
            if (subs.length > 0) {
                setSelectedSubscription(subs[0].id);
            }
        } catch (err) {
            console.error('Error fetching subscriptions:', err);
            setError('Failed to load subscriptions. Please try again.');
        }
    };

    const runValidation = async () => {
        if (!selectedSubscription) return;

        setValidating(true);
        setError(null);
        setValidationResult(null);
        setRecommendations(null);

        try {
            const data = await apiClient.get('/api/v1/storage-validation/validation', { subscription_id: selectedSubscription });
            setValidationResult(data);
        } catch (err: any) {
            console.error('Error running validation:', err);
            setError(err.message || 'Failed to run validation');
        } finally {
            setValidating(false);
        }
    };

    const generateRecommendations = async () => {
        if (!validationResult) return;

        setAnalyzing(true);
        setError(null);

        try {
            const data = await apiClient.post('/api/v1/storage-validation/validation/recommendations', validationResult);
            setRecommendations(data);
        } catch (err: any) {
            console.error('Error generating recommendations:', err);
            setError(err.message || 'Failed to generate recommendations');
        } finally {
            setAnalyzing(false);
        }
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    const downloadPDF = (e: React.MouseEvent) => {
        e.preventDefault();
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to download the report');
            return;
        }

        const content = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Storage Optimization Report</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
                    h1 { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
                    h2 { color: #4b5563; margin-top: 20px; }
                    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 15px; background-color: #fff; }
                    .priority { display: inline-block; padding: 2px 8px; border-radius: 4px; color: white; font-size: 12px; }
                    .priority.High { background-color: #ef4444; }
                    .priority.Medium { background-color: #f59e0b; }
                    .priority.Low { background-color: #3b82f6; }
                    .meta { background-color: #f9fafb; padding: 10px; border-radius: 4px; margin-top: 10px; }
                    .meta-item { margin-bottom: 5px; }
                    .label { font-weight: bold; }
                    pre { background: #f3f4f6; padding: 15px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <h1>Storage Optimization Report</h1>
                <p>Generated on ${new Date().toLocaleString()}</p>
                
                <h2>Summary</h2>
                <p>Total Storage Accounts: ${validationResult?.summary.total_accounts || 0}</p>
                <p>Total Containers: ${validationResult?.summary.total_containers || 0}</p>
                <p>Total Size: ${(validationResult?.summary.total_size_gb || 0).toFixed(2)} GB</p>

                <h2>Resource Details</h2>
                <h3>Large Accounts (>100MB)</h3>
                ${validationResult?.details.large_accounts && validationResult.details.large_accounts.length > 0 ? `
                    <ul>
                        ${validationResult.details.large_accounts.map(acc => `
                            <li>${acc.name} (${acc.size_gb.toFixed(4)} GB)</li>
                        `).join('')}
                    </ul>
                ` : '<p>No large accounts found.</p>'}

                <h3>Large Containers (>100MB)</h3>
                ${validationResult?.details.large_containers && validationResult.details.large_containers.length > 0 ? `
                    <ul>
                        ${validationResult.details.large_containers.map(cont => `
                            <li>${cont.container} (${cont.size_gb.toFixed(4)} GB)</li>
                        `).join('')}
                    </ul>
                ` : '<p>No large containers found.</p>'}

                <h2>AI Recommendations</h2>
                ${recommendations?.recommendations ? recommendations.recommendations.map(rec => `
                    <div class="card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h3 style="margin: 0;">${rec.title}</h3>
                            <span class="priority ${rec.priority}">${rec.priority} Priority</span>
                        </div>
                        <p>${rec.description}</p>
                        <div class="meta">
                            <div class="meta-item"><span class="label">Action:</span> ${rec.action}</div>
                            <div class="meta-item"><span class="label">Impact:</span> ${rec.impact}</div>
                            <div class="meta-item"><span class="label">Category:</span> ${rec.category || 'General'}</div>
                            <div class="meta-item">
                                <span class="label">Target Resources:</span> 
                                ${rec.target_resources.join(', ')}
                            </div>
                        </div>
                    </div>
                `).join('') : recommendations?.raw_recommendations ? `
                    <div class="card">
                        <h3>Raw Recommendations</h3>
                        <pre>${recommendations.raw_recommendations}</pre>
                    </div>
                ` : '<p>No recommendations generated.</p>'}
                
                ${recommendations?.lifecycle_policy ? `
                <h2>Lifecycle Policy</h2>
                <pre>
${JSON.stringify(recommendations.lifecycle_policy, null, 2)}
                </pre>
                ` : ''}
            </body>
            </html>
        `;

        printWindow.document.write(content);
        printWindow.document.close();
        
        // Wait for images/styles to load then print
        printWindow.onload = () => {
            printWindow.print();
        };
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Storage Validation & Optimization</h1>
                <p className="text-muted-foreground">
                    Analyze storage accounts for cost optimization, lifecycle management, and security compliance.
                </p>
            </div>

            {/* Controls */}
            <Card>
                <CardHeader>
                    <CardTitle>Validation Scope</CardTitle>
                    <CardDescription>Select a subscription to analyze storage resources.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-4 items-end">
                    <div className="space-y-2 flex-1">
                        <label className="text-sm font-medium">Subscription</label>
                        <Select value={selectedSubscription} onValueChange={setSelectedSubscription}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Subscription" />
                            </SelectTrigger>
                            <SelectContent>
                                {subscriptions.map((sub) => (
                                    <SelectItem key={sub.id} value={sub.id}>
                                        {sub.display_name} ({sub.id})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button 
                        onClick={runValidation} 
                        disabled={validating || !selectedSubscription}
                        className="min-w-[150px]"
                    >
                        {validating ? (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Validating...
                            </>
                        ) : (
                            <>
                                <Search className="mr-2 h-4 w-4" />
                                Run Validation
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Validation Results */}
            {validationResult && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Storage Accounts</CardTitle>
                                <Database className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{validationResult.summary.total_accounts}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Containers</CardTitle>
                                <Database className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{validationResult.summary.total_containers}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Size</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{validationResult.summary.total_size_gb.toFixed(2)} GB</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detailed Analysis */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Empty Resources */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Trash2 className="h-5 w-5 text-red-500" />
                                    Empty Resources (Candidates for Removal)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h4 className="font-semibold mb-2">Empty Accounts ({validationResult.details.empty_accounts.length})</h4>
                                    {validationResult.details.empty_accounts.length > 0 ? (
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground max-h-40 overflow-y-auto">
                                            {validationResult.details.empty_accounts.map((account, i) => (
                                                <li key={i}>{account}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-green-600 flex items-center"><CheckCircle className="h-4 w-4 mr-1"/> No empty accounts found</p>
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Empty Containers ({validationResult.details.empty_containers.length})</h4>
                                    {validationResult.details.empty_containers.length > 0 ? (
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground max-h-40 overflow-y-auto">
                                            {validationResult.details.empty_containers.map((container, i) => (
                                                <li key={i}>{container}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-green-600 flex items-center"><CheckCircle className="h-4 w-4 mr-1"/> No empty containers found</p>
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Large Containers ({'>'}100MB) ({validationResult.details.large_containers.length})</h4>
                                    {validationResult.details.large_containers.length > 0 ? (
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground max-h-40 overflow-y-auto">
                                            {validationResult.details.large_containers.map((container, i) => (
                                                <li key={i}>{container.container} ({container.size_gb.toFixed(4)} GB)</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-green-600 flex items-center"><CheckCircle className="h-4 w-4 mr-1"/> No large containers found</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Inactive & Large Resources */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Archive className="h-5 w-5 text-amber-500" />
                                    Inactive & Large Resources
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h4 className="font-semibold mb-2">Inactive Accounts ({validationResult.details.inactive_accounts.length})</h4>
                                    <p className="text-xs text-muted-foreground mb-2">No activity in last 90 days</p>
                                    {validationResult.details.inactive_accounts.length > 0 ? (
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground max-h-40 overflow-y-auto">
                                            {validationResult.details.inactive_accounts.map((account, i) => (
                                                <li key={i}>{account}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-green-600 flex items-center"><CheckCircle className="h-4 w-4 mr-1"/> No inactive accounts found</p>
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Large Accounts ({'>'}100MB) ({validationResult.details.large_accounts.length})</h4>
                                    {validationResult.details.large_accounts.length > 0 ? (
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground max-h-40 overflow-y-auto">
                                            {validationResult.details.large_accounts.map((account, i) => (
                                                <li key={i}>{account.name} ({account.size_gb.toFixed(4)} GB)</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-green-600 flex items-center"><CheckCircle className="h-4 w-4 mr-1"/> No large accounts found</p>
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Large Containers ({'>'}100MB) ({validationResult.details.large_containers.length})</h4>
                                    {validationResult.details.large_containers.length > 0 ? (
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground max-h-40 overflow-y-auto">
                                            {validationResult.details.large_containers.map((container, i) => (
                                                <li key={i}>{container.container} ({container.size_gb.toFixed(4)} GB)</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-green-600 flex items-center"><CheckCircle className="h-4 w-4 mr-1"/> No large containers found</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* LLM Action */}
                    <div className="flex justify-center">
                        <Button 
                            onClick={generateRecommendations} 
                            disabled={analyzing}
                            size="lg"
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {analyzing ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Analyzing with AI...
                                </>
                            ) : (
                                <>
                                    <Brain className="mr-2 h-4 w-4" />
                                    Generate AI Recommendations & Policies
                                </>
                            )}
                        </Button>
                    </div>

                    {/* LLM Results */}
                    {(recommendations || validationResult) && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Recommendations List */}
                            <Card className="border-purple-200 shadow-sm">
                                <CardHeader className="bg-purple-50 rounded-t-lg flex flex-row items-center justify-between">
                                    <CardTitle className="flex items-center text-purple-800">
                                        <Lightbulb className="mr-2 h-5 w-5" />
                                        AI Optimization Recommendations
                                    </CardTitle>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        type="button"
                                        onClick={downloadPDF}
                                        disabled={!validationResult}
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Download PDF
                                    </Button>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="grid gap-4">
                                        {recommendations?.recommendations ? (
                                            recommendations.recommendations.map((rec, i) => (
                                            <div key={i} className="border rounded-lg p-4 bg-white shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-semibold text-lg">{rec.title}</h3>
                                                    <Badge className={
                                                        rec.priority === 'High' ? 'bg-red-500' : 
                                                        rec.priority === 'Medium' ? 'bg-amber-500' : 'bg-blue-500'
                                                    }>
                                                        {rec.priority} Priority
                                                    </Badge>
                                                </div>
                                                <p className="text-gray-700 mb-3">{rec.description}</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-gray-50 p-3 rounded">
                                                    <div>
                                                        <span className="font-semibold text-gray-900">Recommended Action:</span>
                                                        <p className="text-gray-600">{rec.action}</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-gray-900">Impact:</span>
                                                        <p className="text-gray-600">{rec.impact}</p>
                                                    </div>
                                                    <div className="col-span-1 md:col-span-2">
                                                        <span className="font-semibold text-gray-900">Target Resources:</span>
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {rec.target_resources.map((res, j) => (
                                                                <Badge key={j} variant="outline" className="text-xs">
                                                                    {res}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                        ) : recommendations?.raw_recommendations ? (
                                            <div className="border rounded-lg p-4 bg-white shadow-sm">
                                                <h3 className="font-semibold text-lg mb-2">Raw Analysis Result</h3>
                                                <div className="bg-gray-50 p-3 rounded font-mono text-sm whitespace-pre-wrap">
                                                    {recommendations.raw_recommendations}
                                                </div>
                                                <p className="text-sm text-gray-500 mt-2">
                                                    Note: The AI response could not be parsed into the standard format.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="text-center p-6 text-gray-500">
                                                {analyzing ? 'Generating recommendations...' : 'No recommendations generated yet. Run the analysis to see AI insights.'}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Lifecycle Policy */}
                            {recommendations?.lifecycle_policy && (
                                <Card className="border-blue-200 shadow-sm">
                                    <CardHeader className="bg-blue-50 rounded-t-lg">
                                        <CardTitle className="flex items-center text-blue-800">
                                            <FileText className="mr-2 h-5 w-5" />
                                            Suggested Lifecycle Policy
                                        </CardTitle>
                                        <CardDescription>
                                            JSON definition for Azure Storage Lifecycle Management Policy
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="bg-slate-900 text-slate-50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                                            <pre>
{JSON.stringify({
    "rules": recommendations.lifecycle_policy.rules.map(rule => ({
        "enabled": true,
        "name": rule.name,
        "type": "Lifecycle",
        "definition": {
            "actions": {
                "baseBlob": {
                    "tierToCool": rule.action === 'TierToCool' ? { "daysAfterModificationGreaterThan": rule.days_after_modification_greater_than } : undefined,
                    "tierToArchive": rule.action === 'TierToArchive' ? { "daysAfterModificationGreaterThan": rule.days_after_modification_greater_than } : undefined,
                    "delete": rule.action === 'Delete' ? { "daysAfterModificationGreaterThan": rule.days_after_modification_greater_than } : undefined
                }
            },
            "filters": {
                "blobTypes": ["blockBlob"]
            }
        }
    }))
}, null, 2)}
                                            </pre>
                                        </div>
                                        <Button className="mt-4" variant="outline" onClick={() => {
                                            navigator.clipboard.writeText(JSON.stringify(recommendations.lifecycle_policy, null, 2));
                                        }}>
                                            <Copy className="mr-2 h-4 w-4" /> Copy Policy JSON
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Missing icon component definition for Copy
function Copy(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
    )
}

export default StorageValidationPage;