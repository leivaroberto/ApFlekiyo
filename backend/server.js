const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta de prueba para verificar que Render funciona
app.get('/', (req, res) => {
    res.json({ mensaje: '¡Servidor Backend de AppFlekiyo funcionando al 100%!' });
});

// Aquí agregaremos luego las rutas pesadas:
// - Descuento de stock en el inventario.
// - Cálculo de liquidación de comisiones.
// - Integración con WhatsApp para recordatorios.

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de AppFlekiyo corriendo en el puerto ${PORT}`);
});
