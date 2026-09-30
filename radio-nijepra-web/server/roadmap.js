// Hoja de ruta de Radio NIJEPRA: fases, pasos y entregables.
// Es la misma estructura del documento "Hoja de ruta: Emisora NIJEPRA".
// Cada paso tiene: clave estable, título, cuándo, entregable y una guía corta.

module.exports = [
  {
    key: 'fase-1',
    title: 'Fase 1 · Emisora digital',
    subtitle: 'La emisora suena 24/7 en internet desde la cabina del colegio',
    when: 'Semanas 1 a 12',
    color: 'blue',
    steps: [
      {
        key: 'f1-aprobacion',
        title: 'Aprobación y equipo',
        when: 'Semana 1',
        deliverable: 'Acta de aprobación del Consejo Directivo y roles asignados',
        guide: 'Presentar la propuesta a Rectoría y al Consejo Directivo. Nombrar un docente coordinador, un responsable técnico y el grupo de estudiantes.'
      },
      {
        key: 'f1-twitch',
        title: 'Inventario y respaldo de Twitch',
        when: 'Semanas 1 y 2',
        deliverable: 'Inventario de equipos y archivo de grabaciones descargado',
        guide: 'Listar micrófonos, consola, computadores y software. Descargar ya los videos guardados en Twitch, porque la plataforma los borra pasado un tiempo.'
      },
      {
        key: 'f1-derechos',
        title: 'Derechos de autor de la música',
        when: 'Semanas 1 a 4',
        deliverable: 'Decisión escrita sobre la música y, si aplica, licencia SAYCO-ACINPRO en trámite',
        guide: 'Si se emitirá música comercial, cotizar la licencia de comunicación pública con SAYCO y ACINPRO. Si no, armar una fonoteca de música libre y producción propia.'
      },
      {
        key: 'f1-identidad',
        title: 'Identidad de la emisora',
        when: 'Semanas 2 y 3',
        deliverable: 'Manual básico de marca (nombre, logo, lema, cuñas) y dominio configurado',
        guide: 'Definir el nombre, el logo, el lema y las cuñas. Configurar un subdominio, por ejemplo radio.colnijepra.edu.co.'
      },
      {
        key: 'f1-fibra',
        title: 'Conectividad por fibra óptica',
        when: 'Semanas 2 a 4',
        deliverable: 'Convenio firmado con Innovation Telecomunicaciones y medición de línea base',
        guide: 'Formalizar por escrito tarifa, velocidad simétrica, IP fija si es posible y tiempo de respuesta ante fallas. Medir velocidad, latencia y pérdida de paquetes (línea base: 844/719 Mbps, 9 ms).'
      },
      {
        key: 'f1-servidor',
        title: 'Servidor de streaming AzuraCast',
        when: 'Semanas 3 y 4',
        deliverable: 'Enlace de transmisión funcionando con HTTPS',
        guide: 'Contratar un VPS con Ubuntu y al menos 2 GB de RAM, instalar AzuraCast con el script oficial y crear el punto de montaje en MP3 a 128 kbps.'
      },
      {
        key: 'f1-cabina',
        title: 'Adecuación de la cabina',
        when: 'Semanas 3 a 6',
        deliverable: 'Cabina adecuada y medición de ruido en locución por debajo de 40 dB',
        guide: 'Tabique de drywall con lana de roca, ventana de doble vidrio, puertas con burletes, paneles absorbentes y trampas de graves. Medir el ruido antes y después.'
      },
      {
        key: 'f1-estudio',
        title: 'Estudio en vivo',
        when: 'Semanas 4 y 5',
        deliverable: 'Prueba en vivo desde la cabina escuchada fuera del colegio',
        guide: 'Conectar la consola al PC de cabina y configurar BUTT para las emisiones en vivo. Si se mantiene video, OBS envía el audio a AzuraCast y el video a YouTube.'
      },
      {
        key: 'f1-ups',
        title: 'Respaldo de energía con UPS',
        when: 'Semanas 5 y 6',
        deliverable: 'UPS instalada y prueba de autonomía de al menos 30 minutos',
        guide: 'Conectar PC, consola, ONT y router a la UPS de 1000 VA. Desconectar la red en horario sin emisión y medir cuánto dura.'
      },
      {
        key: 'f1-parrilla',
        title: 'Parrilla y automatización',
        when: 'Semanas 5 a 7',
        deliverable: 'Parrilla semanal publicada y emisión automática 24/7',
        guide: 'Cargar música, cuñas institucionales y programas grabados. Crear listas, horarios y cuentas de DJ para cada locutor.'
      },
      {
        key: 'f1-web',
        title: 'Reproductor web y podcast',
        when: 'Semanas 6 a 8',
        deliverable: 'Reproductor en el sitio del colegio y primeros episodios publicados',
        guide: 'Incrustar el reproductor de AzuraCast en el sitio web y abrir el feed de podcast para Spotify, Apple Podcasts y YouTube Music.'
      },
      {
        key: 'f1-formacion',
        title: 'Formación de locutores',
        when: 'Semanas 6 a 9',
        deliverable: 'Manual de estilo, reglamento de la emisora y locutores certificados',
        guide: 'Capacitar en locución, operación de cabina y ética periodística. Pedir autorización de las familias para la voz e imagen de los estudiantes.'
      },
      {
        key: 'f1-piloto',
        title: 'Piloto con la comunidad',
        when: 'Semanas 9 y 10',
        deliverable: 'Informe del piloto con oyentes, cortes y ajustes',
        guide: 'Transmisión de prueba con estudiantes, docentes y familias. Medir oyentes, cortes y calidad de audio.'
      },
      {
        key: 'f1-lanzamiento',
        title: 'Lanzamiento oficial',
        when: 'Semanas 11 y 12',
        deliverable: 'Emisora al aire y estadísticas del primer mes',
        guide: 'Evento de lanzamiento, campaña en redes y enlace fijo desde Twitch. Mantener Twitch en paralelo 2 a 4 semanas.'
      }
    ]
  },
  {
    key: 'fase-2',
    title: 'Fase 2 · Alianza FM',
    subtitle: 'Una franja en una emisora existente mientras se prepara la independencia',
    when: 'Meses 4 a 12',
    color: 'gold',
    steps: [
      {
        key: 'f2-aliados',
        title: 'Identificar emisoras aliadas',
        when: 'Meses 4 y 5',
        deliverable: 'Lista de emisoras comunitarias y universitarias contactadas',
        guide: 'Buscar emisoras comunitarias de Girón y emisoras universitarias del área metropolitana de Bucaramanga.'
      },
      {
        key: 'f2-franja',
        title: 'Proponer una franja',
        when: 'Meses 5 y 6',
        deliverable: 'Propuesta de programa semanal enviada',
        guide: 'Un programa semanal producido por estudiantes, grabado o en vivo desde la cabina del colegio.'
      },
      {
        key: 'f2-convenio',
        title: 'Firmar el convenio',
        when: 'Mes 6',
        deliverable: 'Convenio firmado con horario, contenidos, música y duración',
        guide: 'Dejar por escrito el horario, las responsabilidades de contenido, el uso de música y la duración del acuerdo.'
      },
      {
        key: 'f2-emitir',
        title: 'Emitir y documentar',
        when: 'Meses 6 a 12',
        deliverable: 'Bitácora de emisiones y actividades con la comunidad',
        guide: 'Registrar cada emisión y actividad con actas, fotos y certificaciones. Es la evidencia para la convocatoria de la Fase 3.'
      }
    ]
  },
  {
    key: 'fase-3',
    title: 'Fase 3 · Independencia',
    subtitle: 'Entidad propia con concesión FM y conectividad respaldada',
    when: 'Años 1 a 3',
    color: 'green',
    steps: [
      {
        key: 'f3-figura',
        title: 'Definir la figura jurídica',
        when: 'Año 1',
        deliverable: 'Estatutos de la fundación o corporación sin ánimo de lucro',
        guide: 'Fundación o corporación con domicilio en Girón y objeto social de comunicación, cultura y educación. Fundadores: padres, egresados, docentes y líderes del barrio.'
      },
      {
        key: 'f3-constitucion',
        title: 'Constituir la entidad',
        when: 'Año 1',
        deliverable: 'Registro en Cámara de Comercio, RUT y cuenta bancaria',
        guide: 'Acta de constitución, registro en la Cámara de Comercio de Bucaramanga, RUT ante la DIAN y cuenta bancaria.'
      },
      {
        key: 'f3-convenio-colegio',
        title: 'Convenio con el colegio',
        when: 'Año 1',
        deliverable: 'Convenio de uso de cabina, fonoteca y servidor',
        guide: 'Acordar el uso de la cabina, la fonoteca y el servidor, y la participación de los estudiantes como proyecto pedagógico.'
      },
      {
        key: 'f3-trabajo-comunitario',
        title: 'Acumular trabajo comunitario',
        when: 'Años 1 a 3',
        deliverable: 'Carpeta de evidencias con actas, fotos y certificaciones',
        guide: 'Las convocatorias exigen haber desarrollado actividades con la comunidad del municipio. La franja de la Fase 2 cuenta si está documentada.'
      },
      {
        key: 'f3-cobertura',
        title: 'Estudio de cobertura FM',
        when: 'Año 2',
        deliverable: 'Mapa de cobertura y zonas de sombra en Girón (simulación y dron)',
        guide: 'Simular en Radio Mobile y verificar con el vuelo del dron. Identificar el mejor sitio para el transmisor.'
      },
      {
        key: 'f3-respaldo',
        title: 'Radioenlace de respaldo 5,8 GHz',
        when: 'Año 2',
        deliverable: 'Presupuesto de enlace con margen de al menos 15 dB y radioenlace instalado',
        guide: 'Perfil de terreno, zona de Fresnel despejada al 60 % y router de doble conexión que pase de la fibra al radioenlace si la fibra falla.'
      },
      {
        key: 'f3-convocatoria',
        title: 'Presentarse a la convocatoria',
        when: 'Cuando MinTIC la abra',
        deliverable: 'Propuesta radicada ante MinTIC',
        guide: 'Consultar con MinTIC si Girón tiene canal comunitario disponible. Preparar la propuesta, el plan de programación y la financiación.'
      },
      {
        key: 'f3-licencia',
        title: 'Licencia y operación FM',
        when: 'Tras la viabilidad',
        deliverable: 'Estudio técnico aprobado, transmisor instalado y junta de programación conformada',
        guide: 'Tras la viabilidad hay 6 meses para el estudio técnico. Pagar derechos de concesión, instalar transmisor y antena, y conformar la junta de programación.'
      }
    ]
  }
];
