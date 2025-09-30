"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import * as React from "react";
import { useForm, useFieldArray, Controller, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trash2 as TrashIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
// submission is intentionally a no-op for UI-only demo; no backend or clipboard side-effects
import { kindOptions, scaleOptions, purificationOptions, fivePrimeOptions, threePrimeOptions, dyeOptions, quencherOptions, scaleRanges } from "@/lib/params";
import { LineItem, OrderPayloadSchema } from "@/lib/schema";
import { generateOrderCode } from "@/lib/order-code";

// Use z.input to align with zodResolver input type semantics (defaulted fields are optional on input)
type FormValues = z.input<typeof OrderPayloadSchema>;

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function OrderPage() {
  // console removed per request; scaleRanges unified in params
  const form = useForm<FormValues>({
    resolver: zodResolver(OrderPayloadSchema),
    defaultValues: {
      items: [
        {
          id: newId(),
          kind: "oligo",
          name: "",
          sequence: "",
          params: {
            scale: "25nm",
            purification: "STD",
          },
        },
  ],
    },
    mode: "onChange",
  });

  const { control, handleSubmit, watch, setValue } = form;
  const { fields, append, remove, insert } = useFieldArray({ control, name: "items" });
  
  const [submitting, setSubmitting] = React.useState(false);
  const [importMode, setImportMode] = React.useState<'replace' | 'append'>('replace');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const storageKey = 'idt-lines-v1';
  const loadedFromStorageRef = React.useRef(false);
  const [multiAddCount, setMultiAddCount] = React.useState(5);
  const [openClear, setOpenClear] = React.useState(false);
  const [openAgentHelp, setOpenAgentHelp] = React.useState(false);
  const [agentOnline, setAgentOnline] = React.useState<null | boolean>(null);
  const downloadWin = process.env.NEXT_PUBLIC_AGENT_WIN_URL || '';
  const downloadMac = process.env.NEXT_PUBLIC_AGENT_MAC_URL || '';

  React.useEffect(() => {
    let cancelled = false;
    async function ping() {
      try {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), 1500);
        const res = await fetch('http://127.0.0.1:4599/health', { signal: controller.signal });
        clearTimeout(to);
        if (!cancelled) setAgentOnline(res.ok);
      } catch {
        if (!cancelled) setAgentOnline(false);
      }
    }
    ping();
    const id = setInterval(ping, 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Load from localStorage on mount
  React.useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed?.items) ? parsed.items : (Array.isArray(parsed) ? parsed : []);
        if (Array.isArray(arr) && arr.length > 0) {
          const normalized = arr.map((it: any) => ({
            id: it.id || newId(),
            kind: it.kind === 'probe' || it.kind === 'oligo' ? it.kind : 'oligo',
            name: typeof it.name === 'string' ? it.name : '',
            sequence: typeof it.sequence === 'string' ? it.sequence : '',
            params: {
              scale: typeof it?.params?.scale === 'string' && it.params.scale in scaleRanges ? it.params.scale : '25nm',
              purification: purificationOptions.some(p => p.value === it?.params?.purification) ? it.params.purification : 'STD',
              fivePrime: it?.params?.fivePrime,
              threePrime: it?.params?.threePrime,
              dye: it?.params?.dye,
              quencher: it?.params?.quencher,
            }
          }));
          setValue('items', normalized as any, { shouldDirty: false, shouldTouch: false });
        }
      }
    } catch (e) {
      // ignore parse errors
    } finally {
      loadedFromStorageRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to localStorage whenever items change (after initial load)
  const itemsForPersist = watch('items');
  React.useEffect(() => {
    if (!loadedFromStorageRef.current) return;
    try {
      const payload = JSON.stringify({ items: (itemsForPersist || []).map((it: any) => ({
        ...it,
        id: it.id || newId(),
      })) });
      localStorage.setItem(storageKey, payload);
    } catch (e) {
      // ignore
    }
  }, [itemsForPersist]);

  // Export current lines to a JSON file
  function handleExport() {
    try {
      // Exclude internal 'id' from exported representation
      const data = JSON.stringify({ items: (items || []).map(it => ({
        kind: it.kind,
        name: it.name,
        sequence: it.sequence,
        params: { ...it.params },
      })) }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'idt-order-lines.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Exported lines');
    } catch (e) {
      toast.error('Export failed');
    }
  }

  // Build CSV from current items (skip blanks)
  function buildCsv(items: FormValues["items"]) {
    function csvField(v: string) {
      if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    const lines: string[] = [];
    (items || []).forEach((it) => {
      const name = (it?.name || '').trim();
      const seq = (it?.sequence || '').trim().toUpperCase();
      if (!name || !seq) return;
      const scale = it?.params?.scale || '25nm';
      const purification = it?.params?.purification || 'STD';
      lines.push([csvField(name), csvField(seq), scale, purification].join(','));
    });
    return lines.join('\n');
  }

  function handleExportCsv() {
    try {
      const csv = buildCsv(items || []);
      if (!csv) {
        toast.error('No valid lines to export');
        return;
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'idt-bulk.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Exported CSV');
    } catch (e) {
      toast.error('CSV export failed');
    }
  }

  // Trigger hidden file input
  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let incoming: any[] = [];
      if (Array.isArray(parsed)) incoming = parsed;
      else if (parsed && Array.isArray(parsed.items)) incoming = parsed.items;
      else throw new Error('Invalid JSON structure');

      // normalize & validate minimal shape
      const normalized = incoming.map((raw, idx) => {
        return {
          id: newId(),
          kind: raw.kind === 'probe' || raw.kind === 'oligo' ? raw.kind : 'oligo',
          name: typeof raw.name === 'string' ? raw.name : '',
            sequence: typeof raw.sequence === 'string' ? raw.sequence : '',
          params: {
            scale: scaleRanges[raw?.params?.scale] ? raw.params.scale : '25nm',
            purification: purificationOptions.some(p => p.value === raw?.params?.purification) ? raw.params.purification : 'STD',
            fivePrime: raw?.params?.fivePrime,
            threePrime: raw?.params?.threePrime,
            dye: raw?.params?.dye,
            quencher: raw?.params?.quencher,
          }
        };
      });

      if (normalized.length === 0) throw new Error('No items in file');

      if (importMode === 'replace') {
        setValue('items', normalized as any, { shouldDirty: true, shouldTouch: true });
      } else {
        const current = items || [];
        setValue('items', [...current, ...normalized] as any, { shouldDirty: true, shouldTouch: true });
      }
      toast.success(`Imported ${normalized.length} line(s)`);
    } catch (err: any) {
      toast.error('Import failed');
    } finally {
      // reset input so same file can be re-imported
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }
  const items = watch("items");

  // reusable row validator
  function validateRow(it: any) {
    const name = (it?.name || "").trim();
    const seq = (it?.sequence || "").trim();
    const scale = it?.params?.scale || "25nm";
    const range = scaleRanges[scale];
    if (!name || !seq) return { valid: false, reason: "name_or_sequence_missing" };
    if (range && (seq.length < range.min || seq.length > range.max)) {
      return { valid: false, reason: "length_out_of_range", min: range.min, max: range.max };
    }
    return { valid: true };
  }

  // compute invalid lines every render (avoids stale memo if array ref doesn't change)
  const invalidLines: number[] = [];
  (items || []).forEach((it, i) => {
    const res = validateRow(it);
    if (!res.valid) invalidLines.push(i + 1);
  });

  // On submit: produce CSV-style lines: Name,Sequence,Scale,Purification
  // - Skip rows missing name or sequence
  // - Default scale -> "25nmole"
  // - Default purification -> "STD" (standard desalt)
  // This replaces the console content (does not append).
  async function submitViaLocalAgent(csv: string, count: number) {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch('http://127.0.0.1:4599/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, count }),
        signal: controller.signal,
        mode: 'cors',
      });
      clearTimeout(to);
      if (!res.ok) throw new Error('Agent returned error');
      const data = await res.json();
      if (!data?.ok) throw new Error('Agent run failed');
      return true;
    } catch (e) {
      clearTimeout(to);
      return false;
    }
  }

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
  if (submitting) return; // anti-spam guard
    // Validate all lines before proceeding
    const invalidLines: number[] = [];
    function csvField(v: string) {
      if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    const prepared: { csv: string; code: string }[] = [];
    values.items.forEach(it => {
      const name = (it.name || '').trim();
      const seq = (it.sequence || '').trim().toUpperCase();
      if (!name || !seq) return;
      const scale = it.params?.scale || '25nm';
      const purification = it.params?.purification || 'STD';
      prepared.push({
        csv: [csvField(name), csvField(seq), scale, purification].join(','),
        code: generateOrderCode({ ...(it as LineItem), sequence: seq }),
      });
    });
    const lines = prepared.map(p => p.csv);
    const text = lines.join('\n');
    // detect invalid rows using shared validator
    values.items.forEach((it, i) => {
      const res = validateRow(it);
      if (!res.valid) invalidLines.push(i + 1);
    });

    if (invalidLines.length > 0) {
      // show inline and toast notification
      toast.error(`Please amend line(s): ${invalidLines.join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      // Try local agent first for Vercel-hosted site compatibility
      const okLocal = await submitViaLocalAgent(text, lines.length);
      if (okLocal) {
        toast.success('Agent started automation');
      } else {
        // Fallback to server API (may not work on Vercel serverless)
        try {
          await fetch('/api/run-selenium', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csv: text, count: lines.length }),
          });
          toast.success('Server started automation');
        } catch (e) {
          setOpenAgentHelp(true);
          toast.error('Agent not found. See help.');
        }
      }
    } finally {
      // small delay to give user feedback and prevent immediate re-click
      setTimeout(() => setSubmitting(false), 1200);
    }

    return;
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">IDT Bulk Ordering</h1>
          <p className="text-sm text-muted-foreground">Add lines, choose parameters, and generate codes.</p>

          {/* Console was moved below header to span full width */}
        </div>
        <div className="flex items-start gap-4">
          <div className="flex items-center gap-2 text-xs border rounded-md px-3 py-2 bg-muted/40">
            <div className={`w-2.5 h-2.5 rounded-full ${agentOnline ? 'bg-green-500' : agentOnline === false ? 'bg-red-500' : 'bg-gray-400'}`} />
            <span className="select-none">Agent: {agentOnline ? 'Online' : agentOnline === false ? 'Offline' : 'Checking…'}</span>
            {!agentOnline && (
              <button type="button" className="underline text-blue-600" onClick={() => setOpenAgentHelp(true)}>Help</button>
            )}
          </div>
          {/* Import / Export / Clear Controls (styled to align with other tool groups) */}
          <div className="flex items-center gap-2 text-xs border rounded-md px-3 py-2 bg-muted/40">
            <Button
              type="button"
              size="sm"
              onClick={handleImportClick}
              className="h-7 bg-green-600 hover:bg-green-500 text-white px-3"
            >
              Import
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleExport}
              className="h-7 bg-red-600 hover:bg-red-500 text-white px-3"
            >
              Export
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleExportCsv}
              className="h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white"
            >
              Export CSV
            </Button>
            <Dialog open={openClear} onOpenChange={setOpenClear}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-3 bg-transparent text-red-600 border border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  variant="outline"
                >
                  Clear
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clear all lines?</DialogTitle>
                  <DialogDescription>This will remove every line currently shown. One blank line will remain.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setValue('items', [
                        {
                          id: newId(),
                          kind: 'oligo',
                          name: '',
                          sequence: '',
                          params: { scale: '25nm', purification: 'STD' },
                        },
                      ] as any, { shouldDirty: true });
                      toast.success('Lines cleared (left one blank)');
                      setOpenClear(false);
                    }}
                  >
                    Confirm Clear
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-2 text-xs border rounded-md px-3 py-2 bg-muted/40">
            <span className="font-medium select-none">Mode</span>
            <div role="group" aria-label="Import mode" className="flex rounded-md overflow-hidden border bg-background">
              <button
                type="button"
                aria-pressed={importMode === 'replace'}
                onClick={() => setImportMode('replace')}
                className={
                  `px-3 h-7 inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 text-[11px] ` +
                  (importMode === 'replace'
                    ? 'bg-foreground text-background'
                    : 'text-foreground/70 hover:text-foreground hover:bg-foreground/10')
                }
              >
                Replace
              </button>
              <button
                type="button"
                aria-pressed={importMode === 'append'}
                onClick={() => setImportMode('append')}
                className={
                  `px-3 h-7 inline-flex items-center justify-center font-medium border-l transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 text-[11px] ` +
                  (importMode === 'append'
                    ? 'bg-foreground text-background'
                    : 'text-foreground/70 hover:text-foreground hover:bg-foreground/10')
                }
              >
                Append
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs border rounded-md px-3 py-2 bg-muted/40">
            <span className="font-medium">Add:</span>
            <input
              type="number"
              min={1}
              max={200}
              value={multiAddCount}
              onChange={(e) => setMultiAddCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="w-16 h-7 rounded border bg-background px-2 text-xs"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const count = Math.min(200, Math.max(1, multiAddCount));
                const newLines = Array.from({ length: count }).map(() => ({
                  id: newId(),
                  kind: 'oligo',
                  name: '',
                  sequence: '',
                  params: { scale: '25nm', purification: 'STD' },
                }));
                setValue('items', [...(itemsForPersist || []), ...newLines] as any, { shouldDirty: true });
                toast.success(`Added ${count} line(s)`);
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </header>

      {/* Agent Help Dialog */}
      <Dialog open={openAgentHelp} onOpenChange={setOpenAgentHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start the local agent</DialogTitle>
            <DialogDescription>
              To run automation when hosted on Vercel, please start the local agent. It listens on 127.0.0.1:4599 and launches Chrome to place your order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              1) Download and run the agent binary (Windows/mac). Or run it from source via <code>npm run agent</code>.
            </p>
            <div className="flex gap-3 text-xs">
              {downloadWin ? <a className="underline text-blue-600" href={downloadWin} target="_blank">Download for Windows</a> : null}
              {downloadMac ? <a className="underline text-blue-600" href={downloadMac} target="_blank">Download for macOS</a> : null}
            </div>
            <p>
              2) Keep this page open and click Submit again.
            </p>
            <p className="text-muted-foreground">Agent URL: http://127.0.0.1:4599/run</p>
          </div>
          <DialogFooter>
            <a className="underline text-blue-600" href="/agent" onClick={() => setOpenAgentHelp(false)}>Open agent instructions</a>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

  {/* Console removed per user request */}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="space-y-3">
          {fields.map((field, idx) => (
            <motion.div
              key={field.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-2xl border p-4"
            >
              {/* Line number badge */}
              <div className="absolute -top-3 -left-3 bg-foreground text-background w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border">
                {idx + 1}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
                {/* Kind */}
                <div className="md:col-span-2">
                  <Label className="mb-1 block">Type</Label>
                  <Controller
                    control={control}
                    name={`items.${idx}.kind`}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {kindOptions.map((k) => (
                            <SelectItem key={k.value} value={k.value} disabled={k.value === "probe"}>
                              {k.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Name */}
                <div className="md:col-span-3">
                  <Label className="mb-1 block">Name</Label>
                  <Controller
                    control={control}
                    name={`items.${idx}.name`}
                    render={({ field }) => <Input {...field} placeholder="e.g., MYC_exon2_F" />}
                  />
                </div>

                {/* Sequence */}
                <div className="md:col-span-7">
                  {(() => {
                    const scale = items?.[idx]?.params?.scale || '25nm';
                    const range = scaleRanges[scale];
                    const label = range ? `Sequence (${range.min}→${range.max})` : 'Sequence (5’→3’)';
                    return <Label className="mb-1 block">{label}</Label>;
                  })()}
                  <Controller
                    control={control}
                    name={`items.${idx}.sequence`}
                    render={({ field }) => <Input {...field} placeholder="ACGT..." />}
                  />
                </div>
              </div>

              {/* Params row */}
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-2">
                  <Label className="mb-1 block">Scale</Label>
                  <Controller
                    control={control}
                    name={`items.${idx}.params.scale`}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {scaleOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1 block">Purification</Label>
                  <Controller
                    control={control}
                    name={`items.${idx}.params.purification`}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {purificationOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {items?.[idx]?.kind === "probe" && (
                  <>
                    <div className="md:col-span-2">
                      <Label className="mb-1 block">5 Mod</Label>
                      <Controller
                        control={control}
                        name={`items.${idx}.params.fivePrime`}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {fivePrimeOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label className="mb-1 block">3 Mod</Label>
                      <Controller
                        control={control}
                        name={`items.${idx}.params.threePrime`}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {threePrimeOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label className="mb-1 block">Dye</Label>
                      <Controller
                        control={control}
                        name={`items.${idx}.params.dye`}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {dyeOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label className="mb-1 block">Quencher</Label>
                      <Controller
                        control={control}
                        name={`items.${idx}.params.quencher`}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {quencherOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Row actions */}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {(() => {
                    const it = items?.[idx] || {};
                    const res = validateRow(it);
                    if (!it.name && !it.sequence) return 'Empty';
                    if (res.valid) return '\u2713 Valid';
                    if (res.reason === 'name_or_sequence_missing') return 'Missing name/sequence';
                    if (res.reason === 'length_out_of_range') return `Length ${res.min}-${res.max}`;
                    return 'Invalid';
                  })()}
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => insert(idx + 1, {
                    ...items[idx],
                    id: newId(),
                    name: items[idx].name ? `${items[idx].name}_copy` : "",
                  })}>
                    Duplicate
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => remove(idx)}
                    className="bg-destructive text-white p-0 h-9 w-9 rounded-md"
                    aria-label="Delete line"
                  >
                    <TrashIcon className="size-4 text-white" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() =>
              append({
                id: newId(),
                kind: "oligo",
                name: "",
                sequence: "",
                params: { scale: "25nm", purification: "STD" },
              })
            }
          >
            + Add line
          </Button>

          <Separator className="h-6" orientation="vertical" />

          <div className="ml-auto text-right">
            {invalidLines.length > 0 && (
              <div className="mb-2 text-sm font-medium text-red-500">
                Invalid line{invalidLines.length > 1 ? 's' : ''}: {invalidLines.join(', ')}
              </div>
            )}
            <Button
              type="submit"
              disabled={invalidLines.length > 0 || submitting}
              className={
                invalidLines.length > 0
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed hover:bg-gray-300'
                  : submitting
                    ? 'relative bg-primary text-primary-foreground opacity-70'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }
            >
              {submitting ? 'Working…' : 'Submit'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
