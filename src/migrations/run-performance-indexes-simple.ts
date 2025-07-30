import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function runPerformanceIndexes() {
  let client: Client | null = null;
  
  try {
    console.log('🔄 Iniciando aplicación de índices de rendimiento...');
    
    // Verificar que DATABASE_URL esté configurada
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    // Crear cliente de PostgreSQL
    client = new Client({
      connectionString: dbUrl,
      ssl: dbUrl.includes('aiven') || dbUrl.includes('cloud') ? {
        rejectUnauthorized: false
      } : false
    });
    
    // Conectar a la base de datos
    await client.connect();
    console.log('✅ Conexión a la base de datos establecida');

    // Leer el script SQL
    const sqlFilePath = path.join(__dirname, '..', '..', 'src', 'migrations', 'add-performance-indexes.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Dividir el script en comandos individuales
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`📊 Aplicando ${commands.length} índices de rendimiento...`);

    // Ejecutar cada comando
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      try {
        await client.query(command);
        console.log(`✅ Índice ${i + 1}/${commands.length} aplicado`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        console.log(`⚠️  Índice ${i + 1}/${commands.length} ya existe o falló:`, errorMessage);
      }
    }

    console.log('🎉 Índices de rendimiento aplicados exitosamente');
    console.log('📈 El rendimiento de las consultas de analytics debería mejorar significativamente');

  } catch (error) {
    console.error('❌ Error aplicando índices de rendimiento:', error);
    process.exit(1);
  } finally {
    // Cerrar la conexión
    if (client) {
      await client.end();
    }
    process.exit(0);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runPerformanceIndexes();
}

export { runPerformanceIndexes }; 