// 1. Configuración de Supabase (Reemplaza con tus datos reales)
const SUPABASE_URL = 'https://xpufmicxmbhpqocrwgdz.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwdWZtaWN4bWJocHFvY3J3Z2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MzE1OTcsImV4cCI6MjEwMzEwNzU5N30.811oNtrlBbEvNvhxaLlvJBZtqSpU98ZQ9sORRh4EIu8';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Función para mostrar turnos en la pantalla
async function cargarTurnos() {
    const { data: turnos, error } = await supabase
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
    contenedor.innerHTML = ''; // Limpiar grilla

    turnos.forEach(turno => {
        const div = document.createElement('div');
        div.className = `turno-card estado-${turno.estado}`;
        div.innerHTML = `
            <strong>ID Turno:</strong> ${turno.id.substring(0, 6)}... <br>
            <strong>Estado:</strong> <span style="text-transform: capitalize;">${turno.estado}</span>
        `;
        contenedor.appendChild(div);
    });
}

// 3. Activar el TIEMPO REAL (El corazón del Tablero)
supabase
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
