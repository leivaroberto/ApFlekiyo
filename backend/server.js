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

// 2. Ruta de diagnóstico
app.get('/', (req, res) => {
    res.json({ mensaje: "¡Servidor Backend de AppFlekiyo funcionando al 100% con Módulo de Caja!" });
});

// 3. RUTA ACTUALIZADA: Finalizar turno (Stock + Caja)
app.post('/api/finalizar-turno', async (req, res) => {
    // Ahora recibimos también el precio total y el ID del peluquero
    const { turnoId, peluqueroId, insumoId, gramosUsados, precioTotal } = req.body;

    try {
        // --- A. LÓGICA DE INVENTARIO (PAÑOL) ---
        if (gramosUsados > 0) {
            const { data: insumo } = await supabase.from('insumos').select('stock_gramos').eq('id', insumoId).single();
            if (insumo) {
                const nuevoStock = insumo.stock_gramos - gramosUsados;
                await supabase.from('insumos').update({ stock_gramos: nuevoStock }).eq('id', insumoId);
            }
        }

        // --- B. LÓGICA DE CAJA Y COMISIONES ---
        if (precioTotal > 0 && peluqueroId) {
            // 1. Buscamos qué porcentaje le toca a este peluquero
            const { data: peluquero } = await supabase.from('peluqueros').select('porcentaje_comision').eq('id', peluqueroId).single();
            
            // Si por alguna razón no lo encuentra, usa 50% por defecto
            const porcentaje = peluquero ? peluquero.porcentaje_comision : 50; 
            
            // 2. Matemática simple: Calculamos la comisión
            const montoComision = (precioTotal * porcentaje) / 100;

            // 3. Guardamos el registro en el libro contable (caja)
            await supabase.from('caja').insert([{
                turno_id: turnoId,
                peluquero_id: peluqueroId,
                monto_total: precioTotal,
                monto_comision: montoComision
            }]);
        }

        // Respondemos al frontend que todo el proceso doble fue un éxito
        res.json({ mensaje: "¡Éxito! Stock descontado y pago registrado en la caja correctamente." });

    } catch (error) {
        console.error("Error en el servidor:", error);
        res.status(500).json({ error: "Ocurrió un error al procesar el cierre del turno." });
    }
});

// 4. Encendemos el motor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
