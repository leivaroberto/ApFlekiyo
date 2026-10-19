const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json()); // Permite recibir datos del frontend

// 1. Conexión a Supabase desde el Servidor
const SUPABASE_URL = 'https://xpufmicxmbhpqocrwgdz.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_ANON_KEY) {
    throw new Error('Falta configurar SUPABASE_ANON_KEY en las variables de entorno del backend.');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Ruta de diagnóstico
app.get('/', (req, res) => {
    res.json({ mensaje: "¡Servidor Backend de AppFlekiyo funcionando al 100% con Módulo de Caja!" });
});

// 3. RUTA ACTUALIZADA: Finalizar turno (Stock + Caja)
app.post('/api/finalizar-turno', async (req, res) => {
    // Ahora recibimos también el precio total y el ID del peluquero
    const { turnoId, peluqueriaId, peluqueroId, insumoId, gramosUsados, precioTotal } = req.body;

    try {
        const authorization = req.get('Authorization');
        const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
        if (!token) {
            return res.status(401).json({ error: "Debes iniciar sesión para registrar el cobro." });
        }

        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError) {
            console.error('Supabase rechazó el token de sesión:', {
                status: authError.status,
                code: authError.code,
                message: authError.message
            });
            return res.status(401).json({ error: "Supabase rechazó la sesión. Revisa los logs del backend en Render." });
        }
        if (!authData.user) {
            console.error('Supabase validó la solicitud sin devolver un usuario.');
            return res.status(401).json({ error: "La sesión no es válida. Inicia sesión nuevamente." });
        }

        const supabaseAutenticado = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });

        if (!turnoId || !peluqueriaId || !peluqueroId || !Number.isFinite(Number(precioTotal)) || Number(precioTotal) <= 0) {
            return res.status(400).json({ error: "Faltan datos válidos para registrar el cobro del turno." });
        }

        // --- A. LÓGICA DE INVENTARIO (PAÑOL) ---
        if (gramosUsados > 0) {
            const { data: insumo, error: errorInsumo } = await supabaseAutenticado.from('insumos').select('stock_gramos').eq('id', insumoId).single();
            if (errorInsumo) throw errorInsumo;
            if (insumo) {
                const nuevoStock = insumo.stock_gramos - gramosUsados;
                const { error } = await supabaseAutenticado.from('insumos').update({ stock_gramos: nuevoStock }).eq('id', insumoId);
                if (error) throw error;
            }
        }

        // --- B. LÓGICA DE CAJA Y COMISIONES ---
        const { data: peluquero, error: errorPeluquero } = await supabaseAutenticado
            .from('peluqueros')
            .select('porcentaje_comision')
            .eq('id', peluqueroId)
            .eq('peluqueria_id', peluqueriaId)
            .single();
        if (errorPeluquero) throw errorPeluquero;

        const porcentaje = Number(peluquero.porcentaje_comision);
        if (!Number.isFinite(porcentaje)) throw new Error('El profesional no tiene un porcentaje de comisión válido.');
        const montoComision = (Number(precioTotal) * porcentaje) / 100;

        const { error: errorCaja } = await supabaseAutenticado.from('caja').insert([{
            peluqueria_id: peluqueriaId,
            turno_id: turnoId,
            peluquero_id: peluqueroId,
            monto_total: Number(precioTotal),
            monto_comision: montoComision
        }]);
        if (errorCaja) throw errorCaja;

        // Respondemos al frontend que todo el proceso doble fue un éxito
        res.json({ mensaje: "¡Éxito! El pago fue registrado en la caja correctamente." });

    } catch (error) {
        console.error("Error en el servidor:", error);
        res.status(500).json({ error: "Ocurrió un error al procesar el cierre del turno." });
    }
});

// 4. Encendemos el motor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
