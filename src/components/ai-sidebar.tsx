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
import { Switch } from "@/components/ui/switch";
import { Settings, Sparkles, ChevronRight, ChevronLeft, Plus, X, Upload, RotateCcw, Info, Trash2, Download, FileUp, HelpCircle, AlertCircle, Github } from "lucide-react";
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

// Load PDF.js from CDN to avoid SSR issues
async function loadPdfJsLib() {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be loaded in the browser');
  }

  // Check if already loaded
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }

  // Load PDF.js from CDN
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(pdfjsLib);
      } else {
        reject(new Error('Failed to load PDF.js library'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'));
    document.head.appendChild(script);
  });
}

// Extract text from PDF file
async function extractTextFromPDF(file: File): Promise<string> {
  // Ensure we're only running in the browser
  if (typeof window === 'undefined') {
    throw new Error('PDF extraction is only available in the browser');
  }

  try {
    // Load PDF.js from CDN
    const pdfjsLib = await loadPdfJsLib();
    
    const arrayBuffer = await file.arrayBuffer();
    
    // Validate PDF file size (max 50MB)
    if (arrayBuffer.byteLength > 50 * 1024 * 1024) {
      throw new Error('PDF file too large (max 50MB)');
    }
    
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    });
    
    const pdf = await loadingTask.promise;
    
    if (!pdf || pdf.numPages === 0) {
      throw new Error('PDF has no pages or is corrupted');
    }
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
          .trim();
        if (pageText) {
          fullText += pageText + '\n\n';
        }
      } catch (pageError) {
        console.warn(`Failed to extract page ${i}:`, pageError);
        // Continue with other pages
      }
    }
    
    if (!fullText.trim()) {
      throw new Error('No text content found in PDF. The PDF may be image-based or protected.');
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to extract PDF text: ${errorMessage}`);
  }
}

export function AiSidebar({ onImport }: AiSidebarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [apiKey, setApiKey] = React.useState('');
  const [type, setType] = React.useState<'oligo' | 'probe'>('oligo');
  const [importMode, setImportMode] = React.useState<'replace' | 'append'>('replace');
  const [organisms, setOrganisms] = React.useState<string[]>(['']);
  const [additionalText, setAdditionalText] = React.useState('');
  const [additionalTextFocused, setAdditionalTextFocused] = React.useState(false);
  const [additionalFile, setAdditionalFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = React.useState<string | null>(null);
  const [showOutput, setShowOutput] = React.useState(false);
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const [expandedSearch, setExpandedSearch] = React.useState(false);
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [welcomeCountdown, setWelcomeCountdown] = React.useState(3);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Check if first time user and show welcome
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeenWelcome = localStorage.getItem('idt-ai-welcome-seen');
      if (!hasSeenWelcome && isOpen) {
        setShowWelcome(true);
      }
    }
  }, [isOpen]);

  // Countdown timer for welcome dialog
  React.useEffect(() => {
    if (showWelcome && welcomeCountdown > 0) {
      const timer = setTimeout(() => {
        setWelcomeCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome, welcomeCountdown]);

  const handleWelcomeContinue = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('idt-ai-welcome-seen', 'true');
    }
    setShowWelcome(false);
    setWelcomeCountdown(3); // Reset for next time
  };

  const handleShowWelcomeAgain = () => {
    setWelcomeCountdown(3);
    setShowWelcome(true);
  };

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

  // Load sidebar state and form data from localStorage on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSidebarOpen = localStorage.getItem('idt-ai-sidebar-open');
      const savedFormData = localStorage.getItem('idt-ai-form-data');
      
      if (savedSidebarOpen === 'true') {
        setIsOpen(true);
      }
      
      if (savedFormData) {
        try {
          const formData = JSON.parse(savedFormData);
          if (formData.type) setType(formData.type);
          if (formData.organisms) setOrganisms(formData.organisms);
          if (formData.additionalText) setAdditionalText(formData.additionalText);
          if (formData.importMode) setImportMode(formData.importMode);
          if (formData.expandedSearch !== undefined) setExpandedSearch(formData.expandedSearch);
        } catch {}
      }
    }
  }, []);

  // Save sidebar open state to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('idt-ai-sidebar-open', isOpen.toString());
    }
  }, [isOpen]);

  // Save form data to localStorage whenever it changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const formData = {
        type,
        organisms,
        additionalText,
        importMode,
        expandedSearch
      };
      localStorage.setItem('idt-ai-form-data', JSON.stringify(formData));
    }
  }, [type, organisms, additionalText, importMode, expandedSearch]);

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
        // Check if file is PDF and extract text
        if (additionalFile.type === 'application/pdf' || additionalFile.name.toLowerCase().endsWith('.pdf')) {
          toast.info('Extracting text from PDF...');
          try {
            fileContent = await extractTextFromPDF(additionalFile);
            toast.success(`PDF text extracted: ${Math.round(fileContent.length / 1000)}KB of text`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            toast.error(errorMsg);
            setLoading(false);
            return;
          }
        } else {
          fileContent = await additionalFile.text();
        }
        
        // Check if file is extremely large (over 500KB of text)
        // GPT-4o-mini can handle ~128k tokens (~500KB of text)
        const maxChars = 500000;
        if (fileContent.length > maxChars) {
          toast.warning(`File very large (${Math.round(fileContent.length / 1000)}KB). Using first ${Math.round(maxChars / 1000)}KB.`);
          fileContent = fileContent.substring(0, maxChars) + '\n\n[... File truncated due to size ...]';
        }
      }

      const organismList = validOrganisms.length > 0 
        ? validOrganisms.map((o, i) => `${i + 1}. ${o}`).join('\n')
        : '';
      
      const additionalContext = [
        additionalText ? `User notes:\n${additionalText}` : '',
        fileContent ? `Attached study/document:\n${fileContent}` : ''
      ].filter(Boolean).join('\n\n');

      // Determine the scenario:
      // 1. Document only (no organisms) → Extract ALL sequences from document
      // 2. Document + organisms → Find specific organisms in document
      // 3. Organisms only (no document) → Search databases for organisms
      const hasFileOrContext = Boolean(fileContent || additionalText);
      const hasOrganisms = validOrganisms.length > 0;
      
      let systemPrompt: string;
      let userPrompt: string;

      if (hasFileOrContext && !hasOrganisms) {
        // Scenario 1: Document only - extract ALL DNA sequences
        systemPrompt = `You are a DNA sequence extraction specialist. Your task is to extract ALL DNA sequences from the provided document.

CRITICAL INSTRUCTIONS:
1. Extract EVERY DNA sequence found in the document (primers, probes, oligonucleotides, gene sequences, etc.)
2. Look for sequences in tables, figures, text, supplementary data, etc.
3. Use the exact sequences as written in the document
4. Create descriptive names based on labels/context in the document
5. If NO sequences are found, respond with: {"error": "No DNA sequences found in document"}
6. NEVER make up or fabricate sequences - only extract what's actually in the document
7. Respond ONLY with valid JSON - no additional text, explanations, or markdown

Response format (JSON only):
{
  "items": [
    {
      "kind": "oligo",
      "name": "DescriptiveName_GeneName_Region",
      "sequence": "ACGT...",
      "params": {
        "scale": "25nm",
        "purification": "STD"
      }
    }
  ]
}

SEQUENCE & PARAMS CONSTRAINTS:
- Characters: ONLY A, C, G, T, R, Y, S, W, K, M, B, D, H, V, N (remove any invalid characters)
- scale: AUTOMATICALLY select based on sequence length (measured in nucleotides):
  * 15-60nt: Use "25nm" (most cost-effective for standard oligos)
  * 10-14nt OR 61-90nt: Use "100nm"
  * 5-9nt OR 91-100nt: Use "250nm" (or "1um"/"2um" for bulk orders)
  * 45-200nt: Use "4nmU" or "20nmU" (Ultramer synthesis for longer sequences)
  * 60-200nt with complexity: Use "PU" (PAGE-purified Ultramer)
  * 15-45nt rush orders: Use "25nmS" (Sameday)
- purification: AUTOMATICALLY select based on application (default to most cost-effective):
  * Standard applications (PCR, cloning): "STD" (Standard Desalting - cheapest, most common)
  * High purity needed (transfection, sensitive assays): "HPLC" or "PAGE"
  * RNA work or RNase sensitivity: "RNASE"
  * Ion exchange applications: "IEHPLC"
  * Highest purity needed: "DUALHPLC" or "PAGEHPLC"

CRITICAL: If a sequence is outside valid length range for any scale, either:
1. Truncate/trim the sequence to fit within valid ranges (preferred for extraction)
2. Split into multiple overlapping shorter sequences
3. Skip if sequence cannot be salvaged

Extract ALL sequences found - don't filter or select. Use descriptive names from the document's labels/descriptions.`;

        userPrompt = `Extract ALL DNA sequences from the following document:

Type: ${type === 'oligo' ? 'Oligonucleotides' : 'Probes'}

${additionalContext}

Find and extract every DNA sequence present in this document. Provide them all in the JSON format specified.`;

      } else if (hasFileOrContext && hasOrganisms) {
        // Scenario 2: Document + organisms - find specific organisms in document
        systemPrompt = `You are a DNA sequence research assistant. Your task is to find DNA sequences for specific organisms using the provided document.

CRITICAL INSTRUCTIONS:
1. Search the provided document for sequences related to the specified organisms
2. Extract sequences that match or relate to the organism names provided
3. If sequences for the organisms are mentioned but not shown, note what's available in the document
4. Use descriptive names that include organism and gene/region information
5. If the organisms are NOT found in the document, respond with: {"error": "Specified organisms not found in document"}
6. NEVER make up or fabricate sequences
7. Respond ONLY with valid JSON - no additional text, explanations, or markdown

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

SEQUENCE & PARAMS CONSTRAINTS:
- Characters: ONLY A, C, G, T, R, Y, S, W, K, M, B, D, H, V, N (remove any invalid characters)
- scale: AUTOMATICALLY select the most appropriate scale for sequence length:
  * 15-60nt: "25nm" (standard, most cost-effective)
  * 10-14nt OR 61-90nt: "100nm"
  * 5-9nt OR 91-100nt: "250nm" (or "1um"/"2um"/"5um"/"10um" for large quantities)
  * 45-200nt: "4nmU" or "20nmU" (Ultramer for long sequences)
  * 60-200nt complex: "PU" (PAGE Ultramer)
  * 15-45nt rush: "25nmS" (Sameday service)
- purification: AUTOMATICALLY select based on likely use case (default to cost-effective):
  * General use (PCR, sequencing): "STD" (Standard Desalting - default)
  * High purity needs: "HPLC" or "PAGE"
  * RNA-sensitive work: "RNASE"
  * Specialized: "IEHPLC", "DUALHPLC", "PAGEHPLC"

CRITICAL: If sequence length is invalid for all scales:
1. Truncate to fit valid range (15-200nt)
2. Split into multiple sequences if very long
3. Skip if cannot be made valid

Only return sequences for the specified organisms found in the document.`;

        userPrompt = `Find DNA sequences for these specific organisms in the provided document:
${organismList}

Type: ${type === 'oligo' ? 'Oligonucleotides' : 'Probes'}

${additionalContext}

Search the document for sequences related to these organisms. Provide all relevant sequences in the JSON format specified.`;

      } else {
        // Scenario 3: Organisms only - search databases
        if (expandedSearch) {
          // Expanded search mode - cast a wider net
          systemPrompt = `You are a DNA sequence research assistant. Your task is to find DNA sequences for the specified organisms using ALL available sources.

CRITICAL INSTRUCTIONS:
1. Search BROADLY across scientific literature, databases (NCBI, GenBank, published papers, etc.)
2. Include sequences from research papers, preprints, and other scientific sources
3. Prioritize verified sequences but include relevant sequences from reliable sources
4. Find AS MANY relevant sequences as possible for each organism (primers, probes, gene regions, etc.)
5. Remove duplicate sequences (same sequence with different names)
6. Include gene/region information in the name field
7. If you truly cannot find ANY sequences after broad search, respond with: {"error": "No sequences found even with expanded search"}
8. NEVER fabricate sequences - only use sequences that exist in scientific literature/databases
9. Respond ONLY with valid JSON - no additional text, explanations, or markdown

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

SEQUENCE & PARAMS CONSTRAINTS:
- Characters: ONLY A, C, G, T, R, Y, S, W, K, M, B, D, H, V, N (strip invalid characters)
- scale: INTELLIGENTLY auto-select the optimal scale based on sequence length:
  * 15-60nt: "25nm" (standard synthesis, most economical)
  * 10-14nt OR 61-90nt: "100nm" (slightly longer)
  * 5-9nt OR 91-100nt: "250nm" (or "1um"/"2um"/"5um"/"10um" for bulk)
  * 45-200nt: "4nmU" or "20nmU" (Ultramer technology required)
  * 60-200nt with complexity: "PU" (PAGE-purified Ultramer)
  * 15-45nt urgent: "25nmS" (Sameday delivery)
- purification: INTELLIGENTLY select based on typical use (prioritize cost-effectiveness):
  * Default/PCR/cloning: "STD" (Standard Desalting - cheapest)
  * Probes/assays requiring purity: "HPLC" or "PAGE"
  * RNA applications: "RNASE" (RNase-free)
  * Specialized needs: "IEHPLC", "DUALHPLC", "PAGEHPLC"

CRITICAL RULES:
- If sequence is <5nt or >200nt: REJECT or truncate to valid range
- Ensure EVERY sequence has valid scale for its length
- Default to most cost-effective options (25nm + STD for 15-60nt)

Return MULTIPLE sequences per organism when available (different genes, regions, primers). No duplicate sequences.`;

          userPrompt = `Find DNA sequences for these organisms using EXPANDED search:
${organismList}

Type: ${type === 'oligo' ? 'Oligonucleotides' : 'Probes'}

EXPANDED SEARCH MODE: Search broadly across all scientific sources. Find as many relevant, non-duplicate sequences as possible for each organism. Include primers, probes, and gene-specific sequences from research papers and databases.`;

        } else {
          // Standard search mode - verified databases only
          systemPrompt = `You are a DNA sequence research assistant. Your task is to find accurate DNA sequences for the specified organisms.

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

SEQUENCE & PARAMS CONSTRAINTS:
- Characters: ONLY A, C, G, T, R, Y, S, W, K, M, B, D, H, V, N (strip any other characters)
- scale: INTELLIGENTLY choose the right scale for each sequence length:
  * 15-60nt: "25nm" (standard synthesis, most common and economical)
  * 10-14nt OR 61-90nt: "100nm" (extended range)
  * 5-9nt OR 91-100nt: "250nm" (or "1um"/"2um"/"5um"/"10um" for large scale)
  * 45-200nt: "4nmU" or "20nmU" (Ultramer synthesis for long oligos)
  * 60-200nt complex: "PU" (PAGE-purified Ultramer)
  * 15-45nt rush: "25nmS" (Sameday service)
- purification: INTELLIGENTLY select based on application (favor cost-effective options):
  * Routine work (PCR, cloning, etc.): "STD" (Standard Desalting - default and cheapest)
  * High purity required (transfection, CRISPR, etc.): "HPLC" or "PAGE"
  * RNA-sensitive applications: "RNASE" (RNase-free treatment)
  * Specialized applications: "IEHPLC" (ion exchange), "DUALHPLC", "PAGEHPLC"

CRITICAL VALIDATION:
- Sequences <5nt or >200nt are INVALID - skip or truncate them
- EVERY sequence MUST have a scale that matches its length range
- Always choose the most cost-effective scale/purification that meets requirements

If multiple sequences exist for an organism, include all with clear distinguishing names.`;

          userPrompt = `Find DNA sequences for these organisms:
${organismList}

Type: ${type === 'oligo' ? 'Oligonucleotides' : 'Probes'}

Provide verified sequences from scientific databases in the JSON format specified. If you find multiple relevant sequences per organism, include them all with descriptive names.`;
        }
      }

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

  function exportHistory() {
    if (history.length === 0) {
      toast.error('No history to export');
      return;
    }

    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `idt-ai-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('History exported successfully');
  }

  function importHistory(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (!Array.isArray(imported)) {
          toast.error('Invalid history file format');
          return;
        }

        // Validate structure
        const isValid = imported.every(entry => 
          entry.id && entry.timestamp && entry.type && Array.isArray(entry.organisms)
        );

        if (!isValid) {
          toast.error('Invalid history file structure');
          return;
        }

        // Merge with existing history, avoiding duplicates by ID
        setHistory(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const newEntries = imported.filter(e => !existingIds.has(e.id));
          const merged = [...prev, ...newEntries]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 50);
          
          if (typeof window !== 'undefined') {
            localStorage.setItem('idt-ai-history', JSON.stringify(merged));
          }
          
          return merged;
        });

        toast.success(`Imported ${imported.length} history item(s)`);
      } catch (error) {
        toast.error('Failed to import history file');
      }
    };
    reader.readAsText(file);
    
    // Reset input so same file can be imported again
    e.target.value = '';
  }

  function clearAllHistory() {
    setHistory([]);
    setSelectedHistoryId(null);
    setShowOutput(false);
    setShowClearConfirm(false);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('idt-ai-history');
    }
    
    toast.success('History cleared');
  }

  return (
    <>
      <div 
        className={`${isOpen ? 'w-[420px]' : 'w-12'} border-r bg-gradient-to-b from-purple-50/50 via-transparent to-transparent dark:from-purple-950/20 flex flex-col relative`}
        style={{ transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <div className="p-2 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between">
          {isOpen ? (
            <>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Sparkles className="size-5 text-purple-600 animate-pulse" style={{ animationDuration: '3s' }} />
                  <div className="absolute inset-0 bg-purple-600/20 blur-md rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
                </div>
                <span className="font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Generate Sequences
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-8 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors" 
                        onClick={handleShowWelcomeAgain}
                      >
                        <HelpCircle className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">View guide</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-8 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors" 
                        onClick={() => setSettingsOpen(!settingsOpen)}
                      >
                        <Settings className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">OpenAI API settings</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-8 hover:bg-muted transition-colors" 
                        onClick={() => setIsOpen(false)}
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">Close sidebar</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </>
          ) : (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="size-8 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors" 
                    onClick={() => setIsOpen(true)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">Open AI sequence generator</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {isOpen && (
          <div 
            className="flex-1 overflow-y-auto px-6 py-4 space-y-4 animate-in fade-in slide-in-from-left-4"
            style={{ 
              animationDuration: '0.3s',
              animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {settingsOpen && (
              <div className="p-3 border rounded-lg bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="size-4 text-blue-600" />
                    <Label className="text-sm font-semibold">Settings</Label>
                  </div>
                  <Button variant="ghost" size="icon" className="size-6 hover:bg-destructive/10 transition-colors" onClick={() => setSettingsOpen(false)}>
                    <X className="size-3" />
                  </Button>
                </div>
                <div>
                  <Label htmlFor="ai-api-key" className="text-xs flex items-center gap-1">
                    OpenAI API Key
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="size-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="text-xs">Get your API key from platform.openai.com</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="ai-api-key"
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="mt-1 text-xs h-8 transition-all focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold mb-2 block flex items-center gap-1">
                  Type
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="size-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Sequence type to generate</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Select value={type} onValueChange={(v: 'oligo' | 'probe') => setType(v)}>
                  <SelectTrigger className="h-8 text-xs transition-all hover:border-purple-300 focus:ring-2 focus:ring-purple-500/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oligo">Oligos</SelectItem>
                    <SelectItem value="probe" disabled>Probes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-2 block flex items-center gap-1">
                  Mode
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="size-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Replace all or append to existing</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <div className="inline-flex border rounded-md overflow-hidden w-full shadow-sm">
                  <button
                    type="button"
                    aria-pressed={importMode === 'replace'}
                    onClick={() => setImportMode('replace')}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium transition-all duration-300 ease-in-out ${
                      importMode === 'replace'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-accent/50 text-foreground'
                    }`}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    aria-pressed={importMode === 'append'}
                    onClick={() => setImportMode('append')}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium transition-all duration-300 ease-in-out ${
                      importMode === 'append'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-accent/50 text-foreground'
                    }`}
                  >
                    Append
                  </button>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-2 block">Organisms</Label>
              <div className="space-y-2">
                {organisms.map((org, idx) => (
                  <div key={idx} className="flex gap-2 group">
                    <Input
                      placeholder="e.g., E. coli, SARS-CoV-2"
                      value={org}
                      onChange={(e) => {
                        const newOrgs = [...organisms];
                        newOrgs[idx] = e.target.value;
                        setOrganisms(newOrgs);
                      }}
                      className="text-xs h-8 transition-all focus:ring-2 focus:ring-purple-500/20 group-hover:border-purple-300"
                    />
                    {organisms.length > 1 && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                              onClick={() => setOrganisms(organisms.filter((_, i) => i !== idx))}
                            >
                              <X className="size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">Remove organism</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs hover:bg-purple-50 dark:hover:bg-purple-950/20 hover:border-purple-300 transition-all hover:scale-[1.01]"
                  onClick={() => setOrganisms([...organisms, ''])}
                >
                  <Plus className="size-3 mr-1" /> Add Organism
                </Button>
              </div>
              
              <div className="flex items-center justify-between mt-3 p-2.5 rounded-md bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-900/50 transition-all hover:shadow-sm">
                <div className="flex items-center gap-2">
                  <Label htmlFor="expanded-search" className="text-xs font-medium cursor-pointer">
                    Expanded Search
                  </Label>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertCircle className="size-3.5 text-amber-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs font-semibold mb-1">⚠️ Use with caution</p>
                        <p className="text-xs">
                          Only enable if no sequences were found after trying a few times. 
                          Searches beyond verified databases—may find more results but with less certainty.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Switch
                  id="expanded-search"
                  checked={expandedSearch}
                  onCheckedChange={setExpandedSearch}
                  className="data-[state=checked]:bg-amber-600"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-2 block">Additional Context (Optional)</Label>
              <Textarea
                placeholder="Add notes, study details, or specific requirements..."
                value={additionalText}
                onChange={(e) => setAdditionalText(e.target.value)}
                onFocus={() => setAdditionalTextFocused(true)}
                onBlur={() => setAdditionalTextFocused(false)}
                className="text-xs resize-none transition-all duration-300 ease-in-out focus:ring-2 focus:ring-purple-500/20"
                style={{
                  minHeight: additionalTextFocused ? '140px' : '80px',
                  height: additionalTextFocused ? '140px' : '80px'
                }}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold mb-2 block flex items-center gap-1">
                Attach Study/Document (Optional)
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">Upload PDFs or text files. AI will extract sequences automatically.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
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
                className="w-full h-8 text-xs hover:bg-purple-50 dark:hover:bg-purple-950/20 hover:border-purple-300 transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-3 mr-1" />
                {additionalFile ? additionalFile.name : 'Choose File'}
              </Button>
              {additionalFile && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-6 text-xs mt-1 text-destructive hover:bg-destructive/10 transition-all animate-in fade-in slide-in-from-top-1 duration-200"
                  onClick={() => setAdditionalFile(null)}
                >
                  <X className="size-3 mr-1" /> Remove
                </Button>
              )}
            </div>

            <Button 
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100" 
              onClick={generateSequences} 
              disabled={loading || !apiKey}
            >
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

            <div className="pt-4 border-t border-purple-200/30 dark:border-purple-900/30">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <RotateCcw className="size-3.5 text-purple-600" />
                  History
                </Label>
                <div className="flex gap-1">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          onClick={() => document.getElementById('history-import')?.click()}
                        >
                          <FileUp className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Import history from file</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
                          onClick={exportHistory}
                          disabled={history.length === 0}
                        >
                          <Download className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">
                          {history.length === 0 ? 'No history to export' : 'Export history to JSON'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                          onClick={() => setShowClearConfirm(true)}
                          disabled={history.length === 0}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">
                          {history.length === 0 ? 'No history to clear' : 'Clear all history (permanent)'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <input
                    id="history-import"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={importHistory}
                  />
                </div>
              </div>
              
              {history.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                  {history.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`relative group rounded-lg border text-xs transition-all duration-200 hover:shadow-md ${
                        selectedHistoryId === entry.id 
                          ? 'bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-300 dark:border-purple-700 shadow-sm' 
                          : 'bg-background hover:border-purple-200 dark:hover:border-purple-900'
                      }`}
                      style={{
                        animation: `fadeIn 0.3s ease-out ${index * 0.05}s backwards`
                      }}
                    >
                      <button
                        onClick={() => {
                          setSelectedHistoryId(entry.id);
                          setShowOutput(true);
                        }}
                        className="w-full text-left p-2.5 pr-8 rounded-lg transition-all"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-semibold flex items-center gap-1 ${entry.success ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                            {entry.success ? '✓' : '✗'} {entry.type}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-muted-foreground truncate">
                          {entry.organisms.length > 0 ? entry.organisms.join(', ') : '📄 From file/context'}
                        </div>
                      </button>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => deleteHistoryItem(entry.id, e)}
                              className="absolute top-1.5 right-1.5 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="text-xs">Delete this entry</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No history yet. Generate sequences to see them here.
                </div>
              )}
            </div>

            {/* Footer Disclaimer */}
            <div className="pt-4 mt-4 border-t border-muted">
              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  ⚠️ AI-generated sequences should be verified before use
                </p>
                <p className="text-xs text-muted-foreground">
                  Please report bugs to{' '}
                  <a 
                    href="mailto:zainimahdi@outlook.com" 
                    className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 underline transition-colors"
                  >
                    zainimahdi@outlook.com
                  </a>
                </p>
                <div className="flex justify-center pt-1">
                  <a
                    href="https://github.com/MMZaini/IDT-React"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="View on GitHub"
                  >
                    <Github className="size-4" />
                    <span>GitHub</span>
                  </a>
                </div>
              </div>
            </div>
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
              disabled={(() => {
                const selectedEntry = history.find(h => h.id === selectedHistoryId);
                // Disable if entry has no organisms and no additional text (just uploaded file)
                return selectedEntry ? (selectedEntry.organisms.length === 0 && !selectedEntry.additionalText) : true;
              })()}
              className={(() => {
                const selectedEntry = history.find(h => h.id === selectedHistoryId);
                const isDisabled = selectedEntry ? (selectedEntry.organisms.length === 0 && !selectedEntry.additionalText) : true;
                return isDisabled ? 'opacity-50 cursor-not-allowed' : '';
              })()}
            >
              <RotateCcw className="size-4 mr-2" /> Try Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clear All History?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete all {history.length} history item(s). This action cannot be undone.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Consider exporting your history first if you want to keep a backup.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={clearAllHistory}>
              Clear All History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Sparkles className="size-6 text-purple-600" />
              </div>
              <div>
                <DialogTitle className="text-xl">Welcome to AI Sequence Generator!</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">Let&apos;s get you started 🧬</p>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
              <div className="flex gap-3">
                <AlertCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-blue-900 dark:text-blue-100">Important Notice</p>
                  <p className="text-blue-800 dark:text-blue-200">
                    This AI tool generates DNA sequences based on your input. While powerful, it&apos;s not perfect:
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 h-fit">
                  <Info className="size-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold mb-1">Verify Your Results</p>
                  <p className="text-muted-foreground">
                    Always double-check generated sequences against trusted databases before using them in experiments.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 h-fit">
                  <RotateCcw className="size-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold mb-1">Try Multiple Times</p>
                  <p className="text-muted-foreground">
                    If results aren&apos;t quite right, try rephrasing your request or running it again. Each generation can vary slightly.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 h-fit">
                  <HelpCircle className="size-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold mb-1">Need Help?</p>
                  <p className="text-muted-foreground">
                    Click the <HelpCircle className="size-3 inline" /> icon in the sidebar header anytime to see this guide again.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground">
                <strong>Pro tip:</strong> For best results, provide organism names, upload research papers (PDFs), 
                or add additional context about what you&apos;re looking for. The more information you provide, the better the results!
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={handleWelcomeContinue}
              disabled={welcomeCountdown > 0}
              className="w-full"
            >
              {welcomeCountdown > 0 ? `Continue in ${welcomeCountdown}s...` : 'Got it, let\'s go! 🚀'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
