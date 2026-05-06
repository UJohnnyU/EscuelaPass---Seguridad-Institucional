/** UI de coordinación del retiro (vista plantel): línea de tiempo y microcopy alineado al backend. */

export type StaffTimelineStep = {
  statusKey: string;
  title: string;
  caption: string;
};

export type StaffTimelineModel = {
  steps: StaffTimelineStep[];
  currentIndex: number;
  cancelled: boolean;
  closedWithoutConfirm: boolean;
  isConsentOnly: boolean;
};

export function getStaffTimelineModel(
  status: string,
  pickupMethod: string
): StaffTimelineModel {
  const consentFlow =
    pickupMethod === 'SOLO_CONSENTIMIENTO' ||
    status === 'CONSENTIDO_SOLO' ||
    (status === 'ENTREGADO' && pickupMethod === 'SOLO_CONSENTIMIENTO');

  if (consentFlow) {
    const steps: StaffTimelineStep[] = [
      {
        statusKey: 'CONSENTIDO_SOLO',
        title: 'Consentimiento registrado',
        caption: 'Sin retiro físico coordinado por este circuito.'
      },
      {
        statusKey: 'ENTREGADO',
        title: 'Registro cerrado por la institución',
        caption: 'La institución confirma el cierre en el sistema.'
      }
    ];
    if (status === 'CANCELADO') {
      return { steps, currentIndex: -1, cancelled: true, closedWithoutConfirm: false, isConsentOnly: true };
    }
    const idx =
      status === 'ENTREGADO'
        ? 1
        : status === 'CONSENTIDO_SOLO'
          ? 0
          : steps.findIndex((s) => s.statusKey === status);
    return {
      steps,
      currentIndex: idx >= 0 ? idx : 0,
      cancelled: false,
      closedWithoutConfirm: false,
      isConsentOnly: true
    };
  }

  const steps: StaffTimelineStep[] = [
    {
      statusKey: 'PENDIENTE',
      title: 'Solicitud recibida',
      caption: 'La familia generó la solicitud; el plantel da seguimiento protocolario.'
    },
    {
      statusKey: 'PADRE_EN_CAMINO',
      title: 'Familia en camino',
      caption: 'Paso principal en la app de la familia.'
    },
    {
      statusKey: 'NOTIFICADO_LLEGADA',
      title: 'Llegada verificada',
      caption: 'La familia confirma llegada con ubicación para revisión del plantel.'
    },
    {
      statusKey: 'AUTORIZADO_SALIR',
      title: 'Autorizado para acercarse',
      caption: 'El plantel registra formalmente la autorización hacia el punto de salida.'
    },
    {
      statusKey: 'EN_CAMINO',
      title: 'Menor en tránsito a la salida',
      caption: 'El plantel indica tránsito hacia la salida; la familia confirma la entrega en la app.'
    },
    {
      statusKey: 'ENTREGADO',
      title: 'Entrega confirmada',
      caption: 'Cierre del circuito con confirmación de la familia.'
    }
  ];

  if (status === 'CANCELADO') {
    return { steps, currentIndex: -1, cancelled: true, closedWithoutConfirm: false, isConsentOnly: false };
  }
  if (status === 'CERRADO_SIN_CONFIRMACION_PADRE') {
    return { steps, currentIndex: -1, cancelled: false, closedWithoutConfirm: true, isConsentOnly: false };
  }

  const idx = steps.findIndex((s) => s.statusKey === status);
  return {
    steps,
    currentIndex: idx >= 0 ? idx : 0,
    cancelled: false,
    closedWithoutConfirm: false,
    isConsentOnly: false
  };
}

export function getOperationalAdvanceHint(nextStatus: string): string {
  switch (nextStatus) {
    case 'PADRE_EN_CAMINO':
      return 'Actualiza el estado oficial cuando la familia ya informó que se dirige al plantel (coordinación con portería o aula según su protocolo).';
    case 'AUTORIZADO_SALIR':
      return 'La familia ya registró llegada. Al confirmar, autoriza formalmente el acercamiento al punto de salida cuando el procedimiento interno lo permita.';
    case 'EN_CAMINO':
      return 'Registrar este paso indica que el menor va hacia la salida. La familia verá el cambio y podrá confirmar el recibimiento en la app.';
    case 'ENTREGADO':
      return 'Solo aplica a consentimientos sin retiro físico: cierra el registro desde la institución.';
    default:
      return '';
  }
}

export function getPedagogicalHint(
  signal: 'PREPARA_SALIDA' | 'ALUMNO_CAMINO_A_SALIDA'
): string {
  if (signal === 'PREPARA_SALIDA') {
    return 'Aviso al acudiente: el aula prepara la salida. No sustituye el estado oficial del retiro en el sistema.';
  }
  return 'Aviso al acudiente: el menor se dirige hacia la salida. Debe enviarse después de «Preparar salida», en el orden indicado por la institución.';
}
