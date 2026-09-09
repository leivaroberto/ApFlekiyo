// --- 1. CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://xpufmicxmbhpqocrwgdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwdWZtaWN4bWJocHFvY3J3Z2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MzE1OTcsImV4cCI6MjEwMzEwNzU5N30.811oNtrlBbEvNvhxaLlvJBZtqSpU98ZQ9sORRh4EIu8';
const clienteDb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let calendarioGlobal = null; 

// --- 2. LÓGICA DEL MENÚ DE SOLAPAS ---
function abrirSolapa(idSolapa, evento) {
    const contenidos = document.querySelectorAll('.contenido-solapa');
    contenidos.forEach(div => div.classList.remove('activa'));
    
    const botones = document.querySelectorAll('.btn-solapa');
    botones.forEach(btn => btn.classList.remove('activo'));
    
    document.getElementById(idSolapa).classList.add('activa');
    if (evento) evento.currentTarget.classList.add('activo');

    // Retraso de 150ms para asegurar que la pestaña del calendario sea visible[cite: 1]
    if (idSolapa === 'solapa-calendario') {
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

    if (calendarioGlobal) {
        calendarioGlobal.destroy();
    }

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
        .gte('fecha_hora_inicio', inicioDelDia.toISOString());

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
        
        // Rescatamos el detalle del trabajo (si no escribieron nada, muestra un texto por defecto)
        const trabajo = turno.descripcion_trabajo || 'Servicio de salón';
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; width: 100%;">
                <div>
                    <strong style="font-size: 16px; color: #2c3e50;">⏰ ${horaFormateada} | 👤 ${nombreCliente} ${apellidoCliente}</strong><br>
                    
                    <!-- Aquí inyectamos el trabajo a realizar -->
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

async function cambiarEstado(turnoId, nuevoEstado) {
    const { error } = await clienteDb.from('turnos').update({ estado: nuevoEstado }).eq('id', turnoId);
    if (error) {
        alert("Error al actualizar el estado.");
        return;
    }

    if (nuevoEstado === 'finalizado') {
        const resena = prompt("Turno finalizado. Escribe una breve reseña del trabajo realizado:");
        const gramos = prompt("¿Cuántos gramos de Tintura se usaron? (Si no usó, escribe 0)");
        const precio = prompt("¿Cuál fue el precio total cobrado al cliente?");
    }
}

async function borrarTurno(id) {
    if(confirm("¿Estás seguro que deseas eliminar este turno?")) {
        await clienteDb.from('turnos').delete().eq('id', id);
    }
}

// --- 5. MÓDULO DE CAJA Y REPORTE PDF ---
async function cargarCaja() {
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    const { data: registros, error } = await clienteDb
        .from('caja')
        .select('monto_total, monto_comision, peluqueros(nombre)')
        .gte('fecha_cobro', inicioDelDia.toISOString());

    if (error) return;
    
    const contenedor = document.getElementById('resumen-caja');
    if (!registros || registros.length === 0) {
        contenedor.innerHTML = '<p>No hay ingresos aún hoy.</p>';
        return;
    }

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

async function generarReportePDF() {
    const peluqueroId = document.getElementById('select-peluquero-reporte').value;
    const fechaDesdeStr = document.getElementById('fecha-desde').value;
    const fechaHastaStr = document.getElementById('fecha-hasta').value;

    if (!peluqueroId || !fechaDesdeStr || !fechaHastaStr) {
        alert("Selecciona un profesional y las fechas.");
        return;
    }

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

    if (error || !registros || registros.length === 0) {
        alert("No se encontraron cobros registrados para este profesional en estas fechas.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("VERONA Estilistas - Reporte de Liquidación", 14, 20);
    doc.setFontSize(12);
    doc.text(`Profesional: ${peluqueroInfo.nombre} (${peluqueroInfo.porcentaje_comision}% Comisión)`, 14, 28);
    doc.text(`Período: ${fechaDesdeStr} al ${fechaHastaStr}`, 14, 34);

    let cuerpoTabla = [];
    let acumuladoTotalFacturado = 0;
    let acumuladoTotalComision = 0;

    registros.forEach(reg => {
        const fechaObj = new Date(reg.fecha_cobro);
        const fechaFormateada = fechaObj.toLocaleDateString('es-AR') + ' ' + fechaObj.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'});
        const monto = Number(reg.monto_total);
        const comision = Number(reg.monto_comision);

        acumuladoTotalFacturado += monto;
        acumuladoTotalComision += comision;

        cuerpoTabla.push([fechaFormateada, 'Registrado en Caja', 'Servicio de Peluquería', `$${monto.toLocaleString('es-AR')}`, `$${comision.toLocaleString('es-AR')}`]);
    });

    doc.autoTable({
        startY: 42,
        head: [['Fecha y Hora', 'Cliente', 'Detalle', 'Precio Cobrado', 'Comisión']],
        body: cuerpoTabla
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.text(`Total Facturado: $${acumuladoTotalFacturado.toLocaleString('es-AR')}`, 14, finalY);
    doc.text(`Total Comisión a Pagar: $${acumuladoTotalComision.toLocaleString('es-AR')}`, 14, finalY + 7);
    doc.save(`Liquidacion_${peluqueroInfo.nombre.replace(/\s+/g, '_')}_${fechaDesdeStr}_al_${fechaHastaStr}.pdf`);
}

// --- 6. MÓDULO DE INVENTARIO (PAÑOL) ---
async function cargarInventario() {
    const { data: insumos, error } = await clienteDb.from('insumos').select('*').order('nombre', { ascending: true });
    if (!error) renderizarInventario(insumos);
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
        const claseStock = insumo.stock_gramos < 100 ? 'stock-bajo' : '';
        div.innerHTML = `<span>${insumo.nombre}</span><span class="${claseStock}">${insumo.stock_gramos}g</span>`;
        contenedor.appendChild(div);
    });
}

// --- 7. CARGA DE DROPDOWNS ---
async function cargarPeluquerosDropdown() {
    const { data: peluqueros } = await clienteDb.from('peluqueros').select('*').order('nombre', { ascending: true });
    if (!peluqueros) return;

    let html = '<option value="">-- Selecciona un profesional --</option>';
    peluqueros.forEach(p => {
        html += `<option value="${p.id}">${p.nombre}</option>`;
    });

    if(document.getElementById('select-peluquero-avanzado')) document.getElementById('select-peluquero-avanzado').innerHTML = html;
    if(document.getElementById('select-peluquero')) document.getElementById('select-peluquero').innerHTML = html;
    if(document.getElementById('select-peluquero-reporte')) document.getElementById('select-peluquero-reporte').innerHTML = html;
}

// --- 8. TIEMPO REAL (WEBSOCKETS) ---
clienteDb.channel('cambios-en-turnos').on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, () => { cargarTurnos(); if(calendarioGlobal) cargarCalendario(); }).subscribe();
clienteDb.channel('cambios-en-insumos').on('postgres_changes', { event: '*', schema: 'public', table: 'insumos' }, () => { cargarInventario(); }).subscribe();
clienteDb.channel('cambios-en-caja').on('postgres_changes', { event: '*', schema: 'public', table: 'caja' }, () => { cargarCaja(); }).subscribe();

// --- 9. ARRANQUE AUTOMÁTICO ---
cargarPeluquerosDropdown();
cargarInventario();
cargarCaja();
cargarTurnos();
