import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

function runScript(scriptPath: string, arg: string): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(process.execPath, [scriptPath, arg], { windowsHide: false })
      let out = ''
      child.stdout.on('data', (d) => (out += d.toString()))
      child.stderr.on('data', (d) => (out += d.toString()))
      child.on('error', (err) => reject(err))
      child.on('close', (code) => resolve({ code, output: out }))
    } catch (err) {
      reject(err)
    }
  })
}

export async function POST(request: Request) {
  const body = await request.json();
  const csv: string = body?.csv ?? '';
  const count: number | undefined = body?.count;

  if (!csv) {
    return NextResponse.json({ ok: false, error: 'No csv provided' }, { status: 400 });
  }
  if (csv.length > 50_000) {
    return NextResponse.json({ ok: false, error: 'Payload too large' }, { status: 413 });
  }
  if (typeof count === 'number' && count > 500) {
    return NextResponse.json({ ok: false, error: 'Too many lines' }, { status: 422 });
  }

  // Encode CSV as base64 to safely pass as an argument
  const b64 = Buffer.from(csv, 'utf8').toString('base64')

  const scriptPath = path.join(process.cwd(), 'scripts', 'selenium-runner.js')

  try {
    const result = await runScript(scriptPath, b64);
    return NextResponse.json({ ok: result.code === 0, code: result.code, output: result.output });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
