export default function AgentPage() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Local Agent</h1>
      <p className="text-sm text-muted-foreground">
        The local agent is a small app that lets this website trigger Chrome on your computer to paste your order into IDT.
        It listens only on 127.0.0.1 (your machine).
      </p>
      <ol className="list-decimal ml-5 space-y-2 text-sm">
        <li>Download the agent binary for your OS (or build it from source).
          <ul className="list-disc ml-5">
            <li>Windows: idt-agent.exe</li>
            <li>macOS: idt-agent</li>
          </ul>
        </li>
        <li>Run the agent and keep it open. You should see: <code>listening on http://127.0.0.1:4599</code>.</li>
        <li>Return to the Order page and click Submit.</li>
      </ol>
      <div className="rounded-md border p-4 bg-muted/40">
        <div className="text-sm font-medium mb-1">Advanced (build from source)</div>
        <pre className="text-xs whitespace-pre-wrap">npm run agent</pre>
        <div className="text-xs text-muted-foreground">Build one-file binaries: npm run pkg:agent:win or npm run pkg:agent:mac</div>
      </div>
    </div>
  );
}
