const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json()); // Permite recibir datos del frontend

// 1. Conexión a Supabase desde el Servidor
const SUPABASE_URL = 'https://xpufmicxmbhpqocrwgdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwdWZtaWN4bWJocHFvY3J3Z2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MzE1OTcsImV4cCI6MjEwMzEwNzU5N30.811oNtrlBbEvNvhxaLlvJBZtqSpU98ZQ9sORRh4EIu8'; // Pega tu clave súper larga aquí
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Ruta de diagnóstico (la que probaste antes)
app.get('/', (req, res) => {
    res.json({ mensaje: "¡Servidor Backend de AppFlekiyo funcionando al 100%!" });
});

// 3. NUEVA RUTA: El módulo Pañol (Descontar stock)
app.post('/api/finalizar-turno', async (req, res) => {
    // Recibimos los datos que nos mandará el frontend
    const { turnoId, insumoId, gramosUsados } = req.body;

    // A. Buscamos cuánto stock hay actualmente
    const { data: insumo } = await supabase
        .from('insumos')
        .select('stock_gramos')
        .eq('id', insumoId)
        .single();

    if (!insumo) {
        return res.status(404).json({ error: "Insumo no encontrado" });
    }

    // B. Calculamos matemáticamente la resta
    const nuevoStock = insumo.stock_gramos - gramosUsados;

    // C. Guardamos el nuevo stock en la base de datos
    const { error } = await supabase
        .from('insumos')
        .update({ stock_gramos: nuevoStock })
        .eq('id', insumoId);

    if (error) {
        return res.status(500).json({ error: "Error al actualizar el inventario" });
    }

    // Le respondemos al frontend que todo salió bien
    res.json({ mensaje: `¡Éxito! Stock actualizado. Quedan ${nuevoStock} gramos.` });
});

// 4. Encendemos el motor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
