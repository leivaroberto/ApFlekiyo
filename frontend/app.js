// --- 1. CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://xpufmicxmbhpqocrwgdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwdWZtaWN4bWJocHFvY3J3Z2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MzE1OTcsImV4cCI6MjEwMzEwNzU5N30.811oNtrlBbEvNvhxaLlvJBZtqSpU98ZQ9sORRh4EIu8';
const clienteDb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let calendarioGlobal = null;

function abrirSolapa(idSolapa, evento) {
   document.querySelectorAll('.contenido-solapa').forEach(d => d.classList.remove('activa'));
    document.querySelectorAll('.btn-solapa').forEach(b => b.classList.remove('activo'));
    
    document.getElementById(idSolapa).classList.add('activa');
    if (evento) evento.currentTarget.classList.add('activo');

    if (idSolapa === 'solapa-reserva' || idSolapa === 'solapa-calendario') {
        setTimeout(() => {
            if (!calendarioGlobal) {
                cargarCalendario();
            } else {
                calendarioGlobal.render();
            }
        }, 150);
    }
}

// --- 3. MÓDULO DE CALENDARIO GENERAL (SOLAPA 8) ---
async function cargarCalendario() {
    const calendarEl = document.getElementById('calendario-full');
    if (!calendarEl) return;

    const { data: turnos, error } = await clienteDb
        .from('turnos')
        .select('*, clientes(nombre, apellido), peluqueros(nombre, color_calendario)');

    if (error) {
        console.error("Error al cargar turnos para el calendario:", error);
        return;
    }

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

// --- 4. MÓDULO DE TURNOS DE HOY ---
async function cargarTurnos() {
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    const { data: turnos, error } = await clienteDb
        .from('turnos')
        .select('*, clientes(nombre, apellido), peluqueros(nombre, color_calendario)')
        .gte('fecha_hora_inicio', inicioDelDia.toISOString())
        .order('fecha_hora_inicio', { ascending: true });

    if (error) {
        console.error("Error al cargar turnos:", error);
        return;
    }
    renderizarTurnos(turnos);
}

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
        const trabajo = turno.descripcion_trabajo || 'Servicio de salón';
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; width: 100%;">
                <div>
                    <strong style="font-size: 16px; color: #2c3e50;">⏰ ${horaFormateada} | 👤 ${nombreCliente} ${apellidoCliente}</strong><br>
                    <span style="color: #e67e22; font-size: 14px; font-weight: 500; display: inline-block; margin-top: 4px;">📝 ${trabajo}</span><br>
                    
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

async function cambiarEstado(turnoId, nuevoEstado) {
    const { error } = await clienteDb.from('turnos').update({ estado: nuevoEstado }).eq('id', turnoId);
    if (error) return alert("Error al actualizar el estado.");

    if (nuevoEstado === 'finalizado') {
        const resena = prompt("Turno finalizado. Escribe una breve reseña del trabajo realizado:");
        const gramos = prompt("¿Cuántos gramos de Tintura se usaron? (Si no usó, escribe 0)");
        const precio = prompt("¿Cuál fue el precio total cobrado al cliente? (Ej: 15000)");

        if (gramos !== null && precio !== null && resena !== null) {
            const RENDER_URL = 'https://apflekiyo.onrender.com';
            try {
                const { data: turnoInfo } = await clienteDb.from('turnos').select('peluquero_id').eq('id', turnoId).single();

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
        }
    }
}

async function borrarTurno(id) {
    if(confirm("¿Estás seguro que deseas eliminar este turno?")) {
        await clienteDb.from('turnos').delete().eq('id', id);
    }
}

// --- 5. MÓDULO DE CLIENTES (Buscador y Creación) ---
async function guardarCliente() {
    const nombre = document.getElementById('nuevo-cliente-nombre').value.trim();
    const apellido = document.getElementById('nuevo-cliente-apellido').value.trim();
    const telefono = document.getElementById('nuevo-cliente-telefono').value.trim();
    const mensaje = document.getElementById('mensaje-cliente');

    if (!nombre) return alert("El nombre es obligatorio para crear un cliente.");

    const { error } = await clienteDb.from('clientes').insert([{ nombre: nombre, apellido: apellido, telefono: telefono }]);

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
        cargarClientesDropdown();
    }
}

async function buscarCliente() {
    const termino = document.getElementById('buscador-cliente').value.trim();
    const contenedor = document.getElementById('resultado-busqueda');

    if (!termino) return contenedor.innerHTML = '<p>Por favor, ingresa un nombre para buscar.</p>';
    
    contenedor.innerHTML = '<p>Buscando en la base de datos...</p>';

    const { data: clientes, error } = await clienteDb
        .from('clientes')
        .select('*')
        .or(`nombre.ilike.%${termino}%,apellido.ilike.%${termino}%`)
        .limit(5);

    if (error) return contenedor.innerHTML = '<p style="color:red;">Error de conexión.</p>';
    if (clientes.length === 0) return contenedor.innerHTML = '<p>No se encontraron clientes.</p>';

    let html = '';
    clientes.forEach(cliente => {
        html += `<div style="background:#f9f9f9; padding:15px; margin-bottom:10px; border-radius:5px; border: 1px solid #ddd;">
                    <strong style="font-size:16px;">👤 ${cliente.nombre} ${cliente.apellido || ''}</strong><br>
                    <span style="color:#7f8c8d;">📞 ${cliente.telefono || 'Sin registrar'}</span>
                 </div>`;
    });
    contenedor.innerHTML = html;
}

// --- 6. MÓDULO DE CAJA Y REPORTE PDF ---
async function cargarCaja() {
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    const { data: registros, error } = await clienteDb
        .from('caja')
        .select('monto_total, monto_comision, peluqueros(nombre)')
        .gte('fecha_cobro', inicioDelDia.toISOString());

    if (!error) renderizarCaja(registros);
}

function renderizarCaja(registros) {
    const contenedor = document.getElementById('resumen-caja');
    if (!registros || registros.length === 0) return contenedor.innerHTML = '<p>No hay ingresos aún hoy.</p>';

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
    
    if(!contenedorComisiones || !textoTotal) return;

    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();

    const { data: registros, error } = await clienteDb
        .from('caja')
        .select('monto_total, monto_comision, peluqueros(nombre)')
        .gte('fecha_cobro', primerDiaMes);

    if (error) return contenedorComisiones.innerHTML = '<p style="color:red;">Error de conexión.</p>';
    if (registros.length === 0) {
        textoTotal.innerText = '$0';
        return contenedorComisiones.innerHTML = '<p>No hay ingresos este mes.</p>';
    }

    let facturacionTotal = 0;
    const liquidacion = {};

    registros.forEach(reg => {
        facturacionTotal += Number(reg.monto_total);
        const nombre = reg.peluqueros?.nombre || 'Sin asignar';
        if (!liquidacion[nombre]) liquidacion[nombre] = 0;
        liquidacion[nombre] += Number(reg.monto_comision);
    });

    textoTotal.innerText = `$${facturacionTotal.toLocaleString('es-AR')}`;
    let htmlComisiones = '';
    for (const [nombre, monto] of Object.entries(liquidacion)) {
        htmlComisiones += `<div class="comision-mes-item"><strong>👤 ${nombre}</strong><span style="color:#e67e22; font-weight:bold;">$${monto.toLocaleString('es-AR')}</span></div>`;
    }
    contenedorComisiones.innerHTML = htmlComisiones;
}

async function generarReportePDF() {
    const peluqueroId = document.getElementById('select-peluquero-reporte').value;
    const fechaDesdeStr = document.getElementById('fecha-desde').value;
    const fechaHastaStr = document.getElementById('fecha-hasta').value;

    if (!peluqueroId || !fechaDesdeStr || !fechaHastaStr) return alert("Selecciona un profesional y las fechas.");

    const { data: peluqueroInfo } = await clienteDb.from('peluqueros').select('nombre, porcentaje_comision').eq('id', peluqueroId).single();
    const fechaInicio = new Date(fechaDesdeStr + 'T00:00:00').toISOString();
    const fechaFin = new Date(fechaHastaStr + 'T23:59:59').toISOString();

    const { data: registros, error } = await clienteDb
        .from('caja')
        .select('monto_total, monto_comision, fecha_cobro')
        .eq('peluquero_id', peluqueroId)
        .gte('fecha_cobro', fechaInicio)
        .lte('fecha_cobro', fechaFin)
        .order('fecha_cobro', { ascending: true });

    if (error || !registros || registros.length === 0) return alert("No se encontraron cobros en estas fechas.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("VERONA Estilistas - Reporte de Liquidación", 14, 20);
    doc.setFontSize(12);
    doc.text(`Profesional: ${peluqueroInfo.nombre} (${peluqueroInfo.porcentaje_comision}% Comisión)`, 14, 28);
    doc.text(`Período: ${fechaDesdeStr} al ${fechaHastaStr}`, 14, 34);

    let cuerpoTabla = [];
    let acumuladoFacturado = 0;
    let acumuladoComision = 0;

    registros.forEach(reg => {
        const fechaObj = new Date(reg.fecha_cobro);
        const fechaFormateada = fechaObj.toLocaleDateString('es-AR') + ' ' + fechaObj.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'});
        const monto = Number(reg.monto_total);
        const comision = Number(reg.monto_comision);

        acumuladoFacturado += monto;
        acumuladoComision += comision;
        cuerpoTabla.push([fechaFormateada, 'Registrado en Caja', 'Servicio de Peluquería', `$${monto.toLocaleString('es-AR')}`, `$${comision.toLocaleString('es-AR')}`]);
    });

    doc.autoTable({ startY: 42, head: [['Fecha y Hora', 'Cliente', 'Detalle', 'Precio Cobrado', 'Comisión']], body: cuerpoTabla });
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.text(`Total Facturado: $${acumuladoFacturado.toLocaleString('es-AR')}`, 14, finalY);
    doc.text(`Total Comisión a Pagar: $${acumuladoComision.toLocaleString('es-AR')}`, 14, finalY + 7);
    doc.save(`Liquidacion_${peluqueroInfo.nombre.replace(/\s+/g, '_')}_${fechaDesdeStr}.pdf`);
}

// --- 7. MÓDULO DE INVENTARIO Y PRODUCTOS ---
async function cargarInventario() {
    const { data: insumos, error } = await clienteDb.from('insumos').select('*').order('nombre', { ascending: true });
    if (!error) renderizarInventario(insumos);
}

function renderizarInventario(insumos) {
    const contenedor = document.getElementById('lista-insumos');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    
    if (insumos.length === 0) return contenedor.innerHTML = '<p>No hay productos en el pañol.</p>';

    insumos.forEach(insumo => {
        const div = document.createElement('div');
        div.className = 'item-insumo';
        const claseStock = insumo.stock_gramos < 100 ? 'stock-bajo' : '';
        div.innerHTML = `<span>${insumo.nombre}</span><span class="${claseStock}">${insumo.stock_gramos}g</span>`;
        contenedor.appendChild(div);
    });
}

async function cargarProductosAdmin() {
    const contenedor = document.getElementById('lista-productos-admin');
    if(!contenedor) return;
    
    const { data: insumos, error } = await clienteDb.from('insumos').select('*').order('nombre', { ascending: true });
    if (error) return contenedor.innerHTML = '<p style="color:red;">Error al cargar.</p>';
    if (insumos.length === 0) return contenedor.innerHTML = '<p>No hay productos.</p>';

    let html = '';
    insumos.forEach(insumo => {
        html += `
            <div class="producto-admin-card" style="border:1px solid #ddd; padding:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${insumo.nombre}</strong><br>
                    <span style="color:#7f8c8d; font-size:14px;">Stock: ${insumo.stock_gramos}g</span>
                </div>
                <div>
                    <input type="number" id="sumar-stock-${insumo.id}" placeholder="+ Cantidad" style="width:80px; padding:5px; margin-right:5px;">
                    <button onclick="sumarStock(${insumo.id}, ${insumo.stock_gramos})" style="padding:5px 10px; background:#3498db; color:#fff; border:none; border-radius:5px; cursor:pointer;">Sumar</button>
                </div>
            </div>`;
    });
    contenedor.innerHTML = html;
}

async function sumarStock(insumoId, stockActual) {
    const cantidad = parseInt(document.getElementById(`sumar-stock-${insumoId}`).value);
    if (!cantidad || cantidad <= 0 || isNaN(cantidad)) return alert("Cantidad inválida.");
    
    await clienteDb.from('insumos').update({ stock_gramos: stockActual + cantidad }).eq('id', insumoId);
    cargarProductosAdmin();
}

// --- 8. MÓDULO RESERVA AVANZADA Y PRÓXIMOS TURNOS ---
async function cargarClientesDropdown() {
    const select = document.getElementById('select-cliente-avanzado');
    if(!select) return;
    const { data: clientes } = await clienteDb.from('clientes').select('*').order('nombre', { ascending: true });
    
    if (clientes && clientes.length > 0) {
        let html = '<option value="">-- Selecciona un cliente --</option>';
        clientes.forEach(c => html += `<option value="${c.id}">${c.nombre} ${c.apellido || ''}</option>`);
        select.innerHTML = html;
    } else {
        select.innerHTML = '<option value="">No hay clientes guardados</option>';
    }
}

async function cargarPeluquerosDropdown() {
    const { data: peluqueros } = await clienteDb.from('peluqueros').select('*').order('nombre', { ascending: true });
    if (!peluqueros) return;

    let html = '<option value="">-- Selecciona un profesional --</option>';
    peluqueros.forEach(p => html += `<option value="${p.id}">${p.nombre}</option>`);

    if(document.getElementById('select-peluquero-avanzado')) document.getElementById('select-peluquero-avanzado').innerHTML = html;
    if(document.getElementById('select-peluquero')) document.getElementById('select-peluquero').innerHTML = html;
    if(document.getElementById('select-peluquero-reporte')) document.getElementById('select-peluquero-reporte').innerHTML = html;
}

async function agendarTurnoAvanzado() {
    const clienteId = document.getElementById('select-cliente-avanzado').value;
    const peluqueroId = document.getElementById('select-peluquero-avanzado').value;
    const trabajo = document.getElementById('input-trabajo')?.value.trim() || 'Servicio de Salón';
    const duracionMinutos = parseInt(document.getElementById('select-duracion')?.value) || 60;
    const fechaHoraStr = document.getElementById('fecha-hora-turno').value;
    const mensaje = document.getElementById('mensaje-reserva');

    if (!clienteId || !peluqueroId || !fechaHoraStr) return alert("Completa todos los campos.");

    const fechaInicio = new Date(fechaHoraStr);
    const fechaFin = new Date(fechaInicio.getTime() + (duracionMinutos * 60 * 1000));

    const { error } = await clienteDb.from('turnos').insert([{
        cliente_id: clienteId, peluquero_id: peluqueroId, descripcion_trabajo: trabajo,
        duracion_minutos: duracionMinutos, fecha_hora_inicio: fechaInicio.toISOString(),
        fecha_hora_fin: fechaFin.toISOString(), estado: 'programado'
    }]);

    if (!error) {
        if(mensaje) {
            mensaje.style.color = '#27ae60';
            mensaje.innerText = "¡Turno agendado!";
            setTimeout(() => mensaje.innerText = '', 3000);
        }
        document.getElementById('fecha-hora-turno').value = '';
        cargarTurnos();
    }
}

async function cargarProximosTurnos() {
    const contenedor = document.getElementById('lista-proximos-turnos');
    if(!contenedor) return;

    const hoy = new Date();
    const dentroDe7Dias = new Date();
    dentroDe7Dias.setDate(hoy.getDate() + 7);

    const { data: turnos } = await clienteDb.from('turnos')
        .select('*, clientes(nombre, apellido), peluqueros(nombre)')
        .gte('fecha_hora_inicio', hoy.toISOString())
        .lte('fecha_hora_inicio', dentroDe7Dias.toISOString())
        .order('fecha_hora_inicio', { ascending: true });

    if (!turnos || turnos.length === 0) return contenedor.innerHTML = '<p>No hay turnos para los próximos 7 días.</p>';

    let html = '';
    turnos.forEach(turno => {
        const fecha = new Date(turno.fecha_hora_inicio).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' });
        html += `<div style="background:#fff; border-left:4px solid #3498db; padding:10px; margin-bottom:10px; border-radius:5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <strong style="color:#2c3e50;">${fecha}</strong><br>
                    <span style="font-size:14px; color:#555;">👤 ${turno.clientes?.nombre || 'Cliente'} - ${turno.descripcion_trabajo || 'Turno'} con ${turno.peluqueros?.nombre || 'Sin asignar'}</span>
                 </div>`;
    });
    contenedor.innerHTML = html;
}

// --- 9. MÓDULO PROFESIONALES (ADMIN) ---
async function guardarPeluquero() {
    const nombre = document.getElementById('nuevo-peluquero-nombre').value.trim();
    const com = document.getElementById('nuevo-peluquero-comision').value.trim();
    const color = document.getElementById('nuevo-peluquero-color').value;
    
    if (!nombre || !com) return alert("Nombre y comisión obligatorios.");
    
    await clienteDb.from('peluqueros').insert([{ nombre: nombre, porcentaje_comision: parseFloat(com), color_calendario: color }]);
    
    document.getElementById('nuevo-peluquero-nombre').value = '';
    cargarPeluquerosAdmin();
    cargarPeluquerosDropdown();
}

async function cargarPeluquerosAdmin() {
    const contenedor = document.getElementById('lista-peluqueros-admin');
    if(!contenedor) return;
    
    const { data: peluqueros } = await clienteDb.from('peluqueros').select('*').order('nombre', { ascending: true });
    let html = '';
    peluqueros.forEach(p => {
        html += `<div style="border-left: 6px solid ${p.color_calendario}; padding: 10px; margin-bottom: 10px; background: #fff; display:flex; justify-content:space-between; align-items:center; border-radius:5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div>
                        <strong style="font-size:16px;">${p.nombre}</strong><br>
                        <span style="font-size:14px; color:#7f8c8d;">Comisión: ${p.porcentaje_comision}%</span>
                    </div>
                    <button onclick="borrarPeluquero('${p.id}')" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Borrar</button>
                 </div>`;
    });
    contenedor.innerHTML = html;
}

async function borrarPeluquero(id) {
    if(confirm("¿Borrar este profesional? No se pueden borrar si tienen turnos asignados.")) {
        await clienteDb.from('peluqueros').delete().eq('id', id);
        cargarPeluquerosAdmin();
        cargarPeluquerosDropdown();
    }
}

// --- 10. TIEMPO REAL (WEBSOCKETS) ---
clienteDb.channel('cambios-en-turnos').on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, () => { cargarTurnos(); if(calendarioGlobal) cargarCalendario(); cargarProximosTurnos(); }).subscribe();
clienteDb.channel('cambios-en-insumos').on('postgres_changes', { event: '*', schema: 'public', table: 'insumos' }, () => { cargarInventario(); }).subscribe();
clienteDb.channel('cambios-en-caja').on('postgres_changes', { event: '*', schema: 'public', table: 'caja' }, () => { cargarCaja(); cargarCajaMensual(); }).subscribe();

// --- 11. ARRANQUE AUTOMÁTICO ---
cargarPeluquerosDropdown();
cargarClientesDropdown();
cargarInventario();
cargarCaja();
cargarCajaMensual();
cargarTurnos();
cargarProximosTurnos();
cargarPeluquerosAdmin();
cargarProductosAdmin();
