// 1. Configuración de Supabase (Reemplaza con tus datos reales)
const SUPABASE_URL = 'https://xpufmicxmbhpqocrwgdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwdWZtaWN4bWJocHFvY3J3Z2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MzE1OTcsImV4cCI6MjEwMzEwNzU5N30.811oNtrlBbEvNvhxaLlvJBZtqSpU98ZQ9sORRh4EIu8';

// Le cambiamos el nombre a 'clienteDb' para que no choque con la librería
const clienteDb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Función para mostrar turnos en la pantalla
// Mostrar turnos SOLO DE HOY EN ADELANTE
async function cargarTurnos() {
    // Calculamos el inicio del día de hoy a las 00:00 hs
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const { data: turnos, error } = await clienteDb
        .from('turnos')
        .select('*, peluqueros(nombre, color_calendario), clientes(nombre, apellido)')
        .gte('fecha_hora_inicio', inicioHoy.toISOString()) // Filtro: Mayor o igual a hoy
        .order('fecha_hora_inicio', { ascending: true });

    if (error) {
        console.error("Error al cargar turnos:", error);
        return;
    }
    renderizarTurnos(turnos);
}
// --- NUEVO: MÓDULO DE CLIENTES ---

// 1. Guardar un nuevo cliente
async function guardarCliente() {
    const nombre = document.getElementById('nuevo-cliente-nombre').value.trim();
    const apellido = document.getElementById('nuevo-cliente-apellido').value.trim();
    const telefono = document.getElementById('nuevo-cliente-telefono').value.trim();
    const mensaje = document.getElementById('mensaje-cliente');

    if (!nombre) {
        alert("El nombre es obligatorio para crear un cliente.");
        return;
    }

    // Insertamos los datos en Supabase
    const { error } = await clienteDb
        .from('clientes')
        .insert([{ nombre: nombre, apellido: apellido, telefono: telefono }]);

    if (error) {
        console.error("Error al guardar cliente:", error);
        mensaje.style.color = 'red';
        mensaje.innerText = "Error al guardar el cliente. Revisa los permisos.";
    } else {
        mensaje.style.color = '#27ae60';
        mensaje.innerText = "¡Cliente guardado con éxito!";
        
        // Limpiamos las cajitas para el próximo
        document.getElementById('nuevo-cliente-nombre').value = '';
        document.getElementById('nuevo-cliente-apellido').value = '';
        document.getElementById('nuevo-cliente-telefono').value = '';
        
        // Borramos el mensaje verde después de 3 segundos
        setTimeout(() => { mensaje.innerText = ''; }, 3000);
    }
}

// 2. Buscar Cliente e Historial
async function buscarCliente() {
    const termino = document.getElementById('buscador-cliente').value.trim();
    const contenedor = document.getElementById('resultado-busqueda');

    if (!termino) {
        contenedor.innerHTML = '<p>Por favor, ingresa un nombre para buscar.</p>';
        return;
    }

    contenedor.innerHTML = '<p>Buscando en la base de datos...</p>';

    // Buscamos clientes que coincidan parcialmente con el nombre o apellido (.ilike)
    const { data: clientes, error } = await clienteDb
        .from('clientes')
        .select('*')
        .or(`nombre.ilike.%${termino}%,apellido.ilike.%${termino}%`)
        .limit(5); // Traemos hasta 5 coincidencias

    if (error) {
        console.error("Error al buscar cliente:", error);
        contenedor.innerHTML = '<p style="color:red;">Error de conexión con la base de datos.</p>';
        return;
    }

    if (clientes.length === 0) {
        contenedor.innerHTML = '<p>No se encontraron clientes con ese nombre.</p>';
        return;
    }

    // Si encontramos clientes, armamos su ficha HTML
    let html = '';
    for (const cliente of clientes) {
        // Pedimos los turnos que tuvo este cliente específico
        const { data: turnos } = await clienteDb
            .from('turnos')
            .select('*, peluqueros(nombre)')
            .eq('cliente_id', cliente.id)
            .order('fecha_hora_inicio', { ascending: false });

        html += `
            <div style="background: #f9f9f9; padding: 15px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #ddd;">
                <h4 style="margin-top:0; color:#2c3e50; font-size:18px;">👤 ${cliente.nombre} ${cliente.apellido || ''}</h4>
                <p style="margin: 5px 0;"><strong>Teléfono:</strong> ${cliente.telefono || 'Sin registrar'}</p>
                
                <h5 style="margin-bottom: 5px; margin-top: 15px;">📅 Historial de Turnos:</h5>
        `;

        if (!turnos || turnos.length === 0) {
            html += `<p style="font-size:13px; color:#7f8c8d;">No tiene turnos registrados aún.</p>`;
        } else {
            html += `<ul style="font-size:14px; padding-left: 20px; margin-top:5px; color:#444;">`;
            for (const turno of turnos) {
                // Formateamos la fecha para que se lea lindo
                const fecha = new Date(turno.fecha_hora_inicio).toLocaleDateString('es-AR');
                const estado = turno.estado === 'finalizado' ? '✅ Finalizado' : `⏳ ${turno.estado}`;
                html += `<li style="margin-bottom: 5px;"><strong>${fecha}</strong> | Atendió: ${turno.peluqueros?.nombre || 'Sin asignar'} | ${estado}</li>`;
            }
            html += `</ul>`;
        }
        html += `</div>`;
    }

    contenedor.innerHTML = html;
}

// 1. Modificamos cómo se dibuja la tarjeta
function renderizarTurnos(turnos) {
    const contenedor = document.getElementById('lista-turnos');
    contenedor.innerHTML = ''; 

    if (turnos.length === 0) {
        contenedor.innerHTML = '<p>No hay turnos programados para hoy.</p>';
        return;
    }

    turnos.forEach(turno => {
        const div = document.createElement('div');
        div.className = `turno-card estado-${turno.estado}`;
        
        const fecha = new Date(turno.fecha_hora_inicio);
        const horaFormateada = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const nombreCliente = turno.clientes?.nombre || 'Desconocido';
        const apellidoCliente = turno.clientes?.apellido || '';
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; width: 100%;">
                <div>
                    <strong style="font-size: 16px; color: #2c3e50;">⏰ ${horaFormateada} | 👤 ${nombreCliente} ${apellidoCliente}</strong><br>
                    <div style="margin-top: 8px;">
                        <select class="selector-estado" onchange="cambiarEstado('${turno.id}', this.value)">
                            <option value="programado" ${turno.estado === 'programado' ? 'selected' : ''}>Programado (Gris)</option>
                            <option value="check-in" ${turno.estado === 'check-in' ? 'selected' : ''}>Check-in (Amarillo)</option>
                            <option value="en_proceso" ${turno.estado === 'en_proceso' ? 'selected' : ''}>En Proceso (Naranja)</option>
                            <option value="finalizado" ${turno.estado === 'finalizado' ? 'selected' : ''}>Finalizado (Verde)</option>
                        </select>
                    </div>
                </div>
                <!-- Botón de Borrar Turno -->
                <button onclick="borrarTurno('${turno.id}')" style="background: transparent; border: none; font-size: 18px; cursor: pointer;" title="Borrar Turno">❌</button>
            </div>
            <div class="etiqueta-peluquero" style="background-color: ${turno.peluqueros?.color_calendario || '#ccc'};">
                ${turno.peluqueros?.nombre || 'Sin asignar'}
            </div>
        `;
        contenedor.appendChild(div);
    });
}

// Nueva función para borrar un turno
async function borrarTurno(id) {
    if(confirm("¿Estás seguro que deseas eliminar este turno?")) {
        const { error } = await clienteDb.from('turnos').delete().eq('id', id);
        if(error) alert("Error al borrar el turno.");
        // Se borrará solo de la pantalla gracias al Tiempo Real
    }
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
    // ... (El principio de cambiarEstado queda igual, busca la parte 'B. ¡LÓGICA DE STOCK Y CAJA!')
    if (nuevoEstado === 'finalizado') {
        const resena = prompt("Turno finalizado. Escribe una breve reseña del trabajo realizado (Ej. Mechas con gorro, decoloración suave):");
        const gramos = prompt("¿Cuántos gramos de Tintura se usaron? (Si no usó, escribe 0)");
        const precio = prompt("¿Cuál fue el precio total cobrado al cliente? (Ej: 15000)");

        if (gramos !== null && precio !== null && resena !== null) {
            const RENDER_URL = 'https://apflekiyo.onrender.com'; 
            
            try {
                // 1. Guardamos la reseña en el turno directamente
                await clienteDb.from('turnos').update({ resena: resena }).eq('id', turnoId);

                // 2. Ejecutamos tu pago y stock en Render
       
            try {
                // 1. Guardamos la reseña en el turno directamente
                await clienteDb.from('turnos').update({ resena: resena }).eq('id', turnoId);
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

// --- LÓGICA DEL MENÚ DE SOLAPAS ---
function abrirSolapa(idSolapa, evento) {
    // 1. Ocultamos todos los contenidos
    const contenidos = document.querySelectorAll('.contenido-solapa');
    contenidos.forEach(div => div.classList.remove('activa'));
    
    // 2. Apagamos todos los botones
    const botones = document.querySelectorAll('.btn-solapa');
    botones.forEach(btn => btn.classList.remove('activo'));
    
    // 3. Encendemos la solapa seleccionada y su botón
    document.getElementById(idSolapa).classList.add('activa');
    evento.currentTarget.classList.add('activo');
}
// --- NUEVO: MÓDULO DE RESERVA AVANZADA (SOLAPA 3) ---

// 1. Cargar la lista de clientes en el desplegable
async function cargarClientesDropdown() {
    const select = document.getElementById('select-cliente-avanzado');
    const { data: clientes, error } = await clienteDb
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true });

    if (error) {
        console.error("Error al cargar clientes para el dropdown:", error);
        select.innerHTML = '<option value="">Error al cargar clientes</option>';
        return;
    }

    if (clientes.length === 0) {
        select.innerHTML = '<option value="">No hay clientes guardados</option>';
        return;
    }

    // Armamos las opciones
    let html = '<option value="">-- Selecciona un cliente --</option>';
    clientes.forEach(cliente => {
        html += `<option value="${cliente.id}">${cliente.nombre} ${cliente.apellido || ''} - ${cliente.telefono || 'Sin tel.'}</option>`;
    });
    select.innerHTML = html;
}

// 2. Cargar la lista de peluqueros en el desplegable
async function cargarPeluquerosDropdown() {
    const select = document.getElementById('select-peluquero-avanzado');
    const { data: peluqueros, error } = await clienteDb
        .from('peluqueros')
        .select('*')
        .order('nombre', { ascending: true });

    if (error || !peluqueros) {
        console.error("Error al cargar peluqueros:", error);
        return;
    }

    let html = '<option value="">-- Selecciona un profesional --</option>';
    peluqueros.forEach(peluquero => {
        html += `<option value="${peluquero.id}">${peluquero.nombre}</option>`;
    });
    select.innerHTML = html;
}

// 3. Guardar el nuevo turno con fecha específica
async function agendarTurnoAvanzado() {
    const clienteId = document.getElementById('select-cliente-avanzado').value;
    const peluqueroId = document.getElementById('select-peluquero-avanzado').value;
    const fechaHoraStr = document.getElementById('fecha-hora-turno').value;
    const mensaje = document.getElementById('mensaje-reserva');

    if (!clienteId || !peluqueroId || !fechaHoraStr) {
        alert("Por favor, completa todos los campos (Cliente, Peluquero y Fecha).");
        return;
    }

    // Procesar las fechas (Le sumamos 1 hora automáticamente para la duración)
    const fechaInicio = new Date(fechaHoraStr);
    const fechaFin = new Date(fechaInicio.getTime() + (60 * 60 * 1000));

    const { error } = await clienteDb
        .from('turnos')
        .insert([{
            cliente_id: clienteId,
            peluquero_id: peluqueroId,
            fecha_hora_inicio: fechaInicio.toISOString(),
            fecha_hora_fin: fechaFin.toISOString(),
            estado: 'programado'
        }]);

    if (error) {
        console.error("Error al guardar turno avanzado:", error);
        mensaje.style.color = 'red';
        mensaje.innerText = "Error al guardar el turno. Revisa los permisos.";
    } else {
        mensaje.style.color = '#27ae60';
        mensaje.innerText = "¡Turno agendado con éxito!";
        
        // Limpiamos el formulario
        document.getElementById('select-cliente-avanzado').value = '';
        document.getElementById('select-peluquero-avanzado').value = '';
        document.getElementById('fecha-hora-turno').value = '';

        // Borramos el mensaje verde a los 3 segundos
        setTimeout(() => { mensaje.innerText = ''; }, 3000);
        
        // Refrescamos la grilla por si el turno agendado es para el día de hoy
        cargarTurnos(); 
    }
}
// --- NUEVO: MÓDULO DE PRÓXIMOS 7 DÍAS (SOLAPA 4) ---

async function cargarProximosTurnos() {
    const contenedor = document.getElementById('lista-proximos-turnos');
    contenedor.innerHTML = '<p>Buscando la agenda de la semana...</p>';

    // 1. Calculamos las fechas exactas
    const hoy = new Date();
    const dentroDe7Dias = new Date();
    dentroDe7Dias.setDate(hoy.getDate() + 7);

    // 2. Buscamos en la base de datos cruzando Turnos + Clientes + Peluqueros
    const { data: turnos, error } = await clienteDb
        .from('turnos')
        .select('*, clientes(nombre, apellido, telefono), peluqueros(nombre)')
        .gte('fecha_hora_inicio', hoy.toISOString())
        .lte('fecha_hora_inicio', dentroDe7Dias.toISOString())
        .order('fecha_hora_inicio', { ascending: true });

    if (error) {
        console.error("Error al cargar próximos turnos:", error);
        contenedor.innerHTML = '<p style="color:red;">Error al conectar con la base de datos.</p>';
        return;
    }

    if (turnos.length === 0) {
        contenedor.innerHTML = '<p>No hay turnos agendados para los próximos 7 días.</p>';
        return;
    }

    // 3. Dibujamos las tarjetas
    let html = '';
    turnos.forEach(turno => {
        // Le damos un formato lindo a la fecha (Ej: Jueves 27 de Agosto, 15:00 hs)
        const fecha = new Date(turno.fecha_hora_inicio);
        const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' };
        const fechaFormateada = fecha.toLocaleDateString('es-AR', opcionesFecha);

        const cliente = turno.clientes;
        const peluquero = turno.peluqueros?.nombre || 'Sin asignar';
        
        // 4. Lógica de WhatsApp
        let linkWhatsapp = '#';
        let textoBtn = 'Sin teléfono';
        let estiloBtn = 'background-color: #ccc; cursor: not-allowed;'; // Gris si no hay número

        if (cliente && cliente.telefono && cliente.telefono !== 'Sin asignar') {
            // Limpiamos el número de espacios o guiones por si lo guardaron raro
            const numeroLimpio = cliente.telefono.replace(/\D/g, ''); 
            
            if (numeroLimpio.length > 5) { // Verificamos que sea un número válido
                const mensaje = `¡Hola ${cliente.nombre}! Te escribimos de la peluquería para recordarte tu turno del día ${fechaFormateada} con ${peluquero}. ¿Nos confirmas tu asistencia?`;
                // Codificamos el mensaje para que los espacios y símbolos viajen bien por internet
                linkWhatsapp = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
                textoBtn = '📱 Enviar WhatsApp';
                estiloBtn = ''; // Le quita el gris y usa el verde que pusimos en CSS
            }
        }

        html += `
            <div class="turno-proximo-card">
                <div class="turno-proximo-info">
                    <strong style="text-transform: capitalize; color:#2c3e50; font-size:16px;">📅 ${fechaFormateada}</strong>
                    <span>👤 Cliente: ${cliente ? cliente.nombre + ' ' + (cliente.apellido || '') : 'Desconocido'}</span>
                    <span>✂️ Profesional: ${peluquero}</span>
                    <span style="color:#7f8c8d; font-size:13px;">📌 Estado actual: ${turno.estado}</span>
                </div>
                <a href="${linkWhatsapp}" target="_blank" class="btn-whatsapp" style="${estiloBtn}">
                    ${textoBtn}
                </a>
            </div>
        `;
    });

    contenedor.innerHTML = html;
}
// --- NUEVO: MÓDULO DE PRODUCTOS / PAÑOL (SOLAPA 5) ---

// 1. Crear un producto desde cero
async function crearProductoNuevo() {
    const nombre = document.getElementById('nuevo-producto-nombre').value.trim();
    const stockStr = document.getElementById('nuevo-producto-stock').value.trim();
    const mensaje = document.getElementById('mensaje-producto');

    if (!nombre || !stockStr) {
        alert("Por favor, completa el nombre y el stock inicial del producto.");
        return;
    }

    const stock = parseInt(stockStr);

    const { error } = await clienteDb
        .from('insumos')
        .insert([{ nombre: nombre, stock_gramos: stock }]);

    if (error) {
        console.error("Error al crear producto:", error);
        mensaje.style.color = 'red';
        mensaje.innerText = "Error al guardar en la base de datos.";
    } else {
        mensaje.style.color = '#27ae60';
        mensaje.innerText = "¡Producto creado con éxito!";
        
        // Limpiamos los campos
        document.getElementById('nuevo-producto-nombre').value = '';
        document.getElementById('nuevo-producto-stock').value = '';
        
        setTimeout(() => { mensaje.innerText = ''; }, 3000);
        
        // Refrescamos las listas de ambas solapas
        cargarProductosAdmin(); 
    }
}

// 2. Mostrar la lista con opción de sumar stock
async function cargarProductosAdmin() {
    const contenedor = document.getElementById('lista-productos-admin');
    
    const { data: insumos, error } = await clienteDb
        .from('insumos')
        .select('*')
        .order('nombre', { ascending: true });

    if (error) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar el inventario.</p>';
        return;
    }

    if (insumos.length === 0) {
        contenedor.innerHTML = '<p>No hay productos cargados en el sistema.</p>';
        return;
    }

    let html = '';
    insumos.forEach(insumo => {
        html += `
            <div class="producto-admin-card">
                <div>
                    <strong style="font-size: 16px; color: #2c3e50;">${insumo.nombre}</strong> <br>
                    <span style="color: #7f8c8d; font-size: 14px;">Stock actual: <strong>${insumo.stock_gramos}</strong></span>
                </div>
                <div class="form-sumar-stock">
                    <input type="number" id="sumar-stock-${insumo.id}" placeholder="+ Cantidad">
                    <button onclick="sumarStock(${insumo.id}, ${insumo.stock_gramos})" class="btn-sumar">Ingresar Stock</button>
                </div>
            </div>
        `;
    });
    contenedor.innerHTML = html;
}

// 3. Sumar stock a un producto que ya existe
async function sumarStock(insumoId, stockActual) {
    const inputSuma = document.getElementById(`sumar-stock-${insumoId}`);
    const cantidadASumar = parseInt(inputSuma.value);

    if (!cantidadASumar || cantidadASumar <= 0 || isNaN(cantidadASumar)) {
        alert("Ingresa una cantidad válida mayor a 0 para sumar al stock.");
        return;
    }

    const nuevoStock = stockActual + cantidadASumar;

    const { error } = await clienteDb
        .from('insumos')
        .update({ stock_gramos: nuevoStock })
        .eq('id', insumoId);

    if (error) {
        alert("Error al actualizar el stock. Revisa los permisos de Supabase.");
        console.error(error);
    } else {
        inputSuma.value = ''; // Limpiamos la cajita
        cargarProductosAdmin(); // Recargamos esta pantalla para ver el nuevo número
    }
}
// --- NUEVO: MÓDULO FINANCIERO MENSUAL (SOLAPA 6) ---

async function cargarCajaMensual() {
    const contenedorComisiones = document.getElementById('lista-comisiones-mes');
    const textoTotal = document.getElementById('total-mes-ingresos');
    
    // 1. Averiguamos cuál fue el primer día de este mes
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    // Lo convertimos a formato que Supabase entienda
    const fechaFiltro = primerDiaMes.toISOString();

    // 2. Traemos todos los cobros del mes
    const { data: registros, error } = await clienteDb
        .from('caja')
        .select('monto_total, monto_comision, peluqueros(nombre)')
        .gte('fecha_cobro', fechaFiltro);

    if (error) {
        console.error("Error al cargar caja mensual:", error);
        contenedorComisiones.innerHTML = '<p style="color:red;">Error al conectar con la base de datos.</p>';
        return;
    }

    if (registros.length === 0) {
        textoTotal.innerText = '$0';
        contenedorComisiones.innerHTML = '<p>No hay ingresos registrados en este mes aún.</p>';
        return;
    }

    // 3. Calculamos totales y separamos por profesional
    let facturacionTotal = 0;
    const liquidacionPorPeluquero = {};

    registros.forEach(reg => {
        // Sumamos al pozo general
        facturacionTotal += Number(reg.monto_total);
        
        // Sumamos a la "billetera" de cada peluquero
        const nombre = reg.peluqueros?.nombre || 'Sin asignar';
        if (!liquidacionPorPeluquero[nombre]) {
            liquidacionPorPeluquero[nombre] = 0;
        }
        liquidacionPorPeluquero[nombre] += Number(reg.monto_comision);
    });

    // 4. Dibujamos los resultados en pantalla
    textoTotal.innerText = `$${facturacionTotal.toLocaleString('es-AR')}`;

    let htmlComisiones = '';
    for (const [nombre, monto] of Object.entries(liquidacionPorPeluquero)) {
        htmlComisiones += `
            <div class="comision-mes-item">
                <strong>👤 ${nombre}</strong>
                <span style="color: #e67e22; font-weight: bold;">$${monto.toLocaleString('es-AR')}</span>
            </div>
        `;
    }
    
    contenedorComisiones.innerHTML = htmlComisiones;
}

// --- NUEVO: MÓDULO DE PROFESIONALES ---

async function guardarPeluquero() {
    const nombre = document.getElementById('nuevo-peluquero-nombre').value.trim();
    const color = document.getElementById('nuevo-peluquero-color').value;
    const mensaje = document.getElementById('mensaje-peluquero');

    if (!nombre) {
        alert("El nombre es obligatorio.");
        return;
    }

    const { error } = await clienteDb
        .from('peluqueros')
        .insert([{ nombre: nombre, color_calendario: color }]);

    if (error) {
        mensaje.style.color = 'red';
        mensaje.innerText = "Error al guardar el profesional.";
        console.error(error);
    } else {
        mensaje.style.color = '#27ae60';
        mensaje.innerText = "¡Profesional guardado!";
        document.getElementById('nuevo-peluquero-nombre').value = '';
        setTimeout(() => { mensaje.innerText = ''; }, 3000);
        
        // Recargamos las listas
        cargarPeluquerosAdmin();
        cargarPeluquerosDropdown(); // Del agendador avanzado
    }
}

async function cargarPeluquerosAdmin() {
    const contenedor = document.getElementById('lista-peluqueros-admin');
    const { data: peluqueros, error } = await clienteDb
        .from('peluqueros')
        .select('*')
        .order('nombre', { ascending: true });

    if (error) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar.</p>';
        return;
    }
    
    let html = '';
    peluqueros.forEach(p => {
        html += `
            <div class="producto-admin-card" style="border-left: 6px solid ${p.color_calendario}">
                <strong style="font-size: 18px;">${p.nombre}</strong>
            </div>
        `;
    });
    contenedor.innerHTML = html;
}
cargarClientesDropdown();
cargarPeluquerosDropdown();
cargarCaja();
cargarInventario();
cargarTurnos();
cargarProximosTurnos();
cargarProductosAdmin();
cargarCajaMensual();
cargarPeluquerosAdmin();
