// 1. Configuración de Supabase (Reemplaza con tus datos reales)
const SUPABASE_URL = 'https://xpufmicxmbhpqocrwgdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwdWZtaWN4bWJocHFvY3J3Z2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MzE1OTcsImV4cCI6MjEwMzEwNzU5N30.811oNtrlBbEvNvhxaLlvJBZtqSpU98ZQ9sORRh4EIu8';

// Le cambiamos el nombre a 'clienteDb' para que no choque con la librería
const clienteDb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Función para mostrar turnos en la pantalla
async function cargarTurnos() {
    const { data: turnos, error } = await clienteDb
        .from('turnos')
        .select('*');

    if (error) {
        console.error('Error al cargar turnos:', error);
        return;
    }

    renderizarTurnos(turnos);
}

function renderizarTurnos(turnos) {
    const contenedor = document.getElementById('lista-turnos');
    contenedor.innerHTML = ''; // Limpiamos la grilla

    if (turnos.length === 0) {
        contenedor.innerHTML = '<p>No hay turnos programados.</p>';
        return;
    }

    turnos.forEach(turno => {
        const div = document.createElement('div');
        // El color del borde izquierdo define el estado (Semáforo)
        div.className = `turno-card estado-${turno.estado}`;
        
        div.innerHTML = `
            <div>
                <strong>ID:</strong> ${turno.id.substring(0, 5)}...<br>
                <span style="color: #666; font-size: 14px;">Estado: <b>${turno.estado.toUpperCase()}</b></span>
            </div>
            <div class="etiqueta-peluquero">
                <!-- Aquí luego pondremos el color real del peluquero -->
                Estilista Asignado
            </div>
        `;
        contenedor.appendChild(div);
    });
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
