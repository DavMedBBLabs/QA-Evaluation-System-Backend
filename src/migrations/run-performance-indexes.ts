import { AppDataSource } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runPerformanceIndexes() {
  try {
    console.log('🔄 Iniciando aplicación de índices de rendimiento...');
    
    // Conectar a la base de datos
    await AppDataSource.initialize();
    console.log('✅ Conexión a la base de datos establecida');

    // Leer el script SQL
    const sqlFilePath = path.join(__dirname, 'add-performance-indexes.sql');
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
        await AppDataSource.query(command);
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
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(0);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runPerformanceIndexes();
}

export { runPerformanceIndexes }; 