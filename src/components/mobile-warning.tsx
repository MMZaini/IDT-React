'use client';

import { Smartphone, Github, Monitor } from 'lucide-react';
import { Button } from './ui/button';

export function MobileWarning() {
  return (
    <div className="lg:hidden fixed inset-0 bg-gradient-to-br from-background via-background to-muted/20 z-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
            <div className="relative bg-primary/10 p-6 rounded-2xl border border-primary/20">
              <Monitor className="size-16 text-primary" />
            </div>
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Desktop Only
          </h1>
          <p className="text-muted-foreground text-lg">
            IDT React is optimized for desktop use
          </p>
        </div>

        {/* Description */}
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            This application provides an improved bulk ordering experience for DNA oligonucleotides and probes from IDT, with features like:
          </p>
          <ul className="space-y-2 text-left max-w-xs mx-auto">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span>AI-powered sequence generation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span>Advanced validation & error handling</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span>Automated browser-based ordering</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span>JSON & CSV import/export</span>
            </li>
          </ul>
          <p className="pt-2">
            Please visit this site on a desktop or laptop computer for the best experience!
          </p>
        </div>

        {/* CTA Button */}
        <div className="pt-4">
          <Button
            asChild
            size="lg"
            className="w-full max-w-xs"
          >
            <a
              href="https://github.com/MMZaini/IDT-React"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              <Github className="size-5" />
              View on GitHub
            </a>
          </Button>
        </div>

        {/* Footer */}
        <div className="pt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        </div>
      </div>
    </div>
  );
}
