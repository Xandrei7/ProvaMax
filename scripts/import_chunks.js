import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carrega variáveis do .env.local
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Erro: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontrados no .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BASE_DIR = 'C:\\Users\\gustavo\\Desktop\\CFS\\BASE DOCUMENTAL\\CONVERSAO\\txt';

async function processFile(filePath, discipline) {
  const fileName = path.basename(filePath);
  if (!fileName.endsWith('.txt')) return null;

  const subject = path.basename(fileName, '.txt');
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Limpar registros antigos deste arquivo para evitar duplicação
  // Nota: De acordo com o banco, a coluna é source_title
  const { error: deleteError } = await supabase
    .from('document_chunks')
    .delete()
    .eq('source_title', fileName);

  if (deleteError) {
    console.error(`Erro ao limpar duplicatas de ${fileName}:`, deleteError);
  }

  // Chunking (~1500 caracteres)
  const lines = content.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
  const chunks = [];
  let currentChunk = '';
  
  for(const line of lines) {
    if(currentChunk.length + line.length > 1500 && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  if(currentChunk) chunks.push(currentChunk);

  if (chunks.length === 0) return 0;

  // Inserção em lotes
  let inserted = 0;
  for (let i = 0; i < chunks.length; i += 50) {
    const batch = chunks.slice(i, i + 50);
    const rows = batch.map((text, idx) => ({
      discipline: discipline.toUpperCase(),
      subject: subject,
      source_title: fileName,
      chunk_index: i + idx,
      content: text
    }));

    const { error } = await supabase.from('document_chunks').insert(rows);
    if (error) {
      console.error(`Erro ao inserir chunks de ${fileName}:`, error);
      break;
    }
    inserted += rows.length;
  }

  console.log(`[OK] ${discipline} > ${subject} | ${inserted} chunks`);
  return inserted;
}

async function main() {
  console.log(`Iniciando importação recursiva de: ${BASE_DIR}`);
  
  if (!fs.existsSync(BASE_DIR)) {
    console.error("Erro: Pasta base não encontrada:", BASE_DIR);
    return;
  }

  let totalFiles = 0;
  let totalChunks = 0;

  const disciplines = fs.readdirSync(BASE_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory());

  for (const folder of disciplines) {
    const disciplinePath = path.join(BASE_DIR, folder.name);
    const files = fs.readdirSync(disciplinePath);

    for (const file of files) {
      const filePath = path.join(disciplinePath, file);
      if (fs.statSync(filePath).isFile()) {
        const count = await processFile(filePath, folder.name);
        if (count !== null) {
          totalFiles++;
          totalChunks += count;
        }
      }
    }
  }

  console.log('\n==========================================');
  console.log(`IMPORTAÇÃO CONCLUÍDA`);
  console.log(`Arquivos processados: ${totalFiles}`);
  console.log(`Total de chunks inseridos: ${totalChunks}`);
  console.log('==========================================');
}

main().catch(console.error);
