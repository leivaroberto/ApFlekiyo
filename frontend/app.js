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
function crearTurnoNuevo() {
    const nombre = document.getElementById('input-cliente').value;
    if(!nombre) {
        alert("Por favor, ingresa el nombre del cliente.");
        return;
    }
    alert(`¡Listo para programar a ${nombre}! En el próximo paso conectaremos esto a Supabase.`);
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
