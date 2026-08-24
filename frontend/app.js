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
            <div class="etiqueta-peluquero">Estilista</div>
        `;
        contenedor.appendChild(div);
    });
}

// 2. Nueva función para actualizar la base de datos
async function cambiarEstado(turnoId, nuevoEstado) {
    const { error } = await clienteDb
        .from('turnos')
        .update({ estado: nuevoEstado })
        .eq('id', turnoId);

    if (error) {
        alert("Error al actualizar el estado. Revisa los permisos (RLS).");
        console.error(error);
    }
    // ¡De nuevo, la magia del Tiempo Real actualizará los colores solos!
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

// Iniciar la app al abrir la pantalla
cargarTurnos();
