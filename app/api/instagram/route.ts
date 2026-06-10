import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { caption, image_url, type = 'post' } = await req.json();

    if (!caption) {
      return NextResponse.json({ error: 'Caption é obrigatório' }, { status: 400 });
    }

    // Montar o input para o MCP do Instagram
    const input: any = { type, caption };
    if (image_url) input.image_url = image_url;

    const inputJson = JSON.stringify(input).replace(/'/g, "'\\''");

    const cmd = `manus-mcp-cli tool call create_instagram --server instagram --input '${inputJson}'`;
    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });

    return NextResponse.json({ 
      success: true, 
      message: 'Post criado com sucesso! Confirme a publicação no painel.',
      output: stdout 
    });
  } catch (error: any) {
    console.error('Erro ao publicar no Instagram:', error);
    return NextResponse.json({ 
      error: 'Erro ao publicar no Instagram', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const cmd = `manus-mcp-cli tool call get_account_info --server instagram --input '{}'`;
    const { stdout } = await execAsync(cmd, { timeout: 20000 });

    // Ler o resultado do arquivo salvo
    const resultMatch = stdout.match(/saved to:\s*(\S+)/);
    if (resultMatch) {
      const fs = await import('fs/promises');
      const resultData = await fs.readFile(resultMatch[1], 'utf-8');
      const result = JSON.parse(resultData);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: true, output: stdout });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
