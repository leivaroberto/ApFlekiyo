let turnosDelDiaGlobal = []; // Para que la alarma lea los turnos
let calendarioGlobal = null; // Para el renderizado de FullCalendar

// --- 1. CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://xpufmicxmbhpqocrwgdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwdWZtaWN4bWJocHFvY3J3Z2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MzE1OTcsImV4cCI6MjEwMzEwNzU5N30.811oNtrlBbEvNvhxaLlvJBZtqSpU98ZQ9sORRh4EIu8';

const clienteDb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. MÓDULO DE TURNOS DE HOY ---
async function cargarTurnos() {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const { data: turnos, error } = await clienteDb
        .from('turnos')
        .select('*, peluqueros(nombre, color_calendario), clientes(nombre, apellido)')
        .gte('fecha_hora_inicio', inicioHoy.toISOString())
        .order('fecha_hora_inicio', { ascending: true });

    if (error) {
        console.error("Error al cargar turnos:", error);
        return;
    }
    
    turnosDelDiaGlobal = turnos; 
    renderizarTurnos(turnos);
}

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
                <button onclick="borrarTurno('${turno.id}')" style="background: transparent; border: none; font-size: 18px; cursor: pointer;" title="Borrar Turno">❌</button>
            </div>
            <div class="etiqueta-peluquero" style="background-color: ${turno.peluqueros?.color_calendario || '#ccc'};">
                ${turno.peluqueros?.nombre || 'Sin asignar'}
            </div>
        `;
        contenedor.appendChild(div);
    });
}

async function borrarTurno(id) {
    if(confirm("¿Estás seguro que deseas eliminar este turno?")) {
        const { error } = await clienteDb.from('turnos').delete().eq('id', id);
        if(error) alert("Error al borrar el turno.");
    }
}

async function cambiarEstado(turnoId, nuevoEstado) {
    const { error } = await clienteDb
        .from('turnos')
        .update({ estado: nuevoEstado })
        .eq('id', turnoId);

    if (error) {
        alert("Error al actualizar el estado.");
        console.error(error);
        return;
    }

    if (nuevoEstado === 'finalizado') {
        const resena = prompt("Turno finalizado. Escribe una breve reseña del trabajo realizado:");
        const gramos = prompt("¿Cuántos gramos de Tintura se usaron? (Si no usó, escribe 0)");
        const precio = prompt("¿Cuál fue el precio total cobrado al cliente? (Ej: 15000)");

        if (gramos !== null && precio !== null && resena !== null) {
            const RENDER_URL = 'https://apflekiyo.onrender.com';
            
            try {
                await clienteDb.from('turnos').update({ resena: resena }).eq('id', turnoId);
                
                const { data: turnoInfo } = await clienteDb
                    .from('turnos')
                    .select('peluquero_id')
                    .eq('id', turnoId)
                    .single();

                const respuesta = await fetch(`${RENDER_URL}/api/finalizar-turno`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        turnoId: turnoId,
                        peluqueroId: turnoInfo.peluquero_id,
                        insumoId: 1, 
                        gramosUsados: parseInt(gramos) || 0,
                        precioTotal: parseFloat(precio) || 0
                    })
                });

                const resultado = await respuesta.json();
                alert(resultado.mensaje || "Hubo un problema: " + resultado.error);
                
            } catch (errorRender) {
                console.error("Error al conectar con Render:", errorRender);
                alert("El turno finalizó, pero no pudimos conectar con el servidor para la caja.");
            }
        } else {
            alert("Operación cancelada. El turno se marcó como finalizado sin registrar pago/stock.");
        }
    }
}

async function crearTurnoNuevo() {
    const nombreCliente = document.getElementById('input-cliente').value.trim();
    const peluqueroId = document.getElementById('select-peluquero').value;

    if(!nombreCliente || !peluqueroId) {
        alert("Por favor, ingresa el nombre del cliente y selecciona un profesional.");
        return;
    }

    const { data: clienteData, error: errorCliente } = await clienteDb
        .from('clientes')
        .insert([{ nombre: nombreCliente, telefono: 'Sin asignar' }])
        .select();

    if (errorCliente) return alert("Error al crear el cliente.");
    
    const nuevoClienteId = clienteData[0].id;
    const fechaInicio = new Date();
    const fechaFin = new Date(fechaInicio.getTime() + (60 * 60 * 1000));

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
        alert("Error al guardar el turno.");
    } else {
        document.getElementById('input-cliente').value = '';
        document.getElementById('select-peluquero').value = '';
    }
}

// --- 3. MÓDULO DE CLIENTES ---
async function guardarCliente() {
    const nombre = document.getElementById('nuevo-cliente-nombre').value.trim();
    const apellido = document.getElementById('nuevo-cliente-apellido').value.trim();
    const telefono = document.getElementById('nuevo-cliente-telefono').value.trim();
    const mensaje = document.getElementById('mensaje-cliente');

    if (!nombre) return alert("El nombre es obligatorio.");

    const { error } = await clienteDb
        .from('clientes')
        .insert([{ nombre: nombre, apellido: apellido, telefono: telefono }]);

    if (error) {
        mensaje.style.color = 'red';
        mensaje.innerText = "Error al guardar el cliente.";
    } else {
        mensaje.style.color = '#27ae60';
        mensaje.innerText = "¡Cliente guardado con éxito!";
        document.getElementById('nuevo-cliente-nombre').value = '';
        document.getElementById('nuevo-cliente-apellido').value = '';
        document.getElementById('nuevo-cliente-telefono').value = '';
        setTimeout(() => { mensaje.innerText = ''; }, 3000);
    }
}

async function buscarCliente() {
    const termino = document.getElementById('buscador-cliente').value.trim();
    const contenedor = document.getElementById('resultado-busqueda');

    if (!termino) return contenedor.innerHTML = '<p>Ingresa un nombre para buscar.</p>';
    
    contenedor.innerHTML = '<p>Buscando...</p>';

    const { data: clientes, error } = await clienteDb
        .from('clientes')
        .select('*')
        .or(`nombre.ilike.%${termino}%,apellido.ilike.%${termino}%`)
        .limit(5);

    if (error) return contenedor.innerHTML = '<p style="color:red;">Error de conexión.</p>';
    if (clientes.length === 0) return contenedor.innerHTML = '<p>No se encontraron clientes.</p>';

    let html = '';
    for (const cliente of clientes) {
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
                const fecha = new Date(turno.fecha_hora_inicio).toLocaleDateString('es-AR');
                const estado = turno.estado === 'finalizado' ? '✅ Finalizado' : `⏳ ${turno.estado}`;
                html += `<li style="margin-bottom: 10px;">
                            <strong>${fecha}</strong> | Atendió: ${turno.peluqueros?.nombre || 'Sin asignar'} | ${estado}
                            ${turno.resena ? `<br><span style="color:#7f8c8d; font-size:13px;">📝 <i>${turno.resena}</i></span>` : ''}
                         </li>`;
            }
            html += `</ul>`;
        }
        html += `</div>`;
    }
    contenedor.innerHTML = html;
}

// --- 4. MÓDULO RESERVA AVANZADA Y CALENDARIO ---
async function cargarClientesDropdown() {
    const select = document.getElementById('select-cliente-avanzado');
    const { data: clientes } = await clienteDb.from('clientes').select('*').order('nombre', { ascending: true });
    
    if (!clientes || clientes.length === 0) return select.innerHTML = '<option value="">No hay clientes</option>';
    
    let html = '<option value="">-- Selecciona un cliente --</option>';
    clientes.forEach(c => html += `<option value="${c.id}">${c.nombre} ${c.apellido || ''} - ${c.telefono || ''}</option>`);
    select.innerHTML = html;
}

async function cargarPeluquerosDropdown() {
    const { data: peluqueros } = await clienteDb.from('peluqueros').select('*').order('nombre', { ascending: true });
    if (!peluqueros) return;

    let html = '<option value="">-- Selecciona un profesional --</option>';
    peluqueros.forEach(p => html += `<option value="${p.id}">${p.nombre}</option>`);
    
    if (document.getElementById('select-peluquero-avanzado')) document.getElementById('select-peluquero-avanzado').innerHTML = html;
    if (document.getElementById('select-peluquero')) document.getElementById('select-peluquero').innerHTML = html;
    if (document.getElementById('select-peluquero-reporte')) document.getElementById('select-peluquero-reporte').innerHTML = html;
}

async function agendarTurnoAvanzado() {
    const clienteId = document.getElementById('select-cliente-avanzado').value;
    const peluqueroId = document.getElementById('select-peluquero-avanzado').value;
    const trabajo = document.getElementById('input-trabajo').value.trim();
    const duracionMinutos = parseInt(document.getElementById('select-duracion').value) || 60;
    const fechaHoraStr = document.getElementById('fecha-hora-turno').value;
    const mensaje = document.getElementById('mensaje-reserva');

    if (!clienteId || !peluqueroId || !fechaHoraStr || !trabajo) {
        return alert("Por favor, completa todos los campos.");
    }

    const fechaInicio = new Date(fechaHoraStr);
    const fechaFin = new Date(fechaInicio.getTime() + (duracionMinutos * 60 * 1000));

    const { error } = await clienteDb.from('turnos').insert([{
        cliente_id: clienteId,
        peluquero_id: peluqueroId,
        descripcion_trabajo: trabajo,
        duracion_minutos: duracionMinutos,
        fecha_hora_inicio: fechaInicio.toISOString(),
        fecha_hora_fin: fechaFin.toISOString(),
        estado: 'programado'
    }]);

    if (error) {
        mensaje.style.color = 'red';
        mensaje.innerText = "Error al guardar el turno.";
    } else {
        mensaje.style.color = '#27ae60';
        mensaje.innerText = "¡Turno agendado con éxito!";
        document.getElementById('select-cliente-avanzado').value = '';
        document.getElementById('select-peluquero-avanzado').value = '';
        document.getElementById('input-trabajo').value = '';
        document.getElementById('fecha-hora-turno').value = '';
        setTimeout(() => { mensaje.innerText = ''; }, 3000);
        cargarTurnos(); 
    }
}

async function cargarCalendario() {
    const calendarEl = document.getElementById('calendario-full');
    if (!calendarEl) return;

    const { data: turnos } = await clienteDb
        .from('turnos')
        .select('*, clientes(nombre, apellido), peluqueros(nombre, color_calendario)');

    if (!turnos) return;

    const eventos = turnos.map(turno => {
        const nombreCliente = turno.clientes?.nombre || 'Desconocido';
        const nombrePeluquero = turno.peluqueros?.nombre || 'Sin asignar';
        const color = turno.peluqueros?.color_calendario || '#3498db'; 
        return {
            id: turno.id,
            title: `${nombreCliente} - ${turno.descripcion_trabajo || 'Turno'} (${nombrePeluquero})`,
            start: turno.fecha_hora_inicio,
            end: turno.fecha_hora_fin,
            backgroundColor: color,
            borderColor: color
        };
    });

    if (calendarioGlobal) calendarioGlobal.destroy();

    calendarioGlobal = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'es',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay' 
        },
        buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' },
        slotMinTime: '08:00:00',
        slotMaxTime: '22:00:00',
        allDaySlot: false,
        height: 650,
        events: eventos
    });
    calendarioGlobal.render();
}

// --- 5. MÓDULO PRÓXIMOS 7 DÍAS ---
async function cargarProximosTurnos() {
    const contenedor = document.getElementById('lista-proximos-turnos');
    contenedor.innerHTML = '<p>Buscando la agenda...</p>';

    const hoy = new Date();
    const dentroDe7Dias = new Date();
    dentroDe7Dias.setDate(hoy.getDate() + 7);

    const { data: turnos, error } = await clienteDb
        .from('turnos')
        .select('*, clientes(nombre, apellido, telefono), peluqueros(nombre)')
        .gte('fecha_hora_inicio', hoy.toISOString())
        .lte('fecha_hora_inicio', dentroDe7Dias.toISOString())
        .order('fecha_hora_inicio', { ascending: true });

    if (error) return contenedor.innerHTML = '<p style="color:red;">Error de conexión.</p>';
    if (turnos.length === 0) return contenedor.innerHTML = '<p>No hay turnos agendados.</p>';

    let html = '';
    turnos.forEach(turno => {
        const fecha = new Date(turno.fecha_hora_inicio);
        const fechaFormateada = fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' });
        const cliente = turno.clientes;
        const peluquero = turno.peluqueros?.nombre || 'Sin asignar';
        
        let linkWhatsapp = '#';
        let textoBtn = 'Sin teléfono';
        let estiloBtn = 'background-color: #ccc; cursor: not-allowed;';

        if (cliente && cliente.telefono && cliente.telefono !== 'Sin asignar') {
            const numeroLimpio = cliente.telefono.replace(/\D/g, ''); 
            if (numeroLimpio.length > 5) { 
                const mensaje = `¡Hola ${cliente.nombre}! Te escribimos de la peluquería para recordarte tu turno del día ${fechaFormateada} con ${peluquero}. ¿Nos confirmas tu asistencia?`;
                linkWhatsapp = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
                textoBtn = '📱 Enviar WhatsApp';
                estiloBtn = ''; 
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
                <a href="${linkWhatsapp}" target="_blank" class="btn-whatsapp" style="${estiloBtn}">${textoBtn}</a>
            </div>
        `;
    });
    contenedor.innerHTML = html;
}

// --- 6. MÓDULO PAÑOL E INVENTARIO ---
async function cargarInventario() {
    const { data: insumos } = await clienteDb.from('insumos').select('*').order('nombre', { ascending: true });
    if (insumos) renderizarInventario(insumos);
}

function renderizarInventario(insumos) {
    const contenedor = document.getElementById('lista-insumos');
    contenedor.innerHTML = '';
    if (insumos.length === 0) return contenedor.innerHTML = '<p>No hay productos.</p>';

    insumos.forEach(insumo => {
        const div = document.createElement('div');
        div.className = 'item-insumo';
        const claseStock = insumo.stock_gramos < 100 ? 'stock-bajo' : '';
        div.innerHTML = `<span>${insumo.nombre}</span><span class="${claseStock}">${insumo.stock_gramos}g</span>`;
        contenedor.appendChild(div);
    });
}

async function crearProductoNuevo() {
    const nombre = document.getElementById('nuevo-producto-nombre').value.trim();
    const stockStr = document.getElementById('nuevo-producto-stock').value.trim();
    const mensaje = document.getElementById('mensaje-producto');

    if (!nombre || !stockStr) return alert("Completa nombre y stock.");

    const { error } = await clienteDb.from('insumos').insert([{ nombre: nombre, stock_gramos: parseInt(stockStr) }]);

    if (error) {
        mensaje.style.color = 'red';
        mensaje.innerText = "Error al guardar.";
    } else {
        mensaje.style.color = '#27ae60';
        mensaje.innerText = "¡Producto creado!";
        document.getElementById('nuevo-producto-nombre').value = '';
        document.getElementById('nuevo-producto-stock').value = '';
        setTimeout(() => { mensaje.innerText = ''; }, 3000);
        cargarProductosAdmin(); 
    }
}

async function cargarProductosAdmin() {
    const contenedor = document.getElementById('lista-productos-admin');
    const { data: insumos, error } = await clienteDb.from('insumos').select('*').order('nombre', { ascending: true });

    if (error) return contenedor.innerHTML = '<p style="color:red;">Error al cargar.</p>';
    if (insumos.length === 0) return contenedor.innerHTML = '<p>No hay productos.</p>';

    let html = '';
    insumos.forEach(insumo => {
        html += `
            <div class="producto-admin-card">
                <div>
                    <strong style="font-size: 16px; color: #2c3e50;">${insumo.nombre}</strong> 
                    <button onclick="editarProducto(${insumo.id}, '${insumo.nombre}')" style="background:transparent; border:none; cursor:pointer; font-size:16px;">✏️</button><br>
                    <span style="color: #7f8c8d; font-size: 14px;">Stock actual: <strong>${insumo.stock_gramos}</strong></span>
                </div>
                <div class="form-sumar-stock" style="display:flex; align-items:center; gap: 5px;">
                    <input type="number" id="sumar-stock-${insumo.id}" placeholder="+ Cant" style="width: 70px;">
                    <button onclick="sumarStock(${insumo.id}, ${insumo.stock_gramos})" class="btn-sumar">Sumar</button>
                    <button onclick="borrarProducto(${insumo.id})" style="background:transparent; border:none; font-size:18px; cursor:pointer; margin-left: 10px;">❌</button>
                </div>
            </div>
        `;
    });
    contenedor.innerHTML = html;
}

async function sumarStock(insumoId, stockActual) {
    const inputSuma = document.getElementById(`sumar-stock-${insumoId}`);
    const cantidadASumar = parseInt(inputSuma.value);
    if (!cantidadASumar || cantidadASumar <= 0) return alert("Ingresa cantidad válida.");

    const { error } = await clienteDb.from('insumos').update({ stock_gramos: stockActual + cantidadASumar }).eq('id', insumoId);
    if (error) alert("Error al actualizar stock.");
    else cargarProductosAdmin();
}

async function editarProducto(id, nombreActual) {
    const nuevoNombre = prompt("Modificar el nombre del producto:", nombreActual);
    if (nuevoNombre && nuevoNombre.trim() !== "") {
        await clienteDb.from('insumos').update({ nombre: nuevoNombre.trim() }).eq('id', id);
        cargarProductosAdmin();
    }
}

async function borrarProducto(id) {
    if (confirm("¿Borrar este producto?")) {
        await clienteDb.from('insumos').delete().eq('id', id);
        cargarProductosAdmin();
    }
}

// --- 7. MÓDULO CAJA Y FINANZAS ---
async function cargarCaja() {
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    const { data: registros } = await clienteDb
        .from('caja')
        .select('monto_total, monto_comision, peluqueros(nombre)')
        .gte('fecha_cobro', inicioDelDia.toISOString());

    if (registros) renderizarCaja(registros);
}

function renderizarCaja(registros) {
    const contenedor = document.getElementById('resumen-caja');
    if (registros.length === 0) return contenedor.innerHTML = '<p>No hay ingresos aún hoy.</p>';

    let totalCaja = 0;
    const comisiones = {};

    registros.forEach(reg => {
        totalCaja += Number(reg.monto_total);
        const nombrePeluquero = reg.peluqueros?.nombre || 'Sin asignar';
        if (!comisiones[nombrePeluquero]) comisiones[nombrePeluquero] = 0;
        comisiones[nombrePeluquero] += Number(reg.monto_comision);
    });

    let html = `<div class="totales-caja">Total Ingresos: $${totalCaja.toLocaleString()}</div><strong>Comisiones a pagar:</strong>`;
    for (const [nombre, monto] of Object.entries(comisiones)) {
        html += `<div class="comision-item"><span>${nombre}</span><span style="color: #27ae60; font-weight: bold;">$${monto.toLocaleString()}</span></div>`;
    }
    contenedor.innerHTML = html;
}

async function cargarCajaMensual() {
    const contenedorComisiones = document.getElementById('lista-comisiones-mes');
    const textoTotal = document.getElementById('total-mes-ingresos');
    
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const { data: registros, error } = await clienteDb
        .from('caja')
        .select('monto_total, monto_comision, peluqueros(nombre)')
        .gte('fecha_cobro', primerDiaMes.toISOString());

    if (error) return contenedorComisiones.innerHTML = '<p style="color:red;">Error de conexión.</p>';
    if (registros.length === 0) {
        textoTotal.innerText = '$0';
        return contenedorComisiones.innerHTML = '<p>No hay ingresos este mes.</p>';
    }

    let facturacionTotal = 0;
    const liquidacionPorPeluquero = {};

    registros.forEach(reg => {
        facturacionTotal += Number(reg.monto_total);
        const nombre = reg.peluqueros?.nombre || 'Sin asignar';
        if (!liquidacionPorPeluquero[nombre]) liquidacionPorPeluquero[nombre] = 0;
        liquidacionPorPeluquero[nombre] += Number(reg.monto_comision);
    });

    textoTotal.innerText = `$${facturacionTotal.toLocaleString('es-AR')}`;
    let htmlComisiones = '';
    for (const [nombre, monto] of Object.entries(liquidacionPorPeluquero)) {
        htmlComisiones += `<div class="comision-mes-item"><strong>👤 ${nombre}</strong><span style="color: #e67e22; font-weight: bold;">$${monto.toLocaleString('es-AR')}</span></div>`;
    }
    contenedorComisiones.innerHTML = htmlComisiones;
}

// --- 8. MÓDULO PELUQUEROS Y REPORTE PDF ---
async function guardarPeluquero() {
    const nombre = document.getElementById('nuevo-peluquero-nombre').value.trim();
    const comisionStr = document.getElementById('nuevo-peluquero-comision').value.trim();
    const color = document.getElementById('nuevo-peluquero-color').value;
    const mensaje = document.getElementById('mensaje-peluquero');

    if (!nombre || !comisionStr) return alert("El nombre y el porcentaje son obligatorios.");

    const { error } = await clienteDb.from('peluqueros').insert([{ nombre: nombre, porcentaje_comision: parseFloat(comisionStr), color_calendario: color }]);

    if (error) {
        mensaje.style.color = 'red';
        mensaje.innerText = "Error al guardar.";
    } else {
        mensaje.style.color = '#27ae60';
        mensaje.innerText = "¡Profesional guardado!";
        document.getElementById('nuevo-peluquero-nombre').value = '';
        setTimeout(() => { mensaje.innerText = ''; }, 3000);
        cargarPeluquerosAdmin();
        cargarPeluquerosDropdown();
    }
}

async function cargarPeluquerosAdmin() {
    const contenedor = document.getElementById('lista-peluqueros-admin');
    const { data: peluqueros, error } = await clienteDb.from('peluqueros').select('*').order('nombre', { ascending: true });

    if (error) return contenedor.innerHTML = '<p style="color:red;">Error al cargar.</p>';
    
    let html = '';
    peluqueros.forEach(p => {
        const comisionVal = p.porcentaje_comision !== undefined ? p.porcentaje_comision : 50;
        html += `
            <div class="producto-admin-card" style="border-left: 6px solid ${p.color_calendario}; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="font-size: 18px; color: #2c3e50;">${p.nombre}</strong><br>
                    <span style="color: #7f8c8d; font-size: 14px;">Comisión: <strong>${comisionVal}%</strong></span>
                </div>
                <button onclick="borrarPeluquero('${p.id}')" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Borrar</button>
            </div>
        `;
    });
    contenedor.innerHTML = html;
}

async function borrarPeluquero(id) {
    if(confirm("¿Seguro que deseas eliminar a este profesional?")) {
        const { error } = await clienteDb.from('peluqueros').delete().eq('id', id);
        if(error) alert("Error: No puedes borrar un profesional con turnos asignados.");
        else { cargarPeluquerosAdmin(); cargarPeluquerosDropdown(); }
    }
}

async function generarReportePDF() {
    const peluqueroId = document.getElementById('select-peluquero-reporte').value;
    const fechaDesdeStr = document.getElementById('fecha-desde').value;
    const fechaHastaStr = document.getElementById('fecha-hasta').value;

    if (!peluqueroId || !fechaDesdeStr || !fechaHastaStr) return alert("Selecciona profesional y fechas.");

    const { data: peluqueroInfo } = await clienteDb.from('peluqueros').select('nombre, porcentaje_comision').eq('id', peluqueroId).single();
    const fechaInicio = new Date(fechaDesdeStr + 'T00:00:00');
    const fechaFin = new Date(fechaHastaStr + 'T23:59:59');

    const { data: registros, error } = await clienteDb
        .from('caja')
        .select('monto_total, monto_comision, fecha_cobro')
        .eq('peluquero_id', peluqueroId)
        .gte('fecha_cobro', fechaInicio.toISOString())
        .lte('fecha_cobro', fechaFin.toISOString())
        .order('fecha_cobro', { ascending: true });

    if (error || !registros || registros.length === 0) return alert("No hay cobros en estas fechas.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setTextColor(44, 62, 80); doc.text("VERONA Estilistas - Reporte", 14, 20);
    doc.setFontSize(12); doc.setTextColor(127, 140, 141);
    doc.text(`Profesional: ${peluqueroInfo.nombre} (${peluqueroInfo.porcentaje_comision}% Comisión)`, 14, 28);
    doc.text(`Período: ${fechaDesdeStr} al ${fechaHastaStr}`, 14, 34);

    let cuerpoTabla = [], totalFacturado = 0, totalComision = 0;
    registros.forEach(reg => {
        const f = new Date(reg.fecha_cobro);
        const monto = Number(reg.monto_total), com = Number(reg.monto_comision);
        totalFacturado += monto; totalComision += com;
        cuerpoTabla.push([f.toLocaleDateString() + ' ' + f.toLocaleTimeString().slice(0,5), 'Caja', 'Servicio', `$${monto}`, `$${com}`]);
    });

    doc.autoTable({ startY: 42, head: [['Fecha', 'Origen', 'Detalle', 'Precio', 'Comisión']], body: cuerpoTabla });
    doc.text(`Total Facturado: $${totalFacturado}`, 14, doc.lastAutoTable.finalY + 10);
    doc.text(`Total Comisión a Pagar: $${totalComision}`, 14, doc.lastAutoTable.finalY + 17);
    doc.save(`Liquidacion_${peluqueroInfo.nombre}_${fechaDesdeStr}.pdf`);
}

// --- 9. ALARMAS Y NAVEGACIÓN ---
let temporizadorAlarmas;
let turnosYaNotificados = new Set();

function activarAlarmas() {
    if (!("Notification" in window)) return alert("Tu navegador no soporta notificaciones.");
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            document.getElementById('estado-alarma').innerText = "Alarmas ACTIVAS 🟢";
            document.getElementById('estado-alarma').style.color = "#27ae60";
            if (temporizadorAlarmas) clearInterval(temporizadorAlarmas);
            temporizadorAlarmas = setInterval(revisarTurnosProximos, 60000);
            revisarTurnosProximos();
            alert("Alarmas activadas.");
        } else {
            alert("Permiso Denegado.");
        }
    });
}

function revisarTurnosProximos() {
    if (!turnosDelDiaGlobal || turnosDelDiaGlobal.length === 0) return;
    const minsAnticipacion = parseInt(document.getElementById('minutos-alarma').value);
    const ahora = new Date();

    turnosDelDiaGlobal.forEach(turno => {
        if (turno.estado === 'programado') {
            const fTurno = new Date(turno.fecha_hora_inicio);
            const diffMins = Math.floor((fTurno - ahora) / 60000);

            if (diffMins > 0 && diffMins <= minsAnticipacion && !turnosYaNotificados.has(turno.id)) {
                const cli = turno.clientes?.nombre || 'Un cliente';
                new Notification(`⏰ Turno en ${diffMins} min`, { body: `${cli} a las ${fTurno.toLocaleTimeString().slice(0,5)}`, vibrate: [200, 100, 200] });
                turnosYaNotificados.add(turno.id);
            }
        }
    });
}

function abrirSolapa(idSolapa, evento) {
    document.querySelectorAll('.contenido-solapa').forEach(d => d.classList.remove('activa'));
    document.querySelectorAll('.btn-solapa').forEach(b => b.classList.remove('activo'));
    document.getElementById(idSolapa).classList.add('activa');
    evento.currentTarget.classList.add('activo');

    if (idSolapa === 'solapa-reserva') {
        setTimeout(() => { if (!calendarioGlobal) cargarCalendario(); else calendarioGlobal.render(); }, 150);
    }
}

// --- 10. SUSCRIPCIONES EN TIEMPO REAL ---
clienteDb.channel('cambios-en-turnos').on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, () => { cargarTurnos(); cargarCalendario(); }).subscribe();
clienteDb.channel('cambios-en-insumos').on('postgres_changes', { event: '*', schema: 'public', table: 'insumos' }, () => { cargarInventario(); }).subscribe();
clienteDb.channel('cambios-en-caja').on('postgres_changes', { event: '*', schema: 'public', table: 'caja' }, () => { cargarCaja(); }).subscribe();

// --- 11. LLAMADAS DE ARRANQUE ---
cargarClientesDropdown();
cargarPeluquerosDropdown();
cargarCaja();
cargarInventario();
cargarTurnos();
cargarProximosTurnos();
cargarProductosAdmin();
cargarCajaMensual();
cargarPeluquerosAdmin();
