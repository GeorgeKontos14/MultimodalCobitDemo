const speechTasks = [
  {
    id: 'joint', short: 'Joint', title: 'Joint generation', kicker: 'Unconditional',
    description: 'Generate speech and its transcript together from noise.',
    sequence: [
      { modality: 'Text', detail: 'Generated', state: 'denoised' },
      { modality: 'Speaker', detail: 'Generated', state: 'denoised' },
      { modality: 'Speech', detail: 'Generated', state: 'denoised' }
    ]
  },
  {
    id: 'tts', short: 'Text → speech', title: 'Text-to-speech', kicker: 'Text conditioned',
    description: 'Synthesize speech while conditioning on a supplied text transcript.',
    sequence: [
      { modality: 'Text', detail: 'Condition', state: 'frozen' },
      { modality: 'Speaker', detail: 'Condition', state: 'frozen' },
      { modality: 'Speech', detail: 'Generated', state: 'denoised' }
    ]
  },
  {
    id: 'stt', short: 'Speech → text', title: 'Speech-to-text', kicker: 'Audio conditioned',
    description: 'Transcribe a supplied speech signal into text.',
    sequence: [
      { modality: 'Text', detail: 'Generated', state: 'denoised' },
      { modality: 'Speaker', detail: 'Condition', state: 'frozen' },
      { modality: 'Speech', detail: 'Condition', state: 'frozen' }
    ]
  },
  {
    id: 'cont', short: 'Continuation', title: 'Speech continuation', kicker: 'Prefix conditioned',
    description: 'Continue both modalities from a paired speech and text prefix.',
    sequence: [
      { modality: 'Text', detail: 'Generated', state: 'denoised' },
      { modality: 'Speaker', detail: 'Condition', state: 'frozen' },
      { modality: 'Speech', detail: 'Prefix', state: 'frozen' },
      { modality: 'Speech', detail: 'Continuation', state: 'denoised' }
    ]
  },
  {
    id: 'tts-vc', short: 'Speaker', title: 'Speaker realization', kicker: 'Voice conditioned',
    description: 'Render the same sentence in voices specified by held-out speaker references.',
    sequence: [
      { modality: 'Text', detail: 'Condition', state: 'frozen' },
      { modality: 'Speaker', detail: 'Reference', state: 'frozen' },
      { modality: 'Speech', detail: 'Generated', state: 'denoised' }
    ]
  }
];

const contentRoot = document.querySelector('#speech-content');
const taskNav = document.querySelector('#task-nav');
const processMap = document.querySelector('#process-map');
let activeTask = speechTasks[0].id;

function decodeBase64Utf8(encoded) {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function renderProcessMap(task) {
  const sequence = task.sequence.map((segment, index) => `
    <div class="sequence-segment is-${segment.state}">
      <span class="sequence-index">${String(index + 1).padStart(2, '0')}</span>
      <strong>${segment.modality}</strong>
      <small>${segment.detail}</small>
    </div>`).join('');

  processMap.setAttribute('aria-label', `${task.title}: serialized model sequence with frozen parts in blue and noised then denoised parts in red`);
  processMap.innerHTML = `
    <div class="process-map-header">
      <span>Model sequence</span>
      <span class="process-legend"><i class="legend-frozen"></i> Frozen <i class="legend-denoised"></i> Noised → denoised</span>
    </div>
    <div class="model-sequence">${sequence}</div>`;
}

function setActiveTask(id) {
  activeTask = id;
  const task = speechTasks.find(item => item.id === id);
  if (!task) return;

  taskNav.querySelectorAll('.task-button').forEach(button => {
    const selected = button.dataset.task === id;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });

  contentRoot.querySelectorAll('.speech-task-panel').forEach(panel => {
    panel.hidden = panel.dataset.speechTask !== id;
  });

  document.querySelector('#task-kicker').textContent = task.kicker;
  document.querySelector('#task-title').textContent = task.title;
  document.querySelector('#task-description').textContent = task.description;
  renderProcessMap(task);
}

function wireDatasetTabs(section) {
  section.querySelectorAll('.tab-btn').forEach(button => {
    button.setAttribute('type', 'button');
    button.addEventListener('click', () => {
      const { task, model } = button.dataset;
      section.querySelectorAll(`.tab-btn[data-task="${task}"]`).forEach(item => item.classList.toggle('active', item === button));
      section.querySelectorAll(`.model-panel[data-task="${task}"]`).forEach(panel => {
        panel.hidden = panel.dataset.model !== model;
      });
      updateSampleCounts();
    });
  });
}

function updateSampleCounts() {
  contentRoot.querySelectorAll('.model-panel').forEach(panel => {
    let footer = panel.querySelector('.sample-footer');
    if (!footer) {
      footer = document.createElement('div');
      footer.className = 'sample-footer';
      footer.innerHTML = '<span class="sample-count"></span><span>Audio · WAV</span>';
      panel.append(footer);
    }
    const rowCount = panel.querySelectorAll('tbody tr').length;
    footer.querySelector('.sample-count').textContent = `${rowCount} sample${rowCount === 1 ? '' : 's'}`;
  });
}

function loadSpeechResults() {
  speechTasks.forEach((task, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'task-button';
    button.dataset.task = task.id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(index === 0));
    button.innerHTML = `<span>0${index + 1}</span>${task.short}`;
    button.addEventListener('click', () => setActiveTask(task.id));
    taskNav.append(button);
  });

  taskNav.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    const direction = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1;
    const current = speechTasks.findIndex(task => task.id === activeTask);
    const next = speechTasks[(current + direction + speechTasks.length) % speechTasks.length];
    setActiveTask(next.id);
    taskNav.querySelector(`[data-task="${next.id}"]`).focus();
  });

  try {
    if (!window.SPEECH_RESULTS_BASE64) throw new Error('Bundled speech results are unavailable.');
    const legacyMarkup = decodeBase64Utf8(window.SPEECH_RESULTS_BASE64);
    const legacyDocument = new DOMParser().parseFromString(legacyMarkup, 'text/html');
    const fragment = document.createDocumentFragment();

    speechTasks.forEach((task, index) => {
      const sourceSection = legacyDocument.querySelector(`main > section#${CSS.escape(task.id)}`);
      if (!sourceSection) return;
      const section = document.importNode(sourceSection, true);
      section.removeAttribute('id');
      section.className = 'speech-task-panel';
      section.dataset.speechTask = task.id;
      section.hidden = index !== 0;
      wireDatasetTabs(section);
      fragment.append(section);
    });

    contentRoot.replaceChildren(fragment);
    updateSampleCounts();
    setActiveTask(activeTask);
  } catch (error) {
    contentRoot.innerHTML = `<div class="error-state"><p>Speech samples could not be loaded.</p><p>Make sure <code>speech-data.js</code> is beside <code>index.html</code>.</p><a href="old_index.html">Open the legacy results page →</a></div>`;
    console.error(error);
  }
}

loadSpeechResults();

const experimentTasks = {
  mnist: [
    {
      id: 'imageToText', short: 'Image → text', title: 'Image-to-text', kicker: 'Image conditioned',
      description: 'Read four supplied digits and generate their exact equation and sum.',
      fields: 'image, target, prediction, split, correct',
      sequence: [
        { modality: 'Equation', detail: 'Generated', state: 'denoised' },
        { modality: 'Image', detail: 'Condition', state: 'frozen' }
      ]
    },
    {
      id: 'textToImage', short: 'Text → image', title: 'Text-to-image', kicker: 'Equation conditioned',
      description: 'Keep the equation fixed and generate a matching 2×2 grid of handwritten digits.',
      fields: 'prompt, image, predictedDigits, correct',
      sequence: [
        { modality: 'Equation', detail: 'Condition', state: 'frozen' },
        { modality: 'Image', detail: 'Generated', state: 'denoised' }
      ]
    },
    {
      id: 'joint', short: 'Joint', title: 'Joint generation', kicker: 'Unconditional',
      description: 'Generate the handwritten digits and a mutually consistent equation together from noise.',
      fields: 'image, equation, consistent, split',
      sequence: [
        { modality: 'Equation', detail: 'Generated', state: 'denoised' },
        { modality: 'Image', detail: 'Generated', state: 'denoised' }
      ]
    }
  ],
  protein: [
    {
      id: 'forwardFolding', short: 'Forward folding', title: 'Forward folding', kicker: 'Sequence conditioned',
      description: 'Keep the amino-acid sequence fixed and generate its structure codes.',
      fields: 'sequence, structureImage, length, tmScore, caption',
      sequence: [
        { modality: 'Amino acid', detail: '5 bits · condition', state: 'frozen' },
        { modality: 'Structure', detail: '13 bits · generated', state: 'denoised' }
      ]
    },
    {
      id: 'inverseFolding', short: 'Inverse folding', title: 'Inverse folding', kicker: 'Structure conditioned',
      description: 'Keep the backbone representation fixed and generate a compatible amino-acid sequence.',
      fields: 'structureImage, targetSequence, prediction, recovery, length',
      sequence: [
        { modality: 'Amino acid', detail: '5 bits · generated', state: 'denoised' },
        { modality: 'Structure', detail: '13 bits · condition', state: 'frozen' }
      ]
    },
    {
      id: 'joint', short: 'Joint', title: 'Joint generation', kicker: 'Unconditional',
      description: 'Generate an amino-acid sequence and its residue-aligned structure representation together.',
      fields: 'sequence, structureImage, length, scTM, scRMSD, pLDDT',
      sequence: [
        { modality: 'Amino acid', detail: '5 bits · generated', state: 'denoised' },
        { modality: 'Structure', detail: '13 bits · generated', state: 'denoised' }
      ]
    }
  ]
};

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function renderExperimentProcessMap(element, task) {
  const sequence = task.sequence.map((segment, index) => `
    <div class="sequence-segment is-${segment.state}">
      <span class="sequence-index">${String(index + 1).padStart(2, '0')}</span>
      <strong>${segment.modality}</strong>
      <small>${segment.detail}</small>
    </div>`).join('');

  element.setAttribute('aria-label', `${task.title}: frozen parts are blue and generated parts are red`);
  element.innerHTML = `
    <div class="process-map-header">
      <span>Model sequence</span>
      <span class="process-legend"><i class="legend-frozen"></i> Frozen <i class="legend-denoised"></i> Noised → denoised</span>
    </div>
    <div class="model-sequence">${sequence}</div>`;
}

function emptySampleState(experiment) {
  const label = experiment === 'mnist' ? 'MNIST-SUM' : 'protein';
  return `<div class="sample-empty"><p>Import ${label} samples here</p></div>`;
}

function metricPill(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return `<span>${escapeHTML(label)} ${escapeHTML(value)}</span>`;
}

function renderMnistSample(sample, taskId, index) {
  const image = sample.image
    ? `<div class="sample-visual is-mnist"><img src="${escapeHTML(sample.image)}" alt="MNIST-SUM sample ${index + 1}" loading="lazy"></div>`
    : '';
  let title = sample.prediction || sample.prompt || sample.equation || `Sample ${index + 1}`;
  let detail = '';
  if (taskId === 'imageToText' && sample.target) detail = `Target: ${sample.target}`;
  if (taskId === 'textToImage' && sample.predictedDigits) detail = `Read back as: ${sample.predictedDigits}`;
  if (taskId === 'joint') detail = sample.consistent === false ? 'Inconsistent pair' : 'Mutually consistent pair';
  const failed = sample.correct === false || sample.consistent === false;
  const passed = sample.correct === true || sample.consistent === true;
  const status = failed ? 'Review' : passed ? 'Correct' : '';

  return `
    <article class="sample-card">
      ${image}
      <div class="sample-card-body">
        <p class="sample-card-kicker">${escapeHTML(sample.split || 'Evaluation')} · ${String(index + 1).padStart(2, '0')}</p>
        <h4>${escapeHTML(title)}</h4>
        ${detail ? `<p>${escapeHTML(detail)}</p>` : ''}
        ${status ? `<div class="sample-metrics"><span class="sample-status">${status}</span></div>` : ''}
      </div>
    </article>`;
}

function renderProteinSample(sample, taskId, index) {
  const image = sample.structureImage
    ? `<div class="sample-visual"><img src="${escapeHTML(sample.structureImage)}" alt="Protein structure sample ${index + 1}" loading="lazy"></div>`
    : '';
  const sequence = sample.sequence || sample.prediction || '';
  const target = taskId === 'inverseFolding' && sample.targetSequence
    ? `<p class="protein-sequence"><strong>Target</strong><br>${escapeHTML(sample.targetSequence)}</p>`
    : '';
  const metrics = [
    metricPill('L', sample.length),
    metricPill('TM', sample.tmScore),
    metricPill('Recovery', sample.recovery),
    metricPill('scTM', sample.scTM),
    metricPill('scRMSD', sample.scRMSD),
    metricPill('pLDDT', sample.pLDDT)
  ].join('');

  return `
    <article class="sample-card">
      ${image}
      <div class="sample-card-body">
        <p class="sample-card-kicker">Protein · ${String(index + 1).padStart(2, '0')}</p>
        <h4>${escapeHTML(sample.caption || `${taskId === 'joint' ? 'Joint design' : 'Evaluation sample'}`)}</h4>
        ${sequence ? `<p class="protein-sequence">${escapeHTML(sequence)}</p>` : ''}
        ${target}
        ${metrics ? `<div class="sample-metrics">${metrics}</div>` : ''}
      </div>
    </article>`;
}

function setupExperimentBrowser(experiment) {
  const tasks = experimentTasks[experiment];
  const nav = document.querySelector(`#${experiment}-task-nav`);
  const process = document.querySelector(`#${experiment}-process-map`);
  const samplesRoot = document.querySelector(`#${experiment}-samples`);
  if (!tasks || !nav || !process || !samplesRoot) return;

  let activeId = tasks[0].id;

  function selectTask(id, moveFocus = false) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    activeId = id;
    nav.querySelectorAll('.task-button').forEach(button => {
      const selected = button.dataset.task === id;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    document.querySelector(`#${experiment}-task-kicker`).textContent = task.kicker;
    document.querySelector(`#${experiment}-task-title`).textContent = task.title;
    document.querySelector(`#${experiment}-task-description`).textContent = task.description;
    renderExperimentProcessMap(process, task);

    const samples = window.EXPERIMENT_SAMPLES?.[experiment]?.[id] || [];
    if (!samples.length) {
      samplesRoot.innerHTML = emptySampleState(experiment, task);
    } else {
      const renderer = experiment === 'mnist' ? renderMnistSample : renderProteinSample;
      samplesRoot.innerHTML = `<div class="sample-grid">${samples.map((sample, index) => renderer(sample, id, index)).join('')}</div>`;
    }
    if (moveFocus) nav.querySelector(`[data-task="${id}"]`)?.focus();
  }

  tasks.forEach((task, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'task-button';
    button.dataset.task = task.id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(index === 0));
    button.innerHTML = `<span>0${index + 1}</span>${task.short}`;
    button.addEventListener('click', () => selectTask(task.id));
    nav.append(button);
  });

  nav.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    const direction = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1;
    const current = tasks.findIndex(task => task.id === activeId);
    const next = tasks[(current + direction + tasks.length) % tasks.length];
    selectTask(next.id, true);
  });

  selectTask(activeId);
}

setupExperimentBrowser('mnist');
setupExperimentBrowser('protein');
