"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings, Sparkles, ChevronRight, ChevronLeft, Plus, X, Upload, RotateCcw, Info, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface AiSidebarProps {
  onImport: (items: any[], mode: 'replace' | 'append') => void;
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  organisms: string[];
  type: 'oligo' | 'probe';
  additionalText: string;
  response: string;
  success: boolean;
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function AiSidebar({ onImport }: AiSidebarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [apiKey, setApiKey] = React.useState('');
  const [type, setType] = React.useState<'oligo' | 'probe'>('oligo');
  const [importMode, setImportMode] = React.useState<'replace' | 'append'>('replace');
  const [organisms, setOrganisms] = React.useState<string[]>(['']);
  const [additionalText, setAdditionalText] = React.useState('');
  const [additionalFile, setAdditionalFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = React.useState<string | null>(null);
  const [showOutput, setShowOutput] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Load from localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('idt-ai-api-key');
      const savedHistory = localStorage.getItem('idt-ai-history');
      if (savedKey) setApiKey(savedKey);
      if (savedHistory) {
        try {
          setHistory(JSON.parse(savedHistory));
        } catch {}
      }
    }
  }, []);

  // Save to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined' && apiKey) {
      localStorage.setItem('idt-ai-api-key', apiKey);
    }
  }, [apiKey]);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && history.length > 0) {
      localStorage.setItem('idt-ai-history', JSON.stringify(history));
    }
  }, [history]);

  async function generateSequences() {
    if (!apiKey) {
      toast.error('Please set your OpenAI API key in settings');
      return;
    }

    const validOrganisms = organisms.filter(o => o.trim());
    
    // Check if we have either organisms OR additional context/file
    if (validOrganisms.length === 0 && !additionalText.trim() && !additionalFile) {
      toast.error('Please enter organisms or provide additional context/file');
      return;
    }

    setLoading(true);
    setShowOutput(false);

    try {
      let fileContent = '';
      if (additionalFile) {
        const rawContent = await additionalFile.text();
        const maxChars = 50000;
        
        // If file is too large, use AI to extract relevant DNA sequence information first
        if (rawContent.length > maxChars) {
          toast.info('Large file detected - extracting relevant sections...');
          
          try {
            // First pass: Extract only DNA/sequence-relevant sections
            const extractionPrompt = `You are analyzing a scientific document. Extract ONLY the sections that contain or discuss DNA sequences, oligonucleotides, primers, or genetic information. 

Remove all irrelevant sections like:
- References/bibliography
- Author information
- Abstract (unless it contains sequences)
- Methods (unless describing sequences)
- Acknowledgments
- General discussion without sequences

Keep:
- Sequence data (ACGT strings)
- Tables with sequences
- Primers/oligos descriptions
- Gene names and their sequences
- Any NCBI/GenBank references

Respond with ONLY the relevant extracted text, no explanations. If no relevant sections found, respond with "NO_SEQUENCES_FOUND".`;

            const extractionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: extractionPrompt },
                  { role: 'user', content: rawContent.substring(0, 100000) } // Use first 100k chars for extraction
                ],
                temperature: 0.1,
                max_tokens: 8000
              })
            });

            if (extractionResponse.ok) {
              const extractionData = await extractionResponse.json();
              const extracted = extractionData.choices[0]?.message?.content || '';
              
              if (extracted && extracted !== 'NO_SEQUENCES_FOUND' && extracted.length > 100) {
                fileContent = extracted;
                toast.success('Relevant sections extracted from large file');
              } else {
                fileContent = rawContent.substring(0, maxChars) + '\n\n[... File truncated. Consider uploading a smaller file or text with only relevant sections ...]';
                toast.warning('Could not extract sequences - using first portion of file');
              }
            } else {
              // Fallback to simple truncation
              fileContent = rawContent.substring(0, maxChars) + '\n\n[... File truncated due to size ...]';
              toast.warning('Large file truncated to fit token limits');
            }
          } catch (extractError) {
            // Fallback to simple truncation on any error
            fileContent = rawContent.substring(0, maxChars) + '\n\n[... File truncated due to size ...]';
            toast.warning('Large file truncated to fit token limits');
          }
        } else {
          fileContent = rawContent;
        }
      }

      const organismList = validOrganisms.length > 0 
        ? validOrganisms.map((o, i) => `${i + 1}. ${o}`).join('\n')
        : '';
      
      const additionalContext = [
        additionalText ? `User notes:\n${additionalText}` : '',
        fileContent ? `Attached study/document:\n${fileContent}` : ''
      ].filter(Boolean).join('\n\n');

      const systemPrompt = `You are a DNA sequence research assistant. Your task is to find accurate DNA sequences for the specified organisms.

CRITICAL INSTRUCTIONS:
1. Search for REAL, VERIFIED DNA sequences from scientific databases (NCBI, GenBank, etc.)
2. If you cannot find verified data, respond with: {"error": "Could not find verified sequences"}
3. NEVER make up or fabricate sequences
4. Include gene/region information in the name field
5. Respond ONLY with valid JSON - no additional text, explanations, or markdown

Response format (JSON only):
{
  "items": [
    {
      "kind": "oligo",
      "name": "OrganismName_GeneName_Region",
      "sequence": "ACGT...",
      "params": {
        "scale": "25nm",
        "purification": "STD"
      }
    }
  ]
}

Sequence constraints:
- Only these characters: A, C, G, T, R, Y, S, W, K, M, B, D, H, V, N
- Length: 15-60 nt (for 25nm scale)
- If multiple sequences exist for an organism, include all with clear distinguishing names`;

      const userPrompt = validOrganisms.length > 0
        ? `Find DNA sequences for these organisms:
${organismList}

Type: ${type === 'oligo' ? 'Oligonucleotides' : 'Probes'}

${additionalContext}

Provide verified sequences in the JSON format specified. If you find multiple relevant sequences per organism, include them all with descriptive names.`
        : `Extract and provide DNA sequences based on the following context:

Type: ${type === 'oligo' ? 'Oligonucleotides' : 'Probes'}

${additionalContext}

Analyze the provided information and extract or identify relevant DNA sequences. Provide them in the JSON format specified with appropriate names based on the context.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `API error: ${response.status}`;
        
        // Special handling for token limit errors
        if (errorMsg.includes('Request too large') || errorMsg.includes('tokens per min')) {
          throw new Error('File too large. Try a smaller file or reduce the amount of text.');
        }
        
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || '';

      // Extract JSON from response
      let cleanedResponse = aiResponse.trim();
      const jsonMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[1].trim();
      }

      // Parse JSON
      let parsedData;
      try {
        parsedData = JSON.parse(cleanedResponse);
      } catch (e) {
        throw new Error('AI returned invalid JSON format');
      }

      if (parsedData.error) {
        throw new Error(parsedData.error);
      }

      if (!parsedData.items || !Array.isArray(parsedData.items) || parsedData.items.length === 0) {
        throw new Error('AI response missing required "items" array');
      }

      // Validate items
      for (const item of parsedData.items) {
        if (!item.kind || !item.name || !item.sequence || !item.params) {
          throw new Error('Invalid item structure in AI response');
        }
        if (type === 'oligo' && item.kind !== 'oligo') {
          throw new Error('AI returned wrong type (expected oligo)');
        }
      }

      // Add to history
      const historyEntry: HistoryEntry = {
        id: newId(),
        timestamp: Date.now(),
        organisms: validOrganisms,
        type,
        additionalText,
        response: aiResponse,
        success: true
      };
      setHistory(prev => [historyEntry, ...prev].slice(0, 50));

      // Import sequences
      const newItems = parsedData.items.map((item: any) => ({
        ...item,
        id: newId()
      }));

      onImport(newItems, importMode);
      toast.success(`Generated ${newItems.length} sequence(s) from AI (${importMode} mode)`);
      setSelectedHistoryId(historyEntry.id);

    } catch (error: any) {
      const historyEntry: HistoryEntry = {
        id: newId(),
        timestamp: Date.now(),
        organisms: validOrganisms,
        type,
        additionalText,
        response: error.message || 'Unknown error',
        success: false
      };
      setHistory(prev => [historyEntry, ...prev].slice(0, 50));
      setSelectedHistoryId(historyEntry.id);
      setShowOutput(true);
      toast.error('AI generation failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function deleteHistoryItem(id: string, e: React.MouseEvent) {
    e.stopPropagation(); // Prevent triggering the parent button click
    setHistory(prev => {
      const newHistory = prev.filter(entry => entry.id !== id);
      // Update localStorage
      if (typeof window !== 'undefined') {
        if (newHistory.length > 0) {
          localStorage.setItem('idt-ai-history', JSON.stringify(newHistory));
        } else {
          localStorage.removeItem('idt-ai-history');
        }
      }
      return newHistory;
    });
    
    // If the deleted item was selected, close the dialog
    if (selectedHistoryId === id) {
      setSelectedHistoryId(null);
      setShowOutput(false);
    }
    
    toast.success('History item deleted');
  }

  return (
    <>
      <div 
        className={`${isOpen ? 'w-96' : 'w-12'} border-r bg-muted/20 flex flex-col`}
        style={{ transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <div className="p-2 border-b flex items-center justify-between">
          {isOpen ? (
            <>
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-purple-600" />
                <span className="font-semibold">Generate Sequences</span>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <Info className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="space-y-2">
                        <p className="font-semibold text-xs">Recommended Use Cases:</p>
                        <ul className="text-xs space-y-1">
                          <li>• Traditional: Organism names only</li>
                          <li>• Enhanced: Organism names + additional context</li>
                          <li>• File-based: Upload a research paper/document to extract sequences</li>
                          <li>• Text-based: Paste sequences or research notes to format them</li>
                          <li>• Hybrid: Any combination of organisms, text, and files</li>
                        </ul>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setSettingsOpen(!settingsOpen)}>
                  <Settings className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setIsOpen(false)}>
                  <ChevronLeft className="size-4" />
                </Button>
              </div>
            </>
          ) : (
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setIsOpen(true)}>
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>

        {isOpen && (
          <div 
            className="flex-1 overflow-y-auto p-4 space-y-4 animate-in fade-in slide-in-from-left-4"
            style={{ 
              animationDuration: '0.3s',
              animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {settingsOpen && (
              <div className="p-3 border rounded-lg bg-background space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Settings</Label>
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => setSettingsOpen(false)}>
                    <X className="size-3" />
                  </Button>
                </div>
                <div>
                  <Label htmlFor="ai-api-key" className="text-xs">OpenAI API Key</Label>
                  <Input
                    id="ai-api-key"
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="mt-1 text-xs h-8"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold mb-2 block">Type</Label>
              <Select value={type} onValueChange={(v: 'oligo' | 'probe') => setType(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oligo">Oligos</SelectItem>
                  <SelectItem value="probe" disabled>Probes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-2 block">Mode</Label>
              <div className="inline-flex border rounded-md overflow-hidden w-full">
                <button
                  type="button"
                  aria-pressed={importMode === 'replace'}
                  onClick={() => setImportMode('replace')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    importMode === 'replace'
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  }`}
                >
                  Replace
                </button>
                <button
                  type="button"
                  aria-pressed={importMode === 'append'}
                  onClick={() => setImportMode('append')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    importMode === 'append'
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  }`}
                >
                  Append
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-2 block">Organisms</Label>
              <div className="space-y-2">
                {organisms.map((org, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="e.g., E. coli, SARS-CoV-2"
                      value={org}
                      onChange={(e) => {
                        const newOrgs = [...organisms];
                        newOrgs[idx] = e.target.value;
                        setOrganisms(newOrgs);
                      }}
                      className="text-xs h-8"
                    />
                    {organisms.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setOrganisms(organisms.filter((_, i) => i !== idx))}
                      >
                        <X className="size-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => setOrganisms([...organisms, ''])}
                >
                  <Plus className="size-3 mr-1" /> Add Organism
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-2 block">Additional Context (Optional)</Label>
              <Textarea
                placeholder="Add notes, study details, or specific requirements..."
                value={additionalText}
                onChange={(e) => setAdditionalText(e.target.value)}
                className="text-xs min-h-[80px] resize-none"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold mb-2 block">Attach Study/Document (Optional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.doc,.docx"
                onChange={(e) => setAdditionalFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-3 mr-1" />
                {additionalFile ? additionalFile.name : 'Choose File'}
              </Button>
              {additionalFile && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-6 text-xs mt-1"
                  onClick={() => setAdditionalFile(null)}
                >
                  <X className="size-3 mr-1" /> Remove
                </Button>
              )}
            </div>

            <Button className="w-full" onClick={generateSequences} disabled={loading || !apiKey}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  Generate Sequences
                </>
              )}
            </Button>

            {history.length > 0 && (
              <div className="pt-4 border-t">
                <Label className="text-xs font-semibold mb-2 block">History</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className={`relative group rounded border text-xs transition-colors ${
                        selectedHistoryId === entry.id ? 'bg-muted border-primary' : 'bg-background'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedHistoryId(entry.id);
                          setShowOutput(true);
                        }}
                        className="w-full text-left p-2 hover:bg-muted/50 transition-colors rounded"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-medium ${entry.success ? 'text-green-600' : 'text-red-600'}`}>
                            {entry.success ? '✓' : '✗'} {entry.type}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-muted-foreground truncate">
                          {entry.organisms.join(', ')}
                        </div>
                      </button>
                      <button
                        onClick={(e) => deleteHistoryItem(entry.id, e)}
                        className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                        title="Delete history item"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showOutput} onOpenChange={setShowOutput}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Response</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
              {history.find(h => h.id === selectedHistoryId)?.response}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOutput(false)}>
              Close
            </Button>
            {(() => {
              const selectedEntry = history.find(h => h.id === selectedHistoryId);
              if (selectedEntry?.success) {
                return (
                  <Button 
                    variant="secondary"
                    onClick={() => {
                      try {
                        const response = selectedEntry.response;
                        let cleanedResponse = response.trim();
                        const jsonMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                        if (jsonMatch) {
                          cleanedResponse = jsonMatch[1].trim();
                        }
                        
                        const parsedData = JSON.parse(cleanedResponse);
                        if (parsedData.items && Array.isArray(parsedData.items)) {
                          const newItems = parsedData.items.map((item: any) => ({
                            ...item,
                            id: newId()
                          }));
                          onImport(newItems, importMode);
                          toast.success(`Imported ${newItems.length} sequence(s) from history (${importMode} mode)`);
                          setShowOutput(false);
                        } else {
                          toast.error('Invalid response format');
                        }
                      } catch (error) {
                        toast.error('Failed to import from history');
                      }
                    }}
                  >
                    <Upload className="size-4 mr-2" /> Import
                  </Button>
                );
              }
              return null;
            })()}
            <Button 
              onClick={() => {
                const selectedEntry = history.find(h => h.id === selectedHistoryId);
                if (selectedEntry) {
                  // Populate the form with the history entry's parameters
                  setType(selectedEntry.type);
                  setOrganisms(selectedEntry.organisms.length > 0 ? selectedEntry.organisms : ['']);
                  setAdditionalText(selectedEntry.additionalText || '');
                  setShowOutput(false);
                  toast.info('Form populated with previous parameters');
                }
              }}
            >
              <RotateCcw className="size-4 mr-2" /> Try Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
