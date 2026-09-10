export const INTEGRITY_RISK_LEVELS = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];

export const INTEGRITY_PASTE_CATEGORIES = ['SMALL', 'MEDIUM', 'LARGE'];

export const SIZE_RATIO_THRESHOLDS = { small: 0.1, large: 0.3 };

function eventTime(event) {
  return new Date(event.timestamp).getTime();
}

function pushUnique(list, token) {
  if (!list.includes(token)) {
    list.push(token);
  }
}

function sizeCategory(ratio) {
  if (ratio == null) {
    return null;
  }
  if (ratio > SIZE_RATIO_THRESHOLDS.large) {
    return 'LARGE';
  }
  if (ratio >= SIZE_RATIO_THRESHOLDS.small) {
    return 'MEDIUM';
  }
  return 'SMALL';
}

function sizeWeight(category) {
  return category === 'LARGE' ? 1 : 0;
}

export function assessIntegrityRisk(events, options = {}) {
  const solutionCharacters =
    options && options.reference && typeof options.reference.characters === 'number'
      ? options.reference.characters
      : null;

  if (!Array.isArray(events) || events.length === 0) {
    return { level: 'NONE', reasons: [] };
  }

  const sorted = [...events].sort((a, b) => eventTime(a) - eventTime(b));

  const pastes = sorted.filter((event) => event.type === 'PASTE');
  const hasCopy = sorted.some((event) => event.type === 'COPY');
  const hasFocusLoss = sorted.some((event) => event.type === 'WINDOW_BLUR');

  let copyBeforePaste = false;
  let anyWithoutPrior = false;
  let focusLossBeforePaste = false;
  let maxCategory = null;

  for (const paste of pastes) {
    const pasteTime = eventTime(paste);
    if (sorted.some((event) => event.type === 'COPY' && eventTime(event) < pasteTime)) {
      copyBeforePaste = true;
    } else {
      anyWithoutPrior = true;
    }
    if (sorted.some((event) => event.type === 'WINDOW_BLUR' && eventTime(event) < pasteTime)) {
      focusLossBeforePaste = true;
    }
    const pasteCharacters = paste.characters ?? 0;
    const ratio =
      solutionCharacters && solutionCharacters > 0 && pasteCharacters > 0
        ? pasteCharacters / solutionCharacters
        : null;
    const category = sizeCategory(ratio);
    if (
      category != null &&
      (maxCategory == null || sizeWeight(category) > sizeWeight(maxCategory))
    ) {
      maxCategory = category;
    }
  }

  // COPY, luego pérdida de foco (COPY → FOCUS_LOST) => señal media.
  const copyBeforeFocusLoss = sorted.some(
    (copy) =>
      copy.type === 'COPY' &&
      sorted.some(
        (blur) => blur.type === 'WINDOW_BLUR' && eventTime(blur) > eventTime(copy),
      ),
  );

  // COPY → FOCUS_LOST → PASTE con el foco entre el COPY y el PASTE => señal alta,
  // independientemente del tamaño del PASTE.
  const copyToFocusPaste = pastes.some((paste) => {
    const pasteTime = eventTime(paste);
    return sorted.some(
      (copy) =>
        copy.type === 'COPY' &&
        eventTime(copy) < pasteTime &&
        sorted.some(
          (blur) =>
            blur.type === 'WINDOW_BLUR' &&
            eventTime(blur) > eventTime(copy) &&
            eventTime(blur) < pasteTime,
        ),
    );
  });

  const reasons = [];
  if (hasCopy && !copyBeforePaste) {
    pushUnique(reasons, 'COPY');
  }
  if (copyBeforePaste) {
    pushUnique(reasons, 'COPY_BEFORE_PASTE');
  }
  if (focusLossBeforePaste) {
    pushUnique(reasons, 'PASTE_AFTER_FOCUS_LOSS');
  }
  if (anyWithoutPrior) {
    pushUnique(reasons, 'PASTE_WITHOUT_PRIOR_COPY');
  }
  if (maxCategory === 'LARGE') {
    pushUnique(reasons, 'PASTE_LARGE');
  } else if (maxCategory === 'SMALL') {
    pushUnique(reasons, 'PASTE_SMALL');
  }
  if (hasFocusLoss && !focusLossBeforePaste) {
    pushUnique(reasons, 'WINDOW_FOCUS_LOST');
  }

  let level;
  if (copyToFocusPaste) {
    level = 'HIGH';
  } else if (copyBeforeFocusLoss) {
    level = 'MEDIUM';
  } else {
    const weight =
      (copyBeforePaste ? 1 : 0) +
      (focusLossBeforePaste ? 1 : 0) +
      (anyWithoutPrior ? 1 : 0) +
      sizeWeight(maxCategory);
    level = weight >= 2 ? 'MEDIUM' : 'LOW';
  }

  return { level, reasons };
}
