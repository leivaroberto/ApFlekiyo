// 1. Configuración de Supabase (Reemplaza con tus datos reales)
const SUPABASE_URL = 'https://xpufmicxmbhpqocrwgdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwdWZtaWN4bWJocHFvY3J3Z2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MzE1OTcsImV4cCI6MjEwMzEwNzU5N30.811oNtrlBbEvNvhxaLlvJBZtqSpU98ZQ9sORRh4EIu8';

// Le cambiamos el nombre a 'clienteDb' para que no choque con la librería
const clienteDb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Función para mostrar turnos en la pantalla
async function cargarTurnos() {
    // Le pedimos a Supabase que "una" la tabla turnos con la tabla peluqueros
    const { data: turnos, error } = await clienteDb
        .from('turnos')
        .select('*, peluqueros(nombre, color_calendario)');

    if (error) {
        console.error("Error al cargar turnos:", error);
        return;
    }

    renderizarTurnos(turnos);
}

// 1. Modificamos cómo se dibuja la tarjeta
function renderizarTurnos(turnos) {
    const contenedor = document.getElementById('lista-turnos');
    contenedor.innerHTML = ''; 

    if (turnos.length === 0) {
        contenedor.innerHTML = '<p>No hay turnos programados.</p>';
        return;
    }

    turnos.forEach(turno => {
        const div = document.createElement('div');
        div.className = `turno-card estado-${turno.estado}`;
        
        // Agregamos un menú desplegable para cambiar el estado
        div.innerHTML = `
            <div>
                <strong>Turno:</strong> ${turno.id.substring(0, 5)}<br>
                <select class="selector-estado" onchange="cambiarEstado('${turno.id}', this.value)">
                    <option value="programado" ${turno.estado === 'programado' ? 'selected' : ''}>Programado (Gris)</option>
                    <option value="check-in" ${turno.estado === 'check-in' ? 'selected' : ''}>Check-in (Amarillo)</option>
                    <option value="en_proceso" ${turno.estado === 'en_proceso' ? 'selected' : ''}>En Proceso (Naranja)</option>
                    <option value="finalizado" ${turno.estado === 'finalizado' ? 'selected' : ''}>Finalizado (Verde)</option>
                </select>
            </div>
            <!-- Aplicamos el nombre y el color real con salvavidas (?.) -->
            <div class="etiqueta-peluquero" style="background-color: ${turno.peluqueros?.color_calendario || '#ccc'};">
                ${turno.peluqueros?.nombre || 'Sin asignar'}
            </div>
        `;
        contenedor.appendChild(div);
    });
}

// 2. Nueva función para actualizar la base de datos, descontar stock Y registrar el pago
async function cambiarEstado(turnoId, nuevoEstado) {
    // A. Actualizamos el color en Supabase como siempre
    const { error } = await clienteDb
        .from('turnos')
        .update({ estado: nuevoEstado })
        .eq('id', turnoId);

    if (error) {
        alert("Error al actualizar el estado. Revisa los permisos.");
        console.error(error);
        return; 
    }

    // B. ¡LÓGICA DE STOCK Y CAJA!
    if (nuevoEstado === 'finalizado') {
        // 1. Preguntamos los insumos
        const gramos = prompt("Turno finalizado. ¿Cuántos gramos de Tintura se usaron? (Si no usó, escribe 0)");
        
        // 2. Preguntamos el pago
        const precio = prompt("¿Cuál fue el precio total cobrado al cliente? (Ej: 15000)");

        if (gramos !== null && precio !== null) {
            // ¡PEGA AQUÍ TU ENLACE DE RENDER! (Sin la barra / al final)
            // Ej: 'https://appflekiyo-backend-xyz1.onrender.com'
            const RENDER_URL = 'https://apflekiyo.onrender.com'; 

            try {
                // Averiguamos qué peluquero atendió este turno para darle su comisión
                const { data: turnoInfo } = await clienteDb
                    .from('turnos')
                    .select('peluquero_id')
                    .eq('id', turnoId)
                    .single();

                // Le enviamos TODO el paquete de datos a tu servidor en Render
                const respuesta = await fetch(`${RENDER_URL}/api/finalizar-turno`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        turnoId: turnoId,
                        peluqueroId: turnoInfo.peluquero_id,
                        insumoId: 1, 
                        gramosUsados: parseInt(gramos) || 0, // Convierte texto a número
                        precioTotal: parseFloat(precio) || 0 // Convierte texto a precio
                    })
                });

                const resultado = await respuesta.json();
                
                // Render nos avisa si todo salió bien
                alert(resultado.mensaje || "Hubo un problema: " + resultado.error);
                
            } catch (errorRender) {
                console.error("Error al conectar con Render:", errorRender);
                alert("El turno finalizó, pero no pudimos conectar con el servidor para la caja.");
            }
        } else {
            alert("Operación cancelada. El turno se marcó como finalizado pero no se registraron los pagos ni el stock.");
        }
    }
}


// Función preparada para el botón "Agendar Turno"
// Función para crear un turno real en Supabase
async function crearTurnoNuevo() {
    const nombreCliente = document.getElementById('input-cliente').value;

    if(!nombreCliente) {
        alert("Por favor, ingresa el nombre del cliente.");
        return;
    }

    // 1. Creamos al cliente en la base de datos
    const { data: clienteData, error: errorCliente } = await clienteDb
        .from('clientes')
        .insert([{ nombre: nombreCliente, telefono: 'Sin asignar' }])
        .select();

    if (errorCliente) {
        alert("Error al crear el cliente.");
        console.error(errorCliente);
        return;
    }
    const nuevoClienteId = clienteData[0].id;

    // 2. Buscamos al primer peluquero disponible en tu base de datos
    const { data: peluqueros } = await clienteDb
        .from('peluqueros')
        .select('id')
        .limit(1);
    
    if (!peluqueros || peluqueros.length === 0) {
        alert("No hay peluqueros creados en la base de datos.");
        return;
    }
    const peluqueroId = peluqueros[0].id;

    // 3. Creamos el turno (Programado para el momento actual, duración 1 hora)
    const fechaInicio = new Date();
    const fechaFin = new Date(fechaInicio.getTime() + (60 * 60 * 1000)); // Suma 1 hora

    const { error: errorTurno } = await clienteDb
        .from('turnos')
        .insert([{
            cliente_id: nuevoClienteId,
            peluquero_id: peluqueroId,
            fecha_hora_inicio: fechaInicio.toISOString(),
            fecha_hora_fin: fechaFin.toISOString(),
            estado: 'programado'
        }]);

    if (errorTurno) {
        alert("Error al guardar el turno en el calendario.");
        console.error(errorTurno);
    } else {
        // Limpiamos la cajita de texto para que quede lista para otro cliente
        document.getElementById('input-cliente').value = '';
        
        // ¡LA MAGIA!: No necesitamos decirle a la pantalla que se actualice.
        // El sistema de "Tiempo Real" detectará esto y dibujará el turno solo.
    }
}

// 3. Activar el TIEMPO REAL (El corazón del Tablero)
clienteDb
  .channel('cambios-en-turnos')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'turnos' },
    (payload) => {
      console.log('¡Cambio detectado en la base de datos!', payload);
      // Cuando alguien cambia un estado, recargamos la grilla al instante
      cargarTurnos();
    }
  )
  .subscribe();
// --- NUEVO: LÓGICA DEL PAÑOL ---

async function cargarInventario() {
    const { data: insumos, error } = await clienteDb
        .from('insumos')
        .select('*')
        .order('nombre', { ascending: true });

    if (error) {
        console.error("Error al cargar inventario:", error);
        return;
    }
    renderizarInventario(insumos);
}

function renderizarInventario(insumos) {
    const contenedor = document.getElementById('lista-insumos');
    contenedor.innerHTML = '';

    if (insumos.length === 0) {
        contenedor.innerHTML = '<p>No hay productos en el pañol.</p>';
        return;
    }

    insumos.forEach(insumo => {
        const div = document.createElement('div');
        div.className = 'item-insumo';
        
        // Si el stock cae por debajo de 100g, se pinta de rojo
        const claseStock = insumo.stock_gramos < 100 ? 'stock-bajo' : '';

        div.innerHTML = `
            <span>${insumo.nombre}</span>
            <span class="${claseStock}">${insumo.stock_gramos}g</span>
        `;
        contenedor.appendChild(div);
    });
}

// Escuchar cambios en tiempo real en el Pañol
clienteDb
  .channel('cambios-en-insumos')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'insumos' },
    (payload) => {
      cargarInventario(); // Recarga la lista si alguien descuenta stock
    }
  )
  .subscribe();
// --- NUEVO: LÓGICA DE CAJA Y COMISIONES ---

async function cargarCaja() {
    // Calculamos el inicio del día de hoy para buscar solo lo que se cobró hoy
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    // Buscamos los pagos uniendo la tabla caja con la tabla peluqueros
    const { data: registros, error } = await clienteDb
        .from('caja')
        .select('monto_total, monto_comision, peluqueros(nombre)')
        .gte('fecha_cobro', inicioDelDia.toISOString());

    if (error) {
        console.error("Error al cargar caja:", error);
        return;
    }

    renderizarCaja(registros);
}

function renderizarCaja(registros) {
    const contenedor = document.getElementById('resumen-caja');
    
    if (registros.length === 0) {
        contenedor.innerHTML = '<p>No hay ingresos aún hoy.</p>';
        return;
    }

    let totalCaja = 0;
    const comisiones = {};

    // Recorremos todos los cobros y vamos sumando
    registros.forEach(reg => {
        totalCaja += Number(reg.monto_total);
        
        const nombrePeluquero = reg.peluqueros?.nombre || 'Sin asignar';
        if (!comisiones[nombrePeluquero]) {
            comisiones[nombrePeluquero] = 0;
        }
        comisiones[nombrePeluquero] += Number(reg.monto_comision);
    });

    // Armamos el HTML con los resultados
    let html = `<div class="totales-caja">Total Ingresos: $${totalCaja.toLocaleString()}</div>`;
    html += `<strong>Comisiones a pagar:</strong>`;
    
    for (const [nombre, monto] of Object.entries(comisiones)) {
        html += `
            <div class="comision-item">
                <span>${nombre}</span>
                <span style="color: #27ae60; font-weight: bold;">$${monto.toLocaleString()}</span>
            </div>
        `;
    }

    contenedor.innerHTML = html;
}

// Activar el Tiempo Real para la caja registradora
clienteDb
  .channel('cambios-en-caja')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'caja' }, () => {
      cargarCaja(); // Actualiza los números si alguien hace un cobro
  })
  .subscribe();

// --- NO OLVIDES AGREGAR ESTO A TUS LÍNEAS DE INICIO ---
// Busca la parte final de tu código donde dice cargarTurnos() y cargarInventario() 
// y agrega esto:
cargarCaja();
// --- INICIO DE LA APP ---
// Asegúrate de llamar a esta función al final de tu archivo para que arranque
cargarInventario();
// Iniciar la app al abrir la pantalla
cargarTurnos();
